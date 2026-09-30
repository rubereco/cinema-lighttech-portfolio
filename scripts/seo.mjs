// scripts/seo.mjs
//
// Generates SEO artifacts from the data files:
//   - robots.txt
//   - sitemap.xml
//   - <script type="application/ld+json"> block in index.html
//   - <noscript> static film-list fallback inside #work
//   - translated page metadata and initial About/legal copy
//
// Run as part of `npm run build` after build.js.
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

const translations = new Map(loadJSON("data/i18n.json").entries.map(entry => [entry.key, entry]));
const localized = (key, lang) => translations.get(key)?.[lang];
const english = key => localized(key, "en") || key;

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
function buildJSONLD(site, films) {

  const sameAs = [];
  if (site.contact?.imdbUrl) sameAs.push(site.contact.imdbUrl);
  if (site.contact?.instagramUrl) sameAs.push(site.contact.instagramUrl);

  const person = {
    "@type": "Person",
    name: english("brand"),
    jobTitle: english("hero.role"),
    url: absUrl("/"),
    sameAs,
    image: absUrl("assets/images/og-image.svg"),
  };

  const itemList = {
    "@type": "ItemList",
    name: english("work.title"),
    itemListElement: (films.films || [])
      .filter(film => film.poster && film.displayOrder != null)
      .map((film, idx) => {
        return {
          "@type": "ListItem",
          position: idx + 1,
          item: {
            "@type": "Movie",
            name: film.title,
            datePublished: String(film.year || ""),
            image: film.poster ? absUrl(film.poster) : undefined,
            url: absUrl(`/#film-${film.id}`),
            description: film.role ? `${english("brand")} — ${english(`roles.${film.role}`)}` : undefined,
          },
        };
      }),
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
function buildStaticFallback(films) {
  const items = (films.films || [])
    .filter(film => film.poster && film.displayOrder != null)
    .map((film) => {
      const meta = [film.year, film.role ? english(`roles.${film.role}`) : ""].filter(Boolean).join(" · ");
      const slug = film.id;
      return `        <li><a href="/#film-${escapeHTML(slug)}">${escapeHTML(film.title)}${meta ? ` (${escapeHTML(meta)})` : ""}</a></li>`;
    })
    .join("\n");

  return `<noscript class="poster-static-fallback" aria-label="${escapeHTML(english("work.title"))}">\n      <ul class="poster-static-list" role="list">\n${items}\n      </ul>\n    </noscript>`;
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

// Keep the initial HTML aligned with the translations that the admin edits.
// The browser replaces these blocks when the visitor switches language.
function injectTranslatedFallback(page, key, lang, transform = value => value) {
  const file = resolve(ROOT, page);
  const begin = `<!-- i18n-fallback:${key} -->`;
  const end = `<!-- /i18n-fallback:${key} -->`;
  const html = readFileSync(file, "utf8");
  const from = html.indexOf(begin);
  const to = html.indexOf(end, from + begin.length);
  const phrase = localized(key, lang);
  if (from < 0 || to < 0 || !phrase) throw new Error(`${page}: missing fallback markers or translation ${key}.${lang}`);
  const content = transform(phrase);
  writeFileSync(file, html.slice(0, from + begin.length) + "\n" + content + "\n" + html.slice(to));
  console.log(`  ✓ ${key} fallback injected into ${page}`);
}

function syncPageMetadata(page, lang, titleKey, descriptionKey) {
  const file = resolve(ROOT, page);
  let html = readFileSync(file, "utf8");
  const title = localized(titleKey, lang);
  const description = localized(descriptionKey, lang);
  if (!title || !description) throw new Error(`${page}: missing metadata translations`);
  if (!/<title>[^<]*<\/title>/.test(html)) throw new Error(`${page}: missing title tag`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHTML(title)}</title>`);
  for (const [attribute, key, value] of [
    ["name", "description", description],
    ["property", "og:title", title],
    ["property", "og:description", description],
  ]) {
    const tag = new RegExp(`<meta ${attribute}="${key}" content="[^"]*"\\s*/>`);
    if (!tag.test(html)) throw new Error(`${page}: missing ${key} tag`);
    html = html.replace(tag, `<meta ${attribute}="${key}" content="${escapeHTML(value)}" />`);
  }
  writeFileSync(file, html);
  console.log(`  ✓ translated metadata injected into ${page}`);
}

// ─── run ───────────────────────────────────────────────────────────────────
console.log("Generating SEO artifacts…\n");
const site = loadJSON("data/site.json");
const films = loadJSON("data/films.json");

writeRobots();
writeSitemap();
injectLD(buildJSONLD(site, films));
injectFallback(buildStaticFallback(films));
injectTranslatedFallback("index.html", "about.body", "en");
injectTranslatedFallback("legal.html", "legal.body", "es", body => {
  if (!site.contact?.email) throw new Error("Site contact email is required for the legal notice");
  const placeholder = '<a data-site-email href="mailto:"></a>';
  if (!body.includes(placeholder)) throw new Error("Legal notice is missing its email placeholder");
  const email = escapeHTML(site.contact.email);
  return body.replaceAll(placeholder, `<a data-site-email href="mailto:${email}">${email}</a>`);
});
syncPageMetadata("index.html", "en", "meta.title", "meta.description");
syncPageMetadata("legal.html", "es", "legal.title", "legal.description");

console.log("\n✓ SEO generation complete.");
