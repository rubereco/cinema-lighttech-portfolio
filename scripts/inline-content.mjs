// scripts/inline-content.mjs
// Inlines data/content.json and data/i18n.json into <script type="application/json">
// blocks inside index.html and showcase.html so the site works when opened
// directly from the filesystem (file://) where fetch() is blocked by CORS.
//
// Usage: node scripts/inline-content.mjs
//
// What it does:
// 1. Reads data/content.json and data/i18n.json
// 2. Injects/replaces:
//    <script type="application/json" id="tarek-content">{...content.json...}</script>
//    <script type="application/json" id="tarek-i18n">{...i18n.json...}</script>
// 3. Inside <head> of both index.html and showcase.html
//
// The loaders (main.js, showcase.js) check for these inline blocks first,
// fall back to fetch() if missing — so live deploys still pull fresh data.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
}

function injectInline(html, id, data) {
  // Pretty-print with 2-space indent (smaller than minified, easier to debug)
  const json = JSON.stringify(data, null, 2);
  const block = `<script type="application/json" id="${id}">\n${json}\n</script>`;

  // Replace existing block if present, otherwise inject before </head>
  const blockRegex = new RegExp(
    `<script type="application/json" id="${id}">[\\s\\S]*?<\\/script>`,
    "g"
  );
  if (blockRegex.test(html)) {
    return html.replace(blockRegex, block);
  }
  return html.replace("</head>", `  ${block}\n</head>`);
}

function processFile(htmlPath, contentId, contentData, i18nId, i18nData) {
  let html = readFileSync(resolve(ROOT, htmlPath), "utf8");
  html = injectInline(html, contentId, contentData);
  html = injectInline(html, i18nId, i18nData);
  writeFileSync(resolve(ROOT, htmlPath), html, "utf8");
  console.log(`  ✓ ${htmlPath} (inlined ${contentId} + ${i18nId})`);
}

console.log("Inlining content into HTML files (for file:// compatibility)…\n");

const content = loadJson("data/content.json");
const i18n    = loadJson("data/i18n.json");

console.log(`  content.json: ${Object.keys(content).join(", ")}`);
console.log(`  i18n.json:    ${Object.keys(i18n).join(", ")}\n`);

processFile("index.html",    "tarek-content", content, "tarek-i18n", i18n);
processFile("showcase.html", "tarek-content", content, "tarek-i18n", i18n);

console.log("\n✓ Done. HTML files now work via file:// without fetch().");
console.log("  Live deploys still fetch fresh data from /data/*.json (inline is fallback).");