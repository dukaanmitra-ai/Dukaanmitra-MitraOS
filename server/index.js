"use strict";

/**
 * Mitra System — local all-in-one server.
 *
 *   node server/index.js
 *   PORT=4100 node server/index.js
 *
 * Serves the static product folders AND the JSON API from one port, so the
 * business runner, umbrella site and API can be demoed without Vercel.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handle } = require("../api/_lib/router");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 4100);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf",
};

function send(res, status, body, headers) {
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Content-Type-Options": "nosniff",
    ...(headers || {}),
  };
  res.writeHead(status, h);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        req.destroy();
        return resolve({});
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = path.resolve(ROOT, "." + decoded);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

function serveStatic(req, res, pathname) {
  let target = safePath(pathname);
  if (!target) return send(res, 400, "Bad path", { "Content-Type": "text/plain" });

  try {
    let stat = fs.statSync(target);
    if (stat.isDirectory()) {
      target = path.join(target, "index.html");
      stat = fs.statSync(target);
    }
    if (!stat.isFile()) throw new Error("not a file");

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const isHtml = ext === ".html";
    const headers = {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=300",
    };

    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      return res.end();
    }

    res.writeHead(200, headers);
    fs.createReadStream(target).pipe(res);
  } catch (err) {
    send(res, 404, "Not found: " + pathname, { "Content-Type": "text/plain; charset=utf-8" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    return send(res, 204, "");
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const query = Object.fromEntries(url.searchParams.entries());
    const body = req.method === "POST" || req.method === "PUT" ? await readBody(req) : {};
    const started = Date.now();
    const result = await handle({ method: req.method, pathname, query, body });
    console.log(
      "[api]",
      req.method,
      pathname,
      result.status,
      (Date.now() - started) + "ms"
    );
    return sendJson(res, result.status, result.body);
  }

  if (pathname === "/healthz") {
    return sendJson(res, 200, { ok: true, service: "mitra-system", port: PORT });
  }

  serveStatic(req, res, pathname === "/" ? "/index.html" : pathname);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  Mitra System running");
  console.log("  ---------------------");
  console.log("  Umbrella     http://" + HOST + ":" + PORT + "/");
  console.log("  Storefront   http://" + HOST + ":" + PORT + "/apps/storemitra-site/");
  console.log("  Runner       http://" + HOST + ":" + PORT + "/apps/business-runner/");
  console.log("  API health   http://" + HOST + ":" + PORT + "/api/health");
  console.log("");
});

process.on("SIGINT", () => {
  console.log("\n[server] shutting down");
  server.close(() => process.exit(0));
});
