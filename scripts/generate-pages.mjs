#!/usr/bin/env node
/**
 * Mitra System — static page generator.
 *
 * Reads data/catalog.json (single source of truth) and writes:
 *   cities/index.html        + cities/<city>.html          (9)
 *   business/index.html      + business/<biz>.html         (8)
 *   demos/index.html                                       (72-link matrix)
 *   sitemap.xml, robots.txt
 *
 * Usage:
 *   node scripts/generate-pages.mjs
 *   SITE_URL=https://example.com node scripts/generate-pages.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));

const SITE_URL = (process.env.SITE_URL || "https://mitra-system.vercel.app").replace(/\/+$/, "");
const BIZ_IDS = Object.keys(catalog.verticals);
const CITY_IDS = Object.keys(catalog.cities);
const BRAND = catalog.brand;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const round = (n, d) => { const f = Math.pow(10, d || 0); return Math.round(n * f) / f; };
const price = (inr, city) => round(inr * (city.rate || 1), city.decimals || 0);
const money = (v, city) => {
  const d = city.decimals || 0;
  const n = Number(v).toLocaleString(city.currency === "INR" ? "en-IN" : "en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (city.symbol || "").trim() + " " + n;
};
const freeAt = (city) => money(price(299, city), city);

const css = `
:root{--accent:#25d366;--accent-dark:#0f7a43;--ink:#0e1726;--muted:#64748b;--line:#e6e9f0;--bg:#f6f7fb;--card:#fff;--radius:18px;--shadow:0 1px 2px rgba(14,23,38,.05),0 14px 36px -22px rgba(14,23,38,.3)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit}button{font:inherit}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
header{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;gap:18px;min-height:64px;flex-wrap:wrap;padding:10px 0}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;letter-spacing:-.02em}
.mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-weight:900;background:linear-gradient(135deg,var(--accent),var(--accent-dark))}
.brand small{display:block;font-size:11px;color:var(--muted);font-weight:600}
.nav-links{display:flex;gap:16px;margin-left:auto;flex-wrap:wrap;font-size:13px;font-weight:650;color:#334155}
.nav-links a{text-decoration:none}.nav-links a:hover{color:var(--accent-dark)}
.hero{padding:40px 0 22px}
.eyebrow{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--accent-dark);background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.25);padding:7px 11px;border-radius:99px}
h1{font-size:clamp(28px,3.6vw,46px);line-height:1.07;letter-spacing:-.035em;margin:16px 0 10px;font-weight:850;max-width:18ch}
h1 span{color:var(--accent-dark)}
.lede{font-size:15.5px;color:var(--muted);max-width:60ch;margin:0 0 20px}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.pill{font-size:12.5px;font-weight:650;background:#fff;border:1px solid var(--line);padding:8px 11px;border-radius:99px;color:#334155}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:12px;padding:12px 18px;font-size:14px;font-weight:750;text-decoration:none;border:1px solid transparent;transition:transform .12s ease}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--accent);color:#062b18;box-shadow:0 10px 22px -12px var(--accent)}
.btn-dark{background:var(--ink);color:#fff}
.btn-ghost{background:#fff;border-color:var(--line);color:#334155}
.section{padding:22px 0}
.section h2{font-size:22px;letter-spacing:-.025em;margin:0 0 4px}
.section .sub{font-size:13px;color:var(--muted);margin:0 0 16px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow);min-width:0}
.card h3{margin:0 0 4px;font-size:14px;letter-spacing:-.01em}
.card p{margin:0;font-size:12.5px;color:var(--muted)}
.card .top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
.emoji{font-size:24px}
.tag{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:#f8fafc;border:1px solid var(--line);border-radius:99px;padding:3px 7px;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.link-card{display:block;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;transition:border-color .15s,box-shadow .15s}
.link-card:hover{border-color:#cfd6e2;box-shadow:var(--shadow)}
.link-card b{display:block;font-size:13px;margin-bottom:2px}
.link-card span{font-size:11.5px;color:var(--muted)}
.link-card .arrow{float:right;color:var(--accent-dark);font-weight:800}
.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 6px}
.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.stat b{display:block;font-size:18px;letter-spacing:-.02em}
.stat span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.price-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #eef1f6;padding:8px 0;font-size:12.5px}
.price-row:last-child{border-bottom:0}
.price-row b{white-space:nowrap}
.price-row .u{font-size:10.5px;color:var(--muted)}
.callout{background:var(--ink);color:#e2e8f0;border-radius:20px;padding:24px;display:flex;flex-wrap:wrap;align-items:center;gap:16px;justify-content:space-between;margin:26px 0}
.callout h2{color:#fff;margin:0 0 4px}
.callout p{margin:0;font-size:13px;color:#94a3b8;max-width:56ch}
.callout .actions{flex:0 0 auto}
.note{background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:12px;padding:10px 12px;font-size:12px;margin:16px 0}
footer{border-top:1px solid var(--line);background:#fff;margin-top:30px}
.foot{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;padding:22px 0;font-size:12px;color:var(--muted)}
.foot a{text-decoration:none;font-weight:650;color:#334155;margin-right:14px}
.breadcrumb{font-size:12px;color:var(--muted);margin-top:8px}
.breadcrumb a{text-decoration:none;color:#334155}
.matrix{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:var(--shadow)}
.matrix-row{display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;align-items:start;padding:11px 0;border-bottom:1px solid #eef1f6}
.matrix-row:last-child{border-bottom:0}
.matrix-row b{font-size:13px}
.matrix-row .cities{display:flex;flex-wrap:wrap;gap:6px}
.city-chip{font-size:11.5px;font-weight:650;text-decoration:none;border:1px solid var(--line);border-radius:99px;padding:5px 9px;background:#fbfcfe}
.city-chip:hover{background:rgba(37,211,102,.1);border-color:rgba(37,211,102,.4)}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cards{grid-template-columns:1fr}.stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.matrix-row{grid-template-columns:1fr}}
@media(max-width:520px){.nav-links{display:none}.wrap{width:calc(100% - 24px)}h1{max-width:none}.hero{padding-top:26px}.callout{padding:20px}}
`;

function shell({ title, desc, canonicalPath, body, accent }) {
  const url = SITE_URL + canonicalPath;
  const theme = accent || "#25d366";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(url)}" />
<meta name="theme-color" content="${esc(theme)}" />
<link rel="icon" href="../favicon.svg" type="image/svg+xml" />
<style>${css}</style>
</head>
<body>
<header><div class="wrap nav">
  <a class="brand" href="../index.html"><span class="mark">M</span><span><b>Mitra System</b><small>Business Runner</small></span></a>
  <nav class="nav-links">
    <a href="../demos/index.html">Demos</a>
    <a href="../cities/index.html">Cities</a>
    <a href="../business/index.html">Business types</a>
    <a href="../apps/business-runner/?biz=kirana&amp;city=kanpur">Live runner</a>
    <a href="../index.html">Home</a>
  </nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap foot">
  <span>© <span id="yr"></span> Mitra System · Demo build · Prices indicative</span>
  <span><a href="../index.html">Home</a><a href="../demos/index.html">All demos</a><a href="../docs/INDEX.md">Docs</a></span>
</div></footer>
<script>document.getElementById("yr").textContent=new Date().getFullYear();</script>
</body>
</html>
`;
}

function bizCard(b, city) {
  return `<a class="link-card" href="../apps/business-runner/?biz=${b.id}&amp;city=${city.id}">
    <span class="emoji">${b.items[0].emoji}</span><span class="arrow">↗</span>
    <b>${esc(b.label)} · ${esc(city.name)}</b>
    <span>${esc(b.tagline)} · ${esc(city.delivery)}</span>
  </a>`;
}

function cityCard(c, b) {
  return `<a class="link-card" href="../apps/business-runner/?biz=${b.id}&amp;city=${c.id}">
    <span class="emoji">${c.global ? "🌍" : "🇮🇳"}</span><span class="arrow">↗</span>
    <b>${esc(c.name)}</b>
    <span>${esc(c.region)} · ${esc(c.currency)} · ${esc(c.delivery)}</span>
  </a>`;
}

/* ------------------------------------------------------------------ */
/* city page                                                           */
/* ------------------------------------------------------------------ */

function cityPage(c) {
  const allBiz = BIZ_IDS.map((id) => catalog.verticals[id]);
  const items = allBiz[0].items.slice(0, 0); // unused
  const topItems = allBiz.flatMap((b) => b.items.slice(0, 1).map((it) => ({ biz: b, it })));
  const body = `
<section class="hero">
  <span class="eyebrow">City rollout · ${esc(c.country)}</span>
  <h1>${esc(c.name)} me har dukaan <span>online, WhatsApp-first.</span></h1>
  <p class="lede">Kirana, clinic, salon, coaching, restaurant, pharmacy, distributor aur boutique — ${esc(c.name)} ke liye ready demo stores. Delivery ${esc(c.delivery)}, hours ${esc(c.hours)}, currency ${esc(c.currency)}.</p>
  <div class="pills">
    <span class="pill">📍 ${esc(c.address)}</span>
    <span class="pill">🕒 ${esc(c.hours)}</span>
    <span class="pill">💬 WhatsApp checkout</span>
    <span class="pill">📊 Owner insights</span>
  </div>
  <div class="actions">
    <a class="btn btn-primary" href="../apps/business-runner/?biz=kirana&city=${c.id}">${esc(c.name)} ka kirana demo kholo</a>
    <a class="btn btn-ghost" href="../demos/index.html">Saare 72 demos</a>
  </div>
</section>

<section class="section">
  <h2>${esc(c.name)} me 8 business types</h2>
  <p class="sub">Har card ek working demo hai — storefront, cart, WhatsApp order aur owner dashboard.</p>
  <div class="grid">${allBiz.map((b) => bizCard(b, c)).join("")}</div>
</section>

<section class="section">
  <h2>Local setup</h2>
  <div class="stat-grid">
    <div class="stat"><b>${esc(c.delivery)}</b><span>Delivery ETA</span></div>
    <div class="stat"><b>${esc(c.hours)}</b><span>Shop hours</span></div>
    <div class="stat"><b>${esc(c.currency)}</b><span>Currency</span></div>
    <div class="stat"><b>${esc(freeAt(c))}</b><span>Free delivery from</span></div>
  </div>
  <div class="note">📌 Ye demo pages hain. Product names, ratings aur orders sample data hain. Global city prices purchasing-power ke hisaab se indicative hain, FX conversion sirf reference ke liye.</div>
</section>

<section class="section">
  <h2>Sample menu, ${esc(c.name)} pricing</h2>
  <p class="sub">Har business type se ek popular item — prices ${esc(c.currency)} me converted.</p>
  <div class="cards">
    ${topItems.slice(0, 6).map(({ biz, it }) => `<div class="card"><div class="top"><span class="emoji">${it.emoji}</span><span class="tag">${esc(biz.label)}</span></div><h3>${esc(it.name)}</h3><p>${esc(it.unit)} · <b>${esc(money(price(it.price, c), c))}</b></p></div>`).join("")}
  </div>
</section>

<section class="section">
  <h2>Owner dashboard bhi included</h2>
  <div class="cards">
    <div class="card"><div class="top"><span class="emoji">📈</span></div><h3>7-day demand forecast</h3><p>Weighted moving average + day-of-week seasonality. Peak day aur confidence ke saath.</p></div>
    <div class="card"><div class="top"><span class="emoji">🎯</span></div><h3>Smart recommendations</h3><p>Market-basket lift se "isse ye bhi lete hain" upsell suggestions.</p></div>
    <div class="card"><div class="top"><span class="emoji">👥</span></div><h3>Customer segments</h3><p>RFM segments — Champion, Loyal, At risk, Hibernating — aur next action.</p></div>
  </div>
</section>

<div class="callout">
  <div><h2>${esc(c.name)} ke liye pilot shuru karein</h2><p>Ek business type chuno, demo dekho, aur 14-day pilot plan lein. Kanpur-first rollout, phir ${esc(c.name)}.</p></div>
  <div class="actions"><a class="btn btn-primary" href="../index.html#contact">Pilot enquire</a><a class="btn btn-ghost" href="../apps/business-runner/?biz=kirana&city=${c.id}">Demo kholo</a></div>
</div>

<p class="breadcrumb"><a href="../index.html">Home</a> / <a href="index.html">Cities</a> / ${esc(c.name)}</p>
`;
  return shell({
    title: `${c.name} business demos — kirana, clinic, salon | Mitra System`,
    desc: `${c.name} ke liye 8 ready business demos: kirana, clinic, salon, coaching, restaurant, pharmacy, distributor, boutique. WhatsApp checkout, local pricing aur owner insights.`,
    canonicalPath: `/cities/${c.id}.html`,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* business page                                                       */
/* ------------------------------------------------------------------ */

function businessPage(b) {
  const allCities = CITY_IDS.map((id) => catalog.cities[id]);
  const c0 = catalog.cities.kanpur;
  const body = `
<section class="hero">
  <span class="eyebrow">Business type · ${esc(b.label)}</span>
  <h1>${esc(b.label)} ke liye <span>ready storefront + dashboard.</span></h1>
  <p class="lede">${esc(b.tagline)} ${esc(b.hero)} Har city ke liye local pricing, delivery slots aur WhatsApp checkout — bina code likhe.</p>
  <div class="pills">
    <span class="pill">🛍️ ${b.items.length} products / services</span>
    <span class="pill">📦 ${esc(b.fulfilmentLabel)}</span>
    <span class="pill">⭐ ${esc(b.rating)} (${esc(b.reviews)})</span>
    <span class="pill">💬 WhatsApp order</span>
  </div>
  <div class="actions">
    <a class="btn btn-primary" href="../apps/business-runner/?biz=${b.id}&city=kanpur">Kanpur demo kholo</a>
    <a class="btn btn-ghost" href="../apps/business-runner/?biz=${b.id}&city=london">London version</a>
  </div>
</section>

<section class="section">
  <h2>${esc(b.label)} — 9 cities</h2>
  <p class="sub">Har city ka apna currency, delivery ETA aur hours. Link kholte hi demo us city par set ho jata hai.</p>
  <div class="grid">${allCities.map((c) => cityCard(c, b)).join("")}</div>
</section>

<section class="section">
  <h2>Menu / catalogue preview</h2>
  <p class="sub">Kanpur prices. Demo me har city ke hisaab se convert ho jaate hain.</p>
  <div class="cards">
    ${b.items.slice(0, 6).map((it) => `<div class="card"><div class="top"><span class="emoji">${it.emoji}</span>${it.badge ? `<span class="tag">${esc(it.badge)}</span>` : ""}</div><h3>${esc(it.name)}</h3><p>${esc(it.unit)} · <b>${esc(money(price(it.price, c0), c0))}</b></p></div>`).join("")}
  </div>
</section>

<section class="section">
  <h2>Packages &amp; services</h2>
  <div class="cards">
    ${b.services.map((s) => `<div class="card"><div class="top"><span class="emoji">📦</span><span class="tag">${s.price === 0 ? "Free" : esc(money(price(s.price, c0), c0))}</span></div><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div>`).join("")}
  </div>
</section>

<section class="section">
  <h2>Owner dashboard</h2>
  <div class="cards">
    <div class="card"><div class="top"><span class="emoji">📊</span></div><h3>KPIs</h3><p>Revenue, orders, AOV, conversion aur repeat rate — 30 din ka view.</p></div>
    <div class="card"><div class="top"><span class="emoji">📦</span></div><h3>Low stock alerts</h3><p>Critical stock aur restock suggestions, business ke hisaab se.</p></div>
    <div class="card"><div class="top"><span class="emoji">🔁</span></div><h3>WhatsApp reorder</h3><p>Customer ka pichla order ek message me repeat — repeat revenue badhao.</p></div>
  </div>
</section>

<section class="section">
  <h2>Common questions</h2>
  <div class="cards">
    ${b.faqs.map((f) => `<div class="card"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("")}
  </div>
</section>

<div class="callout">
  <div><h2>${esc(b.label)} ke liye pilot</h2><p>Demo dekha? Ab apne naam, city aur catalogue ke saath live karein. Setup 3–5 din.</p></div>
  <div class="actions"><a class="btn btn-primary" href="../index.html#contact">Pilot enquire</a><a class="btn btn-ghost" href="../cities/index.html">Cities dekhein</a></div>
</div>

<p class="breadcrumb"><a href="../index.html">Home</a> / <a href="index.html">Business types</a> / ${esc(b.label)}</p>
`;
  return shell({
    title: `${b.label} storefront demo — 9 cities | Mitra System`,
    desc: `${b.label} ke liye WhatsApp-first storefront, local pricing, packages aur owner insights. 9 cities me demo: Kanpur, Lucknow, Delhi, Mumbai, Bengaluru, Hyderabad, London, Dubai, New York.`,
    canonicalPath: `/business/${b.id}.html`,
    body,
    accent: b.accent,
  });
}

/* ------------------------------------------------------------------ */
/* index pages + matrix                                                */
/* ------------------------------------------------------------------ */

function citiesIndex() {
  const all = CITY_IDS.map((id) => catalog.cities[id]);
  const body = `
<section class="hero">
  <span class="eyebrow">Multi-city rollout</span>
  <h1>Ek system. <span>Har sheher.</span></h1>
  <p class="lede">Kanpur se shuru, phir India ke metro, phir London, Dubai aur New York. Har city page par 8 business demos, local currency aur delivery settings.</p>
  <div class="actions"><a class="btn btn-primary" href="../demos/index.html">72 demos dekhein</a><a class="btn btn-ghost" href="../business/index.html">Business types</a></div>
</section>
<section class="section"><h2>9 cities live</h2><p class="sub">India-first, global-ready.</p><div class="grid">${all.map((c) => `<a class="link-card" href="${c.id}.html"><span class="emoji">${c.global ? "🌍" : "🇮🇳"}</span><span class="arrow">↗</span><b>${esc(c.name)}</b><span>${esc(c.region)} · ${esc(c.currency)} · ${esc(c.delivery)}</span></a>`).join("")}</div></section>
`;
  return shell({
    title: "Cities — Mitra System business demos",
    desc: "Kanpur, Lucknow, Delhi NCR, Mumbai, Bengaluru, Hyderabad, London, Dubai aur New York ke liye business demos.",
    canonicalPath: "/cities/index.html",
    body,
  });
}

function businessIndex() {
  const all = BIZ_IDS.map((id) => catalog.verticals[id]);
  const body = `
<section class="hero">
  <span class="eyebrow">8 business types</span>
  <h1>Har business type. <span>Ek hi engine.</span></h1>
  <p class="lede">Kirana se boutique tak — catalogue, cart, WhatsApp checkout, packages aur owner dashboard. Ek hi codebase, alag-alag vertical configuration.</p>
  <div class="actions"><a class="btn btn-primary" href="../demos/index.html">Matrix dekhein</a><a class="btn btn-ghost" href="../cities/index.html">Cities</a></div>
</section>
<section class="section"><div class="grid">${all.map((b) => `<a class="link-card" href="${b.id}.html"><span class="emoji">${b.items[0].emoji}</span><span class="arrow">↗</span><b>${esc(b.label)}</b><span>${b.items.length} items · ${esc(b.tagline)}</span></a>`).join("")}</div></section>
`;
  return shell({
    title: "Business types — Mitra System demos",
    desc: "Kirana, clinic, salon, coaching, restaurant, pharmacy, distributor aur boutique ke liye ready storefront demos.",
    canonicalPath: "/business/index.html",
    body,
  });
}

function demosIndex() {
  const rows = BIZ_IDS.map((bid) => {
    const b = catalog.verticals[bid];
    const chips = CITY_IDS.map((cid) => {
      const c = catalog.cities[cid];
      return `<a class="city-chip" href="../apps/business-runner/?biz=${bid}&amp;city=${cid}" title="${esc(b.label)} · ${esc(c.name)}">${esc(c.name)}</a>`;
    }).join("");
    return `<div class="matrix-row"><div><b>${esc(b.label)}</b><div class="sub" style="margin:2px 0 0">${b.items.length} items</div></div><div class="cities">${chips}</div></div>`;
  }).join("");

  const body = `
<section class="hero">
  <span class="eyebrow">Demo matrix · 8 × 9</span>
  <h1>72 demos. <span>Ek click door.</span></h1>
  <p class="lede">Business type chuno, city chuno — demo turant us configuration me khul jaata hai. Har demo offline bhi chalta hai (local model fallback).</p>
  <div class="actions"><a class="btn btn-primary" href="../apps/business-runner/?biz=kirana&city=kanpur">Kanpur kirana se shuru</a><a class="btn btn-ghost" href="../cities/index.html">City pages</a></div>
</section>
<section class="section">
  <div class="matrix">${rows}</div>
  <div class="note">📌 Demo data sample hai. Server chalne par prices aur insights API se aate hain; API na ho to local ML-lite model use hota hai.</div>
</section>
`;
  return shell({
    title: "All 72 business demos — Mitra System",
    desc: "8 business types × 9 cities. Har combination ka working storefront demo, WhatsApp checkout aur owner dashboard.",
    canonicalPath: "/demos/index.html",
    body,
  });
}

/* ------------------------------------------------------------------ */
/* write files                                                         */
/* ------------------------------------------------------------------ */

function write(rel, contents) {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, "utf8");
  return { rel, bytes: Buffer.byteLength(contents) };
}

const written = [];
written.push(write("cities/index.html", citiesIndex()));
written.push(write("business/index.html", businessIndex()));
written.push(write("demos/index.html", demosIndex()));
for (const id of CITY_IDS) written.push(write(`cities/${id}.html`, cityPage(catalog.cities[id])));
for (const id of BIZ_IDS) written.push(write(`business/${id}.html`, businessPage(catalog.verticals[id])));

/* sitemap + robots */
const urls = [
  "/",
  "/demos/index.html",
  "/cities/index.html",
  "/business/index.html",
  "/apps/business-runner/",
  "/apps/storemitra-site/",
  "/apps/dukaanmitra-site/",
  ...CITY_IDS.map((id) => `/cities/${id}.html`),
  ...BIZ_IDS.map((id) => `/business/${id}.html`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><changefreq>weekly</changefreq><priority>${u === "/" ? "1.0" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`;
written.push(write("sitemap.xml", sitemap));
written.push(write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`));

console.log("Mitra System static pages generated");
console.log("site:", SITE_URL);
console.log("files:", written.length, "·", (written.reduce((s, w) => s + w.bytes, 0) / 1024).toFixed(1), "KB");
for (const w of written) console.log("  " + w.rel);
