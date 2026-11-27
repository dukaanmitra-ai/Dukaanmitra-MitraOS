# DukaanMitra MitraOS — Verified Schema Map (`mvp1-aafa3`)

- **Authoritative Firebase Project**: `mvp1-aafa3`
- **Primary Schema Source**: `apps/dukaan-in-next/src/docs/backend-types.ts`, `apps/dukaan-in-next/firestore.rules`, `apps/dukaan-in-next/firestore.indexes.json`, and `apps/dukaan-in-next/src/lib/modules/*`
- **Scope**: Verified field definitions, root MitraOS UI-to-schema mapping, adapter translations, and datastore boundary contracts.
- **Phase Status**: Phase 1 Documentation Only — **zero schema migrations, zero parallel `stores/{storeId}` production writes, zero code changes**.

---

## 1. Verified Facts — Authoritative `mvp1-aafa3` Firestore Collections

### 1.1 `users/{uid}`

- **Verified Sources**: `apps/dukaan-in-next/src/docs/backend-types.ts:14-24`, `auth-service.ts:29-33,61-65`, `create-shop-form.tsx:86-90`, `firestore.rules:99-106`
- **Verified Fields**:
  - `uid: string`
  - `email: string`
  - `displayName?: string`
  - `photoURL?: string`
  - `role: "owner" | "staff" | "franchise_admin" | "super_admin"`
  - `status: "active" | "pending" | "suspended"`
  - `shopId?: string` (single active shop pointer)
  - `createdAt: Timestamp`
  - `lastLogin?: Timestamp`
  - `sessionRevokedAt?: Timestamp | null` (written by `AuthService.updateRole` / `updateStatus`)
  - `updated_at?: Timestamp`
- **Current Rules (`firestore.rules:99-106`)**:
  - `read`: owner (`request.auth.uid == userId`), `super_admin`, `franchise_admin`
  - `list`: `super_admin`, `franchise_admin`
  - `create`: `isOwner(userId) && request.resource.data.role == 'owner'` *(Security Risk: does not block client from setting `status: 'active'` or another user's `shopId`)*
  - `update`: `isSuperAdmin()` or owner if affected keys exclude `['role', 'status']` *(Security Risk: allows owner to change `shopId`!)*
  - `delete`: `isSuperAdmin()`

### 1.2 `shops/{shopId}`

- **Verified Sources**: `backend-types.ts:26-59`, `shop-service.ts:17-40`, `ledger-service.ts:100-104`, `create-shop-form.tsx:66-84`, `verify-payment/route.ts:78-83`, `firestore.rules:117-121`
- **Verified Fields**:
  - `id: string`
  - `owner_id: string` (Firebase Auth UID of shop owner)
  - `name: string`
  - `phone: string`
  - `whatsapp?: string`
  - `owner_name?: string`
  - `address?: string`, `city?: string`, `state?: string`, `pincode?: string`
  - `mrr?: number`
  - `plan?: "free" | "basic" | "pro" | "enterprise"`
  - `status?: "active" | "trial" | "suspended" | "cancelled" | "locked" | "integrity_lock"`
  - `trial_ends_at?: Timestamp | Date`
  - `paid_till?: Timestamp | Date`
  - `lastActive?: Timestamp`
  - `created_at?: Timestamp`, `updated_at?: Timestamp`
  - `integrityStatus?: string`, `lastVerifiedAt?: Timestamp`, `ledgerRootHash?: string`
  - `impact_metrics?: { total_entries: number; total_recovery_inr: number }` (incremented by `LedgerService.addEntry`)
  - `settings?: { language?: "hi"|"en"|"hinglish"; currency?: string; timezone?: string; allow_credit?: boolean; credit_limit_per_transaction?: number; working_hours?: { start?: string; end?: string } }`
- **Current Rules (`firestore.rules:117-121`)**:
  - `create`: `isAuthenticated() && isOwner(request.resource.data.owner_id)`
  - `read`: `isSuperAdmin() || isFranchiseAdmin() || isShopMember(shopId)`
  - `update, delete`: `isSuperAdmin() || isShopOwner(shopId)`

### 1.3 `shops/{shopId}/customers/{customerPhone}`

- **Verified Sources**: `backend-types.ts:61-76`, `ledger-service.ts:49-97`, `add-customer-form.tsx:47-60`, `add-ledger-entry-form.tsx:94-109`, `firestore.rules:122-125`, `firestore.indexes.json:37-43`
- **Document ID**: Customer phone number (`customerPhone`, e.g., 10-digit string in `add-customer-form.tsx:25,47`).
- **Verified Fields**:
  - `shop_id: string`
  - `phone: string`
  - `name?: string`
  - `totalUdhaar?: number` (net outstanding credit; incremented on `'credit'`, decremented on `'payment'`)
  - `total_spent?: number` (cumulative amount)
  - `visit_count?: number`
  - `status?: "NEW" | "REPEAT" | "REGULAR" | "LOYAL" | "churned" | "blocked" | "new"` *(note casing/enum variance across files)*
  - `first_visit?: Timestamp`, `last_visit?: Timestamp`, `lastPaymentDate?: Timestamp`
  - `lastReminderSentAt?: Timestamp`, `reminderCount?: number`
  - `created_at?: Timestamp`, `updated_at?: Timestamp`
- **Verified Index**: `customers` (`shop_id ASC`, `totalUdhaar DESC`)
- **Current Rules (`firestore.rules:122-125`)**:
  - `write`: `isShopMember(shopId)`
  - `read`: `isShopMember(shopId) || isFranchiseAdmin() || isSuperAdmin()`

### 1.4 `shops/{shopId}/ledger/{ledgerId}`

- **Verified Sources**: `backend-types.ts:78-91`, `ledger-service.ts:35-65`, `add-ledger-entry-form.tsx:78-91`, `firestore.rules:127-132`, `firestore.indexes.json:29-35`
- **Document ID**: Auto-generated Firestore ID (`id` stored inside doc).
- **Verified Fields**:
  - `id: string`
  - `shop_id: string` (**required to match path `shopId` by security rules**)
  - `actorId?: string` (written by server `LedgerService.addEntry`)
  - `customerPhone: string`
  - `customerName?: string`
  - `amount: number`
  - `item?: string`
  - `type: "credit" | "payment"`
  - `source?: "whatsapp" | "app" | "manual" | "app-ai" | "whatsapp-ai"`
  - `correlationId?: string` (written by server `LedgerService.addEntry`)
  - `raw_text?: string`, `source_model_version?: string`, `source_confidence?: number`
  - `createdAt: Timestamp`
- **Verified Index**: `ledger` (`shop_id ASC`, `createdAt DESC`)
- **Current Rules (`firestore.rules:127-132`)**:
  - `create`: `isShopMember(shopId) && request.resource.data.shop_id == shopId`
  - `read`: `isShopMember(shopId) || isFranchiseAdmin() || isSuperAdmin()`
  - `update, delete`: **`false` (immutable append-only ledger)**

### 1.5 `orders/{orderId}` (Razorpay Subscription Orders)

- **Verified Sources**: `apps/dukaan-in-next/src/app/api/create-order/route.ts:60-71`, `verify-payment/route.ts:49-76`, `firestore.rules:108-112`
- **Verified Fields**:
  - `id: string`
  - `shopId: string`
  - `userId: string`
  - `plan: "basic" | "pro"`
  - `amount: number` (INR rupees: `1999` or `4999`)
  - `currency: "INR"`
  - `razorpayOrderId: string`
  - `razorpayPaymentId?: string` (set upon webhook verification)
  - `status: "created" | "paid"`
  - `createdAt: Date | Timestamp`
  - `paidAt?: Date | Timestamp`
- **Current Rules (`firestore.rules:108-112`)**:
  - `create`: `isOwner(request.resource.data.userId)` *(Note: server Admin SDK creates orders in `create-order/route.ts`; client direct create should be restricted or validated)*
  - `read`: `isSuperAdmin() || isOwner(resource.data.userId)`
  - `update, delete`: `false` (server Admin SDK updates on webhook verification)

### 1.6 Secondary & System Collections in `mvp1-aafa3`

| Collection Path | Verified Purpose | Client Read | Client Write | Verified Source |
| :--- | :--- | :--- | :--- | :--- |
| `shops/{shopId}/insights/{insightId}` | AI-generated shop alerts (`SALES_DROP`, `RISK_ALERT`, `ACTION_REQUIRED`, etc.) | `isShopMember(shopId)` | `create/update: false`, `delete: isShopMember(shopId)` | `backend-types.ts:123-133`, `firestore.rules:134-138` |
| `notifications/{notificationId}` | Shop notifications (`shopId`) | `isSuperAdmin() \|\| isShopMember(resource.data.shopId)` | `false` | `firestore.rules:86-89` |
| `interactions/{interactionId}` | WhatsApp/AI interaction telemetry | `super_admin`, `franchise_admin` | `false` | `backend-types.ts:93-109`, `firestore.rules:71-74` |
| `auditLogs/{auditLogId}` | Security & financial audit trail | `super_admin`, `franchise_admin` | `false` | `backend-types.ts:135-143`, `firestore.rules:81-84` |
| `metrics/{docId=**}` | Platform `GlobalMetrics` (`mrr`, `totalShops`, etc.) | `super_admin`, `franchise_admin` | `false` | `backend-types.ts:111-121`, `firestore.rules:91-94` |
| `logs/{logId}` | System logs | `super_admin` | `false` | `firestore.rules:76-79` |
| `whatsapp_outbox/{id}` | Outbound WhatsApp queue (indexed on `status`, `createdAt`) | Denied (no rule match) | Denied (Admin SDK only) | `firestore.indexes.json:21-27` |
| `posts/{postId}`, `comments/{commentId}`, `contactFormSubmissions/{id}` | Public blog & contact submissions | `posts/comments`: public; `contactFormSubmissions`: `super_admin` | Controlled (`firestore.rules:53-69`) | `backend-types.ts:5-12,145-175` |
| `shops/{shopId}/{otherSubcollection}/{doc=**}` | Catch-all fallback | **`false`** | **`false`** | `firestore.rules:140-142` |

---

## 2. Verified Non-Firestore Service Schemas (Behind Service Boundaries — Decision 5)

| Service | Database | Verified Models / Tables | Intended Access Pattern |
| :--- | :--- | :--- | :--- |
| **`apps/core-engine`** | PostgreSQL (Prisma `apps/core-engine/prisma/schema.prisma`) | `Store`, `BusinessTemplate`, `Product`, `StockMovement`, `Sale`, `SaleItem`, `Customer`, `WhatsAppMessage`, `MediaAsset`, `Annotation`, `KnowledgeDoc`, `Event` | Authenticated REST APIs (`/api/stores/:storeId/inventory`, `/api/products/:id`, `/api/sales`, `/api/media`, `/api/knowledge`) with Firebase ID token + shop ownership middleware |
| **`apps/ai-services`** | SQLite (`apps/ai-services/mcp_server.py`) | `businesses`, `products`, purchase order drafts, GST compliance rules | Authenticated MCP tool gateway (`get_inventory_summary`, `detect_stockout_risk`, `create_purchase_order_draft`, `approve_purchase_order`, `validate_gst_invoice`, `reconcile_gstr2b`, `get_compliance_deadlines`) |

---

## 3. Proposed Architecture — UI Screen to Schema & Adapter Mapping

### 3.1 Screen & Route Mapping Table

| Root MitraOS Screen / File | Current Divergent Source | Proposed Root Adapter (`services/adapters/*`) | Authoritative Target (`mvp1-aafa3` / Backend API) |
| :--- | :--- | :--- | :--- |
| **Auth & Session Bootstrap** (`/App.tsx:118-178`, `/components/ui/AuthModal.tsx`, `/components/LoginPage.tsx`) | `admins/{uid}`, `merchants/{uid}`, auto-seed `stores/{id}`, `localStorage.dm_demo_auth` | `authAdapter.resolveUserSession(firebaseUser)` | `users/{uid}` (`role`, `status`, `shopId`, `sessionRevokedAt`). If no `shopId`, guide user to explicit shop onboarding instead of auto-seeding fake data. |
| **Merchant Dashboard — Header & KPIs** (`/components/StoreDashboard.tsx:169-174`) | `stores/{storeId}` (`name`, `totalSales`, `totalUdhaar`) | `shopAdapter.subscribeShopSummary(shopId)` | `shops/{shopId}` (`name`, `phone`, `status`, `plan`, `paid_till`, `impact_metrics`) + computed totals from `customers` (`sum(totalUdhaar)`) & `ledger` (`sum(amount)`) |
| **Merchant Dashboard — Live Ledger / Transactions** (`/components/StoreDashboard.tsx:176-186`, `/services/storeService.ts`) | `stores/{storeId}/transactions` | `ledgerAdapter.subscribeLedger(shopId)` & `ledgerAdapter.recordEntry(shopId, input)` | `shops/{shopId}/ledger/{ledgerId}` (ordered by `createdAt desc`, filtered/scoped with `shop_id == shopId`) + atomic customer balance update on `shops/{shopId}/customers/{customerPhone}` |
| **Merchant Dashboard — Udhaar / Customers** (`/components/StoreDashboard.tsx:188-197`) | `stores/{storeId}/customers` (`where("balance", ">", 0)`) | `customerAdapter.subscribeUdhaarCustomers(shopId)` | `shops/{shopId}/customers/{customerPhone}` (`where("totalUdhaar", ">", 0)` or client-filtered/sorted by `totalUdhaar desc`) |
| **Merchant Dashboard — Alerts Tab** (`/components/StoreDashboard.tsx:206-250`) | Hardcoded local alert objects + browser `geminiService.generateAlertAction` + fake `handleExecuteBlast` | `insightsAdapter.subscribeInsights(shopId)` + `aiProxyClient.generateAlertNudge(...)` | `shops/{shopId}/insights/{insightId}` (read/dismiss) + authenticated backend AI proxy (no fake blast alerts) |
| **Merchant Dashboard — Inventory & Shelf Scan Tab** (`/components/StoreDashboard.tsx:67-86`) | Hardcoded 2-second mock `handleScanShelf` | `inventoryApiClient.getInventory(shopId)` / `submitMedia(shopId, file)` (Phase 4/6) | **Authenticated `apps/core-engine` API** (`GET /api/stores/:storeId/inventory`, `POST /api/media`) — *NOT* Firestore `shops/{shopId}/products` (blocked by `mvp1-aafa3` rules) |
| **Merchant Dashboard — Marketing & Poster Tab** (`/components/StoreDashboard.tsx:87-91`) | Browser `geminiService.generateMarketingContent` / `generateMarketingPoster` | `aiProxyClient.generateMarketing(...)` | Authenticated backend `/api/ai/marketing` proxy (server-side Gemini key) |
| **Merchant Dashboard — QR Tab** (`/components/StoreDashboard.tsx:92-93`) | Local state `qrShopName`, `qrUpi` | `shopAdapter.getShop(shopId)` | `shops/{shopId}` (`name`, `phone`, `settings`) |
| **WhatsApp Munim AI Simulator** (`/components/WhatsAppSimulation.tsx`) | Browser `geminiService.routeMessage` + `generateV2Response` + `memoryService` (`memory_nodes`/`memory_relations`) | `aiProxyClient.chatMunim(shopId, message, history)` | Authenticated backend AI endpoint + verified `mvp1-aafa3` customer/ledger context (or `apps/core-engine` `KnowledgeDoc` API). Stop writing to unapproved root `memory_nodes`/`memory_relations`. |
| **Super Admin Dashboard** (`/components/AdminDashboard.tsx`) | `stores` collection + silent fallback `dummy-1..4` | `adminAdapter.subscribePlatformShops()` & `adminAdapter.getGlobalMetrics()` | `shops` (permitted for `super_admin` / `franchise_admin` by `firestore.rules:119`) + `metrics/global` (`firestore.rules:91-94`). Render explicit empty/error state instead of dummy stores. |
| **Subscription Checkout** (`/components/Pricing.tsx`, `/server.ts:135-187`) | Unauthenticated `/api/create-order` & `/api/verify-payment` | `orderAdapter.createSubscriptionOrder(shopId, plan, idempotencyKey)` | Authenticated `/api/create-order` (server-side plan pricing + idempotency + `orders/{orderId}` write) and Razorpay webhook verification |
| **Public Demo Route (`/demo`)** (`/App.tsx:280`) | `<StoreDashboard storeId="demo-mode" />` | Explicitly isolated `DEMO_READONLY_FIXTURE` mode inside adapter (never writes to Firestore, clearly badged as Read-Only Sandbox) | Local static demo fixture only (zero Firestore network calls, zero fake production auth) |

---

## 4. Exact Field-by-Field Translation Matrix (Root UI Model ↔ `mvp1-aafa3`)

### 4.1 Role & Auth (`UserRole` ↔ `users/{uid}`)

| Root `UserRole` Field (`/types.ts:214-218`) | `mvp1-aafa3` `users/{uid}` Field | Adapter Translation Rule |
| :--- | :--- | :--- |
| `uid` | `uid` (doc ID) | Direct 1:1 |
| `role: 'merchant' \| 'superadmin'` | `role: 'owner' \| 'staff' \| 'franchise_admin' \| 'super_admin'` | `'super_admin' \| 'franchise_admin'` → `'superadmin'` (preserve raw `mvpRole` for granular RBAC checks); `'owner' \| 'staff'` → `'merchant'` (with `canManageShop = mvpRole === 'owner'`) |
| `storeId` | `shopId` | Direct 1:1 (`shopId` → `storeId` alias in adapter output) |
| *(missing in root)* | `status: 'active' \| 'pending' \| 'suspended'` | Block dashboard access if `status !== 'active'` |
| *(missing in root)* | `sessionRevokedAt` | Compare against Firebase ID token `auth_time`; force token refresh / re-login if `sessionRevokedAt > auth_time` |

### 4.2 Shop Summary (`StoreData` ↔ `shops/{shopId}`)

| Root `StoreData` Field (`StoreDashboard.tsx:44-49`, `AdminDashboard.tsx:20-28`) | `mvp1-aafa3` `shops/{shopId}` Field | Adapter Translation Rule |
| :--- | :--- | :--- |
| `id` | `id` (doc ID) | Direct 1:1 |
| `name` | `name` | Direct 1:1 |
| `ownerUid` | `owner_id` | Direct 1:1 |
| `whatsappNumber` | `whatsapp \|\| phone` | Prefer `whatsapp`, fallback to `phone` |
| `totalSales` | *(not stored as raw field on `shops`)* | Derived from `impact_metrics.total_recovery_inr` / aggregated ledger payments or `core-engine` sales summary (explicitly labeled as verified metric; never fabricated) |
| `totalUdhaar` | *(not stored as raw field on `shops`)* | Derived live by summing `Math.max(0, c.totalUdhaar)` across `shops/{shopId}/customers` |
| `createdAt` | `created_at` | Normalize Firestore `Timestamp` |
| *(new exposed metadata)* | `status`, `plan`, `paid_till`, `impact_metrics` | Exposed cleanly to UI without breaking legacy props |

### 4.3 Customer (`StoreCustomer` / `CustomerType` ↔ `shops/{shopId}/customers/{customerPhone}`)

| Root Customer Field (`types.ts:32-38`, `StoreDashboard.tsx:149-164`) | `mvp1-aafa3` `Customer` Field | Adapter Translation Rule |
| :--- | :--- | :--- |
| `id` | Document ID (`customerPhone`) | Normalized E.164/10-digit phone key |
| `storeId` | `shop_id` | Direct 1:1 |
| `phone` | `phone` | Required primary key for writes |
| `name` | `name` | Fallback: `Grahak ${phone.slice(-4)}` |
| `balance` | `totalUdhaar` | Direct numeric mapping (`totalUdhaar ?? 0`) |
| `totalLTV` | `total_spent` | Direct numeric mapping (`total_spent ?? 0`) |
| `lastTransactionAt` / `lastSeen` | `last_visit` (fallback `updated_at`) | Format Firestore `Timestamp` |
| *(preserved)* | `visit_count`, `status`, `reminderCount`, `lastPaymentDate` | Normalize `status.toUpperCase()` on read; preserve on write |

### 4.4 Ledger Entry (`Transaction` / `StoreTransaction` ↔ `shops/{shopId}/ledger/{ledgerId}`)

| Root Transaction Field (`types.ts:40-65`) | `mvp1-aafa3` `LedgerEntry` Field | Adapter Translation Rule |
| :--- | :--- | :--- |
| `id` / `transId` | `id` (doc ID) | Direct 1:1 |
| `storeId` | `shop_id` | **Must equal path `shopId`** (`firestore.rules:129`) |
| `customerId` / `phone` | `customerPhone` | Required for `mvp1-aafa3` ledger writes |
| `customerName` | `customerName` | Denormalized customer name |
| `amount` | `amount` | Positive finite number (`> 0`) |
| `items` / `description` | `item` | Map `items \|\| description \|\| 'Saman'` ↔ `item` |
| `type: 'udhaar'` | `type: 'credit'` | **Exact bidirectional mapping** (`udhaar` ↔ `credit`) |
| `type: 'payment'` | `type: 'payment'` | **Exact bidirectional mapping** (`payment` ↔ `payment`) |
| `type: 'sale'` (Cash Sale) | **NOT in `LedgerEntry.type` (`'credit' \| 'payment'`)** | **Schema Gap — see Section 5 & 6 below**: Do NOT silently write `'sale'` into `shops/{shopId}/ledger`. Route cash POS sales to `apps/core-engine` `POST /api/sales` OR require explicit schema approval before extending `LedgerEntry.type`. |
| `timestamp` / `date` | `createdAt` | Firestore `serverTimestamp()` on write; `Timestamp.toMillis()` on read |
| *(new required metadata)* | `source: 'app'` | Set `'app'` for UI entries, `'app-ai'` for AI-assisted entries |

---

## 5. Unverified Assumptions & Schema Gaps

1. **Cash Sale (`type: 'sale'`) Gap**: `mvp1-aafa3` `LedgerEntry` (`backend-types.ts:85`, `ledger-service.ts:24`, `add-ledger-entry-form.tsx:36`) models credit/recovery (`'credit' | 'payment'`). Cash sales live in `apps/core-engine` Prisma (`Sale` + `SaleItem`). Writing `'sale'` into `shops/{shopId}/ledger` without approval risks breaking `apps/dukaan-in-next` calculations (`udhaarImpact = type === 'credit' ? amount : -amount` in `ledger-service.ts:48` would subtract a `'sale'` from udhaar!).
2. **Missing `products` / `inventory` / `bills` in `mvp1-aafa3`**: Confirmed absent from `apps/dukaan-in-next/firestore.rules`, which explicitly blocks unlisted subcollections under `shops/{shopId}` (`line 140`). Inventory belongs in `apps/core-engine` PostgreSQL behind authenticated APIs.
3. **Single-Shop vs. Multi-Shop Ownership**: `users/{uid}` stores a single scalar `shopId?: string`. Multi-shop switching (testing shop-switch membership validation) requires either an explicit `memberships` collection/array or server-side shop membership verification — currently unimplemented in `mvp1-aafa3`.
4. **Customer Phone Normalization**: `add-customer-form.tsx:25` enforces 10-digit regex (`/^\d{10}$/`), while WhatsApp webhooks send E.164 with country code (`91...`). Live production doc ID format in `mvp1-aafa3` (`9876543210` vs `919876543210`) must be verified against live `mvp1-aafa3` data before Phase 4 writes.
5. **Memory Graph (`memory_nodes` / `memory_relations`)**: Exists only in root prototype (`services/memoryService.ts`). Not present in `mvp1-aafa3/firestore.rules` and therefore blocked in `mvp1-aafa3`. Must be replaced by `shops/{shopId}/customers` + `ledger` context (and optionally `apps/core-engine` `KnowledgeDoc`) rather than creating unapproved root collections.

---

## 6. Security & Breaking-Change Risks

- **Ledger Immutability**: Attempting `updateDoc` or `deleteDoc` on `shops/{shopId}/ledger/{id}` fails under `mvp1-aafa3` rules.
- **Ledger Tenant Tagging**: Omitting `shop_id: shopId` on `shops/{shopId}/ledger` create fails `firestore.rules:129`.
- **Cross-Tenant Customer Read/Write**: Currently any authenticated user who edits their own `users/{uid}.shopId` can read/write another shop's `customers` and `ledger` (`firestore.rules:104`). Must be fixed in Phase 3 before enabling production root traffic.
- **No Silent Mock Fallback**: If Firestore or backend API returns `permission-denied` or network error, adapters must propagate typed errors (`AdapterError`) instead of returning dummy data.

---

## 7. Required Approvals

1. **Cash Sales Routing**: Confirm whether root UI cash sales (`type: 'sale'`) route to `apps/core-engine` `POST /api/sales` (recommended, zero Firestore schema change) or whether `mvp1-aafa3` `LedgerEntry` should be extended.
2. **Phone Key Normalization**: Confirm live `mvp1-aafa3` `customers/{docId}` format (`10-digit` vs `+91`/`91` E.164) once read-only access to `mvp1-aafa3` is available.
3. **Multi-Shop Membership Schema (Optional)**: Approve if/when a `shops/{shopId}/members/{uid}` or `users/{uid}.shopIds` model is needed for multi-shop switching.
