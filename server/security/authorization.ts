import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { MvpRole } from "../../services/adapters/types";
import type { AuthenticatedRequest, ServerAuthContext } from "./authContext";
import { ServerSecurityError } from "./firebaseAdmin";
import { sendSafeError } from "./guards";

export type PlatformPermission =
  | "shop:read"
  | "shop:update"
  | "shop:delete"
  | "ledger:read"
  | "ledger:write"
  | "customer:read"
  | "customer:write"
  | "insights:read"
  | "insights:delete"
  | "ai:invoke"
  | "ai:approve_action"
  | "whatsapp:send"
  | "billing:manage"
  | "admin:metrics"
  | "admin:shops";

const ROLE_PERMISSIONS: Readonly<Record<MvpRole, ReadonlySet<PlatformPermission>>> = {
  staff: new Set<PlatformPermission>([
    "shop:read",
    "ledger:read",
    "ledger:write",
    "customer:read",
    "customer:write",
    "insights:read",
    "ai:invoke",
  ]),
  owner: new Set<PlatformPermission>([
    "shop:read",
    "shop:update",
    "ledger:read",
    "ledger:write",
    "customer:read",
    "customer:write",
    "insights:read",
    "insights:delete",
    "ai:invoke",
    "ai:approve_action",
    "whatsapp:send",
    "billing:manage",
  ]),
  franchise_admin: new Set<PlatformPermission>([
    "shop:read",
    "ledger:read",
    "customer:read",
    "insights:read",
    "admin:metrics",
    "admin:shops",
  ]),
  super_admin: new Set<PlatformPermission>([
    "shop:read",
    "shop:update",
    "shop:delete",
    "ledger:read",
    "ledger:write",
    "customer:read",
    "customer:write",
    "insights:read",
    "insights:delete",
    "ai:invoke",
    "ai:approve_action",
    "whatsapp:send",
    "billing:manage",
    "admin:metrics",
    "admin:shops",
  ]),
};

export function requireAuthenticatedUser(
  ctx: ServerAuthContext | undefined | null,
): ServerAuthContext {
  if (!ctx || !ctx.uid) {
    throw new ServerSecurityError(
      401,
      "UNAUTHENTICATED",
      "Authentication required.",
    );
  }
  return ctx;
}

export function requireActiveUser(
  ctx: ServerAuthContext | undefined | null,
): ServerAuthContext {
  const authed = requireAuthenticatedUser(ctx);
  if (authed.status === "suspended") {
    throw new ServerSecurityError(
      403,
      "ACCOUNT_SUSPENDED",
      "Suspended accounts cannot perform this operation.",
    );
  }
  if (authed.status !== "active") {
    throw new ServerSecurityError(
      403,
      "ACCOUNT_INACTIVE",
      "Only active accounts can perform this operation.",
    );
  }
  if (
    authed.sessionRevokedAtMs !== null &&
    authed.sessionRevokedAtMs > authed.authTimeMs
  ) {
    throw new ServerSecurityError(
      401,
      "SESSION_REVOKED",
      "Session has been revoked. Please sign in again.",
    );
  }
  return authed;
}

export function requirePlatformAdmin(
  ctx: ServerAuthContext | undefined | null,
  options: { superAdminOnly?: boolean } = {},
): ServerAuthContext {
  const active = requireActiveUser(ctx);
  if (options.superAdminOnly) {
    if (active.role !== "super_admin") {
      throw new ServerSecurityError(
        403,
        "FORBIDDEN",
        "Super Admin privileges are required.",
      );
    }
    return active;
  }

  if (active.role !== "super_admin" && active.role !== "franchise_admin") {
    throw new ServerSecurityError(
      403,
      "FORBIDDEN",
      "Platform administrator privileges are required.",
    );
  }
  return active;
}

export function requireShopMembership(
  ctx: ServerAuthContext | undefined | null,
  targetShopId: string | undefined | null,
  options: { allowFranchiseRead?: boolean } = {},
): ServerAuthContext {
  const active = requireActiveUser(ctx);
  const cleanShopId = typeof targetShopId === "string" ? targetShopId.trim() : "";
  if (!cleanShopId) {
    throw new ServerSecurityError(
      400,
      "INVALID_SHOP_ID",
      "A valid shopId is required.",
    );
  }

  if (active.role === "super_admin") {
    return active;
  }

  if (active.role === "franchise_admin" && options.allowFranchiseRead) {
    return active;
  }

  if (!active.shopId || active.shopId !== cleanShopId) {
    throw new ServerSecurityError(
      403,
      "CROSS_TENANT_DENIED",
      "You are not authorized to access this shop.",
    );
  }

  return active;
}

export function requireShopOwner(
  ctx: ServerAuthContext | undefined | null,
  targetShopId: string | undefined | null,
  shopOwnerUid?: string | null,
): ServerAuthContext {
  const member = requireShopMembership(ctx, targetShopId);
  if (member.role === "super_admin") {
    return member;
  }
  if (member.role !== "owner") {
    throw new ServerSecurityError(
      403,
      "OWNER_ROLE_REQUIRED",
      "Only the shop owner can perform this action.",
    );
  }
  if (shopOwnerUid && shopOwnerUid !== member.uid) {
    throw new ServerSecurityError(
      403,
      "CROSS_TENANT_DENIED",
      "Shop ownership verification failed.",
    );
  }
  return member;
}

export function requirePermission(
  ctx: ServerAuthContext | undefined | null,
  permission: PlatformPermission,
  targetShopId?: string | null,
): ServerAuthContext {
  const active = requireActiveUser(ctx);
  const allowed = ROLE_PERMISSIONS[active.role];
  if (!allowed || !allowed.has(permission)) {
    throw new ServerSecurityError(
      403,
      "PERMISSION_DENIED",
      `Role "${active.role}" is not permitted to perform "${permission}".`,
    );
  }

  if (targetShopId !== undefined) {
    const isReadPermission =
      permission === "shop:read" ||
      permission === "ledger:read" ||
      permission === "customer:read" ||
      permission === "insights:read";
    requireShopMembership(active, targetShopId, {
      allowFranchiseRead: isReadPermission,
    });
  }

  return active;
}

// ----------------------------------------------------------------------------
// Express Middleware Helpers
// ----------------------------------------------------------------------------

export function withPermission(
  permission: PlatformPermission,
  extractShopId?: (req: Request) => string | undefined,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = (req as AuthenticatedRequest).authContext;
      const targetShopId = extractShopId ? extractShopId(req) : undefined;
      requirePermission(ctx, permission, targetShopId);
      next();
    } catch (error) {
      sendSafeError(res, error);
    }
  };
}

export function withShopOwner(
  extractShopId: (req: Request) => string | undefined,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = (req as AuthenticatedRequest).authContext;
      requireShopOwner(ctx, extractShopId(req));
      next();
    } catch (error) {
      sendSafeError(res, error);
    }
  };
}

export function withPlatformAdmin(options: { superAdminOnly?: boolean } = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const ctx = (req as AuthenticatedRequest).authContext;
      requirePlatformAdmin(ctx, options);
      next();
    } catch (error) {
      sendSafeError(res, error);
    }
  };
}
