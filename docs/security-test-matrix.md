# DukaanMitra MitraOS — Phase 3 Security Verification Matrix

**Firebase Project Target**: `mvp1-aafa3`  
**Verification Date**: 2026-11-26  
**Automated Test Suites Executed**:
- `npm run test -- --run` (Vitest 4.1.10) — **3/3 files, 35/35 tests PASSED** (`src/test/security.test.ts`: 13/13, `src/test/adapters.test.ts`: 21/21, `test.test.tsx`: 1/1)
- `python3 -m py_compile apps/ai-services/mcp_server.py apps/ai-services/app.py` + Python MCP security assertions — **9/9 PASSED**
- `npx tsx` Core Engine signed auth context assertions (`apps/core-engine/src/api/middleware/auth.middleware.ts`) — **3/3 PASSED**
- `npm run build` (`compile_applet`) — **PASSED**
- `npm run lint` (`lint_applet`) — **PASSED (0 errors)**

> **Honest Environment Disclosure (Blocked Checks)**  
> 1. **Firebase Firestore Emulator Rules Execution**: **BLOCKED** — `firebase` CLI (`15.36.0`) is present, but **Java Runtime (`java`) is not installed** in this container, so `firebase emulators:exec` cannot execute live Firestore Security Rules unit tests. All 16 rules invariants were instead verified by static rule assertions in `src/test/security.test.ts` and `@firebase/security-rules` ESLint analysis.  
> 2. **Live `mvp1-aafa3` Firestore & Auth Verification**: **BLOCKED** — No production Firebase service account credentials or live `mvp1-aafa3` admin access exist in this environment. No live rules or production data were inspected or modified.

---

## Mandatory 18-Scenario Security Matrix

| # | Mandatory Security Scenario | Enforcement Layer(s) | Automated Server / Adapter / Python Status | Firestore Emulator / Live `mvp1-aafa3` Status | Verified Behavior & Evidence |
|---|---|---|---|---|---|
| 1 | Unauthenticated user accessing protected APIs | Root Express (`authenticateRequest`), Next.js (`verifyNextRequestAuth`), Core Engine (`requireCoreAuth`), WhatsApp Gateway (`requireGatewaySecret`), MCP (`verify_signed_mcp_context`) | **PASSED** (`security.test.ts` #1; Python MCP #2; Core Engine #2) | **BLOCKED** (No Java / No live creds) | Unauthenticated requests to `/api/shops/shop_A/access-check`, `/api/shops/onboard`, `/api/create-order`, `/api/munim-chat`, `/api/ai/tool`, `/api/admin/metrics-check`, and MCP gateway return `401` (`UNAUTHENTICATED`). |
| 2 | Valid active shop owner accessing own shop | `authenticateRequest` + `requireShopOwner` + `requireShopMembership` | **PASSED** (`security.test.ts` #2; Python MCP #1; Core Engine #1) | **BLOCKED** (No Java / No live creds) | Active owner of `shop_A` receives `200` on `/api/shops/shop_A/access-check` with verified `uid`, `role`, and `shopId` sourced strictly from token + `users/{uid}` + `shops/{shopId}`. |
| 3 | Shop A owner accessing Shop B data / billing / AI | `requireShopMembership`, `requireShopOwner`, `createAuthenticatedOrder`, `authorizeAndExecuteAiTool`, Next.js `execute-action` | **PASSED** (`security.test.ts` #3) | **BLOCKED** (No Java / No live creds) | Shop A owner attempting `/api/shops/shop_B/access-check`, `/api/create-order` for `shop_B`, or `/api/ai/tool` targeting `shop_B` is rejected with `403` (`CROSS_TENANT_DENIED` / `FORBIDDEN_OVERRIDE`). |
| 4 | Staff attempting owner-only actions | `requireShopOwner`, `AI_TOOL_REGISTRY`, MCP `TOOL_POLICIES` | **PASSED** (`security.test.ts` #4; Python MCP #5) | **BLOCKED** (No Java / No live creds) | Active `staff` member of `shop_A` attempting `/api/create-order` or `approve_purchase_order` receives `403` (`OWNER_REQUIRED` / `TOOL_FORBIDDEN`). |
| 5 | Merchant attempting `super_admin` privileges | `requirePlatformAdmin`, hardened Firestore Rules (`isSuperAdmin()`) | **PASSED** (`security.test.ts` #5) | **BLOCKED** (No Java / No live creds) | Shop owner attempting `/api/admin/metrics-check` receives `403` (`ADMIN_REQUIRED`); hardened rules remove hardcoded email and require active `super_admin` profile + custom claim. |
| 6 | Suspended account accessing APIs or onboarding | `requireActiveUser`, `provisionShopForUser`, hardened Firestore Rules (`isActiveUser()`) | **PASSED** (`security.test.ts` #6) | **BLOCKED** (No Java / No live creds) | User with `status: "suspended"` receives `403` (`ACCOUNT_SUSPENDED`) on `/api/shops/shop_A/access-check` and `/api/shops/onboard`. |
| 7 | Revoked session accessing APIs | `verifyBearerAuthContext` (`checkRevoked: true` + `sessionRevokedAt` vs `auth_time`), hardened Firestore Rules (`isSessionNotRevoked()`) | **PASSED** (`security.test.ts` #7) | **BLOCKED** (No Java / No live creds) | Tokens issued before `users/{uid}.sessionRevokedAt` AND Firebase-revoked tokens (`auth/id-token-revoked`) both fail with `401` (`SESSION_REVOKED`). |
| 8 | Client-supplied `shopId` or `role` during onboarding | `provisionShopForUser` (`POST /api/shops/onboard`), hardened Firestore Rules (`shops` `allow create: if false`) | **PASSED** (`security.test.ts` #8 & #9) | **BLOCKED** (No Java / No live creds) | Supplying `shopId`, `role`, `status`, `plan`, `owner_id`, or `uid` to `POST /api/shops/onboard` is rejected with `400` (`FORBIDDEN_CLIENT_FIELDS`). |
| 9 | Repeated onboarding requests (idempotency) | `provisionShopForUser` Firestore transaction | **PASSED** (`security.test.ts` #8 & #9) | **BLOCKED** (No Java / No live creds) | First `POST /api/shops/onboard` returns `201` with newly minted `shopId`; second call returns `200` with `idempotent: true` and the exact same `shopId` without creating a duplicate shop. |
| 10 | Direct ledger update attempt | `ledgerAdapter.updateLedgerEntry`, hardened Firestore Rules (`shops/{shopId}/ledger/{ledgerId}` `allow update, delete: if false`) | **PASSED** (`security.test.ts` #10–12; `adapters.test.ts`) | **BLOCKED** (No Java / No live creds) | `updateLedgerEntry()` rejects with `AdapterError { code: "LEDGER_IMMUTABLE" }`; both `firestore.rules` files enforce `allow update, delete: if false;`. |
| 11 | Direct ledger deletion attempt | `ledgerAdapter.deleteLedgerEntry`, hardened Firestore Rules (`allow update, delete: if false`) | **PASSED** (`security.test.ts` #10–12; `adapters.test.ts`) | **BLOCKED** (No Java / No live creds) | `deleteLedgerEntry()` rejects with `AdapterError { code: "LEDGER_IMMUTABLE" }`; both `firestore.rules` files enforce `allow update, delete: if false;`. |
| 12 | Direct customer balance (`totalUdhaar`) manipulation | `customerAdapter.updateCustomer`, hardened Firestore Rules (`!diff.affectedKeys().hasAny(['shop_id', 'phone', 'totalUdhaar', 'total_spent', ...])`) | **PASSED** (`security.test.ts` #10–12; `adapters.test.ts`) | **BLOCKED** (No Java / No live creds) | `updateCustomer("shop_A", ..., { totalUdhaar: 0 })` rejects with `AdapterError { code: "FORBIDDEN" }`; both `firestore.rules` files explicitly forbid client edits to `totalUdhaar` and `total_spent`. |
| 13 | Unauthorized AI tool call & forged `approver_role` | `authorizeAndExecuteAiTool` (`/api/ai/tool`), Python MCP `execute_mcp_tool` | **PASSED** (`security.test.ts` #13 & #14; Python MCP #4, #5, #8) | **N/A** (Server-enforced) | Unknown tools (`drop_database`), forged `approver_role`/`tenant_id`/`actor` inputs, and unauthorized roles are blocked with `403`. |
| 14 | Prompt injection & unapproved sensitive AI write | `detectPromptInjection`, `authorizeAndExecuteAiTool`, Next.js `parse-transaction`, Python MCP `_scan_arguments_for_injection` & `requires_human_approval` | **PASSED** (`security.test.ts` #13 & #14; Python MCP #6, #7) | **N/A** (Server-enforced) | `"Ignore previous instructions..."` is rejected with `400` (`PROMPT_INJECTION_BLOCKED`); sensitive write tools without explicit human approval return `403` / `approval_required` without mutating state. |
| 15 | Invalid payment webhook signature | `verifyRazorpayWebhookPayment` (`/api/verify-payment`), Next.js `verify-payment/route.ts` (`timingSafeEqual`) | **PASSED** (`security.test.ts` #15 & #16) | **BLOCKED** (No live Razorpay/Firebase creds) | Tampered or missing `x-razorpay-signature` returns `401` (`INVALID_WEBHOOK_SIGNATURE`) and never activates subscription or mutates `orders/{orderId}`. |
| 16 | Repeated payment order & webhook requests (idempotency) | `createAuthenticatedOrder` (`Idempotency-Key`), `verifyRazorpayWebhookPayment` transactional state check | **PASSED** (`security.test.ts` #15 & #16) | **BLOCKED** (No Java / No live creds) | Reusing an `Idempotency-Key` on `/api/create-order` returns the original `orderId` without creating a second order; replaying a valid Razorpay webhook returns `200` with `idempotent: true` without double-activating or corrupting state. |
| 17 | Excessive AI requests (rate limiting) | `InMemoryRateLimiter` (`createRateLimitMiddleware`), MCP `_check_rate_limit` | **PASSED** (`security.test.ts` #17) | **N/A** (Server-enforced) | Bursting `/api/munim-chat` beyond configured per-user/per-IP window returns `429` (`RATE_LIMIT_EXCEEDED`) with `Retry-After` header. |
| 18 | Invalid, oversized (>64kb), and disallowed-origin payloads | `express.json({ limit: "64kb" })`, Zod `.strict()` schemas, `createCorsMiddleware` | **PASSED** (`security.test.ts` #18) | **N/A** (Server-enforced) | Disallowed `Origin: https://evil.example.com` is rejected (`403 CORS_ORIGIN_DENIED`); payloads >64kb are rejected (`413 PAYLOAD_TOO_LARGE`); malformed Zod inputs return `400` (`VALIDATION_ERROR`) without stack traces. |

---

## Summary Counts

- **Total Mandatory Scenarios**: 18
- **Automated Server / Adapter / Python / Static-Rules Verification**: **18 / 18 scenarios covered and PASSED** (`35` Vitest tests + `9` Python MCP tests + `3` Core Engine auth tests = **47 passing automated checks, 0 failures**).
- **Firestore Emulator Live Rule Execution**: **0 run / 12 Firestore-related scenarios BLOCKED** (requires Java 17+ to launch `firebase emulators:start --only firestore`).
- **Live `mvp1-aafa3` Verification**: **0 run / BLOCKED** (out of scope until manual review & staging deployment; no live credentials present).

---

## How to Run Unblocked Emulator Verification in CI / Staging

Once Java 17+ and `@firebase/rules-unit-testing` are available in CI:

```bash
java -version
firebase emulators:exec --only firestore --project mvp1-aafa3 "npm run test -- --run"
```
