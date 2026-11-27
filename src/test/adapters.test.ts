import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EXPECTED_FIREBASE_PROJECT_ID,
  validateFirebaseConfig,
} from "../../firebase";
import {
  mapCanonicalTypeToFirestoreLedgerType,
  mapCustomerDoc,
  mapFirestoreLedgerTypeToCanonical,
  mapGlobalMetricsDoc,
  mapInsightDoc,
  mapLedgerDoc,
  mapMvpRoleToLegacyRole,
  mapOrderDoc,
  mapShopDoc,
  normalizeCustomerPhoneId,
  parseMvpRole,
  setPhoneNormalizationMode,
} from "../../services/adapters/mappers";
import {
  assertAdminAccess,
  assertShopAccess,
  evaluateUserSession,
  shopOnboardingService,
} from "../../services/adapters/authAdapter";
import {
  assertNotDemoWrite,
  DEMO_SHOP_PROFILE,
  getReadOnlyDemoSnapshot,
  isDemoShopId,
} from "../../services/adapters/demoFixtures";
import {
  createCustomer,
  updateCustomer,
} from "../../services/adapters/customerAdapter";
import {
  createLedgerEntry,
  deleteLedgerEntry,
  updateLedgerEntry,
} from "../../services/adapters/ledgerAdapter";
import {
  getCurrentUserShop,
  getShop,
  updateShopProfile,
} from "../../services/adapters/shopAdapter";
import {
  getAllShops,
  getGlobalMetrics,
} from "../../services/adapters/adminAdapter";
import {
  authenticatedApiRequest,
  createSubscriptionOrder,
} from "../../services/adapters/orderAdapter";
import { logTransaction } from "../../services/storeService";
import { AdapterError, type AuthSession } from "../../services/adapters/types";

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    uid: "uid-owner-1",
    email: "owner@shop.in",
    role: "owner",
    legacyRole: "merchant",
    status: "active",
    shopId: "shop-a",
    authTimeMs: 1_700_000_000_000,
    sessionRevokedAtMs: null,
    canManageShop: true,
    canAccessAdmin: false,
    ...overrides,
  };
}

describe("Firebase Configuration Validation (mvp1-aafa3)", () => {
  it("fails safely when required Vite Firebase env vars are missing (Case 5)", () => {
    const result = validateFirebaseConfig({
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_PROJECT_ID: "mvp1-aafa3",
    });

    expect(result.isConfigured).toBe(false);
    expect(result.config).toBeNull();
    expect(result.missingKeys).toContain("VITE_FIREBASE_API_KEY");
    expect(result.missingKeys).toContain("VITE_FIREBASE_AUTH_DOMAIN");
    expect(result.missingKeys).toContain("VITE_FIREBASE_APP_ID");
    expect(result.error).toMatch(/Missing required Vite env var/);
  });

  it("rejects mismatched Firebase project IDs", () => {
    const result = validateFirebaseConfig({
      VITE_FIREBASE_API_KEY: "AIzaSyValidKey123",
      VITE_FIREBASE_AUTH_DOMAIN: "wrong.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "wrong-project",
      VITE_FIREBASE_STORAGE_BUCKET: "wrong.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      VITE_FIREBASE_APP_ID: "1:123:web:abc",
    });

    expect(result.isConfigured).toBe(false);
    expect(result.error).toContain(EXPECTED_FIREBASE_PROJECT_ID);
  });

  it("accepts complete mvp1-aafa3 Vite config with optional measurementId", () => {
    const result = validateFirebaseConfig({
      VITE_FIREBASE_API_KEY: "AIzaSyValidKey123",
      VITE_FIREBASE_AUTH_DOMAIN: "mvp1-aafa3.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "mvp1-aafa3",
      VITE_FIREBASE_STORAGE_BUCKET: "mvp1-aafa3.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      VITE_FIREBASE_APP_ID: "1:123:web:abc",
      VITE_FIREBASE_MEASUREMENT_ID: "G-TEST123",
    });

    expect(result.isConfigured).toBe(true);
    expect(result.projectId).toBe("mvp1-aafa3");
    expect(result.config?.measurementId).toBe("G-TEST123");
  });
});

describe("Canonical Field & Role Mapping", () => {
  beforeEach(() => {
    setPhoneNormalizationMode("digits10");
  });

  it("maps verified roles accurately and rejects unknown roles", () => {
    expect(parseMvpRole("owner")).toBe("owner");
    expect(parseMvpRole("staff")).toBe("staff");
    expect(parseMvpRole("franchise_admin")).toBe("franchise_admin");
    expect(parseMvpRole("super_admin")).toBe("super_admin");

    expect(mapMvpRoleToLegacyRole("owner")).toBe("merchant");
    expect(mapMvpRoleToLegacyRole("staff")).toBe("merchant");
    expect(mapMvpRoleToLegacyRole("franchise_admin")).toBe("superadmin");
    expect(mapMvpRoleToLegacyRole("super_admin")).toBe("superadmin");

    expect(() => parseMvpRole("hacker_admin")).toThrowError(AdapterError);
    try {
      parseMvpRole("unknown_role");
    } catch (e) {
      expect((e as AdapterError).code).toBe("INVALID_SCHEMA");
    }
  });

  it("normalizes customer phone IDs using isolated configurable strategies", () => {
    expect(normalizeCustomerPhoneId("+91 98765-43210", "digits10")).toBe("9876543210");
    expect(normalizeCustomerPhoneId("09876543210", "digits10")).toBe("9876543210");
    expect(normalizeCustomerPhoneId("9876543210", "e164_in")).toBe("919876543210");
    expect(normalizeCustomerPhoneId("+919876543210", "raw_trimmed")).toBe("+919876543210");

    expect(() => normalizeCustomerPhoneId("12345", "digits10")).toThrowError(
      AdapterError,
    );
  });

  it("maps Firestore customer totalUdhaar -> balance and total_spent -> totalSpent", () => {
    const mapped = mapCustomerDoc("9876543210", "shop-a", {
      shop_id: "shop-a",
      phone: "9876543210",
      name: "Ramesh Singh",
      totalUdhaar: 2450,
      total_spent: 12000,
      visit_count: 6,
      status: "new",
    });

    expect(mapped.balance).toBe(2450);
    expect(mapped.totalSpent).toBe(12000);
    expect(mapped.status).toBe("NEW");
  });

  it("rejects invalid customer schema documents (Case 6)", () => {
    expect(() =>
      mapCustomerDoc("9876543210", "shop-a", {
        shop_id: "shop-b",
        phone: "9876543210",
        totalUdhaar: 100,
      }),
    ).toThrowError(AdapterError);

    expect(() =>
      mapCustomerDoc("9876543210", "shop-a", {
        shop_id: "shop-a",
        phone: "9876543210",
        totalUdhaar: "not-a-number",
      }),
    ).toThrowError(AdapterError);
  });

  it("maps Firestore shop, insight, global metrics, and order schemas strictly", () => {
    const shop = mapShopDoc("shop-a", {
      owner_id: "uid-owner-1",
      name: "Gupta Kirana",
      phone: "9876543210",
      plan: "pro",
      status: "active",
      impact_metrics: { total_entries: 12, total_recovery_inr: 9500 },
    });
    expect(shop.ownerId).toBe("uid-owner-1");
    expect(shop.impactMetrics.totalRecoveryInr).toBe(9500);

    const insight = mapInsightDoc("ins-1", "shop-a", {
      type: "ACTION_REQUIRED",
      title: "Recover Udhaar",
      message: "3 customers overdue",
      isRead: false,
    });
    expect(insight.type).toBe("ACTION_REQUIRED");

    const metrics = mapGlobalMetricsDoc("global", {
      version: 2,
      mrr: 50000,
      activeSubscriptions: 25,
      activeTrials: 10,
      churnedShops: 2,
      totalShops: 37,
      trialToPaidConversionRate: 0.42,
    });
    expect(metrics.mrr).toBe(50000);

    const order = mapOrderDoc("ord-1", {
      shopId: "shop-a",
      userId: "uid-owner-1",
      plan: "basic",
      amount: 1999,
      razorpayOrderId: "order_123",
      status: "created",
    });
    expect(order.amount).toBe(1999);
  });
});

describe("Authentication, Authorization & Session Security Boundaries", () => {
  it("allows owner to access own shop (Case 1)", () => {
    const session = makeSession({ role: "owner", shopId: "shop-a" });
    expect(assertShopAccess(session, "shop-a")).toEqual(session);
    expect(assertShopAccess(session, "shop-a", { requireOwner: true })).toEqual(
      session,
    );
  });

  it("blocks user from accessing another shop (Case 2)", async () => {
    const session = makeSession({ uid: "uid-a", role: "owner", shopId: "shop-a" });

    expect(() => assertShopAccess(session, "shop-b")).toThrowError(
      /not authorized for shop "shop-b"/,
    );

    await expect(getShop("shop-b", session)).rejects.toMatchObject({
      code: "CROSS_TENANT_DENIED",
    });
    await expect(
      createCustomer("shop-b", { name: "Test", phone: "9876543210" }, session),
    ).rejects.toMatchObject({ code: "CROSS_TENANT_DENIED" });
    await expect(
      createLedgerEntry(
        "shop-b",
        { customerPhone: "9876543210", amount: 500, type: "udhaar" },
        session,
      ),
    ).rejects.toMatchObject({ code: "CROSS_TENANT_DENIED" });
  });

  it("blocks staff from owner-only shop profile updates", async () => {
    const staffSession = makeSession({
      role: "staff",
      shopId: "shop-a",
      canManageShop: false,
    });

    await expect(
      updateShopProfile("shop-a", { name: "Renamed Shop" }, staffSession),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects suspended users (Case 3)", () => {
    expect(() =>
      evaluateUserSession({
        uid: "uid-susp",
        rawUserDoc: {
          email: "susp@shop.in",
          role: "owner",
          status: "suspended",
          shopId: "shop-a",
        },
        authTimeMs: 1_700_000_000_000,
      }),
    ).toThrowError(AdapterError);

    try {
      evaluateUserSession({
        uid: "uid-susp",
        rawUserDoc: {
          email: "susp@shop.in",
          role: "owner",
          status: "suspended",
          shopId: "shop-a",
        },
        authTimeMs: 1_700_000_000_000,
      });
    } catch (e) {
      expect((e as AdapterError).code).toBe("ACCOUNT_SUSPENDED");
    }
  });

  it("rejects sessions invalidated by sessionRevokedAt > authTime (Case 4)", () => {
    const authTimeMs = 1_700_000_000_000;
    const revokedAfterAuth = authTimeMs + 60_000;

    try {
      evaluateUserSession({
        uid: "uid-revoked",
        rawUserDoc: {
          email: "revoked@shop.in",
          role: "owner",
          status: "active",
          shopId: "shop-a",
          sessionRevokedAt: new Date(revokedAfterAuth),
        },
        authTimeMs,
      });
      expect.unreachable("Expected SESSION_REVOKED error");
    } catch (e) {
      expect((e as AdapterError).code).toBe("SESSION_REVOKED");
    }
  });

  it("blocks ordinary shop owners from global admin metrics and shop listings", async () => {
    const ownerSession = makeSession({ role: "owner", canAccessAdmin: false });

    expect(() => assertAdminAccess(ownerSession)).toThrowError(AdapterError);
    await expect(getGlobalMetrics(ownerSession)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getAllShops(ownerSession)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const superAdmin = makeSession({
      role: "super_admin",
      legacyRole: "superadmin",
      canAccessAdmin: true,
    });
    expect(assertAdminAccess(superAdmin)).toEqual(superAdmin);
  });

  it("returns NOT_FOUND when current user has no linked shop and blocks client auto-provisioning", async () => {
    const noShopSession = makeSession({ shopId: null });
    await expect(getCurrentUserShop(noShopSession)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      shopOnboardingService.createShopForCurrentUser({
        name: "My Shop",
        phone: "9876543210",
      }),
    ).rejects.toMatchObject({ code: "SERVER_PROVISIONING_REQUIRED" });
  });
});

describe("Customer & Ledger Safety Invariants", () => {
  const ownerSession = makeSession({ role: "owner", shopId: "shop-a" });

  it("blocks overwriting customer balance via ordinary updateCustomer profile calls (Case 6)", async () => {
    await expect(
      updateCustomer(
        "shop-a",
        "9876543210",
        { name: "Ramesh", totalUdhaar: 0 } as Record<string, unknown>,
        ownerSession,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      updateCustomer(
        "shop-a",
        "9876543210",
        { balance: 99999 } as Record<string, unknown>,
        ownerSession,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("enforces ledger immutability on update and delete attempts (Case 7)", async () => {
    await expect(updateLedgerEntry("shop-a", "ledger-1")).rejects.toMatchObject({
      code: "LEDGER_IMMUTABLE",
    });
    await expect(deleteLedgerEntry("shop-a", "ledger-1")).rejects.toMatchObject({
      code: "LEDGER_IMMUTABLE",
    });
  });

  it("preserves cash sale vs udhaar distinction and never coerces sale into credit (Case 8)", async () => {
    expect(mapFirestoreLedgerTypeToCanonical("credit")).toBe("udhaar");
    expect(mapFirestoreLedgerTypeToCanonical("payment")).toBe("payment");
    expect(mapCanonicalTypeToFirestoreLedgerType("udhaar")).toBe("credit");
    expect(mapCanonicalTypeToFirestoreLedgerType("payment")).toBe("payment");

    expect(() => mapCanonicalTypeToFirestoreLedgerType("sale")).toThrowError(
      AdapterError,
    );

    const mappedCredit = mapLedgerDoc("led-1", "shop-a", {
      id: "led-1",
      shop_id: "shop-a",
      customerPhone: "9876543210",
      customerName: "Ramesh",
      amount: 500,
      item: "Sugar",
      type: "credit",
      source: "app",
    });
    expect(mappedCredit.type).toBe("udhaar");

    await expect(
      createLedgerEntry(
        "shop-a",
        {
          customerPhone: "9876543210",
          amount: 500,
          item: "Cash Sugar Sale",
          type: "sale",
        },
        ownerSession,
      ),
    ).rejects.toMatchObject({ code: "CASH_SALE_REQUIRES_POS_API" });

    await expect(
      logTransaction(
        "shop-a",
        { type: "sale", amount: 500, customerName: "Ramesh", items: "Milk" },
        ownerSession,
      ),
    ).rejects.toMatchObject({ code: "CASH_SALE_REQUIRES_POS_API" });
  });
});

describe("Demo Isolation & Production Write Guard (Case 9)", () => {
  const demoSession = makeSession({ shopId: "demo-mode" });

  it("keeps demo fixtures strictly read-only and blocks all production writes", async () => {
    expect(isDemoShopId("demo-mode")).toBe(true);
    expect(isDemoShopId("sharma-kirana-demo")).toBe(true);
    expect(isDemoShopId("shop-prod-123")).toBe(false);
    expect(Object.isFrozen(DEMO_SHOP_PROFILE)).toBe(true);

    const snap = getReadOnlyDemoSnapshot();
    expect(snap.customers.length).toBeGreaterThan(0);

    expect(() => assertNotDemoWrite("demo-mode", "write")).toThrowError(
      AdapterError,
    );

    await expect(
      createCustomer("demo-mode", { name: "Test", phone: "9876543210" }, demoSession),
    ).rejects.toMatchObject({ code: "DEMO_WRITE_FORBIDDEN" });

    await expect(
      updateCustomer("sharma-kirana-demo", "9876543210", { name: "Edited" }, demoSession),
    ).rejects.toMatchObject({ code: "DEMO_WRITE_FORBIDDEN" });

    await expect(
      createLedgerEntry(
        "demo-mode",
        { customerPhone: "9876543210", amount: 250, type: "udhaar" },
        demoSession,
      ),
    ).rejects.toMatchObject({ code: "DEMO_WRITE_FORBIDDEN" });

    await expect(
      updateShopProfile("demo-mode", { name: "Hacked Demo" }, demoSession),
    ).rejects.toMatchObject({ code: "DEMO_WRITE_FORBIDDEN" });

    await expect(
      createSubscriptionOrder({ shopId: "demo-mode", plan: "pro" }, demoSession),
    ).rejects.toMatchObject({ code: "DEMO_WRITE_FORBIDDEN" });
  });
});

describe("Authenticated API Client Boundary", () => {
  it("injects Firebase Bearer token and Idempotency-Key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "order_1", amount: 1999, currency: "INR" }),
    });

    const data = await authenticatedApiRequest<{ id: string }>(
      "https://api.example.com/api/create-order",
      {
        method: "POST",
        body: { shopId: "shop-a", plan: "basic" },
        idempotencyKey: "order_idem_123",
        getToken: async () => "fake-firebase-id-token",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(data.id).toBe("order_1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer fake-firebase-id-token");
    expect(init.headers["Idempotency-Key"]).toBe("order_idem_123");
  });

  it("maps HTTP 403 responses to typed FORBIDDEN AdapterError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Cross-tenant forbidden" }),
    });

    await expect(
      authenticatedApiRequest("https://api.example.com/api/stores/shop-b/inventory", {
        getToken: async () => "token",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });
});
