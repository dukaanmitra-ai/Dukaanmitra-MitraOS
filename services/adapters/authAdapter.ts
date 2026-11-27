import {
  onAuthStateChanged,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { doc, getDoc, type Firestore } from "firebase/firestore";
import {
  auth,
  db,
  firebaseConfigStatus,
  getFirebaseAuth,
  getFirebaseDb,
  isFirebaseConfigured,
} from "../../firebase";
import {
  mapMvpRoleToLegacyRole,
  mapUserProfileDoc,
  normalizeFirestoreError,
} from "./mappers";
import {
  AdapterError,
  type AuthSession,
  type MvpRole,
  type ShopOnboardingRequest,
  type ShopOnboardingResult,
  type ShopOnboardingService,
} from "./types";

const ADMIN_ROLES = new Set<MvpRole>(["super_admin", "franchise_admin"]);

/**
 * Pure session evaluator — validates role, account status, and sessionRevokedAt
 * against Firebase ID token auth_time without touching browser globals or localStorage.
 */
export function evaluateUserSession(params: {
  uid: string;
  rawUserDoc: unknown;
  authTimeMs: number;
  fallbackEmail?: string;
  fallbackDisplayName?: string;
  fallbackPhotoURL?: string;
}): AuthSession {
  const profile = mapUserProfileDoc(
    params.uid,
    params.rawUserDoc,
    params.fallbackEmail ?? "",
  );

  if (profile.status === "suspended") {
    throw new AdapterError(
      "ACCOUNT_SUSPENDED",
      "Your account has been suspended. Please contact DukaanMitra support.",
      { details: { uid: params.uid } },
    );
  }

  if (profile.status === "pending") {
    throw new AdapterError(
      "ACCOUNT_PENDING",
      "Your account is pending activation and cannot access shop operations yet.",
      { details: { uid: params.uid } },
    );
  }

  if (
    profile.sessionRevokedAtMs !== null &&
    profile.sessionRevokedAtMs > params.authTimeMs
  ) {
    throw new AdapterError(
      "SESSION_REVOKED",
      "Your session has been revoked after a role or security update. Please sign in again.",
      {
        details: {
          uid: params.uid,
          authTimeMs: params.authTimeMs,
          sessionRevokedAtMs: profile.sessionRevokedAtMs,
        },
      },
    );
  }

  const canAccessAdmin = ADMIN_ROLES.has(profile.role);
  const canManageShop =
    profile.role === "owner" || profile.role === "super_admin";

  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName ?? params.fallbackDisplayName,
    photoURL: profile.photoURL ?? params.fallbackPhotoURL,
    role: profile.role,
    legacyRole: mapMvpRoleToLegacyRole(profile.role),
    status: profile.status,
    shopId: profile.shopId,
    authTimeMs: params.authTimeMs,
    sessionRevokedAtMs: profile.sessionRevokedAtMs,
    canManageShop,
    canAccessAdmin,
  };
}

/**
 * Enforces shop-level authorization strictly from the verified AuthSession
 * sourced from `users/{uid}`. Never trusts client-provided shopId or localStorage.
 */
export function assertShopAccess(
  session: AuthSession | null | undefined,
  targetShopId: string,
  options: { requireOwner?: boolean } = {},
): AuthSession {
  if (!session) {
    throw new AdapterError(
      "UNAUTHENTICATED",
      "Authentication is required to access shop resources.",
    );
  }

  if (session.status !== "active") {
    throw new AdapterError(
      session.status === "suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_PENDING",
      `Account status "${session.status}" cannot access shop resources.`,
    );
  }

  if (
    session.sessionRevokedAtMs !== null &&
    session.sessionRevokedAtMs > session.authTimeMs
  ) {
    throw new AdapterError(
      "SESSION_REVOKED",
      "Session has been revoked. Please sign in again.",
    );
  }

  const cleanTarget = targetShopId?.trim();
  if (!cleanTarget) {
    throw new AdapterError("INVALID_INPUT", "A valid shopId is required.");
  }

  if (session.role === "super_admin") {
    return session;
  }

  if (session.role === "franchise_admin") {
    if (options.requireOwner) {
      throw new AdapterError(
        "FORBIDDEN",
        "Only the shop owner or super admin can modify shop configuration.",
      );
    }
    return session;
  }

  if (!session.shopId || session.shopId !== cleanTarget) {
    throw new AdapterError(
      "CROSS_TENANT_DENIED",
      `Access denied: user "${session.uid}" is not authorized for shop "${cleanTarget}".`,
      { details: { uid: session.uid, targetShopId: cleanTarget } },
    );
  }

  if (options.requireOwner && session.role !== "owner") {
    throw new AdapterError(
      "FORBIDDEN",
      "Only the shop owner can perform this action.",
      { details: { role: session.role } },
    );
  }

  return session;
}

/**
 * Enforces global platform admin authorization (`super_admin` or `franchise_admin`).
 * Ordinary shop `owner` or `staff` accounts are rejected with FORBIDDEN.
 */
export function assertAdminAccess(
  session: AuthSession | null | undefined,
  options: { superAdminOnly?: boolean } = {},
): AuthSession {
  if (!session) {
    throw new AdapterError(
      "UNAUTHENTICATED",
      "Authentication is required to access admin endpoints.",
    );
  }

  if (session.status !== "active") {
    throw new AdapterError(
      session.status === "suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_PENDING",
      `Account status "${session.status}" cannot access admin controls.`,
    );
  }

  if (options.superAdminOnly && session.role !== "super_admin") {
    throw new AdapterError(
      "FORBIDDEN",
      "Super Admin privileges are required for this action.",
      { details: { role: session.role } },
    );
  }

  if (!ADMIN_ROLES.has(session.role)) {
    throw new AdapterError(
      "FORBIDDEN",
      "Platform administrator privileges are required to view global metrics.",
      { details: { role: session.role } },
    );
  }

  return session;
}

/**
 * Resolves the verified AuthSession for a Firebase Auth user by reading `users/{uid}`.
 * - Never auto-creates fake shops or seeds fake production records.
 * - Never reads localStorage role overrides.
 * - Signs out immediately if `sessionRevokedAt` invalidates the token.
 */
export async function resolveUserSession(
  firebaseUser: User,
  deps: { firestore?: Firestore; firebaseAuth?: Auth } = {},
): Promise<AuthSession> {
  const firestore = deps.firestore ?? getFirebaseDb();
  const firebaseAuth = deps.firebaseAuth ?? getFirebaseAuth();

  try {
    const [tokenResult, userSnap] = await Promise.all([
      firebaseUser.getIdTokenResult(),
      getDoc(doc(firestore, "users", firebaseUser.uid)),
    ]);

    const authTimeMs = Date.parse(tokenResult.authTime);
    if (!Number.isFinite(authTimeMs)) {
      throw new AdapterError(
        "UNAUTHENTICATED",
        "Could not determine Firebase token authentication timestamp.",
      );
    }

    if (!userSnap.exists()) {
      throw new AdapterError(
        "NOT_FOUND",
        "User profile not found in mvp1-aafa3 (users/{uid}). Please complete onboarding or contact support.",
        { details: { uid: firebaseUser.uid } },
      );
    }

    return evaluateUserSession({
      uid: firebaseUser.uid,
      rawUserDoc: userSnap.data(),
      authTimeMs,
      fallbackEmail: firebaseUser.email ?? "",
      fallbackDisplayName: firebaseUser.displayName ?? undefined,
      fallbackPhotoURL: firebaseUser.photoURL ?? undefined,
    });
  } catch (error) {
    const normalized = normalizeFirestoreError(
      error,
      "Failed to verify user session.",
    );
    if (
      normalized.code === "SESSION_REVOKED" ||
      normalized.code === "ACCOUNT_SUSPENDED"
    ) {
      await signOut(firebaseAuth).catch(() => undefined);
    }
    throw normalized;
  }
}

export interface AuthSubscriptionState {
  firebaseUser: User | null;
  session: AuthSession | null;
  loading: boolean;
  error: AdapterError | null;
}

/**
 * Subscribes to Firebase Auth state changes and resolves `users/{uid}` safely.
 * Does NOT silently downgrade auth or configuration failures to demo mode.
 */
export function subscribeAuthSession(
  onChange: (state: AuthSubscriptionState) => void,
): Unsubscribe {
  if (!isFirebaseConfigured || !auth || !db) {
    onChange({
      firebaseUser: null,
      session: null,
      loading: false,
      error: new AdapterError(
        "FIREBASE_NOT_CONFIGURED",
        firebaseConfigStatus.error ??
          "Firebase is not configured for project mvp1-aafa3.",
      ),
    });
    return () => {};
  }

  // Purge any legacy insecure localStorage demo-auth token if present.
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("dm_demo_auth");
    } catch {
      // ignore storage restrictions
    }
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      onChange({
        firebaseUser: null,
        session: null,
        loading: false,
        error: null,
      });
      return;
    }

    onChange({
      firebaseUser,
      session: null,
      loading: true,
      error: null,
    });

    try {
      const session = await resolveUserSession(firebaseUser);
      onChange({
        firebaseUser,
        session,
        loading: false,
        error: null,
      });
    } catch (error) {
      const normalized = normalizeFirestoreError(
        error,
        "Authentication verification failed.",
      );
      onChange({
        firebaseUser:
          normalized.code === "SESSION_REVOKED" ||
          normalized.code === "ACCOUNT_SUSPENDED"
            ? null
            : firebaseUser,
        session: null,
        loading: false,
        error: normalized,
      });
    }
  });
}

export async function signOutCurrentUser(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("dm_demo_auth");
    } catch {
      // ignore
    }
  }
  if (!auth) return;
  await signOut(auth);
}

/**
 * Retrieves the current user's Firebase ID token for authenticated backend HTTP APIs.
 */
export async function getCurrentIdToken(forceRefresh = false): Promise<string> {
  const firebaseAuth = getFirebaseAuth();
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) {
    throw new AdapterError(
      "UNAUTHENTICATED",
      "You must be signed in to call protected backend APIs.",
    );
  }
  return currentUser.getIdToken(forceRefresh);
}

/**
 * Server-side shop provisioning boundary (Phase 3.5).
 *
 * Calls the trusted server endpoint (`POST /api/shops/onboard`) with the caller's
 * verified Firebase ID token. Direct client writes to `users/{uid}.shopId` or
 * `shops/{shopId}` creation remain disabled to prevent tenant escalation.
 */
export const shopOnboardingService: ShopOnboardingService = {
  async createShopForCurrentUser(
    request: ShopOnboardingRequest,
  ): Promise<ShopOnboardingResult> {
    if (!isFirebaseConfigured || !auth?.currentUser) {
      throw new AdapterError(
        "SERVER_PROVISIONING_REQUIRED",
        "Shop creation requires an authenticated session and the verified server-side onboarding endpoint (/api/shops/onboard). Direct client auto-provisioning is disabled.",
      );
    }

    const idToken = await getCurrentIdToken(false);
    const response = await fetch("/api/shops/onboard", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: request.name,
        phone: request.phone,
        whatsapp: request.whatsapp,
        city: request.city,
        state: request.state,
        pincode: request.pincode,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      shopId?: string;
      error?: string;
    };

    if (!response.ok || !data.shopId) {
      throw new AdapterError(
        response.status === 401
          ? "UNAUTHENTICATED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 400
              ? "INVALID_INPUT"
              : "SERVER_PROVISIONING_REQUIRED",
        data.error || `Shop onboarding failed (HTTP ${response.status}).`,
        { statusCode: response.status },
      );
    }

    return { shopId: data.shopId };
  },
};
