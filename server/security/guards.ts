import crypto from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ServerSecurityError } from "./firebaseAdmin";

// ============================================================================
// 1. Constant-Time HMAC & Secret Comparison
// ============================================================================

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyHmacSha256Hex(params: {
  secret: string;
  payload: string | Buffer;
  providedHex: string;
  prefix?: string;
}): boolean {
  if (!params.secret || !params.providedHex) return false;
  const expectedRaw = crypto
    .createHmac("sha256", params.secret)
    .update(params.payload)
    .digest("hex");
  const expected = params.prefix ? `${params.prefix}${expectedRaw}` : expectedRaw;
  return timingSafeEqualStrings(expected, params.providedHex);
}

// ============================================================================
// 2. Strict CORS Allowlist Middleware (No Wildcard on Authenticated APIs)
// ============================================================================

const DEFAULT_ALLOWED_ORIGINS = [
  "https://dukaanmitra.in",
  "https://www.dukaanmitra.in",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function parseAllowedOrigins(raw = process.env.ALLOWED_ORIGINS): Set<string> {
  const configured = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function createCorsMiddleware(allowedOrigins?: Set<string>): RequestHandler {
  const allowlist = allowedOrigins ?? parseAllowedOrigins();
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin) {
      if (!allowlist.has(origin)) {
        res.status(403).json({
          error: "Origin not allowed.",
          code: "CORS_ORIGIN_FORBIDDEN",
        });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type, Idempotency-Key",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}

// ============================================================================
// 3. Sliding/Fixed Window In-Memory Rate Limiter
// ============================================================================

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyExtractor?: (req: Request) => string;
}

interface BucketEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();

  check(
    key: string,
    maxRequests: number,
    windowMs: number,
    nowMs = Date.now(),
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const existing = this.buckets.get(key);
    if (!existing || nowMs >= existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - 1),
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }

    if (existing.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - existing.count),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
  limiter = new InMemoryRateLimiter(),
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authUid = (req as Request & { authContext?: { uid?: string } })
      .authContext?.uid;
    const rawKey = options.keyExtractor
      ? options.keyExtractor(req)
      : authUid ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `${options.keyPrefix}:${rawKey}`;

    const result = limiter.check(key, options.maxRequests, options.windowMs);
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).json({
        error: "Too many requests. Please slow down and try again shortly.",
        code: "RATE_LIMIT_EXCEEDED",
      });
      return;
    }
    next();
  };
}

// ============================================================================
// 4. Timeout Guard & Safe Error Serialization
// ============================================================================

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new ServerSecurityError(
          504,
          "REQUEST_TIMEOUT",
          `The ${label} timed out. Please try again.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const REDACTED_KEYS = new Set([
  "authorization",
  "token",
  "idtoken",
  "secret",
  "password",
  "apikey",
  "api_key",
  "signature",
  "razorpay_signature",
  "private_key",
  "credential",
]);

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.startsWith("Bearer ") || value.startsWith("AIza") || value.startsWith("sk-")) {
      return "[REDACTED]";
    }
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitiveData(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export interface AuditRecordInput {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  shopId?: string | null;
  outcome: "ALLOW" | "DENY" | "ERROR";
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export type AuditSink = (record: AuditRecordInput & { timestamp: string }) => Promise<void> | void;

export async function recordSecurityAudit(
  entry: AuditRecordInput,
  sink?: AuditSink,
): Promise<void> {
  const sanitized = {
    ...entry,
    correlationId: entry.correlationId ?? crypto.randomUUID(),
    metadata: entry.metadata
      ? (redactSensitiveData(entry.metadata) as Record<string, unknown>)
      : undefined,
    timestamp: new Date().toISOString(),
  };

  if (sink) {
    await sink(sanitized);
    return;
  }

  // Structured log with sensitive values stripped
  console.info("[SECURITY_AUDIT]", JSON.stringify(sanitized));
}

export function sendSafeError(res: Response, error: unknown): void {
  if (error instanceof ServerSecurityError) {
    res.status(error.statusCode).json({
      error: error.safeMessage,
      code: error.code,
    });
    return;
  }

  const expressErr = error as { status?: number; type?: string };
  if (expressErr?.type === "entity.too.large" || expressErr?.status === 413) {
    res.status(413).json({
      error: "Request payload exceeds maximum allowed size.",
      code: "PAYLOAD_TOO_LARGE",
    });
    return;
  }

  if (expressErr?.type === "entity.parse.failed" || expressErr?.status === 400) {
    res.status(400).json({
      error: "Malformed JSON request payload.",
      code: "INVALID_JSON",
    });
    return;
  }

  console.error(
    "[SERVER_ERROR]",
    error instanceof Error ? error.message : "Unhandled error",
  );
  res.status(500).json({
    error: "An internal error occurred while processing your request.",
    code: "INTERNAL_ERROR",
  });
}
