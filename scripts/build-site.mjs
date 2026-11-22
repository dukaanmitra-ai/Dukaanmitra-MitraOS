#!/usr/bin/env node
/**
 * Mitra System — build the deployable static site + serverless API.
 *
 *   node scripts/build-site.mjs
 *   SITE_URL=https://your-domain.com node scripts/build-site.mjs
 *
 * Output: dist-site/  (deploy with: vercel --prod dist-site)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(root, "dist-site");
const SITE_URL = (process.env.SITE_URL || "https://mitra-system.vercel.app").replace(/\/+$/, "");

function run(script) {
  execFileSync(process.execPath, [path.join(root, "scripts", script)], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, SITE_URL },
  });
}

function copyFile(rel, destRel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return null;
  const dest = path.join(out, destRel || rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return fs.statSync(dest).size;
}

function copyDir(rel, destRel, skip) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return 0;
  let total = 0;
  const walk = (dir, relBase) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip && skip(entry.name, relBase)) continue;
      const abs = path.join(dir, entry.name);
      const relPath = relBase ? relBase + "/" + entry.name : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (entry.isFile()) total += copyFile(path.join(rel, relPath), (destRel || rel) + "/" + relPath) || 0;
    }
  };
  walk(src, "");
  return total;
}

console.log("\n[build] generating catalog + pages …");
run("generate-catalog-js.mjs");
run("generate-pages.mjs");

console.log("[build] cleaning dist-site …");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

console.log("[build] copying static files …");
const files = [
  "index.html",
  "favicon.svg",
  "sitemap.xml",
  "robots.txt",
  "README.md",
  "SYSTEM.md",
  "DEPLOY.md",
  "apps/business-runner/index.html",
  "apps/business-runner/catalog.js",
  "apps/storemitra-site/index.html",
  "apps/storemitra-site/favicon.svg",
  "apps/dukaanmitra-site/index.html",
  "apps/dukaanmitra-site/favicon.svg",
  "data/catalog.json",
  "api/[...path].js",
  "api/_lib/ml.js",
  "api/_lib/router.js",
  "api/_lib/store.js",
];
let bytes = 0;
for (const f of files) {
  const n = copyFile(f);
  if (n == null) console.warn("  missing:", f);
  else bytes += n;
}

const dirs = ["cities", "business", "demos", "docs"];
for (const d of dirs) bytes += copyDir(d, d, (name) => name.startsWith(".") || name === "node_modules");

// sales kit, if generated
const salesKit = path.join(root, "sales-kit");
if (fs.existsSync(salesKit)) bytes += copyDir("sales-kit", "sales-kit");

/* Vercel config for the static site + serverless API */
const vercel = {
  version: 2,
  name: "mitra-system",
  functions: {
    "api/[...path].js": { memory: 512, maxDuration: 10 },
  },
  headers: [
    {
      source: "/api/(.*)",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};
fs.writeFileSync(path.join(out, "vercel.json"), JSON.stringify(vercel, null, 2), "utf8");

const total = (fs.statSync(out).isDirectory() ? bytes : 0);
console.log("\n[build] done");
console.log("  output :", out);
console.log("  site   :", SITE_URL);
console.log("  size   :", (total / 1024).toFixed(1), "KB (static + api + docs)");
console.log("  deploy : vercel --prod dist-site\n");
