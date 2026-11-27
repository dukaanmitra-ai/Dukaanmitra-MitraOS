import {
  AdapterError,
  type AdminShopSummary,
  type CanonicalCustomer,
  type CanonicalInsight,
  type CanonicalLedgerEntry,
  type CanonicalLedgerEntryType,
  type CustomerLifecycleStatus,
  type FirestoreLedgerType,
  type GlobalAdminMetrics,
  type InsightType,
  type LedgerSource,
  type LegacyUiRole,
  type MvpRole,
  type PhoneNormalizationMode,
  type ShopPlan,
  type ShopProfile,
  type ShopStatus,
  type SubscriptionOrder,
  type UserAccountStatus,
} from "./types";

const VALID_ROLES = new Set<MvpRole>([
  "owner",
  "staff",
  "franchise_admin",
  "super_admin",
]);

const VALID_USER_STATUSES = new Set<UserAccountStatus>([
  "active",
  "pending",
  "suspended",
]);

const VALID_SHOP_STATUSES = new Set<ShopStatus>([
  "active",
  "trial",
  "suspended",
  "cancelled",
  "locked",
  "integrity_lock",
]);

const VALID_SHOP_PLANS = new Set<ShopPlan>([
  "free",
  "basic",
  "pro",
  "enterprise",
]);

const VALID_INSIGHT_TYPES = new Set<InsightType>([
  "SALES_DROP",
  "GROWTH_TIP",
  "RISK_ALERT",
  "SUCCESS",
  "ACTION_REQUIRED",
]);

const VALID_LEDGER_SOURCES = new Set<LedgerSource>([
  "whatsapp",
  "app",
  "manual",
  "app-ai",
  "whatsapp-ai",
]);

let configuredPhoneNormalizationMode: PhoneNormalizationMode = "digits10";

/**
 * Allows configuring phone document ID normalization strategy once live
 * mvp1-aafa3 production customer doc IDs (10-digit vs E.164) are confirmed.
 */
export function setPhoneNormalizationMode(mode: PhoneNormalizationMode): void {
  configuredPhoneNormalizationMode = mode;
}

export function getPhoneNormalizationMode(): PhoneNormalizationMode {
  return configuredPhoneNormalizationMode;
}

/**
 * Isolated phone normalization helper.
 * Does NOT assume live production ID format globally; callers or app boot config
 * can override via `mode` or `setPhoneNormalizationMode`.
 */
export function normalizeCustomerPhoneId(
  rawPhone: string,
  mode: PhoneNormalizationMode = configuredPhoneNormalizationMode,
): string {
  if (typeof rawPhone !== "string") {
    throw new AdapterError("INVALID_INPUT", "Customer phone number must be a string.");
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    throw new AdapterError("INVALID_INPUT", "Customer phone number is required.");
  }

  if (mode === "raw_trimmed") {
    if (trimmed.includes("/") || trimmed.length < 7 || trimmed.length > 20) {
      throw new AdapterError(
        "INVALID_INPUT",
        "Customer phone number contains invalid characters or length.",
      );
    }
    return trimmed;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  let last10 = digitsOnly;

  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    last10 = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    last10 = digitsOnly.slice(1);
  }

  if (!/^\d{10}$/.test(last10)) {
    throw new AdapterError(
      "INVALID_INPUT",
      "Please enter a valid 10-digit Indian mobile number.",
      { details: { rawPhone } },
    );
  }

  if (mode === "e164_in") {
    return `91${last10}`;
  }

  return last10;
}

/**
 * Safely converts Firestore Timestamp, Date, number (ms or sec), or ISO string to epoch milliseconds.
 */
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object") {
    const obj = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof obj.toMillis === "function") {
      const ms = obj.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof obj.seconds === "number" && Number.isFinite(obj.seconds)) {
      return obj.seconds * 1000;
    }
    if (typeof obj._seconds === "number" && Number.isFinite(obj._seconds)) {
      return obj._seconds * 1000;
    }
  }

  return null;
}

function asRecord(raw: unknown, entityName: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid ${entityName} document: expected object.`,
    );
  }
  return raw as Record<string, unknown>;
}

function requireNonEmptyString(
  obj: Record<string, unknown>,
  field: string,
  entityName: string,
): string {
  const val = obj[field];
  if (typeof val !== "string" || val.trim().length === 0) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid ${entityName} document: missing or invalid required string field "${field}".`,
      { details: { entityName, field } },
    );
  }
  return val.trim();
}

function optionalString(obj: Record<string, unknown>, field: string): string | undefined {
  const val = obj[field];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : undefined;
}

function safeFiniteNumber(
  value: unknown,
  fallback: number,
  fieldName?: string,
  required = false,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (required) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid numeric field "${fieldName ?? "unknown"}": expected finite number.`,
    );
  }
  return fallback;
}

// ============================================================================
// Role & User Profile Mapping
// ============================================================================

export function parseMvpRole(rawRole: unknown): MvpRole {
  if (typeof rawRole === "string" && VALID_ROLES.has(rawRole as MvpRole)) {
    return rawRole as MvpRole;
  }
  throw new AdapterError(
    "INVALID_SCHEMA",
    `Unknown or invalid user role: "${String(rawRole)}".`,
    { details: { rawRole } },
  );
}

export function mapMvpRoleToLegacyRole(role: MvpRole): LegacyUiRole {
  if (role === "super_admin" || role === "franchise_admin") {
    return "superadmin";
  }
  return "merchant";
}

export function parseUserAccountStatus(rawStatus: unknown): UserAccountStatus {
  if (
    typeof rawStatus === "string" &&
    VALID_USER_STATUSES.has(rawStatus as UserAccountStatus)
  ) {
    return rawStatus as UserAccountStatus;
  }
  throw new AdapterError(
    "INVALID_SCHEMA",
    `Unknown or invalid user status: "${String(rawStatus)}".`,
    { details: { rawStatus } },
  );
}

export interface ParsedUserProfileDoc {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: MvpRole;
  status: UserAccountStatus;
  shopId: string | null;
  sessionRevokedAtMs: number | null;
}

export function mapUserProfileDoc(
  uid: string,
  rawData: unknown,
  fallbackEmail = "",
): ParsedUserProfileDoc {
  const data = asRecord(rawData, "UserProfile");
  const role = parseMvpRole(data.role);
  const status = parseUserAccountStatus(data.status);
  const email = optionalString(data, "email") ?? fallbackEmail;
  const shopId = optionalString(data, "shopId") ?? null;

  return {
    uid,
    email,
    displayName: optionalString(data, "displayName"),
    photoURL: optionalString(data, "photoURL"),
    role,
    status,
    shopId,
    sessionRevokedAtMs: toMillis(data.sessionRevokedAt),
  };
}

// ============================================================================
// Shop Mapping (shops/{shopId})
// ============================================================================

export function mapShopDoc(docId: string, rawData: unknown): ShopProfile {
  const data = asRecord(rawData, "Shop");
  const id = optionalString(data, "id") ?? docId;
  const ownerId = requireNonEmptyString(data, "owner_id", "Shop");
  const name = requireNonEmptyString(data, "name", "Shop");
  const phone = requireNonEmptyString(data, "phone", "Shop");
  const whatsapp = optionalString(data, "whatsapp") ?? phone;

  const rawStatus = optionalString(data, "status") ?? "active";
  if (!VALID_SHOP_STATUSES.has(rawStatus as ShopStatus)) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid Shop status "${rawStatus}" on shop "${id}".`,
    );
  }

  const rawPlan = optionalString(data, "plan") ?? "free";
  if (!VALID_SHOP_PLANS.has(rawPlan as ShopPlan)) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid Shop plan "${rawPlan}" on shop "${id}".`,
    );
  }

  const rawImpact =
    data.impact_metrics && typeof data.impact_metrics === "object"
      ? (data.impact_metrics as Record<string, unknown>)
      : {};

  const rawSettings =
    data.settings && typeof data.settings === "object"
      ? (data.settings as Record<string, unknown>)
      : undefined;

  return {
    id,
    ownerId,
    name,
    phone,
    whatsapp,
    ownerName: optionalString(data, "owner_name"),
    address: optionalString(data, "address"),
    city: optionalString(data, "city"),
    state: optionalString(data, "state"),
    pincode: optionalString(data, "pincode"),
    plan: rawPlan as ShopPlan,
    status: rawStatus as ShopStatus,
    mrr: typeof data.mrr === "number" && Number.isFinite(data.mrr) ? data.mrr : undefined,
    paidTillMs: toMillis(data.paid_till),
    trialEndsAtMs: toMillis(data.trial_ends_at),
    lastActiveMs: toMillis(data.lastActive),
    createdAtMs: toMillis(data.created_at),
    updatedAtMs: toMillis(data.updated_at),
    impactMetrics: {
      totalEntries: safeFiniteNumber(rawImpact.total_entries, 0),
      totalRecoveryInr: safeFiniteNumber(rawImpact.total_recovery_inr, 0),
    },
    settings: rawSettings
      ? {
          language:
            rawSettings.language === "hi" ||
            rawSettings.language === "en" ||
            rawSettings.language === "hinglish"
              ? rawSettings.language
              : undefined,
          currency: optionalString(rawSettings, "currency"),
          timezone: optionalString(rawSettings, "timezone"),
          allowCredit:
            typeof rawSettings.allow_credit === "boolean"
              ? rawSettings.allow_credit
              : undefined,
          creditLimitPerTransaction:
            typeof rawSettings.credit_limit_per_transaction === "number" &&
            Number.isFinite(rawSettings.credit_limit_per_transaction)
              ? rawSettings.credit_limit_per_transaction
              : undefined,
          workingHours:
            rawSettings.working_hours &&
            typeof rawSettings.working_hours === "object"
              ? {
                  start: optionalString(
                    rawSettings.working_hours as Record<string, unknown>,
                    "start",
                  ),
                  end: optionalString(
                    rawSettings.working_hours as Record<string, unknown>,
                    "end",
                  ),
                }
              : undefined,
        }
      : undefined,
  };
}

export function mapShopToAdminSummary(shop: ShopProfile): AdminShopSummary {
  return {
    id: shop.id,
    name: shop.name,
    ownerId: shop.ownerId,
    whatsapp: shop.whatsapp,
    phone: shop.phone,
    status: shop.status,
    plan: shop.plan,
    totalRecoveryInr: shop.impactMetrics.totalRecoveryInr,
    totalEntries: shop.impactMetrics.totalEntries,
    mrr: shop.mrr ?? 0,
    createdAtMs: shop.createdAtMs,
  };
}

// ============================================================================
// Customer Mapping (shops/{shopId}/customers/{customerPhone})
// ============================================================================

export function normalizeCustomerStatus(rawStatus: unknown): CustomerLifecycleStatus {
  if (typeof rawStatus !== "string" || !rawStatus.trim()) {
    return "NEW";
  }
  const upper = rawStatus.trim().toUpperCase();
  if (
    upper === "NEW" ||
    upper === "REGULAR" ||
    upper === "REPEAT" ||
    upper === "LOYAL" ||
    upper === "CHURNED" ||
    upper === "BLOCKED"
  ) {
    return upper as CustomerLifecycleStatus;
  }
  throw new AdapterError(
    "INVALID_SCHEMA",
    `Invalid customer lifecycle status: "${rawStatus}".`,
  );
}

export function mapCustomerDoc(
  docId: string,
  expectedShopId: string,
  rawData: unknown,
): CanonicalCustomer {
  const data = asRecord(rawData, "Customer");
  const shopId = optionalString(data, "shop_id") ?? expectedShopId;

  if (shopId !== expectedShopId) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Customer document "${docId}" shop_id "${shopId}" does not match expected shop "${expectedShopId}".`,
    );
  }

  const phone = optionalString(data, "phone") ?? docId;
  if (!phone) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid Customer document "${docId}": phone is required.`,
    );
  }

  const rawUdhaar = data.totalUdhaar;
  if (rawUdhaar !== undefined && (typeof rawUdhaar !== "number" || !Number.isFinite(rawUdhaar))) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid Customer "${docId}": totalUdhaar must be a finite number.`,
    );
  }

  const rawSpent = data.total_spent;
  if (rawSpent !== undefined && (typeof rawSpent !== "number" || !Number.isFinite(rawSpent))) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid Customer "${docId}": total_spent must be a finite number.`,
    );
  }

  const name = optionalString(data, "name") ?? `Grahak ${phone.slice(-4)}`;

  return {
    id: docId,
    shopId,
    phone,
    name,
    balance: safeFiniteNumber(rawUdhaar, 0),
    totalSpent: safeFiniteNumber(rawSpent, 0),
    visitCount: safeFiniteNumber(data.visit_count, 0),
    status: normalizeCustomerStatus(data.status),
    firstVisitMs: toMillis(data.first_visit),
    lastVisitMs: toMillis(data.last_visit) ?? toMillis(data.updated_at),
    lastPaymentDateMs: toMillis(data.lastPaymentDate),
    lastReminderSentAtMs: toMillis(data.lastReminderSentAt),
    reminderCount: safeFiniteNumber(data.reminderCount, 0),
    createdAtMs: toMillis(data.created_at),
    updatedAtMs: toMillis(data.updated_at),
  };
}

// ============================================================================
// Ledger Mapping (shops/{shopId}/ledger/{ledgerId})
// ============================================================================

export function mapFirestoreLedgerTypeToCanonical(
  rawType: unknown,
): CanonicalLedgerEntryType {
  if (rawType === "credit") return "udhaar";
  if (rawType === "payment") return "payment";
  throw new AdapterError(
    "INVALID_SCHEMA",
    `Unsupported Firestore ledger entry type: "${String(rawType)}". Expected "credit" or "payment".`,
    { details: { rawType } },
  );
}

/**
 * Strictly maps canonical ledger types to Firestore `shops/{shopId}/ledger` types.
 * Cash sales (`sale`) MUST NOT be silently treated as `credit` (udhaar) or `payment`.
 */
export function mapCanonicalTypeToFirestoreLedgerType(
  type: CanonicalLedgerEntryType,
): FirestoreLedgerType {
  if (type === "udhaar") return "credit";
  if (type === "payment") return "payment";
  if (type === "sale") {
    throw new AdapterError(
      "CASH_SALE_REQUIRES_POS_API",
      'Cash sales ("sale") cannot be written to Firestore credit ledger (shops/{shopId}/ledger only supports "credit" and "payment"). Route cash POS sales through Core Engine POS API.',
      { details: { attemptedType: type } },
    );
  }
  throw new AdapterError(
    "INVALID_INPUT",
    `Invalid ledger transaction type: "${String(type)}".`,
  );
}

export function mapLedgerDoc(
  docId: string,
  expectedShopId: string,
  rawData: unknown,
): CanonicalLedgerEntry {
  const data = asRecord(rawData, "LedgerEntry");
  const id = optionalString(data, "id") ?? docId;
  const shopId = requireNonEmptyString(data, "shop_id", "LedgerEntry");

  if (shopId !== expectedShopId) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `LedgerEntry "${id}" shop_id "${shopId}" does not match path shop "${expectedShopId}".`,
    );
  }

  const customerPhone = requireNonEmptyString(data, "customerPhone", "LedgerEntry");
  const amount = safeFiniteNumber(data.amount, 0, "amount", true);
  if (amount <= 0) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `LedgerEntry "${id}" amount must be positive.`,
    );
  }

  const type = mapFirestoreLedgerTypeToCanonical(data.type);
  const rawSource = optionalString(data, "source") ?? "app";
  const source: LedgerSource = VALID_LEDGER_SOURCES.has(rawSource as LedgerSource)
    ? (rawSource as LedgerSource)
    : "app";

  const createdAtMs = toMillis(data.createdAt) ?? 0;

  return {
    id,
    shopId,
    customerPhone,
    customerName: optionalString(data, "customerName") ?? `Grahak ${customerPhone.slice(-4)}`,
    amount,
    item: optionalString(data, "item") ?? "Saman",
    type,
    source,
    createdAtMs,
    actorId: optionalString(data, "actorId"),
    correlationId: optionalString(data, "correlationId"),
    rawText: optionalString(data, "raw_text"),
    sourceConfidence:
      typeof data.source_confidence === "number" &&
      Number.isFinite(data.source_confidence)
        ? data.source_confidence
        : undefined,
  };
}

// ============================================================================
// Insights & Global Admin Metrics & Orders Mapping
// ============================================================================

export function mapInsightDoc(
  docId: string,
  shopId: string,
  rawData: unknown,
): CanonicalInsight {
  const data = asRecord(rawData, "ShopInsight");
  const rawType = requireNonEmptyString(data, "type", "ShopInsight");
  if (!VALID_INSIGHT_TYPES.has(rawType as InsightType)) {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Unknown ShopInsight type "${rawType}".`,
    );
  }

  return {
    id: optionalString(data, "id") ?? docId,
    shopId,
    type: rawType as InsightType,
    title: requireNonEmptyString(data, "title", "ShopInsight"),
    message: requireNonEmptyString(data, "message", "ShopInsight"),
    actionLabel: optionalString(data, "action_label"),
    actionType: optionalString(data, "action_type"),
    actionPayload:
      data.action_payload && typeof data.action_payload === "object"
        ? (data.action_payload as Record<string, unknown>)
        : undefined,
    createdAtMs: toMillis(data.createdAt) ?? 0,
    isRead: Boolean(data.isRead),
  };
}

export function mapGlobalMetricsDoc(
  docId: string,
  rawData: unknown,
): GlobalAdminMetrics {
  const data = asRecord(rawData, "GlobalMetrics");
  return {
    id: optionalString(data, "id") ?? docId,
    version: safeFiniteNumber(data.version, 1),
    mrr: safeFiniteNumber(data.mrr, 0),
    activeSubscriptions: safeFiniteNumber(data.activeSubscriptions, 0),
    activeTrials: safeFiniteNumber(data.activeTrials, 0),
    churnedShops: safeFiniteNumber(data.churnedShops, 0),
    totalShops: safeFiniteNumber(data.totalShops, 0),
    trialToPaidConversionRate: safeFiniteNumber(data.trialToPaidConversionRate, 0),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

export function mapOrderDoc(docId: string, rawData: unknown): SubscriptionOrder {
  const data = asRecord(rawData, "Order");
  const plan = data.plan;
  if (plan !== "basic" && plan !== "pro") {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid order plan "${String(plan)}" on order "${docId}".`,
    );
  }
  const status = data.status;
  if (status !== "created" && status !== "paid") {
    throw new AdapterError(
      "INVALID_SCHEMA",
      `Invalid order status "${String(status)}" on order "${docId}".`,
    );
  }

  return {
    id: optionalString(data, "id") ?? docId,
    shopId: requireNonEmptyString(data, "shopId", "Order"),
    userId: requireNonEmptyString(data, "userId", "Order"),
    plan,
    amount: safeFiniteNumber(data.amount, 0, "amount", true),
    currency: "INR",
    razorpayOrderId: requireNonEmptyString(data, "razorpayOrderId", "Order"),
    razorpayPaymentId: optionalString(data, "razorpayPaymentId"),
    status,
    createdAtMs: toMillis(data.createdAt) ?? 0,
    paidAtMs: toMillis(data.paidAt),
  };
}

/**
 * Normalizes Firestore/Firebase SDK errors into typed AdapterError instances.
 */
export function normalizeFirestoreError(error: unknown, fallbackMessage: string): AdapterError {
  if (error instanceof AdapterError) {
    return error;
  }

  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code ?? "";
  const message = errObj?.message ?? fallbackMessage;

  if (code === "FIREBASE_NOT_CONFIGURED") {
    return new AdapterError("FIREBASE_NOT_CONFIGURED", message, { cause: error });
  }
  if (code === "FIREBASE_PROJECT_MISMATCH") {
    return new AdapterError("FIREBASE_PROJECT_MISMATCH", message, { cause: error });
  }
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return new AdapterError(
      "PERMISSION_DENIED",
      "Permission denied by Firestore security rules.",
      { cause: error },
    );
  }
  if (code === "unauthenticated" || code === "firestore/unauthenticated") {
    return new AdapterError(
      "UNAUTHENTICATED",
      "Authentication required to access this resource.",
      { cause: error },
    );
  }
  if (code === "unavailable" || code === "firestore/unavailable") {
    return new AdapterError(
      "NETWORK_ERROR",
      "Unable to reach Firestore. Check your connection and retry.",
      { cause: error },
    );
  }

  return new AdapterError("UNKNOWN", message || fallbackMessage, { cause: error });
}
