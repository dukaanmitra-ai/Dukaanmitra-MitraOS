import { z } from "zod";
import type { MvpRole } from "../../services/adapters/types";
import type { ServerAuthContext } from "./authContext";
import { requireActiveUser, requireShopMembership } from "./authorization";
import { ServerSecurityError } from "./firebaseAdmin";
import {
  InMemoryRateLimiter,
  recordSecurityAudit,
  type AuditSink,
} from "./guards";

// ============================================================================
// 1. Prompt Injection Defense & Untrusted Input Sanitization
// ============================================================================

const PROMPT_INJECTION_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  {
    label: "instruction_override",
    regex: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)\b/i,
  },
  {
    label: "role_impersonation",
    regex: /\b(you\s+are\s+now|act\s+as|switch\s+to)\s+(a\s+)?(super_?admin|system|root|owner|developer\s+mode)\b/i,
  },
  {
    label: "forged_privilege_field",
    regex: /\b(approver_role|actor_role|tenant_id|shopId)\s*[:=]\s*["']?(super_admin|owner|manager|admin)/i,
  },
  {
    label: "system_prompt_exfiltration",
    regex: /\b(reveal|print|dump|output|show)\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key|secret)\b/i,
  },
];

export function detectPromptInjection(text: string): string | null {
  for (const rule of PROMPT_INJECTION_PATTERNS) {
    if (rule.regex.test(text)) {
      return rule.label;
    }
  }
  return null;
}

export function sanitizeUntrustedPromptInput(
  raw: string,
  maxLength = 1000,
): { sanitized: string; injectionFlag: string | null } {
  const normalized = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);

  const injectionFlag = detectPromptInjection(normalized);
  return {
    sanitized: normalized,
    injectionFlag,
  };
}

export function wrapUntrustedContentForLlm(label: string, content: string): string {
  const escaped = content.replace(/<\/untrusted_data>/gi, "[/untrusted_data]");
  return `<untrusted_data source="${label}">\n${escaped}\n</untrusted_data>`;
}

// ============================================================================
// 2. Explicit AI / MCP Tool Permission Registry
// ============================================================================

export type ToolAccessClass = "read" | "write";

export interface RegisteredAiTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly name: string;
  readonly access: ToolAccessClass;
  readonly allowedRoles: ReadonlySet<MvpRole>;
  readonly requiresHumanApproval: boolean;
  readonly maxCallsPerMinute: number;
  readonly schema: TSchema;
}

const FORBIDDEN_CLIENT_OVERRIDE_KEYS = new Set([
  "tenant_id",
  "tenantId",
  "shopId",
  "shop_id",
  "storeId",
  "actor",
  "actorId",
  "actor_id",
  "role",
  "actor_role",
  "approver_role",
  "approverRole",
]);

export const AI_TOOL_REGISTRY: Readonly<Record<string, RegisteredAiTool>> = Object.freeze({
  get_inventory_summary: {
    name: "get_inventory_summary",
    access: "read",
    allowedRoles: new Set<MvpRole>(["owner", "staff", "franchise_admin", "super_admin"]),
    requiresHumanApproval: false,
    maxCallsPerMinute: 30,
    schema: z.object({ low_stock_only: z.boolean().optional().default(false) }).strict(),
  },
  detect_stockout_risk: {
    name: "detect_stockout_risk",
    access: "read",
    allowedRoles: new Set<MvpRole>(["owner", "staff", "franchise_admin", "super_admin"]),
    requiresHumanApproval: false,
    maxCallsPerMinute: 20,
    schema: z.object({}).strict(),
  },
  get_compliance_deadlines: {
    name: "get_compliance_deadlines",
    access: "read",
    allowedRoles: new Set<MvpRole>(["owner", "staff", "franchise_admin", "super_admin"]),
    requiresHumanApproval: false,
    maxCallsPerMinute: 30,
    schema: z.object({ financial_year: z.string().regex(/^\d{4}-\d{2}$/).default("2026-27") }).strict(),
  },
  create_purchase_order_draft: {
    name: "create_purchase_order_draft",
    access: "write",
    allowedRoles: new Set<MvpRole>(["owner", "staff", "super_admin"]),
    requiresHumanApproval: false,
    maxCallsPerMinute: 10,
    schema: z
      .object({
        supplier_name: z.string().trim().min(2).max(120),
        items: z
          .array(
            z
              .object({
                product_id: z.string().trim().min(1).max(100),
                quantity: z.number().positive().max(100000),
                unit_cost: z.number().nonnegative().max(10000000),
              })
              .strict(),
          )
          .min(1)
          .max(50),
        notes: z.string().trim().max(500).optional(),
      })
      .strict(),
  },
  approve_purchase_order: {
    name: "approve_purchase_order",
    access: "write",
    allowedRoles: new Set<MvpRole>(["owner", "super_admin"]),
    requiresHumanApproval: true,
    maxCallsPerMinute: 10,
    schema: z
      .object({
        order_id: z.string().trim().min(3).max(120),
        action: z.enum(["approve", "reject"]),
      })
      .strict(),
  },
  add_ledger_entry_proposal: {
    name: "add_ledger_entry_proposal",
    access: "write",
    allowedRoles: new Set<MvpRole>(["owner", "staff", "super_admin"]),
    requiresHumanApproval: true,
    maxCallsPerMinute: 20,
    schema: z
      .object({
        customerPhone: z.string().trim().regex(/^\+?[0-9]{10,15}$/),
        customerName: z.string().trim().max(120).optional(),
        amount: z.number().positive().max(10000000),
        type: z.enum(["credit", "payment"]),
        item: z.string().trim().max(240).optional(),
      })
      .strict(),
  },
});

export interface TenantBoundToolContext {
  readonly uid: string;
  readonly role: MvpRole;
  readonly shopId: string;
  readonly humanApproved: boolean;
}

export interface ToolExecutionDecision {
  status: "executed" | "approval_required";
  toolName: string;
  tenantShopId: string;
  access: ToolAccessClass;
  validatedArgs: Record<string, unknown>;
  result?: unknown;
}

const defaultToolRateLimiter = new InMemoryRateLimiter();

/**
 * Authorizes and executes an AI / MCP tool strictly bound to the verified server AuthContext.
 * - Rejects unknown/unlisted tools
 * - Rejects forged privilege/tenant override keys (`approver_role`, `tenant_id`, `role`, `actor`)
 * - Enforces role permissions and per-tenant rate limits
 * - Requires explicit server-verified human confirmation for sensitive write tools
 */
export async function authorizeAndExecuteAiTool(params: {
  authContext: ServerAuthContext | undefined | null;
  targetShopId: string | undefined | null;
  toolName: string;
  rawArguments: unknown;
  /** Must come ONLY from a verified human-initiated approval endpoint, NEVER from AI output */
  verifiedHumanApproval?: boolean;
  executor?: (
    ctx: TenantBoundToolContext,
    validatedArgs: Record<string, unknown>,
  ) => Promise<unknown>;
  rateLimiter?: InMemoryRateLimiter;
  auditSink?: AuditSink;
}): Promise<ToolExecutionDecision> {
  const active = requireActiveUser(params.authContext);
  const resolvedShopId = params.targetShopId?.trim() || active.shopId || "";
  requireShopMembership(active, resolvedShopId);

  const tool = AI_TOOL_REGISTRY[params.toolName];
  if (!tool) {
    await recordSecurityAudit(
      {
        actorId: active.uid,
        actorRole: active.role,
        action: "ai:tool:call",
        targetType: "mcp_tool",
        targetId: params.toolName,
        shopId: resolvedShopId,
        outcome: "DENY",
        metadata: { reason: "TOOL_NOT_ALLOWED" },
      },
      params.auditSink,
    );
    throw new ServerSecurityError(
      403,
      "TOOL_NOT_ALLOWED",
      `AI tool "${params.toolName}" is not registered or permitted.`,
    );
  }

  // Reject any attempt to supply forged privilege/tenant keys in tool arguments
  if (
    params.rawArguments &&
    typeof params.rawArguments === "object" &&
    !Array.isArray(params.rawArguments)
  ) {
    const forgedKeys = Object.keys(params.rawArguments as Record<string, unknown>).filter(
      (k) => FORBIDDEN_CLIENT_OVERRIDE_KEYS.has(k),
    );
    if (forgedKeys.length > 0) {
      await recordSecurityAudit(
        {
          actorId: active.uid,
          actorRole: active.role,
          action: "ai:tool:call",
          targetType: "mcp_tool",
          targetId: tool.name,
          shopId: resolvedShopId,
          outcome: "DENY",
          metadata: { reason: "FORGED_PRIVILEGE_PARAM", forgedKeys },
        },
        params.auditSink,
      );
      throw new ServerSecurityError(
        403,
        "FORGED_PRIVILEGE_PARAM",
        `Tool arguments cannot override trusted identity/tenant fields (${forgedKeys.join(", ")}).`,
      );
    }
  }

  // Role authorization derived strictly from verified AuthContext
  if (!tool.allowedRoles.has(active.role)) {
    await recordSecurityAudit(
      {
        actorId: active.uid,
        actorRole: active.role,
        action: "ai:tool:call",
        targetType: "mcp_tool",
        targetId: tool.name,
        shopId: resolvedShopId,
        outcome: "DENY",
        metadata: { reason: "ROLE_FORBIDDEN" },
      },
      params.auditSink,
    );
    throw new ServerSecurityError(
      403,
      "TOOL_ROLE_FORBIDDEN",
      `Role "${active.role}" is not authorized to invoke "${tool.name}".`,
    );
  }

  // Rate limiting per tenant + tool
  const limiter = params.rateLimiter ?? defaultToolRateLimiter;
  const rateCheck = limiter.check(
    `ai_tool:${resolvedShopId}:${active.uid}:${tool.name}`,
    tool.maxCallsPerMinute,
    60_000,
  );
  if (!rateCheck.allowed) {
    throw new ServerSecurityError(
      429,
      "RATE_LIMIT_EXCEEDED",
      "AI tool rate limit exceeded. Please wait before retrying.",
    );
  }

  // Validate tool parameters strictly via Zod
  const parsedArgs = tool.schema.safeParse(params.rawArguments ?? {});
  if (!parsedArgs.success) {
    throw new ServerSecurityError(
      400,
      "INVALID_TOOL_ARGUMENTS",
      `Invalid parameters supplied for tool "${tool.name}".`,
    );
  }

  const validatedArgs = parsedArgs.data as Record<string, unknown>;

  // Scan all string arguments for prompt injection payloads
  for (const val of Object.values(validatedArgs)) {
    if (typeof val === "string") {
      const flag = detectPromptInjection(val);
      if (flag) {
        await recordSecurityAudit(
          {
            actorId: active.uid,
            actorRole: active.role,
            action: "ai:tool:call",
            targetType: "mcp_tool",
            targetId: tool.name,
            shopId: resolvedShopId,
            outcome: "DENY",
            metadata: { reason: "PROMPT_INJECTION_BLOCKED", flag },
          },
          params.auditSink,
        );
        throw new ServerSecurityError(
          400,
          "PROMPT_INJECTION_DETECTED",
          "Input rejected by AI safety policy.",
        );
      }
    }
  }

  const humanApproved = params.verifiedHumanApproval === true;
  if (tool.requiresHumanApproval && !humanApproved) {
    await recordSecurityAudit(
      {
        actorId: active.uid,
        actorRole: active.role,
        action: "ai:tool:proposal_required",
        targetType: "mcp_tool",
        targetId: tool.name,
        shopId: resolvedShopId,
        outcome: "ALLOW",
        metadata: { access: tool.access },
      },
      params.auditSink,
    );
    return {
      status: "approval_required",
      toolName: tool.name,
      tenantShopId: resolvedShopId,
      access: tool.access,
      validatedArgs,
    };
  }

  const boundContext: TenantBoundToolContext = Object.freeze({
    uid: active.uid,
    role: active.role,
    shopId: resolvedShopId,
    humanApproved,
  });

  const result = params.executor
    ? await params.executor(boundContext, validatedArgs)
    : { queued: true, shopId: resolvedShopId, tool: tool.name };

  await recordSecurityAudit(
    {
      actorId: active.uid,
      actorRole: active.role,
      action: "ai:tool:executed",
      targetType: "mcp_tool",
      targetId: tool.name,
      shopId: resolvedShopId,
      outcome: "ALLOW",
      metadata: { access: tool.access, humanApproved },
    },
    params.auditSink,
  );

  return {
    status: "executed",
    toolName: tool.name,
    tenantShopId: resolvedShopId,
    access: tool.access,
    validatedArgs,
    result,
  };
}
