#!/usr/bin/env node
/**
 * v3.14.16: aggregate folder-based collections back to the
 * single-file shape the production site reads.
 *
 * The Decap CMS admin edits films and people as folder-based
 * collections (one file per entry: data/films/<id>.json,
 * data/people/<id>.json) because the relation widget doesn't
 * reliably index file-based collections with nested lists.
 *
 * The production site (assets/js/main.js, assets/js/partners.js)
 * still reads data/films.json and data/people.json as single
 * aggregates. This build step regenerates those aggregates from
 * the folder sources right before Cloudflare Pages deploys.
 *
 * - Films: sorted by year descending, then by id for stability.
 * - People: sorted by kind, then by id (subject → director → dop
 *   → gaffer → electric, alphabetical within each).
 *
 * If you want a different order, edit the sort comparators below.
 * The work order collection (data/work.json) is the source of
 * truth for the homepage display order, so films.json order is
 * only used as a fallback / for non-ordered consumers.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);

function readDir(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) {
    console.error(`  ! directory not found: ${dir}`);
    return [];
  }
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(abs, f), "utf8");
      try {
        return JSON.parse(raw);
      } catch (err) {
        console.error(`  ! parse error in ${dir}/${f}: ${err.message}`);
        process.exit(1);
      }
    });
}

function writeAggregate(outPath, field, items, meta) {
  const abs = path.join(ROOT, outPath);
  const obj = { _meta: { ...meta, lastUpdated: today }, [field]: items };
  fs.writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n");
  console.log(`  ✓ ${outPath} ← ${items.length} entries`);
}

// ─── Films: sort by year desc, then by id ──────────────────────────
const films = readDir("data/films").sort((a, b) => {
  if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
  return (a.id ?? "").localeCompare(b.id ?? "");
});
writeAggregate("data/films.json", "films", films, { version: "1.1" });

// ─── People: sort by kind order, then by id ────────────────────────
const KIND_ORDER = { subject: 0, director: 1, dop: 2, gaffer: 3, electric: 4 };
const people = readDir("data/people").sort((a, b) => {
  const ka = KIND_ORDER[a.kind] ?? 99;
  const kb = KIND_ORDER[b.kind] ?? 99;
  if (ka !== kb) return ka - kb;
  return (a.id ?? "").localeCompare(b.id ?? "");
});
writeAggregate("data/people.json", "people", people, { version: "1.3" });

console.log("build complete.");
