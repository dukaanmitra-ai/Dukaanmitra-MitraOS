import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "../../firebase";
import { assertAdminAccess } from "./authAdapter";
import {
  mapGlobalMetricsDoc,
  mapShopDoc,
  mapShopToAdminSummary,
  normalizeFirestoreError,
} from "./mappers";
import {
  AdapterError,
  type AdminShopSummary,
  type AuthSession,
  type GlobalAdminMetrics,
  type SubscriptionCallbacks,
} from "./types";

/**
 * Reads `metrics/global` strictly for `super_admin` or `franchise_admin`.
 * Ordinary shop owners and staff are rejected with `FORBIDDEN`.
 */
export async function getGlobalMetrics(
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<GlobalAdminMetrics | null> {
  assertAdminAccess(session);
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const snap = await getDoc(doc(firestore, "metrics", "global"));
    if (!snap.exists()) {
      return null;
    }
    return mapGlobalMetricsDoc(snap.id, snap.data());
  } catch (error) {
    throw normalizeFirestoreError(error, "Failed to load global admin metrics.");
  }
}

/**
 * Lists all platform shops from `shops` strictly for `super_admin` or `franchise_admin`.
 * Never falls back to fabricated dummy stores.
 */
export async function getAllShops(
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<AdminShopSummary[]> {
  assertAdminAccess(session);
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const snap = await getDocs(query(collection(firestore, "shops")));
    const shops = snap.docs.map((d) =>
      mapShopToAdminSummary(mapShopDoc(d.id, d.data())),
    );
    shops.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    return shops;
  } catch (error) {
    throw normalizeFirestoreError(error, "Failed to load platform shops.");
  }
}

/**
 * Real-time platform shops subscription strictly for `super_admin` or `franchise_admin`.
 * Never silently returns dummy stores when collection is empty or access fails.
 */
export function subscribePlatformShops(
  session: AuthSession | null | undefined,
  callbacks: SubscriptionCallbacks<AdminShopSummary[]>,
  deps: { firestore?: Firestore } = {},
): Unsubscribe {
  try {
    assertAdminAccess(session);
    const firestore = deps.firestore ?? getFirebaseDb();

    return onSnapshot(
      query(collection(firestore, "shops")),
      (snapshot) => {
        try {
          const shops = snapshot.docs.map((d) =>
            mapShopToAdminSummary(mapShopDoc(d.id, d.data())),
          );
          shops.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
          callbacks.onData(shops);
        } catch (mappingErr) {
          callbacks.onError(
            normalizeFirestoreError(mappingErr, "Invalid shop schema in admin stream."),
          );
        }
      },
      (err) => {
        callbacks.onError(
          normalizeFirestoreError(err, "Lost subscription to platform shops."),
        );
      },
    );
  } catch (error) {
    const normalized = normalizeFirestoreError(
      error,
      "Unauthorized admin subscription attempt.",
    );
    callbacks.onError(
      normalized instanceof AdapterError
        ? normalized
        : new AdapterError("FORBIDDEN", "Admin access required."),
    );
    return () => {};
  }
}
