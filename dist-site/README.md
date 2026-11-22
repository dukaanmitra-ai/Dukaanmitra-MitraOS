# 🪔 Mitra System

> **Business ko AI se jodte hain.** Website se dukaan tak. WhatsApp se machine tak.

Mitra System ek AI product studio + platform hai. Ye repository poore ecosystem ko ek jagah rakhti hai: **DukaanMitra**, **StoreMitra**, **MitraOS**, **AgentMitra**, **OpenWA** aur **Physical AI** — sab ek hi data layer, ek hi agent mesh aur ek hi brand ke andar.

Kanpur se shuru. India ke liye bana. Duniya ke liye ready.

---

## ⚡ Quick start

### Sirf dekhna hai? (koi install nahi)

Browser me kholo:

| Page | File |
|---|---|
| Umbrella site | [`index.html`](index.html) |
| DukaanMitra product site | [`apps/dukaanmitra-site/index.html`](apps/dukaanmitra-site/index.html) |
| StoreMitra storefront | [`apps/storemitra-site/index.html`](apps/storemitra-site/index.html) |

Teeno static hain. Chat, cart, forms — sab scripted fallback ke saath kaam karte hain, internet ke bina bhi (fonts chhod ke).

### Poora stack chalana hai?

Requirements: **Node.js 20+**, npm. Optional: Python 3.11+, Docker Desktop.

```powershell
cd C:\Users\18\Mitra-System
.\scripts\start-all.ps1 -Install     # pehli baar
.\scripts\start-all.ps1              # uske baad
```

| Service | URL |
|---|---|
| MitraOS merchant console | http://localhost:3000 |
| DukaanMitra Next.js commerce | http://localhost:3001 |
| Core Engine API | http://localhost:3100 |
| AI Services (FastAPI) | http://localhost:8000 |
| OpenWA WhatsApp gateway | http://localhost:2785 |

Flags: `-SkipAi`, `-SkipOpenWA`, `-NoBrowser`, `-Install`.

Manual start:

```powershell
npm run dev:mitraos
npm run dev:dukaanin -- -p 3001
$env:PORT=3100; npm run dev:core
npm run dev:ai
npm run docker:openwa
```

---

## 🧩 Products

| Product | Kya karta hai | Kiske liye |
|---|---|---|
| **DukaanMitra** | WhatsApp orders, udhaar khata, stock, GST, daily cash — dukaan ka AI operating system | Kirana, retail, clinic |
| **StoreMitra** | Online catalogue, cart, WhatsApp checkout, local SEO | D2C, local retail, food |
| **MitraOS** | Merchant console: POS, ledger, CRM, analytics, multi-store | Growing shops, distributors |
| **AgentMitra** | Sales / support / follow-up agents on WhatsApp, web, voice | High-inbound businesses |
| **OpenWA** | QR-based WhatsApp gateway, multi-session, webhooks, MCP-ready | Developers, internal ops |
| **Physical AI** | Sensors, cameras, QR, machines → AI alerts and decisions | Factories, cold chain, logistics |

---

## 📁 Repository map

```
Mitra-System/
├─ index.html                 umbrella marketing site
├─ SYSTEM.md                  architecture and data flow
├─ README.md                  this file
├─ business/OFFERS.md         packages, pricing, engagement rules
├─ docs/
│  ├─ INDEX.md                documentation hub
│  ├─ DUKAANMITRA_*.md        company, platform, AI commerce, bible
│  ├─ ALL_PROJECTS_*.md       integration roadmap
│  └─ legacy/                 older notes kept for reference
├─ apps/
│  ├─ dukaanmitra-site/       static product microsite + Supabase setup
│  ├─ storemitra-site/        static storefront demo
│  ├─ mitra-os-web/           React merchant console
│  ├─ dukaan-in-next/         Next.js commerce portal
│  ├─ core-engine/            Node/Prisma event-driven backend
│  ├─ ai-services/            FastAPI AI brain
│  ├─ whatsapp-gateway/       OpenWA NestJS gateway
│  └─ shared-ui/              design tokens + shared components
├─ packages/                  agent mesh, enterprise agents
├─ sdks/                      agent kit + TypeScript SDK
├─ infra/                     docker, kubernetes, terraform
├─ scripts/                   launcher and validation
└─ archive/                   older modules, not wired into runtime
```

---

## 🔐 Security rules

1. **No API key in frontend code.** The public chat calls a Supabase edge function, never Gemini directly.
2. **RLS on every table.** Shop data is scoped to the shop.
3. **Human approval gates** for money, refunds, price changes and stock write-offs.
4. **Demo is honest.** Scripted replies say they are scripted. Demo orders save to `localStorage`.
5. **Local Firebase config is not committed.** `apps/mitra-os-web/firebase-applet-config.json` is excluded by `.gitignore`. Firebase web keys are public-by-design, but restrict them by domain and enable App Check before any public deploy. Rotate the key if this folder is ever shared as an archive.

Setup path for real AI + leads: [`apps/dukaanmitra-site/SETUP.md`](apps/dukaanmitra-site/SETUP.md)
Schema: [`apps/dukaanmitra-site/supabase/schema.sql`](apps/dukaanmitra-site/supabase/schema.sql)
Edge function: [`apps/dukaanmitra-site/supabase/functions/chat/index.ts`](apps/dukaanmitra-site/supabase/functions/chat/index.ts)

---

## 🎨 Brand system

| Token | Value |
|---|---|
| Background | `#f6f2f8` |
| Ink | `#171225` |
| Gradient | `#e473a5 → #8b5cf6 → #6ec6ff` |
| CTA green | `#25d366` |
| Display | Sora |
| Body | Inter |
| Devanagari | Noto Sans Devanagari |
| Radius | 16px / 26px |

Tokens: `apps/shared-ui/src/design-tokens.ts`. Static sites mirror them in CSS variables.

---

## 🚢 Deploy

Static launch (today): drag the folder into Netlify, or `vercel --prod`.
Full stack (when needed): Supabase + Core Engine + AI Services + OpenWA.

Step-by-step: [`DEPLOY.md`](DEPLOY.md)

---

## 📌 Current status

| Area | Status |
|---|---|
| Static demos (umbrella, DukaanMitra, StoreMitra) | ✅ Working |
| Docs, offers, system map | ✅ Written |
| Supabase schema + edge function | ✅ Written, not deployed (no project yet) |
| MitraOS console | ✅ Code present, needs `npm install` |
| Next.js storefront | ✅ Code present, needs env + install |
| Core Engine | ✅ Code present, needs Postgres + Redis |
| AI Services | ✅ Code present, needs Python deps |
| OpenWA gateway | ✅ Code present, needs Docker |
| Live WhatsApp / payments / auth | ⛔ Not configured |

---

## ✅ Before sharing publicly

1. WhatsApp number is set to `+91 6393741171` in `index.html` and `apps/storemitra-site/index.html` — change it if a different owner number should receive demo orders.
2. Replace demo store name in `apps/storemitra-site/index.html` ("Sharma Kirana, Kanpur").
3. If deploying the umbrella site, point the app links at real URLs instead of `localhost`.
4. Follow `apps/dukaanmitra-site/SETUP.md` if real AI replies or real waitlist rows are needed.

---

## 🗺️ Roadmap

1. **Validate** — share the three static pages, collect waitlist and discovery calls.
2. **One pilot** — Supabase + Gemini + OpenWA for a single Kanpur shop.
3. **Wire the OS** — Core Engine orders, ledger, stock, merchant dashboard.
4. **Agents** — sales/support agents with approval gates.
5. **Physical AI** — first sensor/camera pilot.
6. **Scale** — multi-city, multi-store, analytics.

Long-form: [`docs/INDEX.md`](docs/INDEX.md) · [`docs/ALL_PROJECTS_INTEGRATION_ROADMAP.md`](docs/ALL_PROJECTS_INTEGRATION_ROADMAP.md)

---

<p align="center"><b>Made in Kanpur. Built for India.</b><br/>DukaanMitra · StoreMitra · MitraOS · AgentMitra</p>
