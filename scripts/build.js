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
// Normalize the folder files so the aggregate always matches the schema
// the production JS expects: credits.production and credits.people.
// The Decap admin panel sometimes writes people / production at the top
// level depending on the schema version; the build step flattens both.
function normalizeFilm(film) {
  const normalized = { ...film };
  const credits = normalized.credits || {};
  if (!normalized.credits) normalized.credits = credits;
  if (!Array.isArray(credits.production)) {
    credits.production = Array.isArray(normalized.production) ? normalized.production : [];
  }
  if (!Array.isArray(credits.people)) {
    credits.people = Array.isArray(normalized.people) ? normalized.people : [];
  }
  delete normalized.production;
  delete normalized.people;
  // Remove stray null entries left by empty admin fields.
  credits.production = credits.production.filter((p) => p != null);
  return normalized;
}

const films = readDir("data/films")
  .map(normalizeFilm)
  .sort((a, b) => {
    if ((b.year ?? 0) !== (a.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
writeAggregate("data/films.json", "films", films, { version: "1.4" });

// ─── People: sort by partnership first (regular collaborators
//     before one-off film credits), then by name ─────────────────
const people = readDir("data/people").sort((a, b) => {
  const ap = a.partnership?.jobIds?.length ? 0 : 1;
  const bp = b.partnership?.jobIds?.length ? 0 : 1;
  if (ap !== bp) return ap - bp;
  return (a.name ?? "").localeCompare(b.name ?? "");
});
writeAggregate("data/people.json", "people", people, { version: "1.5" });

// ─── Jobs: sort by category order, then by name ──────────────────
const CATEGORY_ORDER = { direction: 0, cinematography: 1, lighting: 2, sound: 3, production: 4, other: 5 };
const jobs = readDir("data/jobs").sort((a, b) => {
  const ca = CATEGORY_ORDER[a.category] ?? 99;
  const cb = CATEGORY_ORDER[b.category] ?? 99;
  if (ca !== cb) return ca - cb;
  return (a.name?.en ?? "").localeCompare(b.name?.en ?? "");
});
writeAggregate("data/jobs.json", "jobs", jobs, { version: "1.0" });

console.log("build complete.");
