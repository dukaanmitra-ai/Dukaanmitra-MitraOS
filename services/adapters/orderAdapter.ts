import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseDb } from "../../firebase";
import { assertShopAccess, getCurrentIdToken } from "./authAdapter";
import { assertNotDemoWrite } from "./demoFixtures";
import { mapOrderDoc, normalizeFirestoreError } from "./mappers";
import {
  AdapterError,
  type AuthSession,
  type SubscriptionOrder,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;

export interface AuthenticatedFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  idempotencyKey?: string;
  getToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export function generateIdempotencyKey(prefix = "dm"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Shared authenticated HTTP request helper with Firebase ID token injection,
 * AbortController timeout handling, Idempotency-Key support, and typed AdapterError mapping.
 */
export async function authenticatedApiRequest<TResponse>(
  url: string,
  options: AuthenticatedFetchOptions = {},
): Promise<TResponse> {
  const getToken = options.getToken ?? (() => getCurrentIdToken(false));
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const idToken = await getToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  try {
    const response = await fetchFn(url, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const parsedBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      const serverMsg =
        (parsedBody &&
          typeof parsedBody === "object" &&
          ("error" in parsedBody || "message" in parsedBody) &&
          String(
            (parsedBody as { error?: unknown; message?: unknown }).error ??
              (parsedBody as { message?: unknown }).message,
          )) ||
        `Request failed with HTTP ${response.status}`;

      const code =
        response.status === 401
          ? "UNAUTHENTICATED"
          : response.status === 403
            ? "FORBIDDEN"
            : response.status === 404
              ? "NOT_FOUND"
              : response.status === 400
                ? "INVALID_INPUT"
                : "NETWORK_ERROR";

      throw new AdapterError(code, serverMsg, { statusCode: response.status });
    }

    return parsedBody as TResponse;
  } catch (error) {
    if (error instanceof AdapterError) {
      throw error;
    }
    if ((error as { name?: string })?.name === "AbortError") {
      throw new AdapterError(
        "REQUEST_TIMEOUT",
        `Request to "${url}" timed out after ${timeoutMs}ms.`,
      );
    }
    throw new AdapterError(
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Network request failed.",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

function getOptionalEnvBaseUrl(key: string): string {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | undefined>)
      : {};
  return (env[key] ?? "").trim().replace(/\/+$/, "");
}

// ============================================================================
// 1. Subscription Orders Adapter (`orders/{orderId}` + `/api/create-order`)
// ============================================================================

export interface CreateSubscriptionOrderRequest {
  shopId: string;
  plan: "basic" | "pro";
  idempotencyKey?: string;
}

export interface CreateSubscriptionOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
}

/**
 * Lists subscription orders owned by the current authenticated user from `orders/{orderId}`.
 */
export async function getUserOrders(
  session: AuthSession | null | undefined,
  deps: { firestore?: Firestore } = {},
): Promise<SubscriptionOrder[]> {
  if (!session) {
    throw new AdapterError("UNAUTHENTICATED", "Sign in to view your orders.");
  }
  const firestore = deps.firestore ?? getFirebaseDb();

  try {
    const q = query(
      collection(firestore, "orders"),
      where("userId", "==", session.uid),
    );
    const snap = await getDocs(q);
    const orders = snap.docs.map((d) => mapOrderDoc(d.id, d.data()));
    orders.sort((a, b) => b.createdAtMs - a.createdAtMs);
    return orders;
  } catch (error) {
    throw normalizeFirestoreError(error, "Failed to load subscription orders.");
  }
}

/**
 * Creates a subscription order through the authenticated backend API.
 *
 * TODO (Phase 3 Hardening Contract):
 * - Root `server.ts` `/api/create-order` must be hardened with Firebase ID token verification,
 *   server-side plan pricing lookup (never accepting raw client `amount`), `Idempotency-Key`
 *   persistence, and `orders/{orderId}` write before production use, OR point
 *   `VITE_ORDERS_API_BASE_URL` to the hardened `apps/dukaan-in-next` `/api/create-order` service.
 */
export async function createSubscriptionOrder(
  request: CreateSubscriptionOrderRequest,
  session: AuthSession | null | undefined,
  options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
): Promise<CreateSubscriptionOrderResponse> {
  assertNotDemoWrite(request.shopId, "createSubscriptionOrder");
  assertShopAccess(session, request.shopId, { requireOwner: true });

  const baseUrl = getOptionalEnvBaseUrl("VITE_ORDERS_API_BASE_URL");
  if (!baseUrl) {
    throw new AdapterError(
      "ENDPOINT_NOT_CONFIGURED",
      "VITE_ORDERS_API_BASE_URL is not configured. Configure the hardened authenticated orders API endpoint (Phase 3) before creating subscription orders.",
    );
  }

  return authenticatedApiRequest<CreateSubscriptionOrderResponse>(
    `${baseUrl}/api/create-order`,
    {
      ...options,
      method: "POST",
      idempotencyKey: request.idempotencyKey ?? generateIdempotencyKey("order"),
      body: {
        shopId: request.shopId,
        plan: request.plan,
      },
    },
  );
}

// ============================================================================
// 2. Core Engine Typed Boundary Clients (PostgreSQL/Prisma behind HTTP API)
// ============================================================================

export interface CoreEngineInventoryItem {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  category?: string;
  unit: string;
  sellPrice: number;
  currentStock: number;
  lowStockAlert: number;
}

export interface CoreEngineCashSaleRequest {
  storeId: string;
  amount: number;
  mode: "CASH" | "UPI" | "CARD";
  customerPhone?: string;
  items?: Array<{ productId: string; quantity: number }>;
  idempotencyKey?: string;
}

export interface CoreEngineMediaUploadRequest {
  storeId: string;
  kind: "image" | "audio" | "video";
  url: string;
  mimeType: string;
}

function requireCoreEngineBaseUrl(operation: string): string {
  const baseUrl = getOptionalEnvBaseUrl("VITE_CORE_ENGINE_API_BASE_URL");
  if (!baseUrl) {
    throw new AdapterError(
      "ENDPOINT_NOT_CONFIGURED",
      `Core Engine boundary "${operation}" requires VITE_CORE_ENGINE_API_BASE_URL and Phase 3 Firebase ID token + tenant authorization middleware on apps/core-engine.`,
    );
  }
  return baseUrl;
}

/**
 * TODO (Phase 3 / Phase 4 Contract):
 * `apps/core-engine` routes currently lack Firebase ID token & shop-ownership middleware
 * (`apps/core-engine/src/api/routes/app.routes.ts`). Production calls must only target a
 * hardened Core Engine deployment with verified Firebase shopId <-> Core Engine storeId mapping.
 */
export const coreEngineInventoryClient = {
  async getInventory(
    shopId: string,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ success: boolean; inventory: CoreEngineInventoryItem[] }> {
    assertShopAccess(session, shopId);
    const baseUrl = requireCoreEngineBaseUrl("getInventory");
    return authenticatedApiRequest(
      `${baseUrl}/api/stores/${encodeURIComponent(shopId)}/inventory`,
      { ...options, method: "GET" },
    );
  },

  async getLowStock(
    shopId: string,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ success: boolean; items: CoreEngineInventoryItem[] }> {
    assertShopAccess(session, shopId);
    const baseUrl = requireCoreEngineBaseUrl("getLowStock");
    return authenticatedApiRequest(
      `${baseUrl}/api/stores/${encodeURIComponent(shopId)}/low-stock`,
      { ...options, method: "GET" },
    );
  },
};

export const coreEnginePosClient = {
  /**
   * Records a cash/UPI POS sale in Core Engine PostgreSQL (`POST /api/sales`).
   * Preserves separation from Firestore credit/payment ledger (`shops/{shopId}/ledger`).
   */
  async recordCashSale(
    request: CoreEngineCashSaleRequest,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ success: boolean; message: string }> {
    assertNotDemoWrite(request.storeId, "recordCashSale");
    assertShopAccess(session, request.storeId);

    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      throw new AdapterError("INVALID_INPUT", "POS sale amount must be positive.");
    }

    const baseUrl = requireCoreEngineBaseUrl("recordCashSale");
    return authenticatedApiRequest(`${baseUrl}/api/sales`, {
      ...options,
      method: "POST",
      idempotencyKey: request.idempotencyKey ?? generateIdempotencyKey("sale"),
      body: request,
    });
  },
};

export const coreEngineMediaClient = {
  /**
   * Queues shelf-photo or voice-note capture through Core Engine (`POST /api/media`).
   */
  async submitMedia(
    request: CoreEngineMediaUploadRequest,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ success: boolean; message: string }> {
    assertNotDemoWrite(request.storeId, "submitMedia");
    assertShopAccess(session, request.storeId);

    const baseUrl = requireCoreEngineBaseUrl("submitMedia");
    return authenticatedApiRequest(`${baseUrl}/api/media`, {
      ...options,
      method: "POST",
      idempotencyKey: generateIdempotencyKey("media"),
      body: request,
    });
  },
};
