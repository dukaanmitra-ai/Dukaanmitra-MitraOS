import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
  mapShopDoc,
  normalizeFirestoreError,
} from "./mappers";
import {
  AdapterError,
  type AuthSession,
  type ShopMetrics,
  type ShopProfile,
  type ShopProfileUpdatePatch,
  type SubscriptionCallbacks,
} from "./types";

/**
 * Reads `shops/{shopId}` after validating session membership/ownership.
 */
export async function getShop(
  shopId: string,
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<ShopProfile> {
  assertShopAccess(session, shopId);
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const snap = await getDoc(doc(firestore, "shops", shopId));
    if (!snap.exists()) {
      throw new AdapterError(
        "NOT_FOUND",
        `Shop "${shopId}" was not found.`,
        { details: { shopId } },
      );
    }
    return mapShopDoc(snap.id, snap.data());
  } catch (error) {
    throw normalizeFirestoreError(error, `Failed to load shop "${shopId}".`);
  }
}

/**
 * Reads the shop bound strictly to the authenticated session's `users/{uid}.shopId`.
 */
export async function getCurrentUserShop(
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<ShopProfile> {
  if (!session) {
    throw new AdapterError(
      "UNAUTHENTICATED",
      "Authentication required to load your shop.",
    );
  }
  if (!session.shopId) {
    throw new AdapterError(
      "NOT_FOUND",
      "No shop is currently linked to your account. Complete shop onboarding first.",
    );
  }
  return getShop(session.shopId, session, deps);
}

/**
 * Updates whitelisted merchant profile fields on `shops/{shopId}`.
 * Restricted strictly to shop `owner` (or `super_admin`).
 * Never allows client mutation of `owner_id`, `plan`, `status`, `paid_till`, `mrr`, or `impact_metrics`.
 */
export async function updateShopProfile(
  shopId: string,
  patch: ShopProfileUpdatePatch,
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<void> {
  assertNotDemoWrite(shopId, "updateShopProfile");
  assertShopAccess(session, shopId, { requireOwner: true });

  const payload: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new AdapterError(
        "INVALID_INPUT",
        "Shop name must be between 2 and 100 characters.",
      );
    }
    payload.name = trimmed;
  }
  if (patch.phone !== undefined) {
    const trimmed = patch.phone.trim();
    if (trimmed.length < 10 || trimmed.length > 20) {
      throw new AdapterError("INVALID_INPUT", "Please provide a valid shop phone number.");
    }
    payload.phone = trimmed;
  }
  if (patch.whatsapp !== undefined) payload.whatsapp = patch.whatsapp.trim();
  if (patch.ownerName !== undefined) payload.owner_name = patch.ownerName.trim();
  if (patch.address !== undefined) payload.address = patch.address.trim();
  if (patch.city !== undefined) payload.city = patch.city.trim();
  if (patch.state !== undefined) payload.state = patch.state.trim();
  if (patch.pincode !== undefined) payload.pincode = patch.pincode.trim();

  if (patch.settings !== undefined) {
    const settingsPayload: Record<string, unknown> = {};
    if (patch.settings.language !== undefined) {
      settingsPayload.language = patch.settings.language;
    }
    if (patch.settings.currency !== undefined) {
      settingsPayload.currency = patch.settings.currency;
    }
    if (patch.settings.timezone !== undefined) {
      settingsPayload.timezone = patch.settings.timezone;
    }
    if (patch.settings.allowCredit !== undefined) {
      settingsPayload.allow_credit = patch.settings.allowCredit;
    }
    if (patch.settings.creditLimitPerTransaction !== undefined) {
      if (
        !Number.isFinite(patch.settings.creditLimitPerTransaction) ||
        patch.settings.creditLimitPerTransaction < 0
      ) {
        throw new AdapterError(
          "INVALID_INPUT",
          "Credit limit per transaction must be a non-negative number.",
        );
      }
      settingsPayload.credit_limit_per_transaction =
        patch.settings.creditLimitPerTransaction;
    }
    if (patch.settings.workingHours !== undefined) {
      settingsPayload.working_hours = patch.settings.workingHours;
    }
    payload.settings = settingsPayload;
  }

  if (Object.keys(payload).length === 0) {
    throw new AdapterError(
      "INVALID_INPUT",
      "At least one editable shop profile field must be provided.",
    );
  }

  payload.updated_at = serverTimestamp();

  const firestore = deps.firestore ?? getFirebaseDb();
  try {
    await updateDoc(doc(firestore, "shops", shopId), payload);
  } catch (error) {
    throw normalizeFirestoreError(error, `Failed to update shop "${shopId}".`);
  }
}

/**
 * Computes verified operational shop metrics from `shops/{shopId}` and
 * `shops/{shopId}/customers` without inventing missing fields.
 */
export async function getShopMetrics(
  shopId: string,
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<ShopMetrics> {
  assertShopAccess(session, shopId);
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const [shop, customersSnap] = await Promise.all([
      getShop(shopId, session, { firestore }),
      getDocs(collection(firestore, "shops", shopId, "customers")),
    ]);

    let totalUdhaarOutstanding = 0;
    let pendingCustomersCount = 0;

    for (const cDoc of customersSnap.docs) {
      const customer = mapCustomerDoc(cDoc.id, shopId, cDoc.data());
      if (customer.balance > 0) {
        totalUdhaarOutstanding += customer.balance;
        pendingCustomersCount += 1;
      }
    }

    return {
      shopId,
      totalRecoveryInr: shop.impactMetrics.totalRecoveryInr,
      totalEntries: shop.impactMetrics.totalEntries,
      totalUdhaarOutstanding,
      pendingCustomersCount,
      totalCustomersCount: customersSnap.size,
    };
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to compute metrics for shop "${shopId}".`,
    );
  }
}

/**
 * Subscribes in real time to `shops/{shopId}` after validating session access.
 */
export function subscribeShop(
  shopId: string,
  session: AuthSession | null | undefined,
  callbacks: SubscriptionCallbacks<ShopProfile>,
  deps: { firestore?: Firestore } = {},
): Unsubscribe {
  try {
    assertShopAccess(session, shopId);
    const firestore = deps.firestore ?? getFirebaseDb();

    return onSnapshot(
      doc(firestore, "shops", shopId),
      (snap) => {
        if (!snap.exists()) {
          callbacks.onError(
            new AdapterError("NOT_FOUND", `Shop "${shopId}" was not found.`),
          );
          return;
        }
        try {
          callbacks.onData(mapShopDoc(snap.id, snap.data()));
        } catch (mappingErr) {
          callbacks.onError(
            normalizeFirestoreError(mappingErr, "Invalid shop document schema."),
          );
        }
      },
      (err) => {
        callbacks.onError(
          normalizeFirestoreError(err, `Lost subscription to shop "${shopId}".`),
        );
      },
    );
  } catch (error) {
    callbacks.onError(normalizeFirestoreError(error, "Cannot subscribe to shop."));
    return () => {};
  }
}
