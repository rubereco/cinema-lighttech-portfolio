#!/usr/bin/env node
/**
 * generate-placeholders.mjs
 *
 * Generates SVG placeholder images for the Showcase page while real photos
 * are not yet available. Each project gets:
 *   - assets/projects/<slug>/cover.svg   (folder cover, large slate design)
 *   - assets/projects/<slug>/photo-NN-<kind>.svg  (gallery tiles)
 *
 * The placeholders are intentionally thematic (film-slate look) so Tarek
 * and rubereco can evaluate the layout rhythm, not just gray boxes.
 *
 * Real photos later replace these files 1:1. Same filenames = no schema change.
 * Just drop a real cover.jpg (or .webp) next to cover.svg and update
 * data/content.json to point at it.
 *
 * Usage: node scripts/generate-placeholders.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS = join(ROOT, "assets", "projects");

// ─── Project catalogue ─────────────────────────────────────────────────────
// Order in this array = display order in the folder grid.
// First entry is treated as "current" — gets a subtle status badge.
const PROJECTS = [
  {
    slug: "saw-2026",
    title: "Saw",
    year: 2026,
    role: "Gaffer",
    status: "in-production",
    accent: "#E8A33D", // tungsten amber
    photoCount: { bts: 4, still: 2, process: 2 },
  },
  {
    slug: "els-mals-noms-2025",
    title: "Els Mals Noms",
    year: 2025,
    role: "Gaffer",
    status: "released",
    accent: "#C77B3A",
    photoCount: { bts: 3, still: 2, process: 1 },
  },
  {
    slug: "la-sociedad-de-la-nieve-2023",
    title: "La Sociedad de la Nieve",
    year: 2023,
    role: "Electrician",
    status: "released",
    accent: "#5BA8C4",
    photoCount: { bts: 3, still: 2, process: 1 },
  },
  {
    slug: "uncharted-2022",
    title: "Uncharted",
    year: 2022,
    role: "Rigging Electric",
    status: "released",
    accent: "#8B7AB8",
    photoCount: { bts: 2, still: 2, process: 1 },
  },
  {
    slug: "a-monster-calls-2016",
    title: "A Monster Calls",
    year: 2016,
    role: "Spark",
    status: "released",
    accent: "#6B8E6B",
    photoCount: { bts: 2, still: 2, process: 1 },
  },
  {
    slug: "the-impossible-2012",
    title: "The Impossible",
    year: 2012,
    role: "Lamp Operator",
    status: "released",
    accent: "#9B7A5C",
    photoCount: { bts: 2, still: 2, process: 1 },
  },
];

// ─── SVG templates ─────────────────────────────────────────────────────────

/** Cover placeholder — film slate with title + year + role */
function coverSvg({ title, year, role, accent, status }) {
  const statusBadge = status === "in-production"
    ? `<g transform="translate(720,40)">
         <rect x="0" y="0" width="200" height="44" rx="22" fill="${accent}" opacity="0.95"/>
         <text x="100" y="29" text-anchor="middle" font-family="ui-sans-serif,system-ui" font-size="16" font-weight="700" fill="#0b0b0d" letter-spacing="2">IN PRODUCTION</text>
       </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg-${slug(title)}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1d"/>
      <stop offset="100%" stop-color="#0b0b0d"/>
    </linearGradient>
    <pattern id="grain-${slug(title)}" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.5" fill="#ffffff" opacity="0.03"/>
    </pattern>
  </defs>
  <rect width="960" height="720" fill="url(#bg-${slug(title)})"/>
  <rect width="960" height="720" fill="url(#grain-${slug(title)})"/>

  <!-- Diagonal slate stripes top -->
  <g transform="translate(0,0)" opacity="0.85">
    ${[0,1,2,3,4,5,6,7].map(i => `<rect x="${i*60}" y="0" width="30" height="80" fill="${i%2===0?'#ffffff':'#0b0b0d'}" transform="skewX(-20)"/>`).join('')}
  </g>

  <!-- Big clapperboard symbol -->
  <g transform="translate(80,200)" opacity="0.15">
    <rect x="0" y="0" width="320" height="240" rx="8" fill="${accent}"/>
    <rect x="0" y="0" width="320" height="60" fill="#0b0b0d"/>
    <rect x="0" y="60" width="320" height="20" fill="${accent}"/>
  </g>

  ${statusBadge}

  <!-- Title block -->
  <g transform="translate(80,500)">
    <text x="0" y="0" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="500" fill="#9b9b9e" letter-spacing="6">${year}</text>
    <line x1="0" y1="20" x2="80" y2="20" stroke="${accent}" stroke-width="3"/>
    <text x="0" y="80" font-family="'Anton',Impact,sans-serif" font-size="72" font-weight="700" fill="#f4f4f4" letter-spacing="1">${escapeXml(title)}</text>
    <text x="0" y="130" font-family="ui-sans-serif,system-ui" font-size="20" font-weight="600" fill="${accent}" letter-spacing="4">${escapeXml(role.toUpperCase())}</text>
  </g>

  <!-- Placeholder corner mark -->
  <g transform="translate(880,680)" opacity="0.5">
    <text x="0" y="0" text-anchor="end" font-family="ui-monospace,monospace" font-size="12" fill="#6b6b6e">PLACEHOLDER</text>
  </g>
</svg>`;
}

/** Photo tile placeholder — kind-specific colour, kind badge, project tag */
function photoSvg({ title, year, kind, accent, index, total }) {
  // Different background hues per kind so the layout reads clearly
  const palettes = {
    bts:      { bg: "#1f2733", sub: "#2a3548", label: "BTS" },
    still:    { bg: "#2a2018", sub: "#3a2d20", label: "STILL" },
    process:  { bg: "#1a2a1f", sub: "#243a2c", label: "PROCESS" },
  };
  const p = palettes[kind];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="p-${slug(title)}-${kind}-${index}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg}"/>
      <stop offset="100%" stop-color="${p.sub}"/>
    </linearGradient>
    <pattern id="g-${slug(title)}-${kind}-${index}" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.6" fill="#ffffff" opacity="0.04"/>
    </pattern>
  </defs>
  <rect width="800" height="800" fill="url(#p-${slug(title)}-${kind}-${index})"/>
  <rect width="800" height="800" fill="url(#g-${slug(title)}-${kind}-${index})"/>

  <!-- Kind badge top-left -->
  <g transform="translate(40,40)">
    <rect x="0" y="0" width="120" height="40" rx="20" fill="${accent}" opacity="0.95"/>
    <text x="60" y="26" text-anchor="middle" font-family="ui-sans-serif,system-ui" font-size="14" font-weight="700" fill="#0b0b0d" letter-spacing="3">${p.label}</text>
  </g>

  <!-- Frame number top-right (cinematic) -->
  <g transform="translate(760,52)" opacity="0.6">
    <text x="0" y="0" text-anchor="end" font-family="ui-monospace,monospace" font-size="14" fill="#f4f4f4" letter-spacing="2">${String(index + 1).padStart(3, '0')} / ${String(total).padStart(3, '0')}</text>
  </g>

  <!-- Camera/aperture icon centre -->
  <g transform="translate(400,400)" opacity="0.18">
    <circle cx="0" cy="0" r="80" fill="none" stroke="${accent}" stroke-width="4"/>
    <circle cx="0" cy="0" r="50" fill="none" stroke="${accent}" stroke-width="3"/>
    <circle cx="0" cy="0" r="20" fill="${accent}"/>
  </g>

  <!-- Bottom caption -->
  <g transform="translate(40,720)">
    <text x="0" y="0" font-family="ui-sans-serif,system-ui" font-size="18" font-weight="600" fill="#f4f4f4" opacity="0.85">${escapeXml(title)}</text>
    <text x="0" y="26" font-family="ui-sans-serif,system-ui" font-size="13" font-weight="500" fill="${accent}" letter-spacing="3" opacity="0.8">${year} · ${kind.toUpperCase()}</text>
  </g>
</svg>`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  console.log(`  ✓ ${rel}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

console.log("Generating showcase placeholders...\n");

for (const proj of PROJECTS) {
  const dir = `assets/projects/${proj.slug}`;
  console.log(`[${proj.title} ${proj.year}]`);

  write(`${dir}/cover.svg`, coverSvg(proj));

  // Generate photos in a consistent order: bts, still, process
  const kinds = ["bts", "still", "process"];
  let photoIdx = 0;
  const totalPhotos = proj.photoCount.bts + proj.photoCount.still + proj.photoCount.process;
  for (const kind of kinds) {
    for (let i = 0; i < proj.photoCount[kind]; i++) {
      const n = String(photoIdx + 1).padStart(2, "0");
      write(`${dir}/photo-${n}-${kind}.svg`, photoSvg({
        ...proj,
        kind,
        index: photoIdx,
        total: totalPhotos,
      }));
      photoIdx++;
    }
  }
  console.log();
}

console.log(`Done. ${PROJECTS.length} projects, ${PROJECTS.reduce((a,p)=>a+1+p.photoCount.bts+p.photoCount.still+p.photoCount.process,0)} files written.`);
console.log(`\nReplace each .svg with a real .jpg (or .webp) of the same name when ready.`);