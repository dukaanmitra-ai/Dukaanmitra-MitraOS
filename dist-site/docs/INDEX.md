# 📚 Mitra System — Documentation Index

Start here. Everything in this repository, sorted by what you are trying to do.

---

## If you just want to see it running

1. Open `index.html` in a browser — the umbrella site.
2. Open `apps/dukaanmitra-site/index.html` — DukaanMitra product site (chat, cities, pricing, waitlist).
3. Open `apps/storemitra-site/index.html` — StoreMitra storefront (catalogue, cart, WhatsApp checkout).

No install needed. These are static pages with scripted fallbacks.

---

## If you want to run the full stack

| Step | File |
|---|---|
| One command | `scripts/start-all.ps1` |
| Deployment guide | `DEPLOY.md` |
| Architecture and ports | `SYSTEM.md` |
| Root scripts | `package.json` |
| Docker | `docker-compose.yml` |

Ports: MitraOS `5173`, Next.js storefront `3001`, Core Engine `3000`, AI Services `8000`, OpenWA `2785`.

---

## Brand and product

| Topic | File |
|---|---|
| Company blueprint | `docs/DUKAANMITRA_COMPANY_OPERATING_MODEL.md` |
| Full platform description | `docs/DUKAANMITRA_IN_FULL_PLATFORM.md` |
| Master engineering bible | `docs/DUKAANMITRA_MASTER_ENGINEERING_BIBLE_v1.0.md` |
| AI commerce architecture | `docs/DUKAANMITRA_AI_COMMERCE_SYSTEM.md` |
| Master blueprint | `docs/MASTER_BLUEPRINT.md` |
| Superintelligence blueprint | `docs/SUPERINTELLIGENCE_BLUEPRINT.md` |

## Business and launch

| Topic | File |
|---|---|
| Productized offers and pricing | `business/OFFERS.md` |
| Company incorporation and launch | `docs/COMPANY_INCORPORATION_AND_LAUNCH_PLAN.md` |
| Integration roadmap | `docs/ALL_PROJECTS_INTEGRATION_ROADMAP.md` |
| Acquisition and growth ideas | `business/OFFERS.md` (last section) |

## Engineering

| Topic | File |
|---|---|
| System architecture | `SYSTEM.md` |
| Static + full-stack deployment | `DEPLOY.md` |
| Deployment and dev console | `docs/DEPLOYMENT_AND_DEV_CONSOLE.md` |
| Domain binding runbook | `docs/DUKAANMITRA_DOMAIN_BINDING_RUNBOOK.md` |
| Pre-launch audit | `docs/PRELAUNCH_AUDIT_PHASE2_REPORT.md` |
| Component deadlines and status | `docs/DUKAANMITRA_MASTER_ENGINEERING_BIBLE_v1.0.md` |

## App-level docs

| App | Docs |
|---|---|
| MitraOS web | `apps/mitra-os-web/AGENTS.md`, `apps/mitra-os-web/DUKAANMITRA_COMPANY_BLUEPRINT_v2.md` |
| Core Engine | `apps/core-engine/ARCHITECTURE.md`, `apps/core-engine/README.md` |
| DukaanMitra site | `apps/dukaanmitra-site/README.md`, `apps/dukaanmitra-site/SETUP.md` |
| WhatsApp gateway | `apps/whatsapp-gateway/README.md` |
| AI services | `apps/ai-services/` (FastAPI entry: `app.py`) |

## Legacy and archive

| Topic | File |
|---|---|
| Original monorepo README | `docs/legacy/README-monorepo.md` |
| Cloud-native notes | `docs/legacy/CLOUD_ARCHITECTURE.md` |
| Zero local deps migration | `docs/legacy/ZERO_LOCAL_DEPS.md` |
| Domain setup | `docs/legacy/DOMAIN_SETUP.md` |
| Older AI service modules | `archive/legacy-ai-services/` |

---

## Canonical rules

1. **Never put an API key in frontend code.** Model calls go through a server function.
2. **Never let an agent move money or stock without a human approval gate.**
3. **WhatsApp-first.** The customer should not have to install anything.
4. **India-first defaults.** Hinglish, UPI, GST, low bandwidth, Tier-2 reality.
5. **Demo must be honest.** Scripted replies say they are scripted; demo orders save locally.

---

## Repository layout

```
Mitra-System/
├─ index.html                  umbrella site
├─ SYSTEM.md                   architecture
├─ README.md                   quick start
├─ business/OFFERS.md          packages and pricing
├─ docs/                       strategy, blueprints, index
├─ apps/
│  ├─ dukaanmitra-site/        static product microsite
│  ├─ storemitra-site/         static storefront demo
│  ├─ mitra-os-web/            merchant console
│  ├─ dukaan-in-next/          Next.js commerce
│  ├─ core-engine/             Node/Primsa backend
│  ├─ ai-services/             FastAPI AI brain
│  ├─ whatsapp-gateway/        OpenWA gateway
│  └─ shared-ui/               design tokens
├─ packages/                   agent mesh, enterprise agents
├─ sdks/                       agent + TypeScript SDKs
├─ infra/                      docker, k8s, terraform
├─ scripts/                    dev, prod, validation
└─ archive/                    older modules, kept for reference
```
