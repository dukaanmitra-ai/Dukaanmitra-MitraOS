import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "../../firebase";
import { assertShopAccess } from "./authAdapter";
import { mapInsightDoc, normalizeFirestoreError } from "./mappers";
import type {
  AuthSession,
  CanonicalInsight,
  SubscriptionCallbacks,
} from "./types";

/**
 * Read-only retrieval of verified shop insights from `shops/{shopId}/insights`.
 */
export async function getInsights(
  shopId: string,
  session: AuthSession | null | undefined,
  options: { maxEntries?: number; firestore?: Firestore } = {},
): Promise<CanonicalInsight[]> {
  assertShopAccess(session, shopId);
  const firestore = options.firestore ?? getFirebaseDb();
  const maxEntries = options.maxEntries ?? 20;

  try {
    const q = query(
      collection(firestore, "shops", shopId, "insights"),
      orderBy("createdAt", "desc"),
      limit(maxEntries),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapInsightDoc(d.id, shopId, d.data()));
  } catch (error) {
    throw normalizeFirestoreError(
      error,
      `Failed to load insights for shop "${shopId}".`,
    );
  }
}

/**
 * Read-only real-time subscription to `shops/{shopId}/insights`.
 */
export function subscribeInsights(
  shopId: string,
  session: AuthSession | null | undefined,
  callbacks: SubscriptionCallbacks<CanonicalInsight[]>,
  options: { maxEntries?: number; firestore?: Firestore } = {},
): Unsubscribe {
  try {
    assertShopAccess(session, shopId);
    const firestore = options.firestore ?? getFirebaseDb();
    const maxEntries = options.maxEntries ?? 20;

    const q = query(
      collection(firestore, "shops", shopId, "insights"),
      orderBy("createdAt", "desc"),
      limit(maxEntries),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        try {
          const list = snapshot.docs.map((d) =>
            mapInsightDoc(d.id, shopId, d.data()),
          );
          callbacks.onData(list);
        } catch (mappingErr) {
          callbacks.onError(
            normalizeFirestoreError(mappingErr, "Invalid insight document schema."),
          );
        }
      },
      (err) => {
        callbacks.onError(
          normalizeFirestoreError(
            err,
            `Lost subscription to insights for shop "${shopId}".`,
          ),
        );
      },
    );
  } catch (error) {
    callbacks.onError(
      normalizeFirestoreError(error, "Cannot subscribe to shop insights."),
    );
    return () => {};
  }
}
