"use strict";

/**
 * Mitra System — ML-lite engine
 * Pure JavaScript, deterministic, no external services.
 *
 * Models:
 *  - Demand forecast: weighted moving average + day-of-week seasonality + trend
 *  - Recommendations: market-basket co-occurrence lift with popularity fallback
 *  - Lead score: weighted intent model (need, budget, timeline, source, completeness)
 *  - Customer segments: RFM (recency, frequency, monetary)
 *  - Anomaly detection: z-score on daily revenue
 */

const MS_DAY = 86400000;

/* ------------------------------------------------------------------ */
/* deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round(n, decimals) {
  const f = Math.pow(10, decimals || 0);
  return Math.round(n * f) / f;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1));
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* pricing                                                             */
/* ------------------------------------------------------------------ */

function convertPrice(inr, city) {
  const value = inr * (city.rate || 1);
  return round(value, city.decimals || 0);
}

function money(value, city) {
  const n = Number(value).toLocaleString(city.currency === "INR" ? "en-IN" : "en-GB", {
    minimumFractionDigits: city.decimals || 0,
    maximumFractionDigits: city.decimals || 0,
  });
  return (city.symbol || "") + n;
}

/* ------------------------------------------------------------------ */
/* synthetic order history                                             */
/* ------------------------------------------------------------------ */

function itemWeight(item, index, total) {
  let w = (total - index) / total;
  if (item.badge) w += 0.22;
  if (item.mrp && item.mrp > item.price) w += 0.08;
  if (item.stock != null && item.stock < 10) w -= 0.1;
  return Math.max(0.05, w);
}

function buildHistory(vertical, city, days) {
  const nDays = days || 60;
  const seed = hash(vertical.id + "|" + city.id + "|history|" + nDays);
  const rand = rng(seed);
  const items = vertical.items;
  const weights = items.map((it, i) => itemWeight(it, i, items.length));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const orders = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (let d = nDays - 1; d >= 0; d--) {
    const date = new Date(today.getTime() - d * MS_DAY);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6 ? 1.28 : 1;
    const drift = 1 + (nDays - d) / nDays * 0.18; // gentle growth
    const count = Math.max(4, Math.round((9 + rand() * 7) * weekend * drift));

    for (let o = 0; o < count; o++) {
      const basketSize = rand() < 0.56 ? 1 : rand() < 0.8 ? 2 : 3;
      const chosen = [];
      const lineItems = [];
      for (let b = 0; b < basketSize; b++) {
        let pick = rand() * weightSum;
        let idx = 0;
        for (; idx < items.length; idx++) {
          pick -= weights[idx];
          if (pick <= 0) break;
        }
        idx = Math.min(idx, items.length - 1);
        if (chosen.includes(idx)) continue;
        chosen.push(idx);
        const qty = rand() < 0.82 ? 1 : 2;
        const it = items[idx];
        lineItems.push({ id: it.id, name: it.name, qty, price: convertPrice(it.price, city) });
      }
      if (!lineItems.length) {
        const it = items[0];
        lineItems.push({ id: it.id, name: it.name, qty: 1, price: convertPrice(it.price, city) });
      }
      const total = lineItems.reduce((s, l) => s + l.price * l.qty, 0);
      orders.push({ date: dayKey(date), items: lineItems, total: round(total, city.decimals || 0) });
    }
  }
  return orders;
}

/* ------------------------------------------------------------------ */
/* demand forecast                                                     */
/* ------------------------------------------------------------------ */

function aggregateDaily(orders) {
  const map = new Map();
  for (const o of orders) {
    const cur = map.get(o.date) || { date: o.date, units: 0, revenue: 0, orders: 0 };
    cur.orders += 1;
    cur.revenue += o.total;
    cur.units += o.items.reduce((s, i) => s + i.qty, 0);
    map.set(o.date, cur);
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function forecast(vertical, city, days) {
  const horizon = days || 7;
  const history = buildHistory(vertical, city, 45);
  const daily = aggregateDaily(history).slice(-30);
  if (daily.length < 7) return { horizon, points: [], confidence: 0, method: "insufficient-data" };

  const revenues = daily.map((d) => d.revenue);
  const overallAvg = mean(revenues);

  // day-of-week multipliers
  const byDow = Array.from({ length: 7 }, () => []);
  daily.forEach((d) => {
    const dow = new Date(d.date + "T12:00:00Z").getUTCDay();
    byDow[dow].push(d.revenue);
  });
  const dowFactor = byDow.map((arr) => (arr.length ? clamp(mean(arr) / (overallAvg || 1), 0.72, 1.35) : 1));

  // weighted moving average of last 7 days
  const last7 = revenues.slice(-7);
  const w = [0.09, 0.09, 0.1, 0.12, 0.16, 0.19, 0.25];
  const base = last7.reduce((s, v, i) => s + v * w[i], 0);

  // trend: last 7 vs previous 7
  const prev7 = revenues.slice(-14, -7);
  const trend = clamp(mean(last7) / (mean(prev7) || 1), 0.75, 1.3);

  const cv = overallAvg ? stddev(revenues) / overallAvg : 0.3;
  const confidence = clamp(0.92 - cv * 0.55, 0.42, 0.93);

  const points = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = 1; i <= horizon; i++) {
    const date = new Date(today.getTime() + i * MS_DAY);
    const dow = date.getDay();
    const trendStep = 1 + (trend - 1) * (i / horizon) * 0.6;
    const revenue = Math.max(0, base * dowFactor[dow] * trendStep);
    points.push({
      date: dayKey(date),
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      revenue: round(revenue, city.decimals || 0),
      revenueLabel: money(revenue, city),
      confidence: round(confidence, 2),
    });
  }

  const peak = points.reduce((a, b) => (b.revenue > a.revenue ? b : a), points[0]);
  return {
    horizon,
    method: "wma+dow+trend",
    confidence: round(confidence, 2),
    trend: round(trend, 2),
    dailyAverage: round(overallAvg, city.decimals || 0),
    dailyAverageLabel: money(overallAvg, city),
    peakDay: peak ? peak.day : null,
    points,
  };
}

/* ------------------------------------------------------------------ */
/* recommendations                                                     */
/* ------------------------------------------------------------------ */

function recommend(vertical, city, basketIds, limit) {
  const topN = limit || 4;
  const history = buildHistory(vertical, city, 60);
  const basket = new Set((basketIds || []).filter(Boolean));

  const itemOrders = new Map();
  const cooccur = new Map();

  for (const order of history) {
    const ids = order.items.map((i) => i.id);
    const unique = Array.from(new Set(ids));
    for (const id of unique) itemOrders.set(id, (itemOrders.get(id) || 0) + 1);
    if (basket.size) {
      const hasBasket = unique.some((id) => basket.has(id));
      if (hasBasket) {
        for (const id of unique) {
          if (!basket.has(id)) cooccur.set(id, (cooccur.get(id) || 0) + 1);
        }
      }
    }
  }

  const basketOrders = Array.from(basket).reduce((s, id) => s + (itemOrders.get(id) || 0), 0);
  const maxPop = Math.max(1, ...itemOrders.values());
  const seedItem = basket.size ? vertical.items.find((i) => basket.has(i.id)) : null;

  const scored = vertical.items
    .filter((i) => !basket.has(i.id))
    .map((i) => {
      const pop = itemOrders.get(i.id) || 0;
      const co = cooccur.get(i.id) || 0;
      const lift = basket.size && basketOrders ? (co + 0.6) / ((basketOrders * pop) / Math.max(1, history.length) + 0.6) : 1;
      const popScore = pop / maxPop;
      const liftScore = clamp(lift / 2.2, 0, 1);
      const stockScore = i.stock == null ? 0.5 : clamp(i.stock / 40, 0, 1);
      const score = basket.size
        ? 0.52 * liftScore + 0.33 * popScore + 0.05 * stockScore + 0.1 * (i.badge ? 1 : 0.3)
        : 0.7 * popScore + 0.2 * stockScore + 0.1 * (i.badge ? 1 : 0.3);
      let reason;
      if (basket.size && lift > 1.35 && seedItem) reason = seedItem.name + " ke saath often bought";
      else if (i.badge === "Bestseller") reason = "Is business ka bestseller";
      else reason = "Customers ise regularly order karte hain";
      return {
        id: i.id,
        name: i.name,
        unit: i.unit,
        emoji: i.emoji,
        price: convertPrice(i.price, city),
        priceLabel: money(i.price, city),
        score: round(score, 3),
        lift: round(lift, 2),
        reason,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return {
    method: basket.size ? "market-basket-lift" : "popularity",
    basedOn: Array.from(basket),
    items: scored,
  };
}

/* ------------------------------------------------------------------ */
/* lead scoring                                                        */
/* ------------------------------------------------------------------ */

const NEED_POINTS = {
  website: 12, store: 20, commerce: 24, agent: 26,
  automation: 22, physical: 30, full: 28, other: 10,
};
const BUDGET_POINTS = { under25: 6, "25to50": 12, "50to100": 18, "100plus": 24, unknown: 8 };
const TIMELINE_POINTS = { now: 30, month: 20, quarter: 10, exploring: 4 };
const SOURCE_POINTS = { referral: 14, whatsapp: 12, website: 9, instagram: 6, walkin: 10, other: 5 };

function leadScore(input) {
  const lead = input || {};
  const need = String(lead.need || "other");
  const budget = String(lead.budget || "unknown");
  const timeline = String(lead.timeline || "exploring");
  const source = String(lead.source || "other");
  const notes = String(lead.notes || "").toLowerCase();

  let score = 0;
  const factors = [];

  const add = (label, points, max) => {
    if (points > 0) factors.push({ label, points, max });
    score += points;
  };

  const needPts = NEED_POINTS[need] != null ? NEED_POINTS[need] : NEED_POINTS.other;
  add("Need fit", needPts, 30);

  const budgetPts = BUDGET_POINTS[budget] != null ? BUDGET_POINTS[budget] : BUDGET_POINTS.unknown;
  add("Budget signal", budgetPts, 24);

  const timelinePts = TIMELINE_POINTS[timeline] != null ? TIMELINE_POINTS[timeline] : TIMELINE_POINTS.exploring;
  add("Timeline urgency", timelinePts, 30);

  const sourcePts = SOURCE_POINTS[source] != null ? SOURCE_POINTS[source] : SOURCE_POINTS.other;
  add("Source quality", sourcePts, 14);

  let completeness = 0;
  if (lead.name && String(lead.name).trim().length >= 2) completeness += 3;
  if (/^[0-9+\-\s]{10,15}$/.test(String(lead.phone || ""))) completeness += 4;
  if (lead.city && String(lead.city).trim()) completeness += 2;
  if (lead.business && String(lead.business).trim()) completeness += 3;
  add("Contact completeness", completeness, 12);

  if (/urgent|abhi|jaldi|today|aaj|turant/.test(notes)) add("Urgency keywords", 6, 6);

  score = clamp(Math.round(score), 0, 100);

  let band, nextAction;
  if (score >= 70) {
    band = "hot";
    nextAction = "Aaj hi call karein aur 20-minute discovery schedule karein.";
  } else if (score >= 45) {
    band = "warm";
    nextAction = "48 ghante me WhatsApp follow-up + ek demo link bhejein.";
  } else {
    band = "nurture";
    nextAction = "Weekly value message bhejein; 2 hafte baad re-score karein.";
  }

  return {
    score,
    band,
    nextAction,
    factors,
    signals: { need, budget, timeline, source, completeness },
  };
}

/* ------------------------------------------------------------------ */
/* RFM customer segments                                               */
/* ------------------------------------------------------------------ */

function rScore(days) {
  if (days <= 7) return 5;
  if (days <= 14) return 4;
  if (days <= 30) return 3;
  if (days <= 60) return 2;
  return 1;
}
function fScore(orders) {
  if (orders >= 20) return 5;
  if (orders >= 12) return 4;
  if (orders >= 6) return 3;
  if (orders >= 3) return 2;
  return 1;
}
function mScore(spend) {
  if (spend >= 20000) return 5;
  if (spend >= 10000) return 4;
  if (spend >= 5000) return 3;
  if (spend >= 2000) return 2;
  return 1;
}

function rfm(customers) {
  const rows = (customers || []).map((c) => {
    const r = rScore(c.lastOrderDaysAgo);
    const f = fScore(c.orders);
    const m = mScore(c.spend);
    let segment, action;
    if (r >= 4 && f >= 4) {
      segment = "Champion";
      action = "Loyalty reward + referral ask.";
    } else if (r >= 4 && f <= 2) {
      segment = "New";
      action = "Onboarding message + second-order offer.";
    } else if (r >= 3 && f >= 3) {
      segment = "Loyal";
      action = "Upsell bundle / monthly pack.";
    } else if (r <= 2 && f >= 3) {
      segment = "At risk";
      action = "Win-back offer with their top item.";
    } else if (r <= 2) {
      segment = "Hibernating";
      action = "Low-cost reactivation, else pause.";
    } else {
      segment = "Promising";
      action = "Nudge with a time-bound offer.";
    }
    return {
      name: c.name,
      lastOrderDaysAgo: c.lastOrderDaysAgo,
      orders: c.orders,
      spend: c.spend,
      r, f, m,
      segment,
      action,
    };
  });
  const counts = rows.reduce((acc, r) => {
    acc[r.segment] = (acc[r.segment] || 0) + 1;
    return acc;
  }, {});
  return { rows: rows.sort((a, b) => a.lastOrderDaysAgo - b.lastOrderDaysAgo), counts };
}

/* ------------------------------------------------------------------ */
/* anomaly detection                                                   */
/* ------------------------------------------------------------------ */

function anomalies(daily) {
  if (daily.length < 10) return [];
  const values = daily.map((d) => d.revenue);
  const recent = values.slice(-3);
  const baseline = values.slice(0, -3);
  const m = mean(baseline);
  const sd = stddev(baseline) || 1;
  const z = (mean(recent) - m) / sd;
  const out = [];
  if (Math.abs(z) >= 1.8) {
    out.push({
      type: z > 0 ? "spike" : "drop",
      z: round(z, 2),
      message: z > 0
        ? "Last 3 din ka revenue normal se kaafi zyada hai — stock check karein."
        : "Last 3 din ka revenue normal se neeche hai — demand ya supply issue ho sakta hai.",
      severity: Math.abs(z) > 2.6 ? "high" : "medium",
    });
  }
  // low stock, a practical "anomaly" for a shop owner
  return out;
}

/* ------------------------------------------------------------------ */
/* synthetic customers                                                 */
/* ------------------------------------------------------------------ */

const NAMES = [
  "Ramesh Gupta", "Sunita Devi", "Amit Verma", "Priya Singh", "Mohammed Irfan",
  "Kavita Yadav", "Rohit Saxena", "Neha Agarwal", "Sanjay Mishra", "Fatima Khan",
];

function syntheticCustomers(vertical, city) {
  const rand = rng(hash(vertical.id + "|" + city.id + "|customers"));
  return NAMES.map((name, i) => {
    const orders = 1 + Math.floor(rand() * 24);
    const spend = Math.round((orders * (400 + rand() * 1600)) / 10) * 10;
    return {
      name,
      lastOrderDaysAgo: 1 + Math.floor(rand() * 75),
      orders,
      spend: convertPrice(spend, city),
    };
  });
}

/* ------------------------------------------------------------------ */
/* combined insights                                                   */
/* ------------------------------------------------------------------ */

function insights(vertical, city) {
  const history = buildHistory(vertical, city, 60);
  const daily = aggregateDaily(history);
  const last30 = daily.slice(-30);
  const last30Orders = history.filter((o) => last30.some((d) => d.date === o.date));

  const revenue = last30.reduce((s, d) => s + d.revenue, 0);
  const orders = last30Orders.length;
  const units = last30.reduce((s, d) => s + d.units, 0);
  const aov = orders ? revenue / orders : 0;

  const itemRev = new Map();
  for (const o of last30Orders) {
    for (const it of o.items) {
      const cur = itemRev.get(it.id) || { id: it.id, name: it.name, units: 0, revenue: 0 };
      cur.units += it.qty;
      cur.revenue += it.qty * it.price;
      itemRev.set(it.id, cur);
    }
  }
  const topItems = Array.from(itemRev.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topItem = topItems[0] || vertical.items[0];

  const recs = recommend(vertical, city, topItem ? [topItem.id] : [], 4);
  const fc = forecast(vertical, city, 7);
  const customers = syntheticCustomers(vertical, city);
  const seg = rfm(customers);
  const rand = rng(hash(vertical.id + "|" + city.id + "|meta"));
  const conversion = round(2.6 + rand() * 4.2, 1);
  const repeatRate = round(30 + rand() * 28, 0);

  const lowStock = vertical.items
    .filter((i) => i.stock != null && i.stock <= 10)
    .map((i) => ({ id: i.id, name: i.name, stock: i.stock, urgency: i.stock <= 3 ? "critical" : "low" }));

  return {
    biz: vertical.id,
    city: city.id,
    currency: city.currency,
    generatedAt: new Date().toISOString(),
    kpis: {
      revenue: round(revenue, city.decimals || 0),
      revenueLabel: money(revenue, city),
      orders,
      units,
      aov: round(aov, city.decimals || 0),
      aovLabel: money(aov, city),
      conversion,
      repeatRate,
    },
    topItems: topItems.map((i) => ({
      ...i,
      revenue: round(i.revenue, city.decimals || 0),
      revenueLabel: money(i.revenue, city),
    })),
    forecast: fc,
    recommendations: recs.items,
    segments: seg.counts,
    customers: seg.rows.slice(0, 6),
    anomalies: anomalies(last30),
    lowStock,
    sourceMix: {
      whatsapp: round(38 + rand() * 14, 0),
      website: round(18 + rand() * 10, 0),
      qr: round(12 + rand() * 8, 0),
      walkin: round(10 + rand() * 8, 0),
    },
  };
}

module.exports = {
  hash,
  rng,
  clamp,
  round,
  mean,
  stddev,
  convertPrice,
  money,
  buildHistory,
  aggregateDaily,
  forecast,
  recommend,
  leadScore,
  rfm,
  anomalies,
  insights,
};
