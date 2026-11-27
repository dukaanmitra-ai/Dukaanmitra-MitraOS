# DukaanMitra MitraOS — Phase 3 Security Hardening & Trusted Backend Report

**Project**: `Dukaanmitra-MitraOS` (monorepo)  
**Firebase Target**: `mvp1-aafa3`  
**Phase**: Phase 3 (Security Inventory, Rules Hardening, Trusted Server Auth/AuthZ, Onboarding, Payments, API & AI/MCP Hardening)  
**Deployment Status**: **NOT DEPLOYED** — No rules were deployed, no production data was migrated, and no collections were deleted.

---

## 1. Executive Findings Summary

The full Phase 3.1 security inventory is documented in `docs/phase3-security-audit.md`. Across the monorepo (`server.ts`, `firestore.rules`, `apps/dukaan-in-next`, `apps/core-engine`, `apps/whatsapp-gateway`, and `apps/ai-services`), **19 findings** were identified:

- **CRITICAL (6)**:
  1. Unauthenticated mutation & privilege-escalation endpoints (`/api/execute-action` trusting client `actor`, `apps/core-engine` store/sales/inventory/product routes with zero auth, `apps/whatsapp-gateway` unauthenticated session/send/simulator controls).
  2. Unauthenticated MCP gateway (`apps/ai-services/mcp_server.py`) advertising `"auth": {"type": "none"}` and trusting client-supplied `tenant_id` and `approver_role`.
  3. Root `firestore.rules` using a hardcoded personal email (`AMITSHARMA99976@gmail.com`) as super-admin, divergent collections (`stores`, `memory_*`, `merchants`), and missing session-revocation / field-immutability enforcement; `apps/dukaan-in-next/firestore.rules` containing invalid Firestore Rules v2 `if (...) return` syntax and allowing client-side `shops` creation and `users/{uid}.shopId` mutation.
  4. Root Express `server.ts` exposing unauthenticated `/api/munim-chat` without rate limiting, size caps, CORS allowlist, or input validation, and no trusted server endpoints for onboarding, payments, or AI tools.
  5. `apps/ai-services/app.py` defaulting `ALLOW_DEMO_OWNER="true"`, using hardcoded `"dev-only-change-me"` `APP_SECRET`, exposing unauthenticated `/api/whatsapp/send`, and missing upload directory confinement.
  6. Payment webhook verification in `apps/dukaan-in-next/src/app/api/verify-payment/route.ts` lacking constant-time signature comparison (`timingSafeEqual`), failing open if secret checks were bypassed, and not cross-checking `orderData.shopId` + amount atomically.
- **HIGH (7)**:
  - Unauthenticated `/api/parse-transaction`, `/api/create-order`, `/api/cron/self-healing`, `/api/supabase/ingest`, Core Engine WhatsApp webhook missing `X-Hub-Signature-256` & using `'default_verify_token'`, Core Engine ONDC sync unauthenticated, and missing payment/onboarding idempotency.
- **MEDIUM (4)**:
  - Open CORS (`*`) on `apps/whatsapp-gateway`, missing JSON body limits (`64kb`/`128kb`), missing request timeouts & safe error redaction, and fire-and-forget WhatsApp webhook processing in Next.js.
- **LOW (2)**:
  - Root `package.json` dependency advisories reported by `npm audit` and `.env.example` missing server-only secret declarations.

---

## 2. Files Created & Modified

### Newly Created Files
| File | Purpose |
|---|---|
| `docs/phase3-security-audit.md` | Full Phase 3.1 vulnerability inventory with severity, file:line, attack scenario, impact, fix, and test plan. |
| `docs/security-test-matrix.md` | Complete 18-scenario verification matrix with actual pass/block outcomes. |
| `docs/phase3-implementation-report.md` | This Phase 3.10 delivery & migration report. |
| `server/security/firebaseAdmin.ts` | Singleton Firebase Admin SDK bound to `mvp1-aafa3` + structured `ServerSecurityError`. |
| `server/security/guards.ts` | Constant-time HMAC verification (`timingSafeEqual`), strict CORS allowlist, sliding-window rate limiter, timeout wrapper, log redaction, audit logger, and safe error responder. |
| `server/security/authContext.ts` | Reusable Bearer token verifier & typed `ServerAuthContext` (`uid`, `role`, `shopId`, `status`, `tokenClaims`) checking token revocation (`checkRevoked: true`) and `users/{uid}.sessionRevokedAt`. |
| `server/security/authorization.ts` | Reusable server guards: `requireAuthenticatedUser`, `requireActiveUser`, `requirePlatformAdmin`, `requireShopMembership`, `requireShopOwner`, `requirePermission`, plus Express middleware wrappers. |
| `server/security/shopOnboarding.ts` | Trusted, idempotent Admin SDK transactional shop provisioning (`provisionShopForUser`), rejecting client-supplied `shopId`/`role`/`status`/`plan`/`owner_id`/`uid`. |
| `server/security/payments.ts` | Authoritative server-side plan catalog (`basic: 1999`, `pro: 4999`), owner-checked idempotent order creation, and `timingSafeEqual` transactional Razorpay webhook verification. |
| `server/security/aiMcpGuard.ts` | AI/MCP tool permission registry, read/write classification, human-approval enforcement, prompt-injection defense, forged parameter rejection, rate limiting, and audit logging. |
| `server/apiRouter.ts` | Hardened Express router (`mountHardenedApiRoutes` & `createTestApiApp`) mounting `/api/health`, `/api/munim-chat`, `/api/shops/onboard`, `/api/shops/:shopId/access-check`, `/api/admin/metrics-check`, `/api/create-order`, `/api/verify-payment`, `/api/ai/merchant-chat`, `/api/ai/marketing-copy`, `/api/ai/alert-nudge`, and `/api/ai/tool`. |
| `apps/dukaan-in-next/src/lib/server-auth.ts` | Reusable Next.js Firebase Admin Bearer verifier (`verifyNextRequestAuth`), `timingSafeEqualText`, and shared-secret header guard. |
| `apps/core-engine/src/api/middleware/auth.middleware.ts` | Signed HMAC-SHA256 internal context verifier (`verifySignedCoreContext`), `requireCoreAuth`, `requireStoreAccess`, `requireProductStoreAccess`, and `requireGatewayBridgeSecret`. |
| `src/test/security.test.ts` | Automated Vitest verification suite covering all 18 mandatory scenarios against live in-process Express routes, adapters, and Firestore rules contracts. |

### Modified Files
| File | Key Changes |
|---|---|
| `apps/dukaan-in-next/firestore.rules` | Fixed invalid Rules v2 `if (...) return` syntax; implemented all 16 Phase 3.2 security invariants (active user, session revocation, immutable `uid`/`role`/`status`/`shopId`, server-only `shops` creation & `orders` writes, immutable `ledger`, immutable `totalUdhaar`/`total_spent`, strict default deny). |
| `firestore.rules` | Synchronized with hardened `mvp1-aafa3` schema rules; removed hardcoded `AMITSHARMA99976@gmail.com` super-admin email and legacy divergent collections (`stores`, `memory_*`, `merchants`). |
| `server.ts` | Mounted `mountHardenedApiRoutes(app)`, added `trust proxy` and security headers while preserving Vite dev middleware & static SPA serving on port 3000. |
| `.env.example` | Documented all server-only secrets (`FIREBASE_SERVICE_ACCOUNT_KEY`, `GEMINI_API_KEY`, `RAZORPAY_*`, `ALLOWED_ORIGINS`, `WHATSAPP_*`, `CRON_SECRET`, `INGEST_API_SECRET`, `MCP_GATEWAY_SECRET`, `GATEWAY_API_SECRET`, `CORE_ENGINE_INTERNAL_SECRET`). |
| `services/adapters/authAdapter.ts` | Wired `shopOnboardingService.createShopForCurrentUser` to invoke authenticated `POST /api/shops/onboard` with the user's Firebase ID token while preserving `SERVER_PROVISIONING_REQUIRED` when unauthenticated/unconfigured. |
| `apps/dukaan-in-next/src/app/api/execute-action/route.ts` | Replaced client-supplied `actor` trust with verified Firebase ID token + `users/{uid}` lookup, tenant isolation, and positive amount validation. |
| `apps/dukaan-in-next/src/app/api/parse-transaction/route.ts` | Added `verifyNextRequestAuth`, input length cap, and prompt-injection filtering. |
| `apps/dukaan-in-next/src/app/api/create-order/route.ts` | Added `verifyNextRequestAuth`, owner/tenant check, server-side plan pricing, and `Idempotency-Key` deduplication. |
| `apps/dukaan-in-next/src/app/api/verify-payment/route.ts` | Added fail-closed secret validation, `timingSafeEqualText` HMAC-SHA256 verification, atomic transaction cross-checking `orderData.shopId` & amount, and safe error responses. |
| `apps/dukaan-in-next/src/app/api/whatsapp/route.ts` | Constant-time token & signature verification (`timingSafeEqualText`) and awaited `handleWhatsAppMessage(body)`. |
| `apps/dukaan-in-next/src/app/api/cron/self-healing/route.ts` | Protected with `CRON_SECRET` via `verifySharedSecretHeader`. |
| `apps/dukaan-in-next/src/app/api/supabase/ingest/route.ts` | Protected with `INGEST_API_SECRET` and `.strict()` Zod schema validation. |
| `apps/core-engine/src/index.ts` | Enforced 128kb JSON limit with `rawBody` capture and wired `WHATSAPP_APP_SECRET` (removed `'default_verify_token'` fallback). |
| `apps/core-engine/src/channels/whatsapp/webhook.handler.ts` | Enforced fail-closed `X-Hub-Signature-256` and `hub.verify_token` constant-time checks. |
| `apps/core-engine/src/api/routes/app.routes.ts` | Added `requireCoreAuth`, `requireStoreAccess`, and `requireProductStoreAccess` across all store, sales, inventory, product, media, and knowledge routes. |
| `apps/core-engine/src/api/routes/whatsapp.routes.ts` | Added `requireGatewayBridgeSecret` on `/openwa/webhook`, `requireCoreAuth` on `/openwa/status`, and owner-level `requireStoreAccess` on `/openwa/send`. |
| `apps/core-engine/src/api/routes/ondc.routes.ts` | Added `requireCoreAuth` + owner `requireStoreAccess` on `/catalog/:storeId/sync`. |
| `apps/whatsapp-gateway/src/gateway.ts` | Restricted CORS to `ALLOWED_ORIGINS`, required `GATEWAY_API_SECRET` (`timingSafeEqual`), and disabled `/api/simulate/inbound` & `/api/sessions/:id/pair-success` when `NODE_ENV=production`. |
| `apps/ai-services/mcp_server.py` | Removed `"auth": {"type": "none"}`, added HMAC-SHA256 signed `verify_signed_mcp_context`, explicit `TOOL_POLICIES` registry, forged `approver_role`/`tenant_id` rejection, rate limiting, prompt-injection scanning, and human-approval enforcement. |
| `apps/ai-services/app.py` | Changed `ALLOW_DEMO_OWNER` default to `"false"`, removed hardcoded `"dev-only-change-me"` `APP_SECRET`, required service auth on `/api/whatsapp/send` and `/api/uploads`, and enforced `os.path.realpath` upload directory confinement. |
| `package.json` | Added `firebase-admin` dependency for server-side Admin SDK verification. |

---

## 3. Firestore Security Rules Hardening & Pre-Deployment Migration Notes

Both `apps/dukaan-in-next/firestore.rules` and root `firestore.rules` now enforce all 16 Phase 3.2 invariants:
- Valid Firestore Rules v2 expression syntax (fixed pre-existing invalid `if (...) return` statements in `isShopMember`/`isShopOwner`).
- Mandatory authentication, active `users/{uid}` profile (`status == 'active'`), and session-revocation check (`request.auth.token.auth_time >= sessionRevokedAt`).
- Users cannot escalate `uid`, `role`, `status`, `shopId`, `sessionRevokedAt`, or `createdAt` on `users/{uid}`.
- `shops/{shopId}` creation is server-only (`allow create: if false`) via Admin SDK; clients cannot tamper with `owner_id`, `plan`, `subscription_status`, or billing fields.
- `shops/{shopId}/ledger/{ledgerId}` is strictly append-only (`allow update, delete: if false`) with positive amount and schema validation.
- `shops/{shopId}/customers/{customerId}` blocks direct client mutations to `totalUdhaar`, `total_spent`, `shop_id`, and `phone`.
- `orders/{orderId}` is read-only for the owning shop / `super_admin` and write-denied (`allow create, update, delete: if false`) for all clients.
- Removed hardcoded personal email super-admin grant; strict default deny on `match /{document=**}`.

### Important Breaking-Change Dependencies Before Deploying Rules
1. **Next.js Shop Creation Form**: `apps/dukaan-in-next/src/app/[locale]/(app)/dashboard/create-shop-form.tsx` currently writes directly to `shops` / `users` from the client. Before deploying the hardened Firestore rules to `mvp1-aafa3`, point that form to the trusted server onboarding endpoint (`POST /api/shops/onboard`).
2. **Client Ledger Balance Writes**: Because hardened rules block client writes to `customers/{customerId}.totalUdhaar`, route client ledger creation + balance aggregation through a trusted server endpoint (or Cloud Function trigger) before enforcing the customer `totalUdhaar` rule in production.

---

## 4. Auth, Authorization, Tenant Isolation & AI/MCP Controls

- **Server Auth Context (`server/security/authContext.ts`)**: Verifies Firebase ID tokens with `checkRevoked: true`, loads `users/{uid}` via Admin SDK, validates `status === 'active'`, and compares `token.auth_time` against `sessionRevokedAt`.
- **Tenant & Role Guards (`server/security/authorization.ts`)**: Every tenant-scoped route verifies `context.shopId === targetShopId` (or explicit `super_admin` override) and validates `shops/{shopId}.owner_id === context.uid` for owner-only actions like billing or subscription changes.
- **AI & MCP Security (`server/security/aiMcpGuard.ts`, `apps/ai-services/mcp_server.py`)**:
  - Explicit allowlisted tool registry with `read` vs `write` classification, allowed roles, and `requiresHumanApproval` flags.
  - Hard rejection (`403`) whenever a request attempts to supply `approver_role`, `tenant_id`, `shopId`, `actor`, or `role` inside tool arguments.
  - Prompt-injection pattern scanning (`400`) and untrusted input delimiters (`wrapUntrustedContentForLlm`).
  - Per-tenant sliding-window rate limits (`429`) and structured audit logging (`recordSecurityAudit` / `_write_mcp_audit`).

---

## 5. Verification Results

| Suite / Command | Result | Details |
|---|---|---|
| `npm run test -- --run` (Vitest) | **PASSED (35 / 35)** | `src/test/security.test.ts` (13/13 covering all 18 scenarios), `src/test/adapters.test.ts` (21/21), `test.test.tsx` (1/1). |
| Python syntax & MCP security checks | **PASSED (9 / 9)** | `py_compile` clean on `mcp_server.py` & `app.py`; 9/9 signed context, RBAC, forged-role, human-approval, prompt-injection, and manifest checks passed. |
| Core Engine signed auth checks (`tsx`) | **PASSED (3 / 3)** | Valid HMAC-SHA256 accepted; invalid signature & expired token rejected. |
| `compile_applet` (`npm run build`) | **PASSED** | Production Vite bundle compiled cleanly. |
| `lint_applet` (`npm run lint`) | **PASSED (0 errors)** | Zero errors across repo; zero warnings in newly added Phase 3 server/adapter/test files. (2 `@firebase/security-rules/no-open-reads` warnings on intentionally public blog `posts`/`comments` collections.) |
| Firestore Emulator Rules Tests | **BLOCKED** | Java runtime (`java`) is not installed in this container. |
| Live `mvp1-aafa3` Rules / Data Audit | **BLOCKED** | No live credentials in environment; live project untouched. |

---

## 6. Remaining Risks & Dependency Advisories (`npm audit`)

Running `npm audit --omit=dev --audit-level=high` reported high-severity advisories in root dependencies:
- `axios` (`1.0.0–1.19.0`), `body-parser` (`<1.20.9`), `follow-redirects` (`1.16.0–1.16.1`), `nanoid` (`<3.3.18`) — remediable via non-breaking `npm audit fix` / targeted minor bumps in a lockfile PR.
- Transitive `@grpc/grpc-js` (`<=1.13.5`) pulled by `firebase` SDK (`npm audit fix --force` would downgrade `firebase@9.14.0`, which is breaking — upgrade `firebase` cleanly to the latest v10/v11 patch in a dedicated dependency PR instead).
- **Rate Limiter Storage**: `InMemoryRateLimiter` in `server/security/guards.ts` and `_RATE_BUCKETS` in `mcp_server.py` are per-instance. Before horizontal multi-replica production scaling, back them with Redis / Cloud Memorystore.

---

## 7. Manual Firebase Console & Deployment Actions Required

1. **Provision Server Environment Secrets** (in Cloud Run / Vercel / Secret Manager — never `VITE_*`):
   - `FIREBASE_SERVICE_ACCOUNT_KEY` (or Workload Identity / ADC bound to `mvp1-aafa3`)
   - `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
   - `ALLOWED_ORIGINS` (exact production origins, e.g. `https://dukaanmitra.in,https://app.dukaanmitra.in`)
   - `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `CRON_SECRET`, `INGEST_API_SECRET`, `MCP_GATEWAY_SECRET`, `GATEWAY_API_SECRET`, `CORE_ENGINE_INTERNAL_SECRET`, `APP_SECRET`
2. **Assign Platform Super-Admin Custom Claim**: Grant `{ role: "super_admin" }` via Firebase Admin SDK `setCustomUserClaims()` ONLY to authorized platform operator UIDs, matching their `users/{uid}` document (`role: "super_admin"`, `status: "active"`).
3. **Run Firestore Emulator Tests in CI**: Execute `firebase emulators:exec --only firestore --project mvp1-aafa3` on a runner with Java 17+ to validate rules dynamically before staging deployment.
4. **Update Remaining Client Writers Before Rules Deploy**: Migrate `apps/dukaan-in-next` `create-shop-form.tsx` and client `totalUdhaar` updates to trusted server endpoints, then inspect live `mvp1-aafa3` rules and deploy in staging first.

---

## 8. Deployment Blockers

- **Do NOT deploy hardened `firestore.rules` to `mvp1-aafa3` yet** until:
  1. Firestore Emulator rule tests pass on a Java-enabled CI runner.
  2. Live `mvp1-aafa3` existing rules and user/shop documents are audited to verify every active user has `status: "active"` and valid `role`/`shopId` fields.
  3. `apps/dukaan-in-next` client shop-creation and customer-balance mutation paths are switched to trusted server endpoints.
- **No Git Repository in Container**: `/app/applet` has no `.git` metadata, so changes should be synced into a dedicated feature branch (e.g., `phase-3-security-hardening`) in your VCS before code review.
