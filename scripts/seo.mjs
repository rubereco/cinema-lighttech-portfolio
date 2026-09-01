// scripts/seo.mjs
//
// Generates SEO artifacts from the data files:
//   - robots.txt
//   - sitemap.xml
//   - <script type="application/ld+json"> block in index.html
//   - <noscript> static film-list fallback inside #work
//
// Run as part of `npm run build` after build.js and inline-content.mjs.
//
// Usage: node scripts/seo.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE_URL = process.env.SITE_URL || "https://recalone.com";
const TODAY = new Date().toISOString().slice(0, 10);

function loadJSON(file) {
  return JSON.parse(readFileSync(resolve(ROOT, file), "utf8"));
}

function absUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  const base = SITE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── robots.txt ───────────────────────────────────────────────────────────
function writeRobots() {
  const txt = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "",
    `Sitemap: ${absUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
  writeFileSync(resolve(ROOT, "robots.txt"), txt);
  console.log("  ✓ robots.txt");
}

// ─── sitemap.xml ──────────────────────────────────────────────────────────
function writeSitemap() {
  const pages = [
    { loc: "/", lastmod: TODAY },
    { loc: "/legal.html", lastmod: TODAY },
  ];
  const urls = pages
    .map(
      (p) => `  <url>\n    <loc>${absUrl(p.loc)}</loc>\n    <lastmod>${p.lastmod}</lastmod>\n    <priority>${p.loc === "/" ? "1.0" : "0.5"}</priority>\n  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  writeFileSync(resolve(ROOT, "sitemap.xml"), xml);
  console.log("  ✓ sitemap.xml");
}

// ─── JSON-LD structured data ──────────────────────────────────────────────
function buildJSONLD(site, films, work) {
  const filmsById = {};
  for (const f of films.films || films || []) filmsById[f.id] = f;

  const sameAs = [];
  if (site.contact?.imdbUrl) sameAs.push(site.contact.imdbUrl);
  if (site.contact?.instagramUrl) sameAs.push(site.contact.instagramUrl);

  const person = {
    "@type": "Person",
    name: site.brand || "Tarek Recolons",
    jobTitle: "Gaffer",
    url: absUrl("/"),
    sameAs,
    image: absUrl("assets/images/og-image.svg"),
  };

  const itemList = {
    "@type": "ItemList",
    name: "Selected Work",
    itemListElement: (work.rows || [])
      .map((row, idx) => {
        const film = filmsById[row.filmId];
        if (!film) return null;
        return {
          "@type": "ListItem",
          position: idx + 1,
          item: {
            "@type": "Movie",
            name: film.title,
            datePublished: String(film.year || ""),
            image: film.poster ? absUrl(film.poster) : undefined,
            url: absUrl(`/#film-${film.id || row.filmId}`),
            description: film.role ? `Tarek Recolons — ${film.role}` : undefined,
          },
        };
      })
      .filter(Boolean),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [person, itemList],
  };
}

function injectLD(jsonld) {
  const pagePath = resolve(ROOT, "index.html");
  let html = readFileSync(pagePath, "utf8");
  const block = `<script type="application/ld+json" id="tarek-ld">\n${JSON.stringify(jsonld, null, 2)}\n</script>`;
  const re = /<script type="application\/ld\+json" id="tarek-ld">[\s\S]*?<\/script>/;

  if (re.test(html)) {
    html = html.replace(re, block);
  } else {
    html = html.replace(/<\/head>/i, `${block}\n  </head>`);
  }
  writeFileSync(pagePath, html);
  console.log("  ✓ JSON-LD injected into index.html");
}

// ─── Static no-JS film list fallback ──────────────────────────────────────
function buildStaticFallback(films, work) {
  const filmsById = {};
  for (const f of films.films || films || []) filmsById[f.id] = f;

  const items = (work.rows || [])
    .map((row) => {
      const film = filmsById[row.filmId];
      if (!film) return "";
      const meta = [film.year, film.role].filter(Boolean).join(" · ");
      const slug = film.id || row.filmId;
      return `        <li><a href="/#film-${escapeHTML(slug)}">${escapeHTML(film.title)}${meta ? ` (${escapeHTML(meta)})` : ""}</a></li>`;
    })
    .filter(Boolean)
    .join("\n");

  return `<noscript class="poster-static-fallback" aria-label="Selected work">\n      <ul class="poster-static-list" role="list">\n${items}\n      </ul>\n    </noscript>`;
}

function injectFallback(fallbackHTML) {
  const pagePath = resolve(ROOT, "index.html");
  let html = readFileSync(pagePath, "utf8");
  const re = /<noscript class="poster-static-fallback"[\s\S]*?<\/noscript>/;

  if (re.test(html)) {
    html = html.replace(re, fallbackHTML);
  } else {
    // Insert right before <ul id="poster-wall">
    html = html.replace(
      /<ul class="poster-wall" id="poster-wall"/,
      `${fallbackHTML}\n    <ul class="poster-wall" id="poster-wall"`
    );
  }
  writeFileSync(pagePath, html);
  console.log("  ✓ static film fallback injected into index.html");
}

// ─── run ───────────────────────────────────────────────────────────────────
console.log("Generating SEO artifacts…\n");
const site = loadJSON("data/site.json");
const films = loadJSON("data/films.json");
const work = loadJSON("data/work.json");

writeRobots();
writeSitemap();
injectLD(buildJSONLD(site, films, work));
injectFallback(buildStaticFallback(films, work));

console.log("\n✓ SEO generation complete.");
