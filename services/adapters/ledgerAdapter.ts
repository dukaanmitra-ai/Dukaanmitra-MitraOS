import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "../../firebase";
import { assertShopAccess } from "./authAdapter";
import { assertNotDemoWrite } from "./demoFixtures";
import {
  mapCanonicalTypeToFirestoreLedgerType,
  mapLedgerDoc,
  normalizeCustomerPhoneId,
  normalizeFirestoreError,
} from "./mappers";
import {
  AdapterError,
  type AuthSession,
  type CanonicalLedgerEntry,
  type CreateLedgerEntryInput,
  type PhoneNormalizationMode,
  type SubscriptionCallbacks,
} from "./types";

const BLOCKED_SHOP_STATUSES = new Set(["locked", "suspended", "integrity_lock"]);

/**
 * Fetches immutable credit/payment ledger entries for `shops/{shopId}/ledger`.
 */
export async function getLedger(
  shopId: string,
  session: AuthSession | null | undefined,
  options: { maxEntries?: number; firestore?: Firestore } = {},
): Promise<CanonicalLedgerEntry[]> {
  assertShopAccess(session, shopId);
  const firestore = options.firestore ?? getFirebaseDb();
  const maxEntries = options.maxEntries ?? 50;

  try {
    const ledgerRef = collection(firestore, "shops", shopId, "ledger");
    const q = query(ledgerRef, orderBy("createdAt", "desc"), limit(maxEntries));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapLedgerDoc(d.id, shopId, d.data()));
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to load ledger for shop "${shopId}".`,
    );
  }
}

/**
 * Fetches ledger entries for a specific customer under `shops/{shopId}/ledger`.
 */
export async function getCustomerLedger(
  shopId: string,
  customerPhone: string,
  session: AuthSession | null | undefined,
  options: {
    phoneMode?: PhoneNormalizationMode;
    maxEntries?: number;
    firestore?: Firestore;
  } = {},
): Promise<CanonicalLedgerEntry[]> {
  assertShopAccess(session, shopId);
  const normalizedPhone = normalizeCustomerPhoneId(
    customerPhone,
    options.phoneMode,
  );
  const firestore = options.firestore ?? getFirebaseDb();
  const maxEntries = options.maxEntries ?? 50;

  try {
    const ledgerRef = collection(firestore, "shops", shopId, "ledger");
    const q = query(
      ledgerRef,
      where("customerPhone", "==", normalizedPhone),
      limit(maxEntries),
    );
    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => mapLedgerDoc(d.id, shopId, d.data()));
    entries.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return entries;
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to load ledger for customer "${normalizedPhone}".`,
    );
  }
}

/**
 * Atomically appends an immutable credit (`udhaar`) or recovery (`payment`) entry
 * to `shops/{shopId}/ledger/{ledgerId}` and updates `shops/{shopId}/customers/{customerPhone}`.
 *
 * IMPORTANT BOUNDARY:
 * - Cash POS sales (`type: 'sale'`) are strictly rejected with `CASH_SALE_REQUIRES_POS_API`
 *   and must be routed through `coreEnginePosClient.recordCashSale()` (`apps/core-engine` `POST /api/sales`).
 *   They are NEVER silently coerced into `credit` (udhaar) or `payment`.
 * - Ledger entries are immutable (`firestore.rules:131` denies update/delete).
 */
export async function createLedgerEntry(
  shopId: string,
  input: CreateLedgerEntryInput,
  session: AuthSession | null | undefined,
  options: { phoneMode?: PhoneNormalizationMode; firestore?: Firestore } = {},
): Promise<CanonicalLedgerEntry> {
  assertNotDemoWrite(shopId, "createLedgerEntry");
  const verifiedSession = assertShopAccess(session, shopId);

  // Strictly enforces credit/payment only; throws CASH_SALE_REQUIRES_POS_API for 'sale'
  const firestoreType = mapCanonicalTypeToFirestoreLedgerType(input.type);

  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AdapterError(
      "INVALID_INPUT",
      "Ledger entry amount must be a positive finite number.",
    );
  }

  const normalizedPhone = normalizeCustomerPhoneId(
    input.customerPhone,
    options.phoneMode,
  );
  const cleanItem = (input.item ?? "Saman").trim() || "Saman";
  const source = input.source ?? "app";
  const firestore = options.firestore ?? getFirebaseDb();

  try {
    const shopRef = doc(firestore, "shops", shopId);
    const customerRef = doc(
      firestore,
      "shops",
      shopId,
      "customers",
      normalizedPhone,
    );
    const ledgerRef = doc(collection(firestore, "shops", shopId, "ledger"));
    const entryId = ledgerRef.id;

    const resolvedCustomerName = await runTransaction(firestore, async (tx) => {
      const shopSnap = await tx.get(shopRef);
      if (!shopSnap.exists()) {
        throw new AdapterError("NOT_FOUND", `Shop "${shopId}" was not found.`);
      }

      const shopStatus = String(shopSnap.data()?.status ?? "active");
      if (BLOCKED_SHOP_STATUSES.has(shopStatus)) {
        throw new AdapterError(
          "SHOP_LOCKED",
          `Cannot record ledger entry while shop status is "${shopStatus}".`,
        );
      }

      const customerSnap = await tx.get(customerRef);
      const existingData = customerSnap.exists() ? customerSnap.data() : null;
      const customerName =
        input.customerName?.trim() ||
        (typeof existingData?.name === "string" && existingData.name.trim()) ||
        `Grahak ${normalizedPhone.slice(-4)}`;

      const udhaarDelta = firestoreType === "credit" ? input.amount : -input.amount;

      // 1. Append immutable ledger entry (shop_id must match path shopId per firestore.rules)
      tx.set(ledgerRef, {
        id: entryId,
        shop_id: shopId,
        actorId: verifiedSession.uid,
        customerPhone: normalizedPhone,
        customerName,
        amount: input.amount,
        item: cleanItem,
        type: firestoreType,
        source,
        createdAt: serverTimestamp(),
      });

      // 2. Atomically maintain customer memory & udhaar balance inside the same transaction
      if (!customerSnap.exists()) {
        tx.set(customerRef, {
          shop_id: shopId,
          phone: normalizedPhone,
          name: customerName,
          totalUdhaar: udhaarDelta,
          total_spent: input.amount,
          visit_count: 1,
          status: "NEW",
          first_visit: serverTimestamp(),
          last_visit: serverTimestamp(),
          ...(firestoreType === "payment"
            ? { lastPaymentDate: serverTimestamp(), reminderCount: 0 }
            : {}),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      } else {
        const nextVisits =
          (typeof existingData?.visit_count === "number"
            ? existingData.visit_count
            : 0) + 1;
        const nextStatus = nextVisits >= 5 ? "LOYAL" : "REGULAR";

        tx.update(customerRef, {
          totalUdhaar: increment(udhaarDelta),
          total_spent: increment(input.amount),
          visit_count: increment(1),
          status: nextStatus,
          last_visit: serverTimestamp(),
          updated_at: serverTimestamp(),
          ...(firestoreType === "payment"
            ? { lastPaymentDate: serverTimestamp(), reminderCount: 0 }
            : {}),
        });
      }

      return customerName;
    });

    return {
      id: entryId,
      shopId,
      customerPhone: normalizedPhone,
      customerName: resolvedCustomerName,
      amount: input.amount,
      item: cleanItem,
      type: input.type,
      source,
      createdAtMs: Date.now(),
      actorId: verifiedSession.uid,
    };
  } catch (error) {
    throw normalizeFirestoreError(error, "Failed to create ledger entry.");
  }
}

/**
 * Ledger entries in `mvp1-aafa3` (`shops/{shopId}/ledger`) are strictly immutable.
 * Always throws `LEDGER_IMMUTABLE` rather than attempting disallowed mutations.
 */
export async function updateLedgerEntry(
  shopId: string,
  ledgerId: string,
): Promise<never> {
  throw new AdapterError(
    "LEDGER_IMMUTABLE",
    `Cannot modify immutable ledger entry "${ledgerId}" in shop "${shopId}". Record a compensating entry instead.`,
    { details: { shopId, ledgerId } },
  );
}

/**
 * Ledger entries in `mvp1-aafa3` (`shops/{shopId}/ledger`) cannot be deleted.
 * Always throws `LEDGER_IMMUTABLE`.
 */
export async function deleteLedgerEntry(
  shopId: string,
  ledgerId: string,
): Promise<never> {
  throw new AdapterError(
    "LEDGER_IMMUTABLE",
    `Cannot delete immutable ledger entry "${ledgerId}" in shop "${shopId}". Record a compensating entry instead.`,
    { details: { shopId, ledgerId } },
  );
}

/**
 * Subscribes in real time to `shops/{shopId}/ledger`.
 */
export function subscribeLedger(
  shopId: string,
  session: AuthSession | null | undefined,
  callbacks: SubscriptionCallbacks<CanonicalLedgerEntry[]>,
  options: { maxEntries?: number; firestore?: Firestore } = {},
): Unsubscribe {
  try {
    assertShopAccess(session, shopId);
    const firestore = options.firestore ?? getFirebaseDb();
    const maxEntries = options.maxEntries ?? 25;

    const q = query(
      collection(firestore, "shops", shopId, "ledger"),
      orderBy("createdAt", "desc"),
      limit(maxEntries),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const entries = snapshot.docs.map((d) =>
            mapLedgerDoc(d.id, shopId, d.data()),
          );
          entries.sort((a, b) => b.createdAtMs - a.createdAtMs);
          callbacks.onData(entries);
        } catch (mappingErr) {
          callbacks.onError(
            normalizeFirestoreError(
              mappingErr,
              "Invalid ledger entry document schema.",
            ),
          );
        }
      },
      (err) => {
        callbacks.onError(
          normalizeFirestoreError(
            err,
            `Lost subscription to ledger for shop "${shopId}".`,
          ),
        );
      },
    );
  } catch (error) {
    callbacks.onError(
      normalizeFirestoreError(error, "Cannot subscribe to ledger."),
    );
    return () => {};
  }
}
