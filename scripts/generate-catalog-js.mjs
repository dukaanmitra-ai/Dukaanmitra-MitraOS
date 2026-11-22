import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));

const outDir = path.join(root, "apps", "business-runner");
fs.mkdirSync(outDir, { recursive: true });

const banner = `/* AUTO-GENERATED from data/catalog.json — do not edit by hand.
   Regenerate: node scripts/generate-catalog-js.mjs
   This file lets the runner work offline (file://) without the API. */
`;

const body = "window.MITRA_CATALOG = " + JSON.stringify(catalog, null, 2) + ";\n";
const target = path.join(outDir, "catalog.js");
fs.writeFileSync(target, banner + body, "utf8");

const kb = (fs.statSync(target).size / 1024).toFixed(1);
console.log("wrote", path.relative(root, target), kb + " KB");
console.log("verticals:", Object.keys(catalog.verticals).length, "cities:", Object.keys(catalog.cities).length);
