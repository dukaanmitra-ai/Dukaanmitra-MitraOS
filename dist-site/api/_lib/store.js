"use strict";

/**
 * Mitra System — order and lead store.
 *
 * Priority:
 *   1. Supabase (production)  — if SUPABASE_URL + SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY are set.
 *   2. Local long-running Node: SQLite via node:sqlite (file on disk, survives restarts).
 *   3. Vercel serverless: in-memory global (ephemeral by design; production should use Supabase).
 */

const path = require("path");
const fs = require("fs");

const isServerless = !!process.env.VERCEL;
const ROOT = path.resolve(__dirname, "..", "..");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "");
const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY);

let db = null;
let mode = hasSupabase ? "supabase" : (isServerless ? "memory" : "sqlite");

function memory() {
  if (!globalThis.__mitraMemory) {
    globalThis.__mitraMemory = { orders: [], leads: [] };
  }
  return globalThis.__mitraMemory;
}

function init() {
  if (mode === "supabase" || db) return;
  try {
    const { DatabaseSync } = require("node:sqlite");
    const dir = path.join(ROOT, "server", "data");
    fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, "mitra.db"));
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        biz TEXT NOT NULL,
        city TEXT NOT NULL,
        customer TEXT NOT NULL,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        delivery REAL NOT NULL,
        total REAL NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        business TEXT,
        city TEXT,
        need TEXT,
        budget TEXT,
        timeline TEXT,
        source TEXT,
        score INTEGER,
        band TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_orders_biz_city ON orders(biz, city);
    `);
    mode = "sqlite";
  } catch (err) {
    mode = "memory";
    console.warn("[store] sqlite unavailable, using memory:", err.message);
  }
}

function newId(prefix) {
  return prefix + "-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Supabase REST client (PostgREST)                                    */
/* ------------------------------------------------------------------ */

async function sb(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1" + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(headers || {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = null; }
  }
  if (!res.ok) {
    throw new Error("supabase:" + res.status + ":" + (data && data.message ? data.message : text.slice(0, 200)));
  }
  return { data, status: res.status, contentRange: res.headers.get("content-range") };
}

function rowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    biz: row.biz,
    city: row.city,
    customer: typeof row.customer === "string" ? safeJson(row.customer, {}) : (row.customer || {}),
    items: typeof row.items === "string" ? safeJson(row.items, []) : (row.items || []),
    subtotal: Number(row.subtotal || 0),
    delivery: Number(row.delivery || 0),
    total: Number(row.total || 0),
    currency: row.currency || "INR",
    status: row.status || "new",
    notes: row.notes || "",
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  };
}

function safeJson(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }

/* ------------------------------------------------------------------ */
/* orders                                                              */
/* ------------------------------------------------------------------ */

async function createOrder(input) {
  init();
  const order = {
    id: newId("MS"),
    biz: input.biz,
    city: input.city,
    customer: input.customer || {},
    items: input.items || [],
    subtotal: Number(input.subtotal || 0),
    delivery: Number(input.delivery || 0),
    total: Number(input.total || 0),
    currency: input.currency || "INR",
    status: "new",
    notes: input.notes || "",
    createdAt: new Date().toISOString(),
  };

  if (mode === "supabase") {
    const { data } = await sb("/orders", {
      method: "POST",
      body: [{
        id: order.id, biz: order.biz, city: order.city,
        customer: order.customer, items: order.items,
        subtotal: order.subtotal, delivery: order.delivery, total: order.total,
        currency: order.currency, status: order.status, notes: order.notes,
        created_at: order.createdAt,
      }],
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) Object.assign(order, rowToOrder(row));
    return order;
  }

  if (mode === "sqlite" && db) {
    db.prepare(
      `INSERT INTO orders (id, biz, city, customer, items, subtotal, delivery, total, currency, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      order.id, order.biz, order.city, JSON.stringify(order.customer), JSON.stringify(order.items),
      order.subtotal, order.delivery, order.total, order.currency, order.status, order.notes, order.createdAt
    );
  } else {
    const mem = memory();
    mem.orders.unshift(order);
    mem.orders = mem.orders.slice(0, 500);
  }
  return order;
}

async function listOrders(filter) {
  init();
  const biz = (filter && filter.biz) || null;
  const city = (filter && filter.city) || null;
  const limit = Math.min(Number((filter && filter.limit) || 20), 100);

  if (mode === "supabase") {
    const params = new URLSearchParams({ select: "*", limit: String(limit) });
    if (biz) params.set("biz", "eq." + biz);
    if (city) params.set("city", "eq." + city);
    params.set("order", "created_at.desc");
    const { data } = await sb("/orders?" + params.toString());
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows.map(rowToOrder).filter(Boolean);
    return mapped;
  }

  if (mode === "sqlite" && db) {
    const rows = db.prepare(
      `SELECT * FROM orders
       ${biz ? "WHERE biz = ?" : "WHERE 1=1"} ${city ? "AND city = ?" : ""}
       ORDER BY created_at DESC LIMIT ?`
    ).all(...[biz, city, limit].filter((v) => v != null));
    return rows.map((r) => ({
      id: r.id, biz: r.biz, city: r.city,
      customer: JSON.parse(r.customer), items: JSON.parse(r.items),
      subtotal: r.subtotal, delivery: r.delivery, total: r.total,
      currency: r.currency, status: r.status, notes: r.notes, createdAt: r.created_at,
    }));
  }

  const mem = memory();
  const rows = mem.orders
    .filter((o) => (!biz || o.biz === biz) && (!city || o.city === city))
    .slice(0, limit)
    .map((o) => ({
      id: o.id, biz: o.biz, city: o.city,
      customer: o.customer, items: o.items,
      subtotal: o.subtotal, delivery: o.delivery, total: o.total,
      currency: o.currency, status: o.status, notes: o.notes, created_at: o.createdAt,
    }));
  return rows;
}

/* ------------------------------------------------------------------ */
/* leads                                                               */
/* ------------------------------------------------------------------ */

async function createLead(input) {
  init();
  const lead = {
    id: newId("LD"),
    name: input.name || "",
    phone: input.phone || "",
    business: input.business || "",
    city: input.city || "",
    need: input.need || "other",
    budget: input.budget || "unknown",
    timeline: input.timeline || "exploring",
    source: input.source || "other",
    score: Number(input.score || 0),
    band: input.band || "nurture",
    notes: input.notes || "",
    createdAt: new Date().toISOString(),
  };

  if (mode === "supabase") {
    const { data } = await sb("/leads", {
      method: "POST",
      body: {
        id: lead.id, name: lead.name, phone: lead.phone, business: lead.business, city: lead.city,
        need: lead.need, budget: lead.budget, timeline: lead.timeline, source: lead.source,
        score: lead.score, band: lead.band, notes: lead.notes, created_at: lead.createdAt,
      },
    });
    return Array.isArray(data) ? data[0] || lead : lead;
  }

  if (mode === "sqlite" && db) {
    db.prepare(
      `INSERT INTO leads (id, name, phone, business, city, need, budget, timeline, source, score, band, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      lead.id, lead.name, lead.phone, lead.business, lead.city, lead.need,
      lead.budget, lead.timeline, lead.source, lead.score, lead.band, lead.notes, lead.createdAt
    );
  } else {
    const mem = memory();
    mem.leads.unshift(lead);
    mem.leads = mem.leads.slice(0, 500);
  }
  return lead;
}

async function listLeads(limit) {
  init();
  const n = Math.min(Number(limit || 20), 100);
  if (mode === "supabase") {
    const { data } = await sb("/leads?order=created_at.desc&limit=" + n);
    return Array.isArray(data) ? data : [];
  }
  if (mode === "sqlite" && db) {
    return db.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?").all(n);
  }
  return memory().leads.slice(0, n);
}

/* ------------------------------------------------------------------ */
/* health                                                              */
/* ------------------------------------------------------------------ */

async function health() {
  init();
  if (mode === "supabase") {
    const o = await sb("/orders?select=id&limit=1", { method: "GET", headers: { Prefer: "count=exact" } });
    const l = await sb("/leads?select=id&limit=1", { method: "GET", headers: { Prefer: "count=exact" } });
    const countOf = (cr) => {
      const m = /\/(\d+)\s*$/.exec(String(cr || ""));
      return m ? Number(m[1]) : 0;
    };    return {
      ok: true,
      store: "supabase",
      persisted: true,
      orders: countOf(o.contentRange),
      leads: countOf(l.contentRange),
      uptime: Math.round(process.uptime()),
    };
  }
  let orders = 0;
  let leads = 0;
  if (mode === "sqlite" && db) {
    orders = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    leads = db.prepare("SELECT COUNT(*) AS n FROM leads").get().n;
  } else {
    const mem = memory();
    orders = mem.orders.length;
    leads = mem.leads.length;
  }
  return {
    ok: true,
    store: mode,
    persisted: mode === "sqlite",
    orders,
    leads,
    uptime: Math.round(process.uptime()),
  };
}

module.exports = {
  createOrder,
  listOrders,
  createLead,
  listLeads,
  health,
  getMode: () => (init(), mode),
};
