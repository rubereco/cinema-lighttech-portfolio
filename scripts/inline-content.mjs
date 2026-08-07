// scripts/inline-content.mjs
//
// Inlines each data/*.json file into its own <script type="application/json">
// block inside index.html / showcase.html / partners.html so the site works
// when opened from the filesystem (file://, where fetch() is blocked by CORS).
//
// Block id convention: "tarek-<basename-of-data-file>"
//   data/site.json      → <script id="tarek-site">
//   data/people.json    → <script id="tarek-people">
//   data/films.json     → <script id="tarek-films">
//   data/work.json      → <script id="tarek-work">
//   data/showcase.json  → <script id="tarek-showcase">
//   data/kit.json       → <script id="tarek-kit">
//   data/companies.json → <script id="tarek-companies">
//   data/i18n.json      → <script id="tarek-i18n">
//
// Per-page loaders (main.js / showcase.js / partners.js) look up only the
// blocks they need by id. Inline is checked first; live deploys fall back
// to fetch("data/<name>.json").
//
// Usage: node scripts/inline-content.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// (dataFilePath, blockId) pairs in the order they should appear in <head>.
const BLOCKS = [
  ["data/site.json",      "tarek-site"],
  ["data/people.json",    "tarek-people"],
  ["data/films.json",     "tarek-films"],
  ["data/work.json",      "tarek-work"],
  ["data/hero.json",      "tarek-hero"],
  ["data/showcase.json",  "tarek-showcase"],
  ["data/kit.json",       "tarek-kit"],
  ["data/companies.json", "tarek-companies"],
  ["data/i18n.json",      "tarek-i18n"],
];

// Pre-v2 monolithic block + the now-decommissioned tarek-partners block
// (entities moved to tarek-people + tarek-companies). Kept here so the
// inliner can strip stale inline blocks from earlier inlines.
const OBSOLETE_IDS = ["tarek-content", "tarek-partners"];

const PAGES = ["index.html", "showcase.html", "partners.html"];

function blockHtml(id, json) {
  return `<script type="application/json" id="${id}">\n${json}\n</script>`;
}

function injectOrReplace(html, id, json) {
  const re = new RegExp(
    `<script type="application/json" id="${id}">[\\s\\S]*?<\\/script>`,
    "g"
  );
  const block = blockHtml(id, json);
  if (re.test(html)) return html.replace(re, block);
  // Inject before </head> if the block doesn't exist yet.
  return html.replace(/<\/head>/i, `${block}\n  </head>`);
}

function stripObsolete(html, ids) {
  let out = html;
  for (const id of ids) {
    const re = new RegExp(
      `\\s*<script type="application/json" id="${id}">[\\s\\S]*?<\\/script>`,
      "g"
    );
    out = out.replace(re, "");
  }
  return out;
}

// ── run ──
console.log("Inlining content into HTML files (for file:// compatibility)…\n");
const filesWritten = [];
for (const [pageFile] of PAGES.map((p) => [p])) {
  const pagePath = resolve(ROOT, pageFile);
  if (!fileExists(pagePath)) continue;
  let html = readFileSync(pagePath, "utf8");
  // Drop legacy monolithic block(s) before re-inlining the new split blocks.
  html = stripObsolete(html, OBSOLETE_IDS);

  for (const [dataFile, blockId] of BLOCKS) {
    const dataPath = resolve(ROOT, dataFile);
    if (!fileExists(dataPath)) continue;
    const data = JSON.parse(readFileSync(dataPath, "utf8"));
    const json  = JSON.stringify(data, null, 2);
    html = injectOrReplace(html, blockId, json);
  }
  writeFileSync(pagePath, html);
  filesWritten.push(pageFile);
}

console.log("  inlined blocks per page:");
for (const [dataFile, blockId] of BLOCKS) {
  const present = fileExists(resolve(ROOT, dataFile));
  console.log(`    ${blockId.padEnd(20)} ← ${dataFile}${present ? "" : "  (missing)"}`);
}
console.log(`\n✓ Done. Wrote: ${filesWritten.join(", ")}`);
console.log("  Live deploys still fetch fresh data per block from /data/*.json.");

function fileExists(p) {
  try { readFileSync(p, "utf8"); return true; } catch { return false; }
}
