# DukaanMitra MitraOS — Phase 3 Security Inventory & Vulnerability Audit

- **Repository**: `Dukaanmitra-MitraOS` (existing monorepo)
- **Target Firebase Project**: `mvp1-aafa3`
- **Audit Method**: Full static source code inspection across root MitraOS (`/`), `apps/dukaan-in-next`, `apps/core-engine`, `apps/ai-services`, `apps/whatsapp-gateway`, `api/`, Firestore rules files, and `npm audit --omit=dev`.
- **Live Rules / Production Inspection Disclaimer**: **Live deployed Firestore rules, Firebase Auth settings, and production documents in `mvp1-aafa3` were NOT inspected** because no live Firebase CLI credentials or service account access exist in this environment. All Firestore rules findings below are verified against repository files (`/apps/dukaan-in-next/firestore.rules` and `/firestore.rules`).

---

## 1. Security Surface Inventory

| Surface | Files Inspected | Auth Mechanism Before Phase 3 | Primary Data / Action Risk |
| :--- | :--- | :--- | :--- |
| **Authoritative Rules Draft** | `apps/dukaan-in-next/firestore.rules` | Firestore Rules v2 (note: contained invalid `if` syntax in helper functions) | Tenant takeover via `users/{uid}.shopId`, self-created orders, client customer balance tampering |
| **Legacy Root Rules** | `firestore.rules` | Hardcoded personal email + open `merchants`/`memory_*` writes | Hardcoded email admin backdoor, arbitrary `memory_nodes` creation, divergent `stores/*` schema |
| **Root Express Backend** | `server.ts` | **None** on `/api/create-order`, `/api/verify-payment`, `/api/munim-chat` | Arbitrary client `amount`, missing signature timing safety, no idempotency, no rate limit, no AI auth |
| **Next.js API Routes** | `apps/dukaan-in-next/src/app/api/*` | Mixed (partial Bearer auth on `create-order`; **none** on `execute-action`, `parse-transaction`, `cron/self-healing`, `supabase/ingest`) | Forged `actor` JSON leads to cross-tenant Admin SDK ledger writes; unauthenticated AI & cron execution |
| **Core Engine (Express/Prisma)** | `apps/core-engine/src/index.ts`, `api/routes/app.routes.ts`, `whatsapp.routes.ts`, `ondc.routes.ts`, `channels/whatsapp/webhook.handler.ts` | **None** across all store, sales, product, media, knowledge, OpenWA, and WhatsApp webhook routes | Full cross-tenant POS/inventory/knowledge read & write; forged WhatsApp webhooks |
| **AI Services & MCP Gateway** | `apps/ai-services/app.py`, `apps/ai-services/mcp_server.py` | `ALLOW_DEMO_OWNER=true` default, client-supplied `actor_id`, `approver_role`, `tenant_id`, `"auth": {"type": "none"}` | Forged `approver_role: "owner"` approves POs; cross-tenant SQLite access; open outbound WhatsApp sender |
| **WhatsApp Gateway** | `apps/whatsapp-gateway/src/gateway.ts` | Open `cors()`, **zero auth** on `/api/sendText`, `/api/simulate/inbound`, `/api/sessions/:id/pair-success` | Arbitrary outbound message injection and forged inbound webhooks |
| **Dependencies** | `package-lock.json` (`npm audit --omit=dev`) | N/A | High-severity advisories in `axios`, `body-parser`, `follow-redirects`, `nanoid`, transitive `@grpc/grpc-js` (under `firebase`) |

---

## 2. Detailed Vulnerability Findings

### CRITICAL Findings

#### [CRIT-01] Cross-Tenant Takeover via Client-Writable `users/{uid}.shopId`
- **File & Line**: `apps/dukaan-in-next/firestore.rules:102-104`
- **Vulnerability**: `users/{userId}` `create` only requires `request.resource.data.role == 'owner'` (does not restrict `shopId`, `status`, or `sessionRevokedAt`), and `update` only blocks `['role', 'status']`, leaving `shopId` and `sessionRevokedAt` writable by the user. Additionally, `isShopMember`/`isShopOwner` at lines 34-48 use invalid `if (!isAuthenticated()) return false;` syntax and do not validate `sessionRevokedAt`.
- **Attack Scenario**: An authenticated attacker updates `/users/{attackerUid}` with `{ shopId: "victim_shop_id" }` (or sets `shopId` on initial user creation). Subsequent requests to `/shops/victim_shop_id`, `/shops/victim_shop_id/customers/*`, and `/shops/victim_shop_id/ledger/*` satisfy `isShopMember("victim_shop_id")` and `isShopOwner("victim_shop_id")`.
- **Impact**: Complete cross-tenant data breach, unauthorized ledger writes, and full takeover of any merchant shop.
- **Proposed Fix**: Lock `shopId`, `role`, `status`, and `sessionRevokedAt` against client updates; require `shopId == null` (or absent) on user create; enforce `isSessionValid(profile)` comparing `request.auth.token.auth_time` against `sessionRevokedAt`; require `resource.data.owner_id == request.auth.uid` on shop owner writes; move shop creation to a trusted Admin SDK onboarding endpoint.
- **Verification Test**: Security Matrix #3, #7, #8, #9 (`src/test/security.test.ts` + Firestore rules contract/emulator suite).

#### [CRIT-02] Forged `actor` Identity on `/api/execute-action` (Admin SDK Privilege Bypass)
- **File & Line**: `apps/dukaan-in-next/src/app/api/execute-action/route.ts:47-118`
- **Vulnerability**: Endpoint accepts `actor: { id, role, shopId }` directly from `request.json()` without verifying a Firebase ID token or querying `users/{uid}`, then passes the untrusted `actor` straight into `executeAction()` -> `LedgerService.addEntry()` using `adminDb` (which bypasses Firestore Security Rules).
- **Attack Scenario**: Any unauthenticated caller sends `POST /api/execute-action` with `{ actor: { id: "fake", role: "super_admin", shopId: "victimShop" }, action: { type: "ADD_LEDGER_ENTRY", payload: { shopId: "victimShop", customerPhone: "9876543210", transaction: { amount: 99999, type: "payment" } } } }`.
- **Impact**: Unauthenticated arbitrary financial ledger manipulation across any shop in `mvp1-aafa3`.
- **Proposed Fix**: Require `Authorization: Bearer <Firebase ID Token>`, verify via Firebase Admin Auth (`verifyIdToken(token, true)`), load `users/{uid}`, validate `status === 'active'` and `sessionRevokedAt`, ignore any client-supplied `actor`, and verify tenant membership against `action.payload.shopId`.
- **Verification Test**: Security Matrix #1, #3, #5, #14.

#### [CRIT-03] Unauthenticated & Client-Priced Payment Endpoints in Root `server.ts`
- **File & Line**: `server.ts:135-187`
- **Vulnerability**: `POST /api/create-order` requires no authentication, accepts raw `amount` directly from `req.body`, creates a Razorpay order without persisting to `orders/{orderId}` or enforcing `Idempotency-Key`. `POST /api/verify-payment` requires no auth, uses empty-string fallback for `RAZORPAY_KEY_SECRET`, compares HMAC with non-constant-time `===`, and performs no transactional order/shop update.
- **Attack Scenario**: An attacker sends `POST /api/create-order` with `{ amount: 100 }` (₹1) to generate a valid ₹1 Razorpay order, or spams retries to create duplicate orders; missing secret lets forged HMAC verify against `""`.
- **Impact**: Financial fraud (underpriced subscriptions), duplicate order creation, signature bypass when secret is unset.
- **Proposed Fix**: Require verified Firebase ID token + `requireShopOwner(ctx, shopId)`, look up authoritative server plan pricing (`basic` / `pro`), enforce `Idempotency-Key`, persist orders atomically, fail closed when Razorpay secrets are missing, and verify HMAC-SHA256 using `crypto.timingSafeEqual`.
- **Verification Test**: Security Matrix #1, #15, #16.

#### [CRIT-04] Zero Authentication & Cross-Tenant Access Across All `apps/core-engine` Routes
- **File & Line**: `apps/core-engine/src/api/routes/app.routes.ts:14-169`, `apps/core-engine/src/api/routes/whatsapp.routes.ts:29-76`, `apps/core-engine/src/api/routes/ondc.routes.ts:76-83`
- **Vulnerability**: Every REST endpoint (`/api/sales`, `/api/stores/:storeId/inventory`, `/api/stores/:storeId/low-stock`, `/api/inventory/intent`, `/api/products/:id`, `/api/products/:id/archive`, `/api/stores/:storeId/seed`, `/api/media`, `/api/stores/:storeId/annotations`, `/api/knowledge`, `/api/stores/:storeId/knowledge`, `/whatsapp/openwa/send`, `/ondc/catalog/:storeId/sync`) is completely unauthenticated and performs zero tenant authorization.
- **Attack Scenario**: Any external actor enumerates or guesses a `storeId` or `productId` to read inventory/knowledge, record fraudulent sales, archive products, or send WhatsApp messages on behalf of another store.
- **Impact**: Total compromise of all PostgreSQL store inventory, sales, and outbound messaging.
- **Proposed Fix**: Add reusable Firebase Auth + tenant authorization middleware to `apps/core-engine` protecting every store/product/sales/media/knowledge/OpenWA route, verifying caller owns/belongs to the target `storeId` (and verifying product ownership before `PATCH /products/:id` or `POST /products/:id/archive`).
- **Verification Test**: Security Matrix #1, #2, #3, #4.

#### [CRIT-05] Unauthenticated MCP Tool Execution & Client-Supplied `approver_role` / `tenant_id`
- **File & Line**: `apps/ai-services/mcp_server.py:141-244, 298-411`
- **Vulnerability**: `POST /api/v1/mcp/tools/call` has zero authentication (`/.well-known/ai-plugin.json` line 307 explicitly declares `"auth": {"type": "none"}`), trusts `arguments["tenant_id"]` (defaulting to `"default"`), and `approve_purchase_order` (lines 219-225) trusts `arguments["approver_role"]` directly from the request payload!
- **Attack Scenario**: An attacker or prompt-injected LLM invokes `approve_purchase_order` with `{ tenant_id: "victim_biz", order_id: "po_123", action: "approve", approver_role: "owner" }`, or calls `record_voice_transaction` / `get_inventory_summary` on any `tenant_id`.
- **Impact**: Unauthorized financial PO approvals, cross-tenant data exfiltration, and direct prompt-injection-to-write exploitation.
- **Proposed Fix**: Remove `"auth": {"type": "none"}`, require verified gateway/Firebase caller identity on `/api/v1/mcp/tools/call`, derive `tenant_id` and `actor_role` strictly from verified server context (rejecting/stripping client `approver_role` and cross-tenant `tenant_id`), enforce tool permission registry, rate limiting, and prompt-injection checks.
- **Verification Test**: Security Matrix #13, #14, #17.

#### [CRIT-06] Default Demo-Owner Elevation & Unauthenticated Outbound WhatsApp in `apps/ai-services/app.py`
- **File & Line**: `apps/ai-services/app.py:11, 148-153, 182-269, 306-343, 399-415`
- **Vulnerability**: `role_for()` defaults `ALLOW_DEMO_OWNER` to `"true"` when `actor_id` is omitted, granting `"owner"` privileges to any unauthenticated request! Moreover, `actor_id` is accepted as an unverified query/body parameter, `APP_SECRET` defaults to `"dev-only-change-me"`, and `POST /api/whatsapp/send` (lines 399-415) sends live WhatsApp Cloud API messages with zero authentication.
- **Attack Scenario**: An unauthenticated attacker calls `POST /api/businesses/{victim}/stock-movements` omitting `actor_id` (automatically elevated to `owner`), or calls `POST /api/whatsapp/send` to send spam/phishing via the platform's WhatsApp Business number.
- **Impact**: Unauthenticated inventory tampering, audit log exfiltration, and WhatsApp account abuse/ban.
- **Proposed Fix**: Default `ALLOW_DEMO_OWNER` to `"false"`, require authenticated caller header/token verified against `APP_SECRET` / gateway token on business, agent, upload, and WhatsApp endpoints, and remove reliance on unverified `actor_id`.
- **Verification Test**: Security Matrix #1, #3, #4, #13.

---

### HIGH Findings

#### [HIGH-01] Direct Customer Balance Manipulation & Unrestricted Customer Writes in Firestore Rules
- **File & Line**: `apps/dukaan-in-next/firestore.rules:122-125`
- **Vulnerability**: `match /customers/{customerId} { allow write: if isShopMember(shopId); }` lets any shop member (including staff) overwrite `totalUdhaar`, `total_spent`, `visit_count`, or delete customer records directly without creating a corresponding immutable ledger entry.
- **Attack Scenario**: Dishonest staff member resets a friend's `totalUdhaar` from ₹25,000 to `0` via direct `updateDoc`, leaving zero trace in `shops/{shopId}/ledger`.
- **Impact**: Silent financial fraud and ledger-to-balance integrity drift.
- **Proposed Fix**: Block direct client updates to `['shop_id', 'phone', 'totalUdhaar', 'total_spent', 'visit_count', 'lastPaymentDate', 'first_visit', 'created_at']`; require `totalUdhaar == 0` on initial client customer create; deny client deletes (`allow delete: if false`). Route balance-changing writes through trusted server transactions.
- **Verification Test**: Security Matrix #12.

#### [HIGH-02] Missing Ledger Field/Amount/Type/Shop-Status Validation in Firestore Rules
- **File & Line**: `apps/dukaan-in-next/firestore.rules:127-132`
- **Vulnerability**: Ledger `create` checks only `isShopMember(shopId) && request.resource.data.shop_id == shopId`. It does not validate `amount > 0`, `type in ['credit', 'payment']`, allowed fields, `customerPhone`, or whether the shop is locked/suspended.
- **Attack Scenario**: A compromised client writes a negative amount (`amount: -50000`) or invalid `type: "sale"` or arbitrary oversized document fields into `shops/{shopId}/ledger`.
- **Impact**: Ledger corruption and broken financial totals.
- **Proposed Fix**: Validate required fields (`shop_id`, `customerPhone`, `amount`, `type`, `createdAt`), strict `hasOnly(...)` key allowlist, `type in ['credit', 'payment']`, `amount is number && amount > 0 && amount <= 10000000`, valid phone length, and active/trial shop status.
- **Verification Test**: Security Matrix #10, #11, #18.

#### [HIGH-03] Client-Writable `orders/{orderId}` & Unchecked Payment Notes Amount in `dukaan-in-next`
- **File & Line**: `apps/dukaan-in-next/firestore.rules:108-112`, `apps/dukaan-in-next/src/app/api/create-order/route.ts:31-73`, `apps/dukaan-in-next/src/app/api/verify-payment/route.ts:13-84`
- **Vulnerability**:
  1. `firestore.rules:109` allows clients to `create` arbitrary `orders/{orderId}` documents directly.
  2. `create-order/route.ts` does not check `users/{uid}.status` or `sessionRevokedAt`, and lacks `Idempotency-Key` deduplication.
  3. `verify-payment/route.ts` uses non-constant-time `!==` for `x-razorpay-signature` (line 28), crashes/falls back if `RAZORPAY_WEBHOOK_SECRET` is unset, and trusts `payment.notes.shopId` and `payment.notes.plan` without verifying they match the stored `orders/{orderId}` `shopId`, `plan`, and `amount * 100`.
- **Attack Scenario**: An attacker creates a fake `orders` doc or replays a payment webhook with mismatched plan/shopId, or triggers duplicate Razorpay orders on network retry.
- **Impact**: Unauthorized subscription activation or duplicate billing records.
- **Proposed Fix**: Set `orders/{orderId}` `allow create, update, delete: if false;` in Firestore Rules; enforce `Idempotency-Key` and user status/revocation checks in `create-order`; use `crypto.timingSafeEqual` and cross-verify `orderDoc.shopId`, `orderDoc.plan`, and `orderDoc.amount * 100 === payment.amount` inside `verify-payment`.
- **Verification Test**: Security Matrix #15, #16.

#### [HIGH-04] Missing WhatsApp Webhook Signature Verification in `apps/core-engine` & Timing/Async Issues in `apps/dukaan-in-next`
- **File & Line**: `apps/core-engine/src/channels/whatsapp/webhook.handler.ts:31-57`, `apps/dukaan-in-next/src/app/api/whatsapp/route.ts:16, 33, 39`
- **Vulnerability**: `core-engine` `POST /whatsapp/webhook` performs **zero** `X-Hub-Signature-256` HMAC validation. `dukaan-in-next` compares `hub.verify_token` and `x-hub-signature-256` with non-constant-time `!==` and invokes `handleWhatsAppMessage(body)` without `await`.
- **Attack Scenario**: Any attacker posts forged WhatsApp payloads to `core-engine /whatsapp/webhook`, injecting arbitrary inbound messages, media events, or ledger entries.
- **Impact**: Forged customer orders, ledger entries, and automated outbound WhatsApp spam.
- **Proposed Fix**: Capture raw request buffer in `apps/core-engine/src/index.ts`, verify `X-Hub-Signature-256` using `crypto.timingSafeEqual` with `WHATSAPP_APP_SECRET` (fail closed), and upgrade `dukaan-in-next/src/app/api/whatsapp/route.ts` to `crypto.timingSafeEqual` + awaited error-handled dispatch.
- **Verification Test**: Unit test for valid/invalid/missing WhatsApp HMAC signature.

#### [HIGH-05] Unauthenticated `/api/parse-transaction`, `/api/cron/self-healing`, and `/api/supabase/ingest`
- **File & Line**: `apps/dukaan-in-next/src/app/api/parse-transaction/route.ts:6-24`, `apps/dukaan-in-next/src/app/api/cron/self-healing/route.ts:10-18`, `apps/dukaan-in-next/src/app/api/supabase/ingest/route.ts:13-39`
- **Vulnerability**: All three endpoints accept unauthenticated traffic, allowing LLM quota exhaustion (`/api/parse-transaction`), unauthorized platform self-healing runs (`/api/cron/self-healing`), and arbitrary Supabase event injection (`/api/supabase/ingest`).
- **Attack Scenario**: Attacker floods `/api/parse-transaction` to exhaust Gemini quota or injects poisoned telemetry into Supabase `ingestion_events`.
- **Impact**: Denial-of-wallet, unauthorized administrative jobs, and analytics poisoning.
- **Proposed Fix**: Require verified Firebase ID token + payload length limit on `/api/parse-transaction`; require constant-time secret header (`CRON_SECRET` / `INGEST_API_SECRET`) on cron and ingest endpoints.
- **Verification Test**: Security Matrix #1, #17, #18.

#### [HIGH-06] Unrestricted CORS, Unauthenticated Outbound Send & Debug Simulation Endpoints in `apps/whatsapp-gateway`
- **File & Line**: `apps/whatsapp-gateway/src/gateway.ts:12, 102-168`
- **Vulnerability**: Uses wildcard `cors()`, exposes unauthenticated `POST /api/sendText`, `POST /api/simulate/inbound` (which forwards forged webhooks to `CORE_ENGINE_WEBHOOK`), and `POST /api/sessions/:sessionId/pair-success`.
- **Attack Scenario**: Cross-origin webpage or internet scanner triggers `/api/simulate/inbound` to inject fake customer messages into Core Engine or hijacks session state.
- **Impact**: Cross-origin CSRF/webhook injection and unauthorized messaging.
- **Proposed Fix**: Restrict CORS to `ALLOWED_ORIGINS`, require `X-Gateway-Secret` (`GATEWAY_API_SECRET`) via `timingSafeEqual`, and disable `/api/simulate/inbound` and `/api/sessions/:sessionId/pair-success` when `NODE_ENV === 'production'`.
- **Verification Test**: Security Matrix #1, #18.

#### [HIGH-07] Legacy Root `firestore.rules` Hardcoded Personal Admin Email & Permissive Prototype Writes
- **File & Line**: `firestore.rules:78-82, 146-170`
- **Vulnerability**: Hardcodes personal email `AMITSHARMA99976@gmail.com` as superadmin, allows any signed-in user to create `memory_nodes`/`memory_relations` for any `storeId`, allows users to freely write `merchants/{uid}`, and targets obsolete `stores/*` collections instead of `mvp1-aafa3` `shops/*`.
- **Attack Scenario**: Deploying root `firestore.rules` instead of `apps/dukaan-in-next/firestore.rules` would break `mvp1-aafa3` security and open prototype collections.
- **Impact**: Privilege escalation and broken multi-tenant isolation if accidentally deployed.
- **Proposed Fix**: Align root `/firestore.rules` directly with the hardened `mvp1-aafa3` ruleset (zero hardcoded personal emails, zero prototype `stores`/`memory_*`/`merchants` allowances, strict default deny).
- **Verification Test**: Static & rules-contract verification across both `/firestore.rules` and `/apps/dukaan-in-next/firestore.rules`.

---

### MEDIUM Findings

#### [MED-01] Unbounded Request Bodies, Missing Rate Limiting & Prompt-Injection Exposure on `/api/munim-chat`
- **File & Line**: `server.ts:45, 76-133`
- **Vulnerability**: `express.json()` uses default limits without explicit `413` handling; `/api/munim-chat` lacks rate limiting, lacks request timeout on Gemini calls, and interpolates raw user `history` directly into the prompt without injection filtering or delimiter isolation.
- **Attack Scenario**: Automated bot sends thousands of requests per minute to drain Gemini API budget, or submits oversized JSON payloads / prompt-injection strings to override system instructions.
- **Impact**: Denial-of-service / API billing spike and prompt-injection manipulation.
- **Proposed Fix**: Enforce `64kb` body size limit, per-IP/per-user rate limiting, prompt-injection sanitization with strict XML data delimiters, and server-side timeout on AI calls.
- **Verification Test**: Security Matrix #17, #18.

#### [MED-02] Shop Owner Can Self-Mutate Subscription `plan`, `status`, `paid_till`, `mrr`, and `owner_id` in Firestore Rules
- **File & Line**: `apps/dukaan-in-next/firestore.rules:118-120`
- **Vulnerability**: `allow update, delete: if isSuperAdmin() || isShopOwner(shopId);` permits a shop owner to directly update `plan: 'enterprise'`, `status: 'active'`, `paid_till: <2099>`, or delete the shop document bypassing billing and audit trails. Also `allow create: if isAuthenticated() && isOwner(request.resource.data.owner_id);` lets any user create unlimited shops with arbitrary `shopId` or `plan: 'enterprise'`.
- **Attack Scenario**: Free-tier owner executes `updateDoc(doc(db, 'shops', myShopId), { plan: 'enterprise', status: 'active' })` from browser DevTools.
- **Impact**: Complete billing bypass and audit trail destruction.
- **Proposed Fix**: Restrict `shops/{shopId}` `create` and `delete` to Admin SDK / `super_admin` (`allow create: if false; allow delete: if isSuperAdmin();`); restrict owner `update` to whitelisted profile/settings keys (`name`, `phone`, `whatsapp`, `owner_name`, `address`, `city`, `state`, `pincode`, `settings`, `updated_at`) and verify `resource.data.owner_id == request.auth.uid`.
- **Verification Test**: Security Matrix #2, #4, #5.

#### [MED-03] `apps/ai-services/app.py` Upload Path Construction & Missing Auth
- **File & Line**: `apps/ai-services/app.py:345-371`
- **Vulnerability**: `POST /api/uploads` is unauthenticated and writes to relative `os.path.join("uploads", name)` instead of canonical `uploads_dir` with `os.path.realpath` confinement check.
- **Attack Scenario**: Unauthenticated attacker fills disk space with 8 MB uploads.
- **Impact**: Disk exhaustion / DoS.
- **Proposed Fix**: Require authenticated caller context and resolve uploads strictly inside `uploads_dir` with `os.path.commonpath` / prefix confinement verification.
- **Verification Test**: Static verification + unit test.

#### [MED-04] Dependency Advisories Detected by `npm audit --omit=dev`
- **File & Line**: `package-lock.json`
- **Vulnerability**: `npm audit --omit=dev --audit-level=high` reported advisories in `axios` (`1.0.0 - 1.19.0`), `body-parser` (`<1.20.9`), `follow-redirects` (`1.16.0 - 1.16.1`), `nanoid` (`<3.3.18`), and transitive `@grpc/grpc-js` (`<=1.13.5`, pulled by `@firebase/firestore`).
- **Attack Scenario**: Prototype pollution / DoS / SSRF redirect edge cases if untrusted URLs or malformed compressed payloads reach vulnerable versions.
- **Impact**: Potential DoS or SSRF if exposed via server-side `axios`/`body-parser`.
- **Proposed Fix**: Documented in Phase 3 report; avoid `npm audit fix --force` (which would downgrade `firebase` to `9.14.0`); schedule targeted dependency upgrades (`axios`, `express`/`body-parser`) in a dedicated maintenance PR after compatibility testing.
- **Verification Test**: Re-run `npm audit --omit=dev` after package updates.

---

### LOW Findings

#### [LOW-01] Raw Internal Error Messages Returned to Clients
- **File & Line**: `apps/dukaan-in-next/src/app/api/verify-payment/route.ts:97`, `apps/core-engine/src/api/routes/app.routes.ts:32, 61, 88, 98, 113, 130, 143, 159`, `apps/ai-services/mcp_server.py:410`
- **Vulnerability**: Several handlers return `error.message` or `str(e)` directly in HTTP responses, potentially leaking internal Prisma/SQLite schema details or stack context.
- **Attack Scenario**: Attacker submits malformed payloads to probe database column names or internal paths.
- **Impact**: Information disclosure aiding further exploitation.
- **Proposed Fix**: Return sanitized error codes/messages to external callers while logging structured error context server-side without secrets.
- **Verification Test**: Security Matrix #18.

#### [LOW-02] Staff Permitted to Delete Shop Insights
- **File & Line**: `apps/dukaan-in-next/firestore.rules:137`
- **Vulnerability**: `shops/{shopId}/insights/{insightId}` allows `delete: if isShopMember(shopId)`, permitting staff to delete owner-directed risk alerts (`RISK_ALERT`, `ACTION_REQUIRED`).
- **Attack Scenario**: Staff member dismisses/deletes a fraud or discrepancy insight before the shop owner sees it.
- **Impact**: Audit/monitoring blind spots for shop owners.
- **Proposed Fix**: Restrict `insights` deletion to `isShopOwner(shopId) || isSuperAdmin()`.
- **Verification Test**: Security Matrix #4.
