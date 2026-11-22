# 🛍️ StoreMitra — Demo Storefront

A dependency-free storefront demo for **Sharma Kirana & General Store, Kanpur**. It shows what a `DukaanMitra-OS` shop looks like when a customer opens it on their phone.

**Open it:** double-click `index.html`, or serve the repo root and go to `/apps/storemitra-site/index.html`.

---

## What works

| Feature | Behaviour |
|---|---|
| Catalogue | 16 products across 6 categories |
| Search | Live filter on name, unit and category |
| Cart | Add, increment, decrement; survives refresh via `localStorage` (`sm_cart_v1`) |
| Delivery rule | Free above ₹299, otherwise ₹29 |
| Checkout | Name + phone + address validation, then a pre-filled WhatsApp order |
| Orders | Last 25 orders saved to `localStorage` (`sm_orders_v1`) |
| Mobile | Sticky total bar, slide-in cart, Escape to close, focus trap |
| Empty states | Cart empty and no-search-results states |

No build step, no framework, no network calls except Google Fonts. It also works from `file://`.

---

## Customize in 5 minutes

Open `index.html` and edit the `PRODUCTS` array in the script near the bottom:

```js
var PRODUCTS = [
  { id: "atta", name: "Aashirvaad Atta", unit: "5 kg pack",
    price: 265, mrp: 290, cat: "staples", emoji: "🌾",
    badge: "Bestseller" },
  ...
];
```

- `id` — unique, stable (used as the cart key).
- `price` — number, rupees.
- `mrp` — optional; shows a struck-through price.
- `cat` — must match an id in `CATEGORIES`.
- `badge` — optional label; add `low: true` for the amber "Only 3 left" style.
- `emoji` — product visual. Replace with an `<img>` if you have photos (see below).

Store details:

```html
<h1>Sharma Kirana &amp; General Store</h1>
...
<span class="store-tag">Open now · 8am – 10pm</span>
```

Delivery economics:

```js
var FREE_DELIVERY_AT = 299;
var DELIVERY_FEE = 29;
```

WhatsApp destination — **replace before sharing**:

```js
var WA_NUMBER = "919999999999"; // country code + number, no + or spaces
```

---

## Using real product photos

Replace the emoji block in the render function with an image:

```js
'<div class="thumb" aria-hidden="true">' +
  '<img src="' + p.image + '" alt="" loading="lazy" ' +
  'style="width:100%;height:100%;object-fit:cover;border-radius:14px" />' +
  badge +
'</div>'
```

Add `image: "images/atta.jpg"` to each product and keep the files next to `index.html`.

---

## Going live (production path)

This demo intentionally has no backend. For a real shop:

1. Move products into Supabase (`apps/dukaanmitra-site/supabase/schema.sql` is the starting point).
2. Replace the `localStorage` cart with server-side orders.
3. Replace the `wa.me` deep link with the Core Engine order API + OpenWA.
4. Add real UPI/Razorpay checkout if prepaid orders are needed.

See `SYSTEM.md` and `docs/INDEX.md` for the architecture.

---

## Safety notes

- The checkout explicitly says it is a demo and saves orders in the browser.
- No payment is collected.
- No customer data leaves the device; only the WhatsApp deep link carries the order text, and only when the user clicks it.
- The placeholder number must be replaced before any public use.
