# DukaanMitra MitraOS — Architecture & Security Audit (Phase 1 Baseline)

- **Repository**: `Dukaanmitra-MitraOS` (GitHub Org: `https://github.com/dukaanmitra-ai`)
- **Authoritative Firebase Project**: `mvp1-aafa3`
- **Audit Scope**: Root MitraOS Vite SPA (`/`), `apps/dukaan-in-next`, `apps/mitra-os-web`, `apps/core-engine`, `apps/ai-services`, `apps/whatsapp-gateway`, and `api/`
- **Phase Status**: Phase 1 Documentation Only — **zero application code or production rules modified**

---

## 1. Verified Facts (Current Monorepo Architecture)

### 1.1 Workspace Topology

| Component / App | Runtime & Framework | Database(s) Used | Firebase Project Binding | Verified Entry / Config Files |
| :--- | :--- | :--- | :--- | :--- |
| **Root MitraOS Web (`/`)** | React 19 + Vite 6 + React Router 7 + Express (`server.ts`, port 3000) | Cloud Firestore (direct browser SDK) | Placeholder fallback (`dukaanmitra-demo`) or local `firebase-applet-config.json` / `VITE_FIREBASE_*` | `/App.tsx`, `/firebase.ts`, `/server.ts`, `/vite.config.ts`, `/firestore.rules` |
| **`apps/mitra-os-web`** | React + Vite mirror of root SPA | Cloud Firestore (divergent `stores/*` schema) | Same pattern as root | `/apps/mitra-os-web/` |
| **`apps/dukaan-in-next`** | Next.js (App Router) + Firebase Admin SDK + Genkit/AI flows | **Cloud Firestore (`mvp1-aafa3`)** (authoritative schema); optional Supabase ingestion env vars | **`mvp1-aafa3`** (`.firebaserc` line 3) | `/apps/dukaan-in-next/.firebaserc`, `/apps/dukaan-in-next/firestore.rules`, `/apps/dukaan-in-next/src/docs/backend-types.ts`, `/apps/dukaan-in-next/src/firebase/config.ts` |
| **`apps/core-engine`** | Node.js + Express + Prisma ORM | **PostgreSQL** (`Store`, `Product`, `StockMovement`, `Sale`, `SaleItem`, `Customer`, `WhatsAppMessage`, `BusinessTemplate`, `MediaAsset`, `Annotation`, `KnowledgeDoc`, `Event`) | None directly | `/apps/core-engine/src/index.ts`, `/apps/core-engine/src/api/routes/app.routes.ts`, `/apps/core-engine/prisma/schema.prisma` |
| **`apps/ai-services`** | Python MCP Server (`mcp_server.py`) | **SQLite** (`DUKAANMITRA_DB`, default `dukaanmitra.db`) | None directly | `/apps/ai-services/mcp_server.py` |
| **`apps/whatsapp-gateway`** | Node.js + Express (port 2785) | In-memory `Map<string, SessionState>` | None | `/apps/whatsapp-gateway/src/gateway.ts` |
| **Serverless API (`/api/`)** | Node.js router (`api/_lib/router.js`) | Stateless / proxy endpoints | None | `/api/_lib/router.js` |

### 1.2 Firebase Services Actually Used (Verified)

- **Firebase Authentication**: Used in root MitraOS (`/firebase.ts`, `/App.tsx`, `/components/ui/AuthModal.tsx`, `/components/LoginPage.tsx`) and `apps/dukaan-in-next` (`src/firebase/provider.tsx`, `src/app/api/create-order/route.ts`).
- **Cloud Firestore**: Primary operational database in both root MitraOS and `apps/dukaan-in-next`.
- **Firebase Realtime Database (RTDB)**: **Zero imports or SDK calls** across root and monorepo source files. Only transitive lockfile packages and CSP hostnames (`*.firebaseio.com`) exist. Per **Decision 1**, RTDB is not required for the root frontend.
- **Firebase Admin SDK**: Used server-side in `apps/dukaan-in-next/src/lib/firebase-admin.ts` (`adminDb`, `auth().verifyIdToken`). Not yet wired in root `/server.ts`.

### 1.3 Divergent Schema Conflict (Root vs. `mvp1-aafa3`)

The root MitraOS SPA currently reads and writes to a **divergent prototype schema** that does not match `mvp1-aafa3`:

| Concern | Root MitraOS Current Paths (Divergent) | Authoritative `mvp1-aafa3` Paths (`apps/dukaan-in-next`) |
| :--- | :--- | :--- |
| User roles & shop binding | `admins/{uid}`, `merchants/{uid}` (`/App.tsx:124-132`) | `users/{uid}` (`role`, `status`, `shopId`, `sessionRevokedAt`) |
| Shop / Tenant document | `stores/{storeId}` (`/App.tsx:135`, `/components/StoreDashboard.tsx:169`, `/components/AdminDashboard.tsx:36`) | `shops/{shopId}` (`owner_id`, `name`, `phone`, `status`, `plan`, `paid_till`, `impact_metrics`) |
| Customers | `stores/{storeId}/customers/{autoId}` (`/services/storeService.ts:9,27`, `/components/StoreDashboard.tsx:188`) | `shops/{shopId}/customers/{customerPhone}` (doc ID is phone number; `totalUdhaar`, `total_spent`, `visit_count`, `status`) |
| Ledger / Transactions | `stores/{storeId}/transactions/{autoId}` (`/services/storeService.ts:8,38`, `/components/StoreDashboard.tsx:176`) | `shops/{shopId}/ledger/{ledgerId}` (immutable; `shop_id`, `customerPhone`, `type: 'credit' \| 'payment'`, `amount`, `item`, `source`) |
| AI Graph Memory | `memory_nodes/{id}`, `memory_relations/{id}` (`/services/memoryService.ts:26,62`) | Not defined in `mvp1-aafa3/firestore.rules` (denied by default) |
| Subscription Orders | Not persisted in root `/server.ts:135-187` | `orders/{orderId}` (`shopId`, `userId`, `plan`, `amount`, `razorpayOrderId`, `status`) |

### 1.4 Verified Mock Data & Demo Leakage Locations

1. **`/App.tsx` (lines 134–166)**: On real Firebase login, if `merchants/{uid}` does not exist, automatically creates a fake `stores` document (`totalSales: 45200`, `totalUdhaar: 12500`, hardcoded `+91 98765 43210`) and seeds 3 fake transactions + 4 fake customers (`Ramesh Singh`, `Suresh Kumar`, `Manoj Tiwari`, `Anita Devi`).
2. **`/components/StoreDashboard.tsx` (lines 67–86, 110–167, 214–217, 225–245)**:
   - Hardcoded `demo-mode` / `sharma-kirana-demo` state.
   - `handleScanShelf` simulates Edge-AI shelf scanning with a 2-second timeout and hardcoded items (`Amul Gold 500ml`, `Britannia Marie Gold`, `Tata Salt 1kg`).
   - `handleExecuteBlast` simulates a WhatsApp campaign blast with `setInterval` + `window.alert`.
3. **`/components/AdminDashboard.tsx` (lines 50–90)**: When `stores` snapshot returns 0 docs, silently populates 4 fabricated dummy stores (`dummy-1` through `dummy-4`).
4. **`/components/LoginPage.tsx` (lines 35–56)**: Writes fake `dm_demo_auth` object to `localStorage` for 1-click `merchant` and `superadmin` login.
5. **`/components/ui/AuthModal.tsx` (lines 193–249, 538)**: Hardcoded demo credentials (`demo@dukaanmitra.in` / `demoUser1234`) that auto-register in production Firebase Auth; instructions view references stale project ID `amit-ahi`.
6. **`/apps/whatsapp-gateway/src/gateway.ts` (lines 30–37, 102–112, 118–132, 139–168)**: Generates a demo QR code, stubs `/api/sendText` with `console.log`, and exposes unauthenticated `/api/simulate/inbound` and `/api/sessions/:sessionId/pair-success`.

### 1.5 Verified Existing API Endpoints

- **Root Express (`server.ts`)**:
  - `GET /api/health`
  - `POST /api/munim-chat` (website assistant grounded on `public/llms-full.txt`; unauthenticated, no rate limiting)
  - `POST /api/create-order` (Razorpay order creation; unauthenticated, accepts raw `amount` from client, no DB persistence, no idempotency)
  - `POST /api/verify-payment` (Razorpay HMAC check; unauthenticated, no DB update, no idempotency)
- **`apps/dukaan-in-next/src/app/api/*`**:
  - `POST /api/create-order` (verifies Firebase ID token + `shop.owner_id === userId`; persists to `orders/{id}`; lacks idempotency key)
  - `POST /api/verify-payment` (verifies `x-razorpay-signature`; transactional `status === 'paid'` idempotency check; updates `orders` + `shops` + sends WhatsApp confirmation)
  - `GET|POST /api/whatsapp` (verifies `hub.verify_token` and `x-hub-signature-256`; calls `handleWhatsAppMessage(body)` fire-and-forget)
  - `POST /api/execute-action` (calls `executeAction`; **trusts `actor` object directly from request body without verifying Firebase ID token**)
  - `POST /api/parse-transaction` (calls `parseTransaction`; **unauthenticated**)
  - `POST /api/contact`, `/api/cron/*`, `/api/interactive-demo`, `/api/supabase/*`, `/api/warmup`
- **`apps/core-engine/src/api/routes/app.routes.ts`**:
  - `POST /api/sales`, `GET /api/templates`, `GET /api/templates/:key`, `POST /api/onboard`, `GET /api/stores/:storeId/inventory`, `GET /api/stores/:storeId/low-stock`, `POST /api/inventory/intent`, `PATCH /api/products/:id`, `POST /api/products/:id/archive`, `POST /api/stores/:storeId/seed`, `POST /api/media`, `POST /api/stores/:storeId/annotations`, `POST /api/knowledge`, `GET /api/stores/:storeId/knowledge`, `GET /api/health`.
  - WhatsApp webhook handler: `apps/core-engine/src/channels/whatsapp/webhook.handler.ts` (deduplicates via `prisma.whatsAppMessage.findUnique({ where: { messageId } })`, but **missing `X-Hub-Signature-256` HMAC verification**).
- **`apps/ai-services/mcp_server.py`**:
  - Typed MCP tools over SQLite: `get_inventory_summary`, `detect_stockout_risk`, `create_purchase_order_draft`, `approve_purchase_order`, `validate_gst_invoice`, `reconcile_gstr2b`, `get_compliance_deadlines`.

---

## 2. Proposed Architecture (Aligned with Confirmed Decisions 1–8)

1. **Primary Operational Database (Root MitraOS)**: Cloud Firestore in Firebase project `mvp1-aafa3`, using the verified `apps/dukaan-in-next` collection hierarchy (`users`, `shops`, `shops/{shopId}/customers`, `shops/{shopId}/ledger`, `shops/{shopId}/insights`, `orders`). No Realtime Database in root frontend. No parallel `stores/{storeId}` writes.
2. **Backward-Compatible Service Adapter Layer**: Introduce `services/adapters/*` in root MitraOS to map `mvp1-aafa3` Firestore documents and authenticated backend API responses into the existing root UI view models (`StoreDashboard`, `AdminDashboard`, `WhatsAppSimulation`, `App.tsx`) while preserving the existing UI design.
3. **Firebase Client Configuration**: Bind root `/firebase.ts` strictly to `mvp1-aafa3` via `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and optional `VITE_FIREBASE_MEASUREMENT_ID`. Remove RTDB config requirements and never ship service-account credentials to the browser.
4. **Strict Service Boundaries for PostgreSQL & SQLite**:
   - `apps/core-engine` (PostgreSQL/Prisma) remains the authoritative inventory/product/media/event engine behind authenticated HTTP APIs with tenant authorization.
   - `apps/ai-services` (SQLite/MCP) remains behind its MCP gateway / authenticated backend proxy.
   - The root frontend never connects directly to PostgreSQL or SQLite.
5. **Server-Side AI & Financial Operations**: All Gemini calls (currently in browser `/services/geminiService.ts`) move behind authenticated backend proxy routes (`/api/*` or approved MCP tools). All payment creation/verification and sensitive mutations validate Firebase ID tokens and enforce idempotency keys.

---

## 3. Unverified Assumptions (Require Verification Before Production Cutover)

1. **Live Deployed `mvp1-aafa3` Firestore Rules**: Only the repo file `/apps/dukaan-in-next/firestore.rules` was inspected. The live rules currently deployed to `mvp1-aafa3` could not be fetched from this environment (no active Firebase CLI auth / `mvp1-aafa3` credentials).
2. **Live Production Data Shape in `mvp1-aafa3`**: Actual production documents in `users`, `shops`, `shops/{shopId}/customers`, `shops/{shopId}/ledger`, and `orders` have not been sampled directly; field types and nullability are verified only from `backend-types.ts`, `ledger-service.ts`, `shop-service.ts`, `auth-service.ts`, and dashboard form components.
3. **Shop ID Alignment Across Datastores**: Whether `shops/{shopId}` IDs in Firestore `mvp1-aafa3` map 1:1 to `Store.id` in `apps/core-engine` (Prisma `cuid()`) and `businesses.id` in `apps/ai-services` (SQLite) is **unverified**.
4. **Customer `status` Casing Variance**: `backend-types.ts:71` defines `"NEW" | "REPEAT" | "LOYAL" | "churned" | "blocked"`, `ledger-service.ts:77,86` writes `'NEW' | 'REGULAR' | 'LOYAL'`, and `add-customer-form.tsx:55` writes `'new'`. Adapters must normalize status case-insensitively on read.
5. **Firebase Auth Providers & Authorized Domains in `mvp1-aafa3`**: Whether Google Sign-In, Email/Password, and production domains (`dukaanmitra.in`, preview domains) are enabled in `mvp1-aafa3` Authentication settings is unverified.
6. **Composite Indexes Deployed in `mvp1-aafa3`**: `/apps/dukaan-in-next/firestore.indexes.json` defines 5 indexes (`interactions`, `whatsapp_outbox`, `ledger`, `customers`), but deployment parity in `mvp1-aafa3` is unverified.

---

## 4. Security Risks (All 10 Mandatory Fixes + Additional Verified Findings)

| # | Severity | Risk Description | Verified File & Line Reference | Target Phase |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **CRITICAL** | `GEMINI_API_KEY` injected into browser bundle via Vite `define` | `/vite.config.ts:31-34` | Phase 3 |
| **2** | **CRITICAL** | Direct browser calls to `@google/genai` SDK exposing key & bypassing server guardrails | `/services/geminiService.ts:28,59,96,116,148,160,169,180,189,204,230,246` | Phase 3 |
| **3** | **CRITICAL** | **Self-escalation to any shop**: `users/{uid}` update rule blocks only `['role', 'status']`, allowing any authenticated user to overwrite their own `shopId` to another merchant's `shopId` and satisfy `isShopMember(shopId)` / `isShopOwner(shopId)` | `/apps/dukaan-in-next/firestore.rules:103-104` | Phase 3 (approval required for prod deploy) |
| **4** | **CRITICAL** | Missing Firebase ID token verification on protected APIs (`server.ts` `/api/create-order`, `/api/verify-payment`, `/api/munim-chat`; `apps/dukaan-in-next` `/api/execute-action` trusts client-supplied `actor` JSON; `/api/parse-transaction` unauthenticated) | `/server.ts:76-187`, `/apps/dukaan-in-next/src/app/api/execute-action/route.ts:105-118`, `/apps/dukaan-in-next/src/app/api/parse-transaction/route.ts:6-24` | Phase 3 |
| **5** | **CRITICAL** | Missing authentication & shop-level tenant authorization across all `apps/core-engine` routes (`/api/stores/:storeId/*`, `/api/sales`, `/api/products/:id`, `/api/media`, `/api/knowledge`) | `/apps/core-engine/src/api/routes/app.routes.ts:14-169` | Phase 3 |
| **6** | **HIGH** | Missing Meta `X-Hub-Signature-256` HMAC verification on `core-engine` WhatsApp webhook; open CORS + unauthenticated `/api/sendText` & `/api/simulate/inbound` on `whatsapp-gateway`; non-constant-time comparison & unawaited handler in `dukaan-in-next` webhook | `/apps/core-engine/src/channels/whatsapp/webhook.handler.ts:31-57`, `/apps/whatsapp-gateway/src/gateway.ts:12,102-168`, `/apps/dukaan-in-next/src/app/api/whatsapp/route.ts:33,39` | Phase 3 & Phase 5 |
| **7** | **HIGH** | `localStorage`-based fake `merchant` & `superadmin` login bypass (`dm_demo_auth`) | `/components/LoginPage.tsx:35-56` | Phase 3 |
| **8** | **HIGH** | Hardcoded demo email/password (`demo@dukaanmitra.in` / `demoUser1234`) auto-creating accounts in production Firebase Auth | `/components/ui/AuthModal.tsx:193-249` | Phase 3 |
| **9** | **MEDIUM** | Automatic fake store/customer/transaction seeding in real user accounts + silent dummy stores in AdminDashboard | `/App.tsx:134-166`, `/components/AdminDashboard.tsx:50-90` | Phase 3 & Phase 4 |
| **10** | **HIGH** | Missing idempotency for payment/order creation (`server.ts` has no DB persistence or idempotency; `dukaan-in-next` `/api/create-order` generates fresh Razorpay order on retry without idempotency key; `server.ts` accepts client-supplied `amount` instead of server plan price) | `/server.ts:135-187`, `/apps/dukaan-in-next/src/app/api/create-order/route.ts:53-71` | Phase 3 |
| **11** | **MEDIUM** | Root `/firestore.rules` hardcodes personal email `AMITSHARMA99976@gmail.com` as admin and allows any authenticated user to create `memory_nodes`/`memory_relations` for any `storeId` | `/firestore.rules:81,148,155` | Phase 3 (retire root rules in favor of hardened `mvp1-aafa3` rules) |
| **12** | **MEDIUM** | `apps/dukaan-in-next/firestore.rules:102` allows `users/{uid}` create with `role == 'owner'` without validating `status` or restricting `shopId` on initial creation (an attacker creating a new user doc could set `shopId` to a victim's `shopId` and `status: 'active'`!) | `/apps/dukaan-in-next/firestore.rules:102` | Phase 3 (must be fixed alongside #3!) |

---

## 5. Breaking-Change Risks

1. **Firestore Rules Locking `users/{uid}.shopId`**: Currently `apps/dukaan-in-next/src/app/[locale]/(app)/dashboard/create-shop-form.tsx:86-90` performs a client-side `writeBatch` that creates `shops/{shopId}` AND writes `{ shopId }` directly to `users/{uid}`. Once `users/{uid}.shopId` is locked from client modification (Security Fix #3 & #12), shop creation MUST either:
   - Use a server-side authenticated API endpoint (Admin SDK atomic batch creating `shops/{shopId}` and binding `users/{uid}.shopId`), **OR**
   - Allow a tightly constrained Firestore rule permitting setting `users/{uid}.shopId` **only once** (when `resource.data.shopId == null`) AND verifying `getAfter(/databases/$(database)/documents/shops/$(request.resource.data.shopId)).data.owner_id == request.auth.uid`.
2. **Strict Subcollection Fallback in `mvp1-aafa3`**: `/apps/dukaan-in-next/firestore.rules:140-142` explicitly denies all unlisted subcollections under `shops/{shopId}`. Attempting to read/write `shops/{shopId}/products`, `shops/{shopId}/inventory`, or `shops/{shopId}/bills` from the client will fail with `PERMISSION_DENIED`.
3. **Immutable Ledger Rules**: `/apps/dukaan-in-next/firestore.rules:131` forbids `update` and `delete` on `shops/{shopId}/ledger/{ledgerId}`. Any future edit/reversal flow must use compensating entries rather than mutating existing documents.
4. **Ledger Type Mismatch (`sale` vs `credit`/`payment`)**: Root UI expects `type: 'sale' | 'udhaar' | 'payment'`, whereas `mvp1-aafa3` `LedgerEntry` only supports `'credit' | 'payment'`. Writing `'sale'` directly into `shops/{shopId}/ledger` could break `apps/dukaan-in-next` analytics and `LedgerService` assumptions.
5. **Customer Document ID Format**: `mvp1-aafa3` keys customers by normalized phone number (`shops/{shopId}/customers/{customerPhone}`), whereas root `storeService.ts` generates random Firestore doc IDs and allows customers without phone numbers.
6. **Removing Client `GEMINI_API_KEY`**: Existing components calling `services/geminiService.ts` directly (`StoreDashboard.tsx`, `WhatsAppSimulation.tsx`, `SeoDashboard.tsx`, `Blog.tsx`, etc.) will fail unless migrated to authenticated `/api/*` endpoints in lockstep.

---

## 6. Required Approvals

No destructive or production-impacting action will be executed without explicit approval:

1. **Live `mvp1-aafa3` Environment & Inspection Approval**: Provisioning `VITE_FIREBASE_*` values for `mvp1-aafa3` (and read-only verification of live deployed rules/sample schemas).
2. **Production Firestore Rules Deployment Approval**: Hardening `users/{uid}` (`shopId`, `role`, `status` protection) and any future subcollection rules in `mvp1-aafa3` before running `firebase deploy --only firestore:rules`.
3. **Schema Extension Approval (If Needed Later)**: Any new field/enum (e.g., cash `sale` support in ledger, or `memberships` for multi-shop users, or `shopId` foreign-key mapping into `core-engine` `Store`).
4. **Shop Creation Flow Approval**: Confirming server-side API vs `getAfter()` rule for atomic shop creation once `users/{uid}.shopId` is locked.
5. **Destructive / Cleanup Actions**: Removing legacy prototype files (`apps/mitra-os-web` duplication or obsolete root `firestore.rules`) will NOT occur without explicit approval.
