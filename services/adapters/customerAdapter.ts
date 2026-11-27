import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "../../firebase";
import { assertShopAccess } from "./authAdapter";
import { assertNotDemoWrite } from "./demoFixtures";
import {
  mapCustomerDoc,
  normalizeCustomerPhoneId,
  normalizeCustomerStatus,
  normalizeFirestoreError,
} from "./mappers";
import {
  AdapterError,
  type AuthSession,
  type CanonicalCustomer,
  type CreateCustomerInput,
  type PhoneNormalizationMode,
  type SubscriptionCallbacks,
  type UpdateCustomerProfilePatch,
} from "./types";

const FORBIDDEN_BALANCE_FIELDS = new Set([
  "balance",
  "totalUdhaar",
  "total_spent",
  "totalSpent",
  "visit_count",
  "visitCount",
]);

/**
 * Fetches all customers under `shops/{shopId}/customers`, sorted by highest udhaar balance first.
 */
export async function getCustomers(
  shopId: string,
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<CanonicalCustomer[]> {
  assertShopAccess(session, shopId);
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const snap = await getDocs(collection(firestore, "shops", shopId, "customers"));
    const customers = snap.docs.map((d) => mapCustomerDoc(d.id, shopId, d.data()));
    customers.sort((a, b) => b.balance - a.balance);
    return customers;
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to load customers for shop "${shopId}".`,
    );
  }
}

/**
 * Fetches a single customer document from `shops/{shopId}/customers/{customerId}`.
 */
export async function getCustomer(
  shopId: string,
  customerId: string,
  session: AuthSession | null | undefined,
  options: { phoneMode?: PhoneNormalizationMode; firestore?: Firestore } = {},
): Promise<CanonicalCustomer> {
  assertShopAccess(session, shopId);
  const normalizedId = normalizeCustomerPhoneId(customerId, options.phoneMode);
  const firestore = options.firestore ?? getFirebaseDb();

  try {
    const snap = await getDoc(
      doc(firestore, "shops", shopId, "customers", normalizedId),
    );
    if (!snap.exists()) {
      throw new AdapterError(
        "NOT_FOUND",
        `Customer "${normalizedId}" was not found in shop "${shopId}".`,
      );
    }
    return mapCustomerDoc(snap.id, shopId, snap.data());
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to fetch customer "${normalizedId}".`,
    );
  }
}

/**
 * Creates a new customer document at `shops/{shopId}/customers/{normalizedPhone}`
 * without overwriting an existing customer or allowing arbitrary initial balances.
 */
export async function createCustomer(
  shopId: string,
  input: CreateCustomerInput,
  session: AuthSession | null | undefined,
  options: { phoneMode?: PhoneNormalizationMode; firestore?: Firestore } = {},
): Promise<CanonicalCustomer> {
  assertNotDemoWrite(shopId, "createCustomer");
  assertShopAccess(session, shopId);

  const cleanName = typeof input?.name === "string" ? input.name.trim() : "";
  if (cleanName.length < 2 || cleanName.length > 100) {
    throw new AdapterError(
      "INVALID_INPUT",
      "Customer name must be between 2 and 100 characters.",
    );
  }

  const normalizedPhone = normalizeCustomerPhoneId(
    input?.phone ?? "",
    options.phoneMode,
  );
  const firestore = options.firestore ?? getFirebaseDb();

  try {
    const customerRef = doc(
      firestore,
      "shops",
      shopId,
      "customers",
      normalizedPhone,
    );

    await runTransaction(firestore, async (tx) => {
      const existing = await tx.get(customerRef);
      if (existing.exists()) {
        throw new AdapterError(
          "INVALID_INPUT",
          `Customer with phone "${normalizedPhone}" already exists in this shop.`,
        );
      }

      tx.set(customerRef, {
        shop_id: shopId,
        phone: normalizedPhone,
        name: cleanName,
        totalUdhaar: 0,
        total_spent: 0,
        visit_count: 0,
        status: "NEW",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    });

    const now = Date.now();
    return {
      id: normalizedPhone,
      shopId,
      phone: normalizedPhone,
      name: cleanName,
      balance: 0,
      totalSpent: 0,
      visitCount: 0,
      status: "NEW",
      firstVisitMs: null,
      lastVisitMs: null,
      lastPaymentDateMs: null,
      lastReminderSentAtMs: null,
      reminderCount: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };
  } catch (error) {
    throw normalizeFirestoreError(error, "Failed to create customer.");
  }
}

/**
 * Updates ordinary customer profile fields (`name`, `status`).
 * Explicitly blocks any attempt to mutate financial balance fields directly.
 */
export async function updateCustomer(
  shopId: string,
  customerId: string,
  patch: UpdateCustomerProfilePatch & Record<string, unknown>,
  session: AuthSession | null | undefined,
  options: { phoneMode?: PhoneNormalizationMode; firestore?: Firestore } = {},
): Promise<void> {
  assertNotDemoWrite(shopId, "updateCustomer");
  assertShopAccess(session, shopId);

  if (!patch || typeof patch !== "object") {
    throw new AdapterError("INVALID_INPUT", "Customer update payload must be an object.");
  }

  for (const key of Object.keys(patch)) {
    if (FORBIDDEN_BALANCE_FIELDS.has(key)) {
      throw new AdapterError(
        "FORBIDDEN",
        `Field "${key}" cannot be modified through ordinary customer profile updates. Use immutable ledger entries to change customer balances.`,
        { details: { forbiddenField: key } },
      );
    }
  }

  const normalizedId = normalizeCustomerPhoneId(customerId, options.phoneMode);
  const payload: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const cleanName = typeof patch.name === "string" ? patch.name.trim() : "";
    if (cleanName.length < 2 || cleanName.length > 100) {
      throw new AdapterError(
        "INVALID_INPUT",
        "Customer name must be between 2 and 100 characters.",
      );
    }
    payload.name = cleanName;
  }

  if (patch.status !== undefined) {
    payload.status = normalizeCustomerStatus(patch.status);
  }

  if (Object.keys(payload).length === 0) {
    throw new AdapterError(
      "INVALID_INPUT",
      "Provide at least one editable customer profile field (name or status).",
    );
  }

  payload.updated_at = serverTimestamp();

  const firestore = options.firestore ?? getFirebaseDb();
  try {
    await updateDoc(
      doc(firestore, "shops", shopId, "customers", normalizedId),
      payload,
    );
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to update customer "${normalizedId}".`,
    );
  }
}

/**
 * Subscribes in real time to `shops/{shopId}/customers`.
 */
export function subscribeCustomers(
  shopId: string,
  session: AuthSession | null | undefined,
  callbacks: SubscriptionCallbacks<CanonicalCustomer[]>,
  deps: { firestore?: Firestore } = {},
): Unsubscribe {
  try {
    assertShopAccess(session, shopId);
    const firestore = deps.firestore ?? getFirebaseDb();

    return onSnapshot(
      collection(firestore, "shops", shopId, "customers"),
      (snapshot) => {
        try {
          const list = snapshot.docs.map((d) =>
            mapCustomerDoc(d.id, shopId, d.data()),
          );
          list.sort((a, b) => b.balance - a.balance);
          callbacks.onData(list);
        } catch (mappingErr) {
          callbacks.onError(
            normalizeFirestoreError(
              mappingErr,
              "Invalid customer document schema.",
            ),
          );
        }
      },
      (err) => {
        callbacks.onError(
          normalizeFirestoreError(
            err,
            `Lost subscription to customers for shop "${shopId}".`,
          ),
        );
      },
    );
  } catch (error) {
    callbacks.onError(
      normalizeFirestoreError(error, "Cannot subscribe to customers."),
    );
    return () => {};
  }
}
