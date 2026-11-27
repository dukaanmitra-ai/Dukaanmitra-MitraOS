import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export type CoreRole = 'owner' | 'staff' | 'franchise_admin' | 'super_admin';

export interface CoreAuthContext {
  readonly uid: string;
  readonly role: CoreRole;
  readonly shopId: string | null;
  readonly storeId: string | null;
}

export interface CoreAuthenticatedRequest extends Request {
  coreAuth?: CoreAuthContext;
  rawBody?: Buffer;
}

const VALID_ROLES = new Set<CoreRole>([
  'owner',
  'staff',
  'franchise_admin',
  'super_admin',
]);

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a signed internal gateway context header (`X-Core-Auth-Context` base64url JSON +
 * `X-Core-Auth-Signature` HMAC-SHA256 hex using `CORE_ENGINE_INTERNAL_SECRET`).
 * Enforces a 60-second replay window (`iat` / `exp`).
 */
export function verifySignedCoreContext(
  encodedContext: string | undefined,
  signatureHex: string | undefined,
  secret = process.env.CORE_ENGINE_INTERNAL_SECRET,
  nowMs = Date.now(),
): CoreAuthContext | null {
  const cleanSecret = (secret || '').trim();
  if (!cleanSecret || !encodedContext || !signatureHex) return null;

  const expectedSig = crypto
    .createHmac('sha256', cleanSecret)
    .update(encodedContext)
    .digest('hex');

  if (!timingSafeEqualStr(expectedSig, signatureHex.trim())) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedContext, 'base64url').toString('utf8'),
    ) as {
      uid?: unknown;
      role?: unknown;
      shopId?: unknown;
      storeId?: unknown;
      exp?: unknown;
    };

    if (typeof parsed.uid !== 'string' || !parsed.uid.trim()) return null;
    if (typeof parsed.role !== 'string' || !VALID_ROLES.has(parsed.role as CoreRole)) {
      return null;
    }
    if (typeof parsed.exp !== 'number' || parsed.exp * 1000 <= nowMs) {
      return null;
    }

    const shopId =
      typeof parsed.shopId === 'string' && parsed.shopId.trim()
        ? parsed.shopId.trim()
        : null;
    const storeId =
      typeof parsed.storeId === 'string' && parsed.storeId.trim()
        ? parsed.storeId.trim()
        : shopId;

    return Object.freeze({
      uid: parsed.uid.trim(),
      role: parsed.role as CoreRole,
      shopId,
      storeId,
    });
  } catch {
    return null;
  }
}

/**
 * Fail-closed authentication middleware for Core Engine REST endpoints.
 * Never trusts request.body.role, request.body.actor, or unverified headers.
 */
export function requireCoreAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const signedCtx = verifySignedCoreContext(
    req.header('x-core-auth-context'),
    req.header('x-core-auth-signature'),
  );

  if (!signedCtx) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Missing or invalid verified server auth context.',
    });
    return;
  }

  (req as CoreAuthenticatedRequest).coreAuth = signedCtx;
  next();
}

/**
 * Enforces strict tenant isolation against the verified CoreAuthContext.
 */
export function requireStoreAccess(
  extractStoreId: (req: Request) => string | undefined,
  options: { requireOwner?: boolean; allowFranchiseRead?: boolean } = {},
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx = (req as CoreAuthenticatedRequest).coreAuth;
    if (!ctx) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const targetStoreId = (extractStoreId(req) || '').trim();
    if (!targetStoreId) {
      res.status(400).json({ success: false, error: 'A valid storeId is required.' });
      return;
    }

    if (ctx.role === 'super_admin') {
      next();
      return;
    }

    if (ctx.role === 'franchise_admin') {
      if (options.allowFranchiseRead && !options.requireOwner) {
        next();
        return;
      }
      res.status(403).json({
        success: false,
        error: 'Franchise admin is not authorized for store mutations.',
      });
      return;
    }

    const allowedStore = ctx.storeId || ctx.shopId;
    if (!allowedStore || allowedStore !== targetStoreId) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: cross-tenant store access denied.',
      });
      return;
    }

    if (options.requireOwner && ctx.role !== 'owner') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: shop owner role is required.',
      });
      return;
    }

    next();
  };
}

/**
 * Verifies the target product belongs to the caller's authorized store before mutation.
 */
export function requireProductStoreAccess(
  prisma: PrismaClient,
  options: { requireOwner?: boolean } = {},
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = (req as CoreAuthenticatedRequest).coreAuth;
    if (!ctx) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const productId = (req.params.id || '').trim();
    if (!productId) {
      res.status(400).json({ success: false, error: 'Product ID is required.' });
      return;
    }

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, storeId: true },
      });

      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found.' });
        return;
      }

      if (ctx.role === 'super_admin') {
        next();
        return;
      }

      const allowedStore = ctx.storeId || ctx.shopId;
      if (!allowedStore || product.storeId !== allowedStore) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: product does not belong to your authorized store.',
        });
        return;
      }

      if (options.requireOwner && ctx.role !== 'owner') {
        res.status(403).json({
          success: false,
          error: 'Forbidden: shop owner role is required.',
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({ success: false, error: 'Authorization verification failed.' });
    }
  };
}

/**
 * Shared-secret verification for internal OpenWA gateway bridge calls.
 */
export function requireGatewayBridgeSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configured = (process.env.GATEWAY_API_SECRET || '').trim();
  if (!configured) {
    res.status(503).json({ error: 'Gateway bridge secret is not configured.' });
    return;
  }
  const provided = (req.header('x-gateway-secret') || '').trim();
  if (!timingSafeEqualStr(provided, configured)) {
    res.status(401).json({ error: 'Unauthorized gateway bridge request.' });
    return;
  }
  next();
}
