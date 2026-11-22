# 🧠 Mitra System — System Architecture

> One system. Many doors. Mitra System business ko AI se jodta hai — website se dukaan tak, WhatsApp se machine tak.

This document is the technical map of everything inside this repository. It explains what each app does, how data moves, and where the boundaries are.

---

## 1. The one-line model

```
Customer  ->  Channel  ->  Agent  ->  Core OS  ->  Data  ->  Action
(WhatsApp / web / QR / voice / IoT)
```

Every product in this repo is a different front door into the same spine:

| Layer | What lives here |
|---|---|
| **Channels** | WhatsApp (OpenWA), website, QR, voice, IoT/sensor |
| **Agents** | Sales, support, inventory, finance, ops — with human approval gates |
| **Core OS** | Orders, udhaar/credit, stock, GST, CRM, ledger |
| **Data** | Postgres/Supabase, pgvector, RLS, audit trail |
| **Actions** | Reply, invoice, reorder, alert, report, payment link |

---

## 2. Applications

| App | Path | Stack | Role |
|---|---|---|---|
| **MitraOS web** | `apps/mitra-os-web` | React + Vite + TypeScript | Merchant console: landing page, POS UI, dashboards, WhatsApp pairing, SEO pages |
| **DukaanMitra storefront** | `apps/dukaan-in-next` | Next.js 14 + Supabase + Genkit | Customer-facing commerce: catalogue, cart, checkout, AI flows |
| **Core Engine** | `apps/core-engine` | Node.js + TypeScript + Prisma | Event-driven backend: orders, ledger, inventory, WhatsApp webhooks |
| **AI Services** | `apps/ai-services` | Python + FastAPI | Retail superintelligence: voice, OCR, agents, Mowglai delivery, sandboxes |
| **WhatsApp Gateway** | `apps/whatsapp-gateway` | NestJS + OpenWA | QR pairing, multi-session, webhooks, MCP-ready message bus |
| **Shared UI** | `apps/shared-ui` | React + TS | Design tokens and shared components |
| **DukaanMitra site** | `apps/dukaanmitra-site` | Static HTML | Pre-build validation microsite: chat demo, cities, pricing, waitlist |
| **StoreMitra site** | `apps/storemitra-site` | Static HTML | Working storefront demo: catalogue, cart, WhatsApp checkout |

Supporting packages:

| Package / folder | Path | Role |
|---|---|---|
| Agent mesh | `packages/agent-mesh` | Python orchestrator for multi-agent routing |
| Enterprise agents | `packages/enterprise-agents` | Company/launch agents |
| Agent Development Kit | `sdks/agent-development-kit` | Base agent, governor, router |
| TypeScript SDK | `sdks/dukaan-mitra-sdk` | External integration surface |
| Infra | `infra/` | Docker, Kubernetes, Terraform |
| Archive | `archive/legacy-ai-services` | Older modules kept for reference, not wired into the runtime |

---

## 3. Request flow — WhatsApp order

```
Customer WhatsApp message
        |
        v
OpenWA gateway (apps/whatsapp-gateway)      QR session, webhook fan-out
        |
        v
Core Engine webhook handler                 auth, dedupe, event log
        |
        v
Agent mesh (packages/agent-mesh)            classify intent
        |
        +--> Sales agent        -> product lookup, order draft
        +--> Inventory agent    -> stock check, reorder suggestion
        +--> Finance agent      -> credit/udhaar check
        |
        v
Core OS (orders / ledger / stock)           Postgres via Prisma
        |
        v
Reply generator -> OpenWA -> customer
        |
        v
Audit trail + merchant dashboard
```

Sensitive actions (price change, refund, stock write-off, credit limit) stop at an **approval gate**. The agent recommends; the merchant approves.

---

## 4. Request flow — StoreMitra website order

```
Customer browses catalogue (static or Next.js)
        |
        v
Cart (localStorage for demo, Supabase for production)
        |
        v
Checkout -> WhatsApp deep link with order summary
        |
        v
Shop owner confirms in WhatsApp (same number, no new app)
```

The static demo in `apps/storemitra-site` is intentionally dependency-free: it works from a file or any static host, keeps the cart in `localStorage`, and opens WhatsApp with a pre-filled order. Production swaps the deep link for the Core Engine API.

---

## 5. Data and security

- **Postgres / Supabase** is the system of record.
- **Row-Level Security (RLS)** scopes every row to a shop/business.
- **pgvector** stores product and knowledge embeddings for RAG.
- **Audit log** records every agent action, approval and rejection.
- **Secrets** live only in server-side env vars (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Never in frontend code.
- **No key in the browser.** The public site talks to a server function, never directly to a model provider.

See `apps/dukaanmitra-site/SETUP.md` for the Supabase + Gemini deployment path and `supabase/schema.sql` for the RLS policies.

---

## 6. Local ports

| Service | Port | Command |
|---|---|---|
| MitraOS web | `3000` | `npm run dev:mitraos` |
| DukaanMitra Next.js | `3001` | `npm run dev:dukaanin -- -p 3001` |
| Core Engine | `3100` | `$env:PORT=3100; npm run dev:core` |
| AI Services | `8000` | `npm run dev:ai` |
| OpenWA gateway | `2785` | `npm run docker:openwa` |

One command to start everything: `.\scripts\start-all.ps1`

> Ports 3000 and 3001 are taken by MitraOS and Next.js, so the Core Engine runs on 3100 in the launcher. If you run services manually, keep them on distinct ports and point `CORE_WEBHOOK_URL` at the Core Engine.

---

## 7. What is demo vs. production

| Capability | Demo state | Production state |
|---|---|---|
| StoreMitra catalogue | Static array, `localStorage` cart | Supabase products + orders |
| DukaanMitra chat | Scripted replies | Gemini edge function |
| Waitlist | `localStorage` | Supabase `waitlist` table |
| WhatsApp | Deep link (`wa.me`) | OpenWA session or Cloud API |
| Payments | None (COD/UPI on delivery copy) | Razorpay / UPI intent |
| Auth | None | Supabase auth + RLS |
| Agents | Docs + code paths | Live agent mesh with approvals |

This distinction is deliberate: the public demos must never pretend to move real money or real stock.

---

## 8. Design system

| Token | Value |
|---|---|
| Background | `#f6f2f8` |
| Ink | `#171225` |
| Gradient | `#e473a5 → #8b5cf6 → #6ec6ff` |
| CTA green | `#25d366` |
| Display font | Sora |
| Body font | Inter |
| Devanagari | Noto Sans Devanagari |
| Radius | 16px / 26px |
| Motion | `cubic-bezier(.22,.61,.36,1)` |

Shared tokens live in `apps/shared-ui/src/design-tokens.ts`. Static sites mirror them in CSS variables so the brand stays identical without a build step.

---

## 9. Roadmap

1. **Now** — static sites + docs + working demos (this repo).
2. **Next** — Supabase project, RLS, real waitlist, Gemini edge function.
3. **Then** — OpenWA session for one pilot shop in Kanpur.
4. **After** — Core Engine order/ledger wiring and merchant dashboard.
5. **Scale** — multi-city onboarding, agent approvals, analytics.

See `docs/ALL_PROJECTS_INTEGRATION_ROADMAP.md` and `docs/DUKAANMITRA_MASTER_ENGINEERING_BIBLE_v1.0.md` for the long-form plans.
