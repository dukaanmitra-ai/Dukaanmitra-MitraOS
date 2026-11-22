# DukaanMitra - launch site

A scroll-through presentation site for **DukaanMitra**, a hyperlocal AI
storefront and WhatsApp marketing product for small shops.

The story follows one idea: *a shopkeeper should get an AI employee without
learning software.* It starts in Kanpur, then scales to Delhi, London, Dubai
and New York.

**Stack:** one static `index.html` (HTML + CSS + vanilla JS). No build step,
no framework, no npm install. Optional Supabase + Gemini backend for real AI
replies and lead storage.

---

## What is inside

| Section | What it does |
| --- | --- |
| Hero | Live chat demo with quick prompts and Kanpur/Delhi/London/Dubai switch |
| Marquee | Positioning strip |
| Story | Seven full-screen poetic statements with scroll reveals |
| How it works | Three-step onboarding |
| Owner dashboard | Animated dark UI preview with live-ish stats |
| Features | Catalogue, AI replies, orders, reminders, broadcasts, insights |
| Pricing | ₹999 Starter / ₹1,999 Growth / $29 Global |
| Cities | Launch roadmap: Kanpur -> Delhi -> London -> Dubai -> New York |
| FAQ | Native `<details>`, no JS needed |
| Waitlist | Name, business type, city, WhatsApp; persists to Supabase or `localStorage` |
| Final CTA + footer | WhatsApp CTA and site links |

Also included: glass header, scroll progress bar, mobile menu, skip link,
`aria-pressed` city tabs, `prefers-reduced-motion` support.

---

## Run locally

Use any static server. Opening `file://` works for most of the page, but a
server is closer to production.

```powershell
cd C:\Users\18\dukaanmitra-site

# Python 3
python -m http.server 5173

# or Node
npx serve .
```

Open <http://localhost:5173>.

No environment variables and no build step are required.

---

## Deploy

The whole site is `index.html`, so every static host works.

### Netlify (fastest)

1. Go to <https://app.netlify.com/drop>.
2. Drag the `dukaanmitra-site` folder onto the page.
3. Done. Add a custom domain later in **Site settings -> Domain management**.

### Vercel

```powershell
npm i -g vercel
cd C:\Users\18\dukaanmitra-site
vercel
```

Framework preset: **Other**. Build command: none. Output directory: `.`.

### GitHub Pages

1. Push this folder to a GitHub repository.
2. **Settings -> Pages -> Deploy from a branch**.
3. Branch `main`, folder `/ (root)`.

### Cloudflare Pages

Upload the folder, or connect the repo with no build command and `/` as the
output directory.

---

## Optional backend (real AI + stored leads)

Out of the box:

- Chat replies are scripted per city (instant, zero cost, never fails).
- Waitlist submissions save to `localStorage` under `dm_lead`.

To go live with real Gemini replies and Supabase lead storage, follow
[`SETUP.md`](SETUP.md). It takes about 10 minutes and stays on free tiers.

Then fill the `CONFIG` block in `index.html`:

```js
var CONFIG = {
  supabaseUrl: "https://YOUR_REF.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
  useRealAI: true
};
```

**The Gemini key must never appear in `index.html`.** It is stored as a
Supabase secret and read only by the edge function.

### How the fallback works

- If `CONFIG` is empty, the site never makes a network request.
- If `useRealAI` is `false`, chat uses `CITIES[city].price/order/time/fallback`.
- If the edge function errors or times out, the chat falls back to the scripted
  reply for that question.
- If the waitlist insert fails, the lead is stored locally and the visitor
  still sees success.

A visitor should never see a broken state.

---

## File structure

```
dukaanmitra-site/
├─ index.html                      # the entire website
├─ favicon.svg                     # gradient brand mark
├─ README.md                       # this file
├─ SETUP.md                        # Supabase + Gemini walkthrough
└─ supabase/
   ├─ config.toml                  # JWT verification for the chat function
   ├─ schema.sql                   # waitlist, ai_chats, summary view + RLS
   └─ functions/
      └─ chat/
         └─ index.ts               # secure Gemini proxy (Deno edge function)
```

---

## Customize

### Cities and demo replies

In `index.html`, find `var CITIES = { ... }` (~line 912). Each city has:

```js
name, city, locale, orders, lang, greet, price, order, time, fallback
```

Add a new city by adding a key (`mumbai: { ... }`) and a button in
`#cityTabs` with `data-city="mumbai"`. The same keys exist in the edge function
(`SHOPS` in `supabase/functions/chat/index.ts`) when real AI is enabled.

### WhatsApp number

Replace the placeholder `919999999999` in the final CTA:

```html
https://wa.me/919999999999?text=Hi%2C%20DukaanMitra%20ka%20demo%20dekhna%20hai
```

Use country code + number, no `+`, spaces or dashes.

### Pricing and copy

- Plans: search for `<article class="plan`.
- Hero headline: search for `hero-lead` / the `<h1>`.
- Story statements: sections with `class="story"`.

### Colors and fonts

Design tokens are at the top of the `<style>` block:

```css
--bg: #f6f2f8;      /* warm off-white */
--ink: #171225;     /* near-black plum */
--grad: linear-gradient(100deg, #e473a5, #8b5cf6, #6ec6ff);
--green: #25d366;   /* WhatsApp CTA */
```

Fonts are Sora, Inter and Noto Sans Devanagari via Google Fonts.

### Waitlist fields

The form posts:

```json
{
  "name": "Rahul",
  "business_type": "Retail / Kirana Store",
  "city": "Kanpur",
  "whatsapp": "9876543210",
  "source": "website"
}
```

Keep these names aligned with `public.waitlist` in `supabase/schema.sql`.

---

## Pre-launch checklist

- [ ] Replace the placeholder WhatsApp number.
- [ ] Set a real support email in the footer.
- [ ] Test on a real phone (iOS Safari + Android Chrome).
- [ ] Run the Supabase setup if you want real leads before launch.
- [ ] Add the final domain to Supabase **Auth -> URL configuration** if you
      later add auth (not needed for this static page).
- [ ] Add analytics (Plausible/Umami) if desired.
- [ ] Take a screenshot for Product Hunt / WhatsApp outreach.

---

## Roadmap after this page

1. **WhatsApp bot** - connect a business number via WhatsApp Cloud API, route
   messages through the same `chat` function, store orders in `orders`.
2. **Catalogue importer** - photo/PDF/Excel to structured products.
3. **Owner dashboard** - move the animated preview into the existing
   `DukaanMitra-OS` app.
4. **Payments** - UPI/Razorpay links inside chat.
5. **City playbook** - repeat the Kanpur launch in Delhi, London, Dubai, NYC.

---

## Notes

- This is a validation asset, not the full product. It intentionally has no
  auth, no payments and no order database.
- The `DukaanMitra-OS` monorepo is untouched by this site.
- Content is written in Hinglish for the Indian launch, with English for
  London/Dubai.

Built for the first 10 Kanpur shops.
