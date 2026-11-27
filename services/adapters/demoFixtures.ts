import {
  AdapterError,
  type CanonicalCustomer,
  type CanonicalInsight,
  type CanonicalLedgerEntry,
  type ShopMetrics,
  type ShopProfile,
} from "./types";

/**
 * Strictly isolated read-only fixtures exclusively for the public `/demo` route.
 *
 * Rules:
 * - Demo data must NEVER be written to production Firebase.
 * - Authenticated production UI must NEVER silently fall back to these fixtures.
 */

export const DEMO_SHOP_IDS = new Set<string>([
  "demo-mode",
  "sharma-kirana-demo",
]);

export function isDemoShopId(shopId: string | null | undefined): boolean {
  return typeof shopId === "string" && DEMO_SHOP_IDS.has(shopId.trim());
}

/**
 * Runtime guard called at the entry of every production write adapter.
 * Ensures demo IDs can never leak writes into production Firestore.
 */
export function assertNotDemoWrite(shopId: string, operation: string): void {
  if (isDemoShopId(shopId)) {
    throw new AdapterError(
      "DEMO_WRITE_FORBIDDEN",
      `Blocked "${operation}" on demo shop "${shopId}". Demo fixtures are strictly read-only and never write to production Firebase.`,
      { details: { shopId, operation } },
    );
  }
}

const NOW = 1764000000000;

export const DEMO_SHOP_PROFILE: Readonly<ShopProfile> = Object.freeze({
  id: "sharma-kirana-demo",
  ownerId: "demo-readonly-owner",
  name: "Sharma Kirana & General Store (Read-Only Demo)",
  phone: "9876543210",
  whatsapp: "+91 98765 43210",
  ownerName: "Ramesh Sharma",
  city: "Kanpur",
  state: "Uttar Pradesh",
  plan: "pro",
  status: "active",
  paidTillMs: null,
  trialEndsAtMs: null,
  lastActiveMs: NOW,
  createdAtMs: NOW - 86400000 * 30,
  updatedAtMs: NOW,
  impactMetrics: Object.freeze({
    totalEntries: 142,
    totalRecoveryInr: 45200,
  }),
});

export const DEMO_CUSTOMERS: ReadonlyArray<Readonly<CanonicalCustomer>> =
  Object.freeze([
    Object.freeze({
      id: "9876543210",
      shopId: "sharma-kirana-demo",
      phone: "9876543210",
      name: "Ramesh Singh",
      balance: 2500,
      totalSpent: 4500,
      visitCount: 8,
      status: "LOYAL" as const,
      firstVisitMs: NOW - 86400000 * 25,
      lastVisitMs: NOW - 3600000 * 2,
      lastPaymentDateMs: NOW - 86400000 * 5,
      lastReminderSentAtMs: null,
      reminderCount: 1,
      createdAtMs: NOW - 86400000 * 25,
      updatedAtMs: NOW - 3600000 * 2,
    }),
    Object.freeze({
      id: "9876543211",
      shopId: "sharma-kirana-demo",
      phone: "9876543211",
      name: "Suresh Kumar",
      balance: 1500,
      totalSpent: 3200,
      visitCount: 4,
      status: "REGULAR" as const,
      firstVisitMs: NOW - 86400000 * 14,
      lastVisitMs: NOW - 86400000,
      lastPaymentDateMs: null,
      lastReminderSentAtMs: null,
      reminderCount: 0,
      createdAtMs: NOW - 86400000 * 14,
      updatedAtMs: NOW - 86400000,
    }),
  ]);

export const DEMO_LEDGER_ENTRIES: ReadonlyArray<Readonly<CanonicalLedgerEntry>> =
  Object.freeze([
    Object.freeze({
      id: "demo-tx-1",
      shopId: "sharma-kirana-demo",
      customerPhone: "9876543210",
      customerName: "Ramesh Singh",
      amount: 500,
      item: "2kg Sugar, Milk (POS Demo Sale)",
      type: "sale" as const,
      source: "app" as const,
      createdAtMs: NOW - 600000,
    }),
    Object.freeze({
      id: "demo-tx-2",
      shopId: "sharma-kirana-demo",
      customerPhone: "9876543210",
      customerName: "Ramesh Singh",
      amount: 1500,
      item: "Flour 10kg, Cooking Oil",
      type: "udhaar" as const,
      source: "whatsapp" as const,
      createdAtMs: NOW - 7200000,
    }),
    Object.freeze({
      id: "demo-tx-3",
      shopId: "sharma-kirana-demo",
      customerPhone: "9876543211",
      customerName: "Suresh Kumar",
      amount: 800,
      item: "Paid old udhaar via UPI",
      type: "payment" as const,
      source: "whatsapp" as const,
      createdAtMs: NOW - 86400000,
    }),
  ]);

export const DEMO_INSIGHTS: ReadonlyArray<Readonly<CanonicalInsight>> =
  Object.freeze([
    Object.freeze({
      id: "demo-insight-1",
      shopId: "sharma-kirana-demo",
      type: "ACTION_REQUIRED" as const,
      title: "Udhaar Recovery",
      message: "2 demo customers have outstanding udhaar totaling ₹4,000.",
      actionLabel: "Draft Reminder",
      actionType: "UDHAAR_REMINDER",
      createdAtMs: NOW - 3600000,
      isRead: false,
    }),
    Object.freeze({
      id: "demo-insight-2",
      shopId: "sharma-kirana-demo",
      type: "GROWTH_TIP" as const,
      title: "Review Prompt",
      message: "Invite regular buyers to leave a Google Review after UPI payment.",
      actionLabel: "Preview Message",
      actionType: "REVIEW_PROMPT",
      createdAtMs: NOW - 7200000,
      isRead: false,
    }),
  ]);

export const DEMO_SHOP_METRICS: Readonly<ShopMetrics> = Object.freeze({
  shopId: "sharma-kirana-demo",
  totalRecoveryInr: 45200,
  totalEntries: 142,
  totalUdhaarOutstanding: 4000,
  pendingCustomersCount: 2,
  totalCustomersCount: 2,
});

export function getReadOnlyDemoSnapshot(): {
  shop: ShopProfile;
  metrics: ShopMetrics;
  customers: CanonicalCustomer[];
  ledger: CanonicalLedgerEntry[];
  insights: CanonicalInsight[];
} {
  return {
    shop: {
      ...DEMO_SHOP_PROFILE,
      impactMetrics: { ...DEMO_SHOP_PROFILE.impactMetrics },
    },
    metrics: { ...DEMO_SHOP_METRICS },
    customers: DEMO_CUSTOMERS.map((c) => ({ ...c })),
    ledger: DEMO_LEDGER_ENTRIES.map((l) => ({ ...l })),
    insights: DEMO_INSIGHTS.map((i) => ({ ...i })),
  };
}
