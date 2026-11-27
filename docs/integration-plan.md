# DukaanMitra MitraOS — Production Integration & Security Plan

- **Project**: `Dukaanmitra-MitraOS` → Firebase Project `mvp1-aafa3`
- **Baseline**: Verified Phase 0 Audit (`docs/architecture-audit.md`) & Verified Schema Map (`docs/schema-map.md`)
- **Confirmed Decisions Applied**: Decisions 1–8 (Firestore primary, `mvp1-aafa3` schema, backward-compatible adapter layer, Vite env Firebase config, PostgreSQL/SQLite behind service boundaries, 10 mandatory security fixes, strict phased execution).
- **Phase Status**: Phase 1 Complete (Documentation Only — zero app code modified).

---

## 1. Verified Facts vs. Proposed Execution Plan

- **Verified Baseline**: Root MitraOS compiles and serves on port 3000, but currently binds to placeholder/divergent Firestore paths (`stores/*`, `admins/*`, `merchants/*`, `memory_*`), exposes `GEMINI_API_KEY` to the browser, allows unauthenticated API calls and fake demo login bypasses, and seeds fake data on new accounts.
- **Proposed Architecture**: Phased migration (Phases 2–7 below) that preserves the existing Material-3 Bharat Retail UI and all public SEO/content routes while replacing divergent data access with a clean, typed, backward-compatible adapter layer backed by `mvp1-aafa3` Firestore and authenticated backend APIs.

---

## 2. Proposed Adapter Architecture (Phase 2 Blueprint)

All root React components (`App.tsx`, `StoreDashboard.tsx`, `AdminDashboard.tsx`, `WhatsAppSimulation.tsx`, `Pricing.tsx`) will stop importing `db` directly for divergent paths and instead depend on typed adapters under `/services/adapters/`:

```text
services/
  adapters/
    types.ts             # Canonical MitraOS view models + AdapterError + MvpRole
    mappers.ts           # Pure, unit-testable functions mapping mvp1-aafa3 docs <-> UI models
    authAdapter.ts       # Resolves users/{uid}, enforces status === 'active' & sessionRevokedAt
    shopAdapter.ts       # Reads shops/{shopId}, computes KPIs, handles explicit shop onboarding
    customerAdapter.ts   # Subscribes & writes shops/{shopId}/customers/{customerPhone}
    ledgerAdapter.ts     # Subscribes & appends immutable shops/{shopId}/ledger/{ledgerId} + atomic customer totals
    insightsAdapter.ts   # Reads/dismisses shops/{shopId}/insights/{insightId}
    adminAdapter.ts      # Super-admin/franchise-admin views over shops & metrics/global (zero dummy fallback)
    orderAdapter.ts      # Authenticated /api/create-order client with client-generated Idempotency-Key
    aiProxyClient.ts     # Replaces browser geminiService calls with authenticated /api/ai/* calls
    demoFixtures.ts      # Strictly isolated read-only fixtures ONLY for public /demo route
```

### Key Adapter Contracts

1. **Zero Divergent Writes**: No adapter may reference `stores/`, `admins/`, `merchants/`, `memory_nodes/`, or `memory_relations/`.
2. **Strict Error Propagation (No Silent Mock Fallback)**: Every Firestore subscription/query exposes `{ data, loading, error }`. On `permission-denied`, `unavailable`, or expired session, adapters return a typed `AdapterError` so UI renders an actionable error/re-auth banner instead of fabricated data.
3. **Atomic Ledger + Customer Update**: `ledgerAdapter.recordEntry(shopId, payload)` executes a Firestore `writeBatch` / `runTransaction` (or calls authenticated server `LedgerService` endpoint) that:
   - Validates `amount > 0`, valid `customerPhone`, and `type` in `['credit', 'payment']` (mapping UI `'udhaar'` → `'credit'`).
   - Writes `shops/{shopId}/ledger/{newId}` with `shop_id: shopId`, `source: 'app'`, `createdAt: serverTimestamp()`.
   - Atomically updates `shops/{shopId}/customers/{customerPhone}` (`totalUdhaar`, `total_spent`, `visit_count`, `last_visit`, `updated_at`, and `lastPaymentDate` + `reminderCount: 0` on `'payment'`).
   - Rejects writes when `shop.status` is `'locked' | 'suspended' | 'integrity_lock'`.
4. **Role & Session Enforcement (`authAdapter`)**:
   - Reads `users/{uid}` on `onAuthStateChanged`.
   - Checks `profile.status === 'active'`.
   - Checks `profile.sessionRevokedAt`: if newer than `idTokenResult.authTime`, forces `signOut(auth)` and surfaces session-expired prompt.
   - Exposes `mvpRole` (`owner` | `staff` | `franchise_admin` | `super_admin`) alongside backward-compatible `role` (`merchant` | `superadmin`), enabling owner-only vs staff/cashier UI guards.

---

## 3. Phased Execution Roadmap (Aligned with Decision 8)

### Phase 2 — Firebase Config Alignment & Adapter Layer (Next Phase)
- **Scope**:
  1. Update root `/firebase.ts` and `/.env.example` to bind cleanly to `mvp1-aafa3` using:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_MEASUREMENT_ID` (optional)
     - Remove any unused RTDB URL requirement and placeholder `dukaanmitra-demo` silently-succeeding config (fail clearly with config warning when env vars are missing).
  2. Implement `/services/adapters/*` (`types.ts`, `mappers.ts`, `authAdapter.ts`, `shopAdapter.ts`, `customerAdapter.ts`, `ledgerAdapter.ts`, `insightsAdapter.ts`, `adminAdapter.ts`, `demoFixtures.ts`).
  3. Write unit tests for all pure mappers and adapter error/validation boundaries (`vitest`).
- **Exit Criteria**: `compile_applet`, `lint_applet`, and `vitest` pass; zero divergent `stores/*` paths inside adapters.

### Phase 3 — Mandatory Security Hardening (All 10 Fixes from Decision 7)
- **Scope**:
  1. **Vite Build Sanitization**: Remove `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from `/vite.config.ts:31-34`.
  2. **Server-Side AI Proxy**: Move all Gemini calls from browser `/services/geminiService.ts` to authenticated backend routes in `/server.ts` (`/api/ai/route`, `/api/ai/chat`, `/api/ai/marketing`, `/api/ai/alert-nudge`, etc.) using server-side `process.env.GEMINI_API_KEY` + Firebase ID token verification + rate limiting. Enforce deterministic pricing guardrail (AI cannot invent prices not present in verified product/ledger context).
  3. **Harden `mvp1-aafa3` Firestore Rules (Draft + Emulator Tests — Deploy Only After Explicit Approval)**:
     - Fix `/apps/dukaan-in-next/firestore.rules:102-104`:
       - On `users/{userId}` `create`: enforce `role == 'owner'`, `status == 'active'`, and `(!('shopId' in request.resource.data) || request.resource.data.shopId == null)`.
       - On `users/{userId}` `update`: block client changes to `['role', 'status', 'shopId', 'sessionRevokedAt']` (or permit one-time `shopId` bind strictly via `getAfter` ownership check / server API).
     - Restrict `orders/{orderId}` `create` to Admin SDK only (`allow create: if false;`) since server creates orders.
     - Add Firestore Rules unit test suite covering all RBAC & tenant isolation assertions.
  4. **Firebase ID Token Verification on Protected APIs**:
     - Add Firebase Admin SDK token verification middleware (`verifyFirebaseToken`) to root `/server.ts` (`/api/create-order`, `/api/verify-payment`, `/api/ai/*`, and optional rate-limited `/api/munim-chat`).
     - Fix `/apps/dukaan-in-next/src/app/api/execute-action/route.ts` to derive `actor` (`uid`, `role`, `shopId`) strictly from verified Firebase ID token + Firestore `users/{uid}` lookup instead of trusting request body `actor`.
     - Protect `/apps/dukaan-in-next/src/app/api/parse-transaction/route.ts` with Firebase ID token verification.
  5. **Tenant Authorization in `apps/core-engine`**:
     - Add auth + tenant-membership middleware to `/apps/core-engine/src/api/routes/app.routes.ts` verifying Firebase ID token and confirming caller owns/belongs to `req.params.storeId` (or `product.storeId` for `/products/:id`).
  6. **WhatsApp Webhook Signature Verification**:
     - Add raw-body capture + `X-Hub-Signature-256` verification using `crypto.timingSafeEqual` in `/apps/core-engine/src/channels/whatsapp/webhook.handler.ts`.
     - Upgrade `/apps/dukaan-in-next/src/app/api/whatsapp/route.ts` to `crypto.timingSafeEqual` and `await handleWhatsAppMessage(body)`.
     - Lock down `/apps/whatsapp-gateway/src/gateway.ts` (API key auth, restricted CORS origins, disable `/api/simulate/*` and demo pairing in `NODE_ENV=production`).
  7. **Remove `localStorage` Fake Auth**: Remove `dm_demo_auth` bypass from `/components/LoginPage.tsx`.
  8. **Remove Hardcoded Demo Credentials**: Remove `demo@dukaanmitra.in` / `demoUser1234` bypass and stale `amit-ahi` reference from `/components/ui/AuthModal.tsx`.
  9. **Stop Auto-Seeding Fake Data**: Remove automatic store/customer/transaction seeding in `/App.tsx:134-166` and silent dummy fallback stores in `/components/AdminDashboard.tsx:50-90`.
  10. **Payment & Order Idempotency**:
      - Root `/server.ts`: derive order amount strictly from server-side plan catalog (never client `req.body.amount`), require `Idempotency-Key` header, persist to `orders/{orderId}` with deterministic idempotency lookup, and verify Razorpay payment atomically via Firestore transaction (`status !== 'paid'`).
      - `apps/dukaan-in-next/src/app/api/create-order/route.ts`: add `Idempotency-Key` support to prevent duplicate Razorpay orders on retry.

### Phase 4 — Incremental Real Data Integration (Root UI Cutover)
- **Scope**:
  - Rewire `/App.tsx`, `/components/StoreDashboard.tsx`, `/components/AdminDashboard.tsx`, and `/components/WhatsAppSimulation.tsx` to use `/services/adapters/*`.
  - Keep `/demo` strictly on read-only local fixtures with an explicit sandbox banner.
  - Replace fake `handleScanShelf` and fake `handleExecuteBlast` with real authenticated backend integrations (or honest "Connect Core Engine / WhatsApp Cloud API to enable" state when service is unconfigured — zero fake timers/alerts).
  - Add clean Shop Onboarding flow when an authenticated user has `users/{uid}` without a `shopId`.

### Phase 5 — WhatsApp Webhook & Gateway Integration
- **Scope**:
  - Connect verified Meta WhatsApp Cloud API webhook signature + idempotent message processing (`messageId` deduplication) between `apps/dukaan-in-next`, `apps/core-engine`, and `apps/whatsapp-gateway`.
  - Verify end-to-end inbound message → intent routing → `shops/{shopId}/ledger` / `interactions` / `whatsapp_outbox` persistence with zero duplicate entries on webhook retries.

### Phase 6 — AI & MCP Integration
- **Scope**:
  - Route root `WhatsAppSimulation` and Merchant AI tools through authenticated server-side AI proxy and approved `apps/ai-services` MCP tools (`get_inventory_summary`, `detect_stockout_risk`, `create_purchase_order_draft`, `approve_purchase_order` with owner/manager maker-checker, GST tools).
  - Enforce server-side tenant ID injection from verified Firebase session (never trust client-supplied `tenant_id` or `approver_role`).

### Phase 7 — Deployment & Production Verification
- **Scope**:
  - Verify Vercel/Cloudflare/Render env vars, authorized Firebase Auth domains, Firestore indexes, and production build.
  - Execute full verification test matrix (Section 4) against staging/emulator before production cutover.

---

## 4. Verification & Security Test Matrix (Mandatory Pre-Cutover Suite)

| # | Test Scenario | Target Layer | Expected Result |
| :-: | :--- | :--- | :--- |
| **1** | **Cross-Tenant Isolation**: User A (Shop A) attempts to read/write Shop B (`shops/shopB`, `customers`, `ledger`) or mutate `users/userA.shopId = 'shopB'` | Firestore Rules + `core-engine` API | `PERMISSION_DENIED` / HTTP `403` |
| **2** | **RBAC Enforcement**: Staff/Cashier attempts owner-only actions (`shops/{shopId}` update/delete, `approve_purchase_order`, subscription changes) | Firestore Rules + Backend API + MCP | `PERMISSION_DENIED` / HTTP `403` |
| **3** | **Webhook Idempotency**: Replay identical WhatsApp webhook (`messageId`) and Razorpay `payment.captured` webhook twice | `core-engine` webhook + `verify-payment` | Second call returns `200 OK` without creating duplicate ledger/sale/order state |
| **4** | **Invalid Product / Payload Rejection**: Submit negative/zero amount, missing `customerPhone`, invalid `shop_id`, or unknown SKU | Adapter + Firestore Rules + `core-engine` | Rejected with HTTP `400` / validation error; zero partial writes |
| **5** | **AI Pricing Guardrail**: Ask Munim AI for price of an uncataloged item or attempt prompt injection to override price | Server AI Proxy | AI refuses to invent price and cites only verified catalog/ledger prices |
| **6** | **Unauthorized Financial Write**: Unauthenticated caller or wrong-shop user calls `/api/create-order`, `/api/execute-action`, or writes `shops/{shopId}/ledger` directly | Backend API + Firestore Rules | HTTP `401`/`403` / `PERMISSION_DENIED` |
| **7** | **No Silent Mock Fallback**: Simulate Firestore `unavailable` / `permission-denied` or 500 API error on `StoreDashboard` & `AdminDashboard` | Root UI + Adapters | Explicit error state shown; zero dummy stores (`dummy-1..4`) or fake transactions rendered |
| **8** | **Session Expiration / Revocation**: Revoke user session (`sessionRevokedAt` > token `auth_time`) or set `users/{uid}.status = 'suspended'` | `authAdapter` + Protected Routes + Backend API | Session terminated / access blocked immediately; re-auth required |
| **9** | **Shop-Switch Membership Validation**: Attempt to navigate or pass `?storeId=shopB` for a shop user does not belong to | `authAdapter` + `shopAdapter` + Rules | Blocked before rendering; verified against `users/{uid}.shopId` (and future membership doc) |

---

## 5. Unverified Assumptions, Risks & Honest Blockers

### Current Blockers (Reported Honestly)
1. **Live `mvp1-aafa3` Credentials Unavailable in Workspace**: Neither `.env` nor `firebase-applet-config.json` currently contains live `mvp1-aafa3` web config or Firebase Admin service-account credentials. Therefore:
   - Live deployed `firestore.rules` and live production document samples in `mvp1-aafa3` could **not** be directly inspected during Phase 1.
   - Phase 2 adapter code and unit tests can be built immediately, and Phase 3 security fixes can be implemented and tested locally, but live `mvp1-aafa3` smoke testing requires `VITE_FIREBASE_*` (client) and server-side Admin credentials in deployment env vars.
2. **Shop-ID Cross-System Mapping (`Firestore` ↔ `PostgreSQL` ↔ `SQLite`)**: `mvp1-aafa3` uses Firestore auto-IDs for `shops/{shopId}`, `apps/core-engine` uses Prisma `cuid()` keyed by unique `Store.phone`, and `apps/ai-services` uses SQLite `businesses.id`. A deterministic link (e.g., storing `firebaseShopId` or resolving via verified shop phone) must be confirmed before Phase 4/6 inventory & MCP integration.
3. **Cash Sale (`type: 'sale'`) vs. Credit Ledger (`'credit' | 'payment'`)**: `mvp1-aafa3` `shops/{shopId}/ledger` strictly supports `'credit' | 'payment'`. Until confirmed, the root adapter will map `'udhaar'` → `'credit'` and `'payment'` → `'payment'`, and will not write `'sale'` into `shops/{shopId}/ledger`.

### Breaking-Change Risks
- Tightening `users/{uid}` rules to lock `shopId` will break `apps/dukaan-in-next`'s existing client-side `create-shop-form.tsx` unless paired with either a server-side shop creation endpoint or a tightly scoped `getAfter()` Firestore rule.
- Removing `GEMINI_API_KEY` from `vite.config.ts` requires migrating all browser callers of `services/geminiService.ts` to server `/api/*` endpoints in the same phase.

---

## 6. Explicit Approval Gates

| Gate | Action Requiring Approval | Status |
| :--- | :--- | :--- |
| **Gate A** | Proceeding to **Phase 2** (Root `firebase.ts` binding to `mvp1-aafa3` env vars + `/services/adapters/*` implementation + unit tests) | Ready to proceed |
| **Gate B** | Proceeding to **Phase 3** code hardening (all 10 security fixes in repo + local tests, **without** deploying prod rules yet) | Requires Phase 2 green |
| **Gate C** | Deploying hardened `firestore.rules` to production Firebase project `mvp1-aafa3` | **Explicit User Approval Required** |
| **Gate D** | Any schema addition to `mvp1-aafa3` (e.g., cash `sale` support, multi-shop `memberships`, or `products` subcollection) | **Explicit User Approval Required** |
| **Gate E** | Any destructive cleanup (deleting obsolete root `firestore.rules` or duplicated `apps/mitra-os-web` files) | **Explicit User Approval Required** |
