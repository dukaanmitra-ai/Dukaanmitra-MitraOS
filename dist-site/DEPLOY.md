# 🚀 Deploying Mitra System

Two independent deploy paths. Start with Path A; move to Path B only when you need real data, real AI or real WhatsApp.

---

## Path A — Static launch (today)

Deploy the three static pages. No server, no database, no keys.

| Page | Entry |
|---|---|
| Umbrella | `index.html` |
| DukaanMitra | `apps/dukaanmitra-site/index.html` |
| StoreMitra | `apps/storemitra-site/index.html` |

### Netlify (drag & drop)

1. Go to Netlify → **Add new site** → **Deploy manually**.
2. Drag the whole `Mitra-System` folder (or a zip of it).
3. Publish directory: `.` — no build command.
4. Open the generated URL and check all three pages.

### Vercel

```powershell
npm i -g vercel
cd C:\Users\18\Mitra-System
vercel --prod
```

Framework preset: **Other**. Build command: empty. Output directory: `.`.

### GitHub Pages

```powershell
cd C:\Users\18\Mitra-System
git init
git add .
git commit -m "Mitra System static launch"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Deploy from branch → main / root**.

> `.gitignore` keeps `node_modules`, `.env`, databases and the local Firebase config out of the commit.

### Cloudflare Pages

Upload the folder as a direct-upload project. Same settings as Netlify.

### Before you share the URL

1. WhatsApp number is set to `+91 6393741171` in:
   - `data/catalog.json` (`brand.support`)
   - `index.html`
   - `apps/storemitra-site/index.html`
   - `apps/dukaanmitra-site/index.html`
2. Replace "Sharma Kirana" with the real demo shop name in `apps/storemitra-site/index.html`.
3. Change the localhost links in `index.html` (`http://localhost:3000`, `:3001`, `:8000`, `:2785`) to real URLs, or mark them as "local only".
4. Test on a real phone, not just desktop.

---

## Path B — Full stack

```
Vercel / Netlify        -> apps/mitra-os-web, apps/dukaan-in-next, static pages
Render / Railway / VPS  -> apps/core-engine, apps/ai-services
Supabase                -> Postgres, auth, RLS, edge functions
Docker VPS              -> apps/whatsapp-gateway (OpenWA)
```

### 1. Supabase

Follow `apps/dukaanmitra-site/SETUP.md`:

1. Create a project.
2. Run `apps/dukaanmitra-site/supabase/schema.sql` in the SQL editor.
3. Deploy `supabase/functions/chat`.
4. Set `GEMINI_API_KEY` as a function secret.
5. Put the project URL and **anon** key in the `CONFIG` block of `apps/dukaanmitra-site/index.html`.
6. Flip `useRealAI: true` when the function responds.

Never put the **service role** key in any frontend file.

### 2. Core Engine (Node)

Environment:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
PORT=3100
OPENWA_URL=https://wa.yourdomain.com
CORE_WEBHOOK_URL=https://api.yourdomain.com/whatsapp/openwa/webhook
```

Build and run:

```powershell
npm --prefix apps/core-engine install
npm --prefix apps/core-engine run prisma:generate
npm --prefix apps/core-engine run build
npm --prefix apps/core-engine start
```

Render/Railway: use `apps/core-engine` as root, build `npm install && npm run build`, start `npm start`.

### 3. AI Services (Python)

```
OPENAI_API_KEY=...
GEMINI_API_KEY=...
DATABASE_URL=postgresql://...
```

```powershell
pip install -r apps/ai-services/requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --app-dir apps/ai-services
```

Render: Python environment, start command above (without `--reload`).

### 4. MitraOS web (React)

```powershell
npm --prefix apps/mitra-os-web install
npm --prefix apps/mitra-os-web run build
```

Vercel: root `apps/mitra-os-web`, build `npm run build`, output `dist`.
The app reads runtime config from its own `.env`; copy `.env.example` and fill it.

### 5. Next.js commerce

```powershell
npm --prefix apps/dukaan-in-next install
npm --prefix apps/dukaan-in-next run build
```

Vercel: root `apps/dukaan-in-next`. Add all variables from its `.env.example`.
`next.config.js` supports static export with `BUILD_STATIC=true` if you only need a catalogue.

### 6. OpenWA gateway (Docker)

```powershell
cd apps/whatsapp-gateway
docker compose -f docker-compose.dev.yml up -d
```

Then open `http://<server>:2785`, scan the QR with the shop's WhatsApp, and point its webhook at the Core Engine.

Put it behind HTTPS (Caddy/Nginx) before production. Do not expose the raw port publicly without auth.

---

## Environment variables cheat sheet

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Core Engine, AI Services | Postgres |
| `REDIS_URL` | Core Engine | Queues, cache |
| `PORT` | Core Engine | Use `3100` locally |
| `OPENWA_URL` | Core Engine | Gateway base URL |
| `CORE_WEBHOOK_URL` | OpenWA | Delivery target |
| `OPENAI_API_KEY` | AI Services (server only) | Model calls |
| `GEMINI_API_KEY` | Supabase function secret / AI Services | Model calls |
| `SUPABASE_URL` | Frontend | Project URL (public) |
| `SUPABASE_ANON_KEY` | Frontend | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations |
| `RAZORPAY_KEY_ID` / `SECRET` | Server only | Payments |

Rules:

- Anything prefixed `NEXT_PUBLIC_` or `VITE_` is public. Never put a secret there.
- Rotate any key that was ever committed or pasted into a chat.
- Firebase web config is public-by-design, but restrict it by domain and enable App Check.

---

## Domain plan

| Domain | Points to |
|---|---|
| `mitrasystem.in` | umbrella static site |
| `dukaanmitra.in` | DukaanMitra site / Next.js commerce |
| `app.dukaanmitra.in` | MitraOS console |
| `api.dukaanmitra.in` | Core Engine |
| `ai.dukaanmitra.in` | AI Services |
| `wa.dukaanmitra.in` | OpenWA gateway (HTTPS + auth) |

DNS: point apex to the host, `www` redirect to apex, and each subdomain to its service. Enable HTTPS everywhere.

---

## Post-deploy checklist

- [ ] All three static pages load on mobile at 390px without horizontal scroll.
- [ ] WhatsApp CTA opens the correct number with the correct message.
- [ ] Waitlist/brief form shows success and stores data.
- [ ] No console errors; no secret appears in page source.
- [ ] `robots.txt` and `sitemap.xml` updated for the real domain.
- [ ] Open Graph image and title look right when pasted into WhatsApp.
- [ ] Supabase RLS tested with the anon key (must not read other rows).
- [ ] AI function rate limit verified.
- [ ] Backups enabled on the database.
- [ ] Uptime check on `api` and `ai` endpoints.

---

## Rollback

- Static: redeploy the previous folder or use the host's instant rollback.
- Next.js / MitraOS: Vercel → Deployments → Promote previous.
- Core Engine / AI: redeploy the previous image or commit.
- Database: restore from the Supabase backup; migrations should be additive.

Keep one known-good deploy per week until the pilot stabilizes.
