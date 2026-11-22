# 🔗 Mitra System — Demo Links & 5-Minute Scripts

> Base URL: **https://mitra-system.vercel.app** ✅ live
> Local: `http://127.0.0.1:4100` after `npm run demo`

---

## 1. URL patterns

| What | URL |
|---|---|
| Umbrella site | `/` |
| Business runner (any combo) | `/apps/business-runner/?biz=kirana&city=kanpur` |
| Owner dashboard | Same URL → click **📊 Owner dashboard** |
| Storefront demo (storemitra) | `/apps/storemitra-site/` |
| DukaanMitra product site | `/apps/dukaanmitra-site/` |
| All 72 demos | `/demos/` |
| City pages | `/cities/kanpur`, `/cities/london`, … |
| Business pages | `/business/kirana`, `/business/clinic`, … |
| API health | `/api/health` |

### Valid values

**biz:** `kirana`, `clinic`, `salon`, `coaching`, `restaurant`, `pharmacy`, `distributor`, `boutique`

**city:** `kanpur`, `lucknow`, `delhi`, `mumbai`, `bengaluru`, `hyderabad`, `london`, `dubai`, `newyork`

Example combos:

- Kanpur kirana — `/apps/business-runner/?biz=kirana&city=kanpur`
- London clinic — `/apps/business-runner/?biz=clinic&city=london`
- Dubai restaurant — `/apps/business-runner/?biz=restaurant&city=dubai`
- Mumbai salon — `/apps/business-runner/?biz=salon&city=mumbai`
- Bengaluru coaching — `/apps/business-runner/?biz=coaching&city=bengaluru`
- Delhi distributor — `/apps/business-runner/?biz=distributor&city=delhi`
- New York boutique — `/apps/business-runner/?biz=boutique&city=newyork`
- Hyderabad pharmacy — `/apps/business-runner/?biz=pharmacy&city=hyderabad`

---

## 2. The 5-minute demo flow (use for every vertical)

**0:00 — Open the combo link.**
Point at the live badge: **Live API** (server connected) or **Demo mode** (offline model). Say: *"Ye ek asli working demo hai, screenshot nahi."*

**0:40 — Customer side.**
- Search an item.
- Filter a category.
- Add 2 items.
- Show free-delivery progress bar.

**1:30 — Checkout.**
- Click **Checkout**.
- Fill name + phone + address.
- Submit.
- Show the WhatsApp-ready order message.
- Say: *"Order server par save hua, aur WhatsApp message taiyar hai. Payment page par nahi — COD/UPI on delivery."*

**2:30 — Owner dashboard.**
- Click **📊 Owner dashboard**.
- Revenue, orders, AOV, conversion, repeat rate.
- 7-day forecast: peak day + confidence.
- Recommendations: add one to cart.
- Customer segments + next action.
- Low stock alert.

**4:00 — City + business switch.**
- Change business type and city in the header.
- Say: *"Same engine, 8 business types, 9 cities. Currency aur delivery apne aap badal jaate hain."*

**4:30 — Close.**
> "Aapke naam, catalogue aur number ke saath 3–5 din me aisa hi store live kar sakta hoon. 14-day pilot se shuru karein?"

---

## 3. Vertical-specific talking points

### Kirana / grocery
- Show `atta`, `milk`, `maggi`; add 3 → free delivery.
- Owner: low stock on rice/surf; recommendation "atta ke saath often bought".
- Pitch: monthly grocery pack ₹2,499 + WhatsApp reorder.

### Clinic
- Show consultation vs teleconsultation vs full blood panel.
- Checkout slot = preferred time (appointment mode).
- Owner: checkup package is bestseller; follow-up segment.
- Pitch: family health plan + home sample collection.

### Salon
- Show haircut → add facial (recommendation).
- Home-service address field.
- Owner: bridal package has only 3 slots; at-risk customers.
- Pitch: monthly grooming membership.

### Coaching
- Show free demo class + foundation batch.
- Enrollment slot = next batch.
- Owner: NEET course high AOV; test series repeat.
- Pitch: full-year batch + parent progress report.

### Restaurant
- Show veg thali + family combo.
- Delivery slot; Jain/no-onion notes.
- Owner: peak day forecast → prep advice.
- Pitch: weekly tiffin + corporate lunch.

### Pharmacy
- Show OTC vs device; prescription note in checkout.
- Owner: BP monitor low stock; refill plan.
- Pitch: monthly medicine refill ₹999.

### Distributor
- Show 50kg atta bag, oil tin; quote request.
- Order mode (no delivery fee logic).
- Owner: bulk order forecast + credit terms.
- Pitch: route delivery + monthly supply plan.

### Boutique
- Show ready-to-wear vs stitching.
- Trial/pickup slot.
- Owner: bridal lehenga low stock; alteration upsell.
- Pitch: bridal consultation + bulk uniform order.

---

## 4. What to say about the ML (honestly)

> "Ye production ML nahi, **ML-lite** hai — pure JavaScript, no external AI bill. Demand forecast weighted moving average + day-of-week use karta hai. Recommendations market-basket lift se aate hain. Customer segments RFM se. Anomalies z-score se. Demo data deterministic hai, taaki har baar same story dikhe. Aapke real orders aane par yehi models aapke data par chalenge."

Do **not** claim:
- real customer data
- real revenue
- live payments
- Meta-approved WhatsApp API (the demo uses click-to-chat)

---

## 5. Offline / bad-network demo

The runner detects a missing API and switches to **Demo mode**:
- catalogue from `apps/business-runner/catalog.js`
- insights from the local model
- orders saved in `localStorage`
- WhatsApp link still works

To force it: open the page from a file path, or block `/api/*` in DevTools → Network → Offline.

---

## 6. Run locally

```powershell
cd C:\Users\18\Mitra-System
node server/index.js
# open http://127.0.0.1:4100/apps/business-runner/
```

Or full stack:

```powershell
npm run start:all
# MitraOS :3000 · Next :3001 · Core :3100 · AI :8000 · OpenWA :2785
```

API checks:

```powershell
Invoke-RestMethod http://127.0.0.1:4100/api/health
Invoke-RestMethod "http://127.0.0.1:4100/api/insights?biz=clinic&city=london"
```

---

## 7. Demo hygiene

- Always mention **"demo data"** once.
- Use the prospect's city and business type — not Kanpur kirana for a Dubai salon.
- Show one vertical deeply, not all eight shallowly.
- End with one next step: 20-minute discovery or 14-day pilot.
- WhatsApp orders jaate hain founder ke number `+91 6393741171` par (demo ke liye set).
