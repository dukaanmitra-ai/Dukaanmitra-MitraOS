"use strict";

/**
 * Vercel serverless entry: /api/*
 * Deployed from the dist-site folder built by scripts/build-site.mjs.
 */

const { handle } = require("./_lib/router");

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string") {
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");
  const query = Object.fromEntries(url.searchParams.entries());
  const body = req.method === "POST" ? await readBody(req) : {};

  const result = await handle({
    method: req.method,
    pathname: url.pathname,
    query: { ...query, ...(req.query || {}) },
    body,
  });

  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(result.body));
};
