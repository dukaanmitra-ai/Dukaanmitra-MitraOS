/**
 * Canonical Frontend Domain Models & Error Contracts for MitraOS Adapter Layer
 *
 * UI components consume these canonical types and never depend on
 * Firestore collection paths or raw database field names.
 */

export type MvpRole = "owner" | "staff" | "franchise_admin" | "super_admin";

export type LegacyUiRole = "merchant" | "superadmin";

export type UserAccountStatus = "active" | "pending" | "suspended";

export type ShopStatus =
  | "active"
  | "trial"
  | "suspended"
  | "cancelled"
  | "locked"
  | "integrity_lock";

export type ShopPlan = "free" | "basic" | "pro" | "enterprise";

export type CustomerLifecycleStatus =
  | "NEW"
  | "REGULAR"
  | "REPEAT"
  | "LOYAL"
  | "CHURNED"
  | "BLOCKED";

/**
 * Preserves the strict distinction between:
 * - 'udhaar': Credit ledger entry (Firestore shops/{shopId}/ledger, raw type = 'credit')
 * - 'payment': Payment / recovery entry (Firestore shops/{shopId}/ledger, raw type = 'payment')
 * - 'sale': Cash POS sale (Core Engine PostgreSQL POST /api/sales — NEVER silently written as udhaar)
 */
export type CanonicalLedgerEntryType = "udhaar" | "payment" | "sale";

/** Raw Firestore LedgerEntry.type verified in mvp1-aafa3 */
export type FirestoreLedgerType = "credit" | "payment";

export type LedgerSource =
  | "whatsapp"
  | "app"
  | "manual"
  | "app-ai"
  | "whatsapp-ai";

export type InsightType =
  | "SALES_DROP"
  | "GROWTH_TIP"
  | "RISK_ALERT"
  | "SUCCESS"
  | "ACTION_REQUIRED";

export type PhoneNormalizationMode = "digits10" | "e164_in" | "raw_trimmed";

export type AdapterErrorCode =
  | "FIREBASE_NOT_CONFIGURED"
  | "FIREBASE_PROJECT_MISMATCH"
  | "UNAUTHENTICATED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_PENDING"
  | "SESSION_REVOKED"
  | "FORBIDDEN"
  | "CROSS_TENANT_DENIED"
  | "NOT_FOUND"
  | "INVALID_SCHEMA"
  | "INVALID_INPUT"
  | "SHOP_LOCKED"
  | "LEDGER_IMMUTABLE"
  | "CASH_SALE_REQUIRES_POS_API"
  | "DEMO_WRITE_FORBIDDEN"
  | "SERVER_PROVISIONING_REQUIRED"
  | "ENDPOINT_NOT_CONFIGURED"
  | "REQUEST_TIMEOUT"
  | "NETWORK_ERROR"
  | "PERMISSION_DENIED"
  | "UNKNOWN";

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly statusCode?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AdapterErrorCode,
    message: string,
    options?: { statusCode?: number; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAdapterError(err: unknown): err is AdapterError {
  return err instanceof AdapterError;
}

export interface AuthSession {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: MvpRole;
  legacyRole: LegacyUiRole;
  status: UserAccountStatus;
  /** Authorized shopId sourced strictly from verified users/{uid} document */
  shopId: string | null;
  authTimeMs: number;
  sessionRevokedAtMs: number | null;
  canManageShop: boolean;
  canAccessAdmin: boolean;
}

export interface ShopSettings {
  language?: "hi" | "en" | "hinglish";
  currency?: string;
  timezone?: string;
  allowCredit?: boolean;
  creditLimitPerTransaction?: number;
  workingHours?: {
    start?: string;
    end?: string;
  };
}

export interface ShopProfile {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  whatsapp: string;
  ownerName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  plan: ShopPlan;
  status: ShopStatus;
  mrr?: number;
  paidTillMs: number | null;
  trialEndsAtMs: number | null;
  lastActiveMs: number | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  impactMetrics: {
    totalEntries: number;
    totalRecoveryInr: number;
  };
  settings?: ShopSettings;
}

export interface ShopMetrics {
  shopId: string;
  totalRecoveryInr: number;
  totalEntries: number;
  totalUdhaarOutstanding: number;
  pendingCustomersCount: number;
  totalCustomersCount: number;
}

export interface ShopProfileUpdatePatch {
  name?: string;
  phone?: string;
  whatsapp?: string;
  ownerName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  settings?: ShopSettings;
}

export interface CanonicalCustomer {
  id: string;
  shopId: string;
  phone: string;
  name: string;
  /** Mapped from Firestore totalUdhaar */
  balance: number;
  /** Mapped from Firestore total_spent */
  totalSpent: number;
  visitCount: number;
  status: CustomerLifecycleStatus;
  firstVisitMs: number | null;
  lastVisitMs: number | null;
  lastPaymentDateMs: number | null;
  lastReminderSentAtMs: number | null;
  reminderCount: number;
  createdAtMs: number | null;
  updatedAtMs: number | null;
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
}

/**
 * Ordinary profile updates strictly exclude financial balance fields
 * (balance / totalUdhaar / total_spent / visit_count).
 */
export interface UpdateCustomerProfilePatch {
  name?: string;
  status?: CustomerLifecycleStatus;
}

export interface CanonicalLedgerEntry {
  id: string;
  shopId: string;
  customerPhone: string;
  customerName: string;
  amount: number;
  item: string;
  type: CanonicalLedgerEntryType;
  source: LedgerSource;
  createdAtMs: number;
  actorId?: string;
  correlationId?: string;
  rawText?: string;
  sourceConfidence?: number;
}

export interface CreateLedgerEntryInput {
  customerPhone: string;
  customerName?: string;
  amount: number;
  item?: string;
  type: CanonicalLedgerEntryType;
  source?: LedgerSource;
}

export interface CanonicalInsight {
  id: string;
  shopId: string;
  type: InsightType;
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: string;
  actionPayload?: Record<string, unknown>;
  createdAtMs: number;
  isRead: boolean;
}

export interface GlobalAdminMetrics {
  id: string;
  version: number;
  mrr: number;
  activeSubscriptions: number;
  activeTrials: number;
  churnedShops: number;
  totalShops: number;
  trialToPaidConversionRate: number;
  updatedAtMs: number | null;
}

export interface AdminShopSummary {
  id: string;
  name: string;
  ownerId: string;
  whatsapp: string;
  phone: string;
  status: ShopStatus;
  plan: ShopPlan;
  totalRecoveryInr: number;
  totalEntries: number;
  mrr: number;
  createdAtMs: number | null;
}

export interface SubscriptionOrder {
  id: string;
  shopId: string;
  userId: string;
  plan: "basic" | "pro";
  amount: number;
  currency: "INR";
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: "created" | "paid";
  createdAtMs: number;
  paidAtMs?: number | null;
}

export interface SubscriptionCallbacks<T> {
  onData: (data: T) => void;
  onError: (error: AdapterError) => void;
}

/**
 * Typed interface for server-side shop onboarding once users/{uid}.shopId is locked
 * from direct client writes in production Firestore rules.
 */
export interface ShopOnboardingRequest {
  name: string;
  phone: string;
  city?: string;
}

export interface ShopOnboardingResult {
  shopId: string;
  shop: ShopProfile;
}

export interface ShopOnboardingService {
  createShopForCurrentUser(
    request: ShopOnboardingRequest,
  ): Promise<ShopOnboardingResult>;
}
