import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { MvpRole } from "../../services/adapters/types";
import { getFirebaseAdmin, ServerSecurityError } from "./firebaseAdmin";
import { recordSecurityAudit, sendSafeError, type AuditSink } from "./guards";

export interface AuthoritativeUserDoc {
  uid?: string;
  email?: string;
  role?: string;
  status?: string;
  shopId?: string | null;
  sessionRevokedAt?: unknown;
}

/**
 * Trusted server-side authentication context populated ONLY after
 * Firebase Admin ID token verification + authoritative `users/{uid}` lookup.
 * Never populated from request.body or unverified client headers.
 */
export interface ServerAuthContext {
  readonly uid: string;
  readonly email: string;
  readonly role: MvpRole;
  readonly status: "active" | "pending" | "suspended";
  readonly shopId: string | null;
  readonly authTimeMs: number;
  readonly sessionRevokedAtMs: number | null;
  readonly tokenClaims: Readonly<Record<string, unknown>>;
}

export interface AuthenticatedRequest extends Request {
  authContext?: ServerAuthContext;
  rawBody?: Buffer;
}

export interface AuthVerificationDeps {
  verifyIdToken: (idToken: string, checkRevoked: boolean) => Promise<DecodedIdToken>;
  loadUserProfile: (uid: string) => Promise<AuthoritativeUserDoc | null>;
  auditSink?: AuditSink;
  nowMs?: () => number;
}

const ALLOWED_ROLES = new Set<MvpRole>([
  "owner",
  "staff",
  "franchise_admin",
  "super_admin",
]);

function normalizeTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object") {
    const rec = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof rec.toMillis === "function") return rec.toMillis();
    if (typeof rec.seconds === "number") return rec.seconds * 1000;
    if (typeof rec._seconds === "number") return rec._seconds * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeRole(raw: unknown): MvpRole {
  if (typeof raw === "string" && ALLOWED_ROLES.has(raw as MvpRole)) {
    return raw as MvpRole;
  }
  throw new ServerSecurityError(
    403,
    "INVALID_USER_ROLE",
    "Account role is invalid or unrecognized.",
  );
}

function normalizeStatus(raw: unknown): "active" | "pending" | "suspended" {
  if (raw === "active" || raw === "pending" || raw === "suspended") {
    return raw;
  }
  throw new ServerSecurityError(
    403,
    "INVALID_USER_STATUS",
    "Account status is invalid.",
  );
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new ServerSecurityError(
      401,
      "MISSING_AUTH_TOKEN",
      "Authentication required. Provide a valid Bearer ID token.",
    );
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) {
    throw new ServerSecurityError(
      401,
      "INVALID_AUTH_TOKEN",
      "Invalid authentication token.",
    );
  }
  return token;
}

function getDefaultAuthDeps(): AuthVerificationDeps {
  const admin = getFirebaseAdmin();
  return {
    verifyIdToken: (idToken, checkRevoked) =>
      admin.auth.verifyIdToken(idToken, checkRevoked),
    loadUserProfile: async (uid) => {
      const snap = await admin.db.collection("users").doc(uid).get();
      if (!snap.exists) return null;
      return (snap.data() ?? null) as AuthoritativeUserDoc | null;
    },
  };
}

/**
 * Verifies a Firebase ID token via Firebase Admin SDK, validates expiry &
 * session revocation, loads authoritative `users/{uid}`, and returns a frozen
 * `ServerAuthContext`.
 *
 * Explicitly ignores any client-supplied role/shopId/actor fields.
 */
export async function verifyBearerAuthContext(
  authorizationHeader: string | undefined,
  options: {
    allowMissingProfile?: boolean;
    deps?: AuthVerificationDeps;
  } = {},
): Promise<ServerAuthContext> {
  const token = extractBearerToken(authorizationHeader);
  const deps = options.deps ?? getDefaultAuthDeps();
  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();

  let decoded: DecodedIdToken;
  try {
    decoded = await deps.verifyIdToken(token, true);
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "";
    if (code === "auth/id-token-revoked") {
      throw new ServerSecurityError(
        401,
        "TOKEN_REVOKED",
        "Your session has been revoked. Please sign in again.",
      );
    }
    if (code === "auth/id-token-expired") {
      throw new ServerSecurityError(
        401,
        "TOKEN_EXPIRED",
        "Your session has expired. Please sign in again.",
      );
    }
    throw new ServerSecurityError(
      401,
      "INVALID_AUTH_TOKEN",
      "Invalid or expired authentication token.",
    );
  }

  if (!decoded?.uid || typeof decoded.uid !== "string") {
    throw new ServerSecurityError(401, "INVALID_AUTH_TOKEN", "Invalid token identity.");
  }

  if (typeof decoded.exp === "number" && decoded.exp * 1000 <= nowMs) {
    throw new ServerSecurityError(
      401,
      "TOKEN_EXPIRED",
      "Your session has expired. Please sign in again.",
    );
  }

  const authTimeMs =
    typeof decoded.auth_time === "number" ? decoded.auth_time * 1000 : 0;
  if (!authTimeMs) {
    throw new ServerSecurityError(
      401,
      "INVALID_AUTH_TOKEN",
      "Token is missing authentication timestamp.",
    );
  }

  const profile = await deps.loadUserProfile(decoded.uid);
  if (!profile) {
    if (options.allowMissingProfile) {
      return Object.freeze({
        uid: decoded.uid,
        email: typeof decoded.email === "string" ? decoded.email : "",
        role: "owner" as MvpRole,
        status: "active" as const,
        shopId: null,
        authTimeMs,
        sessionRevokedAtMs: null,
        tokenClaims: Object.freeze({ ...decoded }),
      });
    }
    throw new ServerSecurityError(
      403,
      "USER_PROFILE_NOT_FOUND",
      "Authoritative user profile not found.",
    );
  }

  const role = normalizeRole(profile.role);
  const status = normalizeStatus(profile.status);
  const sessionRevokedAtMs = normalizeTimestampMs(profile.sessionRevokedAt);

  if (status === "suspended") {
    await recordSecurityAudit(
      {
        actorId: decoded.uid,
        actorRole: role,
        action: "auth:verify",
        targetType: "session",
        outcome: "DENY",
        metadata: { reason: "ACCOUNT_SUSPENDED" },
      },
      deps.auditSink,
    );
    throw new ServerSecurityError(
      403,
      "ACCOUNT_SUSPENDED",
      "Your account is suspended. Access denied.",
    );
  }

  if (status === "pending") {
    throw new ServerSecurityError(
      403,
      "ACCOUNT_PENDING",
      "Your account is pending activation.",
    );
  }

  if (sessionRevokedAtMs !== null && sessionRevokedAtMs > authTimeMs) {
    await recordSecurityAudit(
      {
        actorId: decoded.uid,
        actorRole: role,
        action: "auth:verify",
        targetType: "session",
        outcome: "DENY",
        metadata: { reason: "SESSION_REVOKED" },
      },
      deps.auditSink,
    );
    throw new ServerSecurityError(
      401,
      "SESSION_REVOKED",
      "Your session was revoked. Please sign in again.",
    );
  }

  const shopId =
    typeof profile.shopId === "string" && profile.shopId.trim().length > 0
      ? profile.shopId.trim()
      : null;

  return Object.freeze({
    uid: decoded.uid,
    email:
      typeof profile.email === "string" && profile.email
        ? profile.email
        : typeof decoded.email === "string"
          ? decoded.email
          : "",
    role,
    status,
    shopId,
    authTimeMs,
    sessionRevokedAtMs,
    tokenClaims: Object.freeze({ ...decoded }),
  });
}

/**
 * Express middleware that populates `req.authContext` after strict server verification.
 */
export function authenticateRequest(options: {
  allowMissingProfile?: boolean;
  deps?: AuthVerificationDeps;
} = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authContext = await verifyBearerAuthContext(
        req.headers.authorization,
        options,
      );
      (req as AuthenticatedRequest).authContext = authContext;
      next();
    } catch (error) {
      sendSafeError(res, error);
    }
  };
}
