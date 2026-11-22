"use strict";

/**
 * Mitra System — shared API router.
 * Used by server/index.js (local) and api/[...path].js (Vercel serverless).
 */

const catalog = require("../../data/catalog.json");
const ml = require("./ml");
const store = require("./store");

const BIZ_IDS = Object.keys(catalog.verticals);
const CITY_IDS = Object.keys(catalog.cities);

function resolve(bizId, cityId) {
  const biz = catalog.verticals[bizId] || catalog.verticals.kirana;
  const city = catalog.cities[cityId] || catalog.cities.kanpur;
  return { biz, city };
}

function catalogFor(bizId, cityId) {
  const { biz, city } = resolve(bizId, cityId);
  const freeAt = ml.convertPrice(299, city);
  const fee = ml.convertPrice(29, city);

  const items = biz.items.map((it) => {
    const price = ml.convertPrice(it.price, city);
    const mrp = it.mrp ? ml.convertPrice(it.mrp, city) : null;
    return {
      id: it.id,
      name: it.name,
      unit: it.unit,
      category: it.category,
      emoji: it.emoji,
      badge: it.badge || null,
      stock: it.stock,
      tags: it.tags || [],
      basePrice: it.price,
      price,
      priceLabel: ml.money(price, city),
      mrp,
      mrpLabel: mrp ? ml.money(mrp, city) : null,
    };
  });

  const services = biz.services.map((s) => {
    const price = ml.convertPrice(s.price, city);
    return { name: s.name, price, priceLabel: price === 0 ? "Free" : ml.money(price, city), desc: s.desc };
  });

  return {
    biz: {
      id: biz.id, name: biz.name, label: biz.label, demoName: biz.demoName,
      tagline: biz.tagline, hero: biz.hero, accent: biz.accent, accentDark: biz.accentDark,
      mode: biz.mode, cta: biz.cta, fulfilmentLabel: biz.fulfilmentLabel,
      addressLabel: biz.addressLabel, rating: biz.rating, reviews: biz.reviews,
      ordersLabel: biz.ordersLabel, categories: biz.categories, faqs: biz.faqs,
    },
    city: {
      id: city.id, name: city.name, region: city.region, country: city.country,
      currency: city.currency, symbol: city.symbol, decimals: city.decimals,
      delivery: city.delivery, hours: city.hours, timezone: city.timezone,
      address: city.address, tier: city.tier, global: city.global,
    },
    freeDeliveryAt: freeAt,
    freeDeliveryLabel: ml.money(freeAt, city),
    deliveryFee: fee,
    deliveryFeeLabel: ml.money(fee, city),
    items,
    services,
  };
}

function validateBizCity(bizId, cityId) {
  if (bizId && !catalog.verticals[bizId]) {
    return { error: "Unknown business type: " + bizId + ". Try one of: " + BIZ_IDS.join(", ") };
  }
  if (cityId && !catalog.cities[cityId]) {
    return { error: "Unknown city: " + cityId + ". Try one of: " + CITY_IDS.join(", ") };
  }
  return null;
}

function buildWhatsApp(catalogData, order) {
  const { biz, city } = catalogData;
  const lines = order.items.map((it) => {
    const base = "• " + it.name + " (" + it.unit + ") × " + it.qty + " = " + ml.money(it.price * it.qty, city);
    return it.hsn ? base + " [HSN " + it.hsn + "]" : base;
  });
  return [
    "Namaste " + biz.demoName + "! 🙏",
    "",
    "Order ID: " + order.id,
    "Naam: " + (order.customer.name || ""),
    "WhatsApp: " + (order.customer.phone || ""),
    (biz.addressLabel || "Address") + ": " + (order.customer.address || "-"),
    (biz.fulfilmentLabel || "Slot") + ": " + (order.customer.slot || "-"),
    "",
    "Order:",
    ...lines,
    "",
    "Subtotal: " + ml.money(order.subtotal, city),
    "Delivery: " + (order.delivery ? ml.money(order.delivery, city) : "Free"),
    "Total: " + ml.money(order.total, city),
    "Payment: " + (order.customer.payment || "Cash on delivery"),
    order.notes ? "Notes: " + order.notes : "",
  ].filter(Boolean).join("\n");
}

async function handle(req) {
  const method = (req.method || "GET").toUpperCase();
  const pathname = (req.pathname || "/").replace(/\/+$/, "") || "/";
  const query = req.query || {};
  const body = req.body || {};

  try {
    if (pathname === "/api" || pathname === "/api/") {
      return {
        status: 200,
        body: {
          name: "Mitra System API",
          version: 1,
          endpoints: [
            "GET /api/health",
            "GET /api/verticals",
            "GET /api/cities",
            "GET /api/catalog?biz=kirana&city=kanpur",
            "GET /api/insights?biz=kirana&city=kanpur",
            "GET /api/forecast?biz=kirana&city=kanpur&days=7",
            "GET /api/matrix",
            "POST /api/recommend",
            "POST /api/lead-score",
            "POST /api/leads",
            "GET /api/leads",
            "POST /api/orders",
            "GET /api/orders?biz=kirana&city=kanpur",
          ],
        },
      };
    }

    if (pathname === "/api/health") {
      const h = await store.health();
      return { status: 200, body: { ...h, service: "mitra-api", version: 1 } };
    }

    if (pathname === "/api/verticals") {
      return {
        status: 200,
        body: {
          count: BIZ_IDS.length,
          verticals: BIZ_IDS.map((id) => {
            const v = catalog.verticals[id];
            return {
              id, name: v.name, label: v.label, mode: v.mode, accent: v.accent,
              demoName: v.demoName, itemCount: v.items.length, tagline: v.tagline,
            };
          }),
        },
      };
    }

    if (pathname === "/api/cities") {
      return {
        status: 200,
        body: {
          count: CITY_IDS.length,
          cities: CITY_IDS.map((id) => {
            const c = catalog.cities[id];
            return {
              id, name: c.name, region: c.region, country: c.country,
              currency: c.currency, symbol: c.symbol, delivery: c.delivery,
              tier: c.tier, global: c.global,
            };
          }),
        },
      };
    }

    if (pathname === "/api/matrix") {
      const links = [];
      for (const b of BIZ_IDS) {
        for (const c of CITY_IDS) {
          links.push({
            biz: b,
            city: c,
            label: catalog.verticals[b].label + " · " + catalog.cities[c].name,
            path: "/apps/business-runner/?biz=" + b + "&city=" + c,
          });
        }
      }
      return { status: 200, body: { count: links.length, links } };
    }

    if (pathname === "/api/catalog") {
      const bad = validateBizCity(query.biz, query.city);
      if (bad) return { status: 400, body: { error: bad.error } };
      return { status: 200, body: catalogFor(query.biz || "kirana", query.city || "kanpur") };
    }

    if (pathname === "/api/insights") {
      const bad = validateBizCity(query.biz, query.city);
      if (bad) return { status: 400, body: { error: bad.error } };
      const { biz, city } = resolve(query.biz || "kirana", query.city || "kanpur");
      return { status: 200, body: ml.insights(biz, city) };
    }

    if (pathname === "/api/forecast") {
      const bad = validateBizCity(query.biz, query.city);
      if (bad) return { status: 400, body: { error: bad.error } };
      const { biz, city } = resolve(query.biz || "kirana", query.city || "kanpur");
      const days = Math.max(1, Math.min(Number(query.days) || 7, 30));
      return { status: 200, body: { biz: biz.id, city: city.id, ...ml.forecast(biz, city, days) } };
    }

    if (pathname === "/api/recommend") {
      if (method !== "POST") return { status: 405, body: { error: "Use POST" } };
      const bad = validateBizCity(body.biz, body.city);
      if (bad) return { status: 400, body: { error: bad.error } };
      const { biz, city } = resolve(body.biz || "kirana", body.city || "kanpur");
      const basket = Array.isArray(body.basket) ? body.basket.slice(0, 10) : [];
      const limit = Math.max(1, Math.min(Number(body.limit) || 4, 8));
      return { status: 200, body: ml.recommend(biz, city, basket, limit) };
    }

    if (pathname === "/api/lead-score") {
      if (method !== "POST") return { status: 405, body: { error: "Use POST" } };
      return { status: 200, body: ml.leadScore(body) };
    }

    if (pathname === "/api/whatsapp" && method === "POST") {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioKey = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;
      const to = String(body.to || "").trim();
      const text = String(body.text || "").trim();
      if (!to) return { status: 400, body: { error: "Missing recipient phone." } };
      if (!text) return { status: 400, body: { error: "Missing message text." } };

      if (twilioSid && twilioKey && twilioFrom) {
        const params = new URLSearchParams({
          From: twilioFrom,
          To: "whatsapp+" + to.replace(/^\+/, ""),
          Body: text,
        });
        const twRes = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + twilioSid + "/Messages.json", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        const twBody = await twRes.text();
        if (!twRes.ok) return { status: 502, body: { error: "twilio_send_failed", detail: twBody.slice(0, 300) } };
        const twJson = JSON.parse(twBody);
        const waUrl = "https://wa.me/" + to.replace(/^\+/, "") + "?text=" + encodeURIComponent(text);
        return { status: 201, body: { via: "twilio", sid: twJson.sid, to: twJson.to, whatsappUrl: waUrl } };
      }

      const waUrl = "https://wa.me/" + to.replace(/^\+/, "") + "?text=" + encodeURIComponent(text);
      return { status: 200, body: { via: "wa.me", whatsappUrl: waUrl, note: "twilio_not_configured" } };
    }

    if (pathname === "/api/leads" && method === "POST") {
      const scored = ml.leadScore(body);
      const lead = await store.createLead({ ...body, score: scored.score, band: scored.band });
      return { status: 201, body: { lead, scoring: scored, persisted: store.getMode() !== "memory" } };
    }

    if (pathname === "/api/leads" && method === "GET") {
      const token = process.env.ADMIN_TOKEN;
      if (token && query.token !== token) return { status: 401, body: { error: "Invalid or missing token" } };
      return { status: 200, body: { leads: await store.listLeads(query.limit) } };
    }

    if (pathname === "/api/orders" && method === "POST") {
      const bad = validateBizCity(body.biz, body.city);
      if (bad) return { status: 400, body: { error: bad.error } };

      const { biz, city } = resolve(body.biz || "kirana", body.city || "kanpur");
      const customer = body.customer || {};
      const items = Array.isArray(body.items) ? body.items : [];

      if (!items.length) return { status: 400, body: { error: "Order me kam se kam ek item chahiye." } };
      if (!customer.name || String(customer.name).trim().length < 2) {
        return { status: 400, body: { error: "Customer name required." } };
      }
      if (!/^[0-9+\-\s]{10,15}$/.test(String(customer.phone || ""))) {
        return { status: 400, body: { error: "Valid phone required (10–15 digits)." } };
      }
      if (biz.mode === "delivery" && String(customer.address || "").trim().length < 6) {
        return { status: 400, body: { error: "Delivery address required." } };
      }

      const lines = [];
      for (const raw of items) {
        const product = biz.items.find((i) => i.id === raw.id);
        if (!product) return { status: 400, body: { error: "Unknown item: " + raw.id } };
        const qty = Math.max(1, Math.min(Number(raw.qty) || 1, 20));
        lines.push({
          id: product.id, name: product.name, unit: product.unit,
          qty, price: ml.convertPrice(product.price, city), emoji: product.emoji,
          hsn: product.hsn || null,
        });
      }

      const subtotal = ml.round(lines.reduce((s, l) => s + l.price * l.qty, 0), city.decimals || 0);
      const freeAt = ml.convertPrice(299, city);
      const delivery = biz.mode === "delivery" && subtotal > 0 && subtotal < freeAt
        ? ml.convertPrice(29, city) : 0;
      const total = ml.round(subtotal + delivery, city.decimals || 0);

      const catalogData = catalogFor(biz.id, city.id);
      const order = await store.createOrder({
        biz: biz.id, city: city.id, customer, items: lines,
        subtotal, delivery, total, currency: city.currency, notes: body.notes || "",
      });
      const whatsappText = buildWhatsApp(catalogData, order);

      return {
        status: 201,
        body: {
          order,
          totals: {
            subtotal, delivery, total,
            subtotalLabel: ml.money(subtotal, city),
            deliveryLabel: delivery ? ml.money(delivery, city) : "Free",
            totalLabel: ml.money(total, city),
            currency: city.currency,
          },
          whatsappText,
          persisted: store.getMode() !== "memory",
        },
      };
    }

    if (pathname === "/api/orders" && method === "GET") {
      const token = process.env.ADMIN_TOKEN;
      if (token && query.token !== token) return { status: 401, body: { error: "Invalid or missing token" } };
      return {
        status: 200,
        body: { orders: await store.listOrders({ biz: query.biz, city: query.city, limit: query.limit }) },
      };
    }

    if (pathname === "/api/seed") {
      const { biz, city } = resolve(query.biz || "kirana", query.city || "kanpur");
      const days = Math.max(7, Math.min(Number(query.days) || 30, 90));
      const history = ml.buildHistory(biz, city, days);
      return {
        status: 200,
        body: {
          biz: biz.id, city: city.id, days,
          orders: history.length,
          daily: ml.aggregateDaily(history),
          sample: history.slice(-5),
        },
      };
    }

    return { status: 404, body: { error: "Not found: " + pathname } };
  } catch (err) {
    console.error("[api]", err);
    return { status: 500, body: { error: "Server error", detail: String(err.message || err) } };
  }
}

module.exports = { handle, catalog, catalogFor, resolve, BIZ_IDS, CITY_IDS };
