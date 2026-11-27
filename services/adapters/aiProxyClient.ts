import { assertShopAccess } from "./authAdapter";
import {
  authenticatedApiRequest,
  type AuthenticatedFetchOptions,
} from "./orderAdapter";
import { AdapterError, type AuthSession } from "./types";

const DEFAULT_AI_TIMEOUT_MS = 20_000;

export interface MunimChatRequest {
  message: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}

export interface MunimChatResponse {
  reply: string;
}

export interface MerchantAiChatRequest {
  shopId: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}

export interface MerchantAiMarketingRequest {
  shopId: string;
  campaignType: string;
  details: string;
}

export interface MerchantAiAlertNudgeRequest {
  shopId: string;
  title: string;
  description: string;
}

function getAiProxyBaseUrl(): string {
  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as Record<string, string | undefined>)
      : {};
  return (env.VITE_AI_PROXY_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/**
 * Verified public website assistant endpoint served by root `server.ts` (`POST /api/munim-chat`).
 * Never uses a browser-side Gemini API key.
 */
export async function sendPublicMunimChat(
  request: MunimChatRequest,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<MunimChatResponse> {
  const trimmed = request.message?.trim() ?? "";
  if (!trimmed || trimmed.length > 1000) {
    throw new AdapterError(
      "INVALID_INPUT",
      "Message must be non-empty and under 1000 characters.",
    );
  }

  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn("/api/munim-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message: trimmed,
        history: request.history ?? [],
      }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as {
      reply?: string;
      error?: string;
    };

    if (!response.ok || !data.reply) {
      throw new AdapterError(
        response.status === 400 ? "INVALID_INPUT" : "NETWORK_ERROR",
        data.error || `Munim AI chat request failed (HTTP ${response.status}).`,
        { statusCode: response.status },
      );
    }

    return { reply: data.reply };
  } catch (error) {
    if (error instanceof AdapterError) throw error;
    if ((error as { name?: string })?.name === "AbortError") {
      throw new AdapterError(
        "REQUEST_TIMEOUT",
        `Munim AI chat timed out after ${timeoutMs}ms.`,
      );
    }
    throw new AdapterError(
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Failed to reach Munim AI.",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Authenticated Merchant AI Proxy Client.
 *
 * TODO (Phase 3 / Phase 6 Contract):
 * Server-side authenticated merchant AI routes (`/api/ai/merchant-chat`,
 * `/api/ai/marketing-copy`, `/api/ai/alert-nudge`) must be implemented in
 * backend Express / Next.js with Firebase ID token verification, shop-level
 * authorization, and deterministic pricing guardrails. Configure
 * `VITE_AI_PROXY_BASE_URL` once those routes are deployed.
 */
export const aiProxyClient = {
  async sendMerchantChat(
    request: MerchantAiChatRequest,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ reply: string; intent?: string }> {
    assertShopAccess(session, request.shopId);
    const baseUrl = getAiProxyBaseUrl();
    if (!baseUrl) {
      throw new AdapterError(
        "ENDPOINT_NOT_CONFIGURED",
        "Merchant AI proxy is not configured (VITE_AI_PROXY_BASE_URL). Direct browser Gemini calls are disabled for security.",
      );
    }
    return authenticatedApiRequest(`${baseUrl}/api/ai/merchant-chat`, {
      ...options,
      method: "POST",
      timeoutMs: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      body: request,
    });
  },

  async generateMarketingCopy(
    request: MerchantAiMarketingRequest,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ content: string }> {
    assertShopAccess(session, request.shopId);
    const baseUrl = getAiProxyBaseUrl();
    if (!baseUrl) {
      throw new AdapterError(
        "ENDPOINT_NOT_CONFIGURED",
        "Marketing AI proxy is not configured (VITE_AI_PROXY_BASE_URL). Direct browser Gemini calls are disabled for security.",
      );
    }
    return authenticatedApiRequest(`${baseUrl}/api/ai/marketing-copy`, {
      ...options,
      method: "POST",
      timeoutMs: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      body: request,
    });
  },

  async generateAlertNudge(
    request: MerchantAiAlertNudgeRequest,
    session: AuthSession | null | undefined,
    options: Pick<AuthenticatedFetchOptions, "timeoutMs" | "getToken" | "fetchImpl"> = {},
  ): Promise<{ nudge: string }> {
    assertShopAccess(session, request.shopId);
    const baseUrl = getAiProxyBaseUrl();
    if (!baseUrl) {
      throw new AdapterError(
        "ENDPOINT_NOT_CONFIGURED",
        "Alert Nudge AI proxy is not configured (VITE_AI_PROXY_BASE_URL). Direct browser Gemini calls are disabled for security.",
      );
    }
    return authenticatedApiRequest(`${baseUrl}/api/ai/alert-nudge`, {
      ...options,
      method: "POST",
      timeoutMs: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      body: request,
    });
  },
};
