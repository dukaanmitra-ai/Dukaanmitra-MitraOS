import crypto from "crypto";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebase-admin";

export interface NextServerAuthContext {
  readonly uid: string;
  readonly email: string;
  readonly role: "owner" | "staff" | "franchise_admin" | "super_admin";
  readonly status: "active" | "pending" | "suspended";
  readonly shopId: string | null;
  readonly authTimeMs: number;
}

export class NextAuthError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function timingSafeEqualText(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifySharedSecretHeader(
  provided: string | null | undefined,
  envSecret: string | undefined,
): boolean {
  const expected = envSecret?.trim() ?? "";
  const actual = provided?.trim() ?? "";
  if (!expected || !actual) return false;
  return timingSafeEqualText(actual, expected);
}

function toMillis(val: unknown): number | null {
  if (!val) return null;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object") {
    const rec = val as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof rec.toMillis === "function") return rec.toMillis();
    if (typeof rec.seconds === "number") return rec.seconds * 1000;
    if (typeof rec._seconds === "number") return rec._seconds * 1000;
  }
  return null;
}

/**
 * Verifies Firebase ID token (with revocation check) and loads authoritative
 * `users/{uid}` profile from Firestore Admin SDK.
 * Never trusts client-supplied role, actor, or shopId.
 */
export async function verifyNextRequestAuth(
  request: Request,
): Promise<NextServerAuthContext> {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new NextAuthError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken || idToken.length > 8192) {
    throw new NextAuthError(401, "INVALID_TOKEN", "Invalid authentication token.");
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch {
    throw new NextAuthError(401, "INVALID_TOKEN", "Invalid or revoked token.");
  }

  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) {
    throw new NextAuthError(403, "PROFILE_NOT_FOUND", "User profile not found.");
  }

  const data = userSnap.data() ?? {};
  const role = data.role;
  const status = data.status;

  if (
    role !== "owner" &&
    role !== "staff" &&
    role !== "franchise_admin" &&
    role !== "super_admin"
  ) {
    throw new NextAuthError(403, "INVALID_ROLE", "Account role is invalid.");
  }

  if (status !== "active") {
    throw new NextAuthError(
      403,
      status === "suspended" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_INACTIVE",
      "Account is not active.",
    );
  }

  const authTimeMs =
    typeof decoded.auth_time === "number" ? decoded.auth_time * 1000 : 0;
  const revokedAtMs = toMillis(data.sessionRevokedAt);
  if (revokedAtMs !== null && revokedAtMs > authTimeMs) {
    throw new NextAuthError(
      401,
      "SESSION_REVOKED",
      "Session has been revoked. Please sign in again.",
    );
  }

  const shopId =
    typeof data.shopId === "string" && data.shopId.trim().length > 0
      ? data.shopId.trim()
      : null;

  return Object.freeze({
    uid: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email : String(data.email ?? ""),
    role,
    status,
    shopId,
    authTimeMs,
  });
}
