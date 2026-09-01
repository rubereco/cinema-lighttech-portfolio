# Tarek Recolons — Portfolio

Static portfolio site. No build step, no framework, no tracking, no cookies.

**Live:** https://recalone.com
**Repo:** https://github.com/rubereco/cinema-lighttech-portfolio

## Stack

- HTML + CSS + vanilla JS
- Cloudflare Pages (auto-deploy from this repo)
- Cloudflare R2 (planned) for video files
- **Mobile-first layout**; desktop kicks in at `min-width: 900px`
- **English + Spanish** translations via `data/i18n.json`

## Pages

| Page | What it shows |
|---|---|
| `index.html` | Single-page bio + work credits + partners + contact |

## File map

```
cinema-lighttech-portfolio/
├── index.html                  ← THE page. All sections. Single file.
├── codebase_index.json         ← AI navigation map (read first in AI sessions)
├── data/
│   ├── i18n.json               ← EN + ES UI strings (~80 keys)
│   ├── site.json               ← brand, contact, stats
│   ├── people.json             ← people entries (id, name, kind, portrait …)
│   ├── films.json              ← canonical film records (id, title, year, role, type, credits)
│   ├── work.json               ← ordered list of `{filmId}` rows for the index work table
│   ├── kit.json                ← equipment items for the rental section
│   └── companies.json          ← partner companies (equipment houses, commercial partners)
│
│  (no partners.json — the “Partners” section composes people + companies)
├── assets/
│   ├── css/
│   │   ├── base.css            ← mobile-first layout + components
│   │   ├── tungsten.css        ← default theme (cinematic warm)
│   │   └── anamorphic.css      ← alt theme (cool anamorphic look)
│   ├── js/
│   │   ├── main.js             ← i18n + theme + nav + kit filter
│   │   └── partners.js         ← partners render (typed, language-aware)
│   ├── images/                 ← hero photo + og-image
│   └── projects/               ← ONE folder per project (poster + photos)
│       ├── saw-2026/
│       │   └── poster.jpg
│       └── els-mals-noms-2025/
│           └── ...
├── admin/                      ← Decap CMS admin panel (Phase 1)
│   ├── index.html              ← Decap CMS loader (visits /admin)
│   ├── config.yml              ← editable content schemas
│   └── SETUP.md                ← one-time setup guide
├── cloudflare-worker/          ← OAuth proxy for /admin (separate deploy)
│   ├── oauth-proxy.js          ← Worker code
│   └── wrangler.toml           ← deploy config
└── scripts/
    ├── inline-content.mjs      ← inlines each data/*.json into its own <script> block per page
    └── generate-placeholders.mjs   ← regenerates SVG placeholders (idempotent)
```

The site reads `data/*.json` as a **lite database**: people, films, and credits are
referenced by stable IDs (e.g. `credits.director: ["marc-ortiz-prades"]` walks through
`data/people.json` to render the name). To add a new director once, you add them to
`people.json`; every film that references their ID picks them up automatically.

## Editing content

You have two options:

**A) Admin panel (recommended for non-developers)** — go to `recalone.com/admin`, log in with GitHub, edit visually. Changes commit to the repo and the site rebuilds automatically. See `admin/SETUP.md` for the one-time setup.

**B) Direct file edit** — for small changes, edit the JSON files in `data/` directly. The data files are the source of truth; the admin panel just provides a UI on top of them.

| Change | Where (file edit) |
|---|---|
| Bio / UI strings (EN + ES) | `data/i18n.json` |
| Site-wide config (contact email, stats, brand) | `data/site.json` |
| Add a new person (director, DP, gaffer, collaborator) | `data/people.json` → append a `{id, name, kind, portrait?}` entry |
| Add a new partner company | `data/companies.json` → append a `{id, name, kind, logo, ...}` entry |
| Add a new film (canonical record: title, year, role, type, credits) | `data/films.json` → append a `{id, title, year, role, type, credits}` entry |
| Show a film in the work-table view | `data/work.json` → append `{filmId: "<film.id>"}` |
| Add a new partner-page section (e.g. "Sponsors") | `assets/js/partners.js` → `CATEGORIES` + i18n key |
| Add a translation key | `data/i18n.json` (both `en` and `es`) + `data-i18n="key"` in HTML |
| Switch default theme | `index.html` → `<link id="theme-css" ...>` |

### Person-IDs are stable

Every person has an ID (e.g. `marc-ortiz-prades`, `tarek-recolons`). Films reference
people by ID, so updating a director's name or portrait in `data/people.json`
propagates to every film they're credited on. To rename / rebrand a director: edit
`name` in `people.json` and that's it — no film-by-film updates.

The `id` should be kebab-case, ASCII-only, and not start with a digit. If the ID is
unknown, the renderer falls back to displaying the raw ID string (visible in
production until you fix it).

### Tarek's edit flow (the simple model)

The content is split across multiple files, one per concern. Tarek edits the
ones relevant to his work:

1. **`data/films.json`** — when he finishes a film, Tarek appends a record
   `{id, title, year, role, type, credits}` (id is the kebab-cased title+year).
2. **`data/work.json`** — appends `{filmId: "<that id>"}` to the row list,
   in the order he wants on screen.
3. **`data/people.json`** — only when there's a new director/DP/gaffer he
   wants to list. Tarek himself is already there (`tarek-recolons`).
4. **Photos** — Tarek sends BTS photos on Telegram → owner drops them in
   `assets/projects/<slug>/photo-NN-kind.{svg,jpg,webp}` and references them in
   the project folder.

The other files (`site.json`, `kit.json`, `companies.json`, `i18n.json`)
change rarely; the owner edits them on demand.

### Schema quick reference

```jsonc
// data/people.json
{
  "_meta": { "version": "1.0", "lastUpdated": "2026-07-27" },
  "people": [
    {
      "id":   "tarek-recolons",
      "name": "Tarek Recolons",
      "kind": "subject",                 // subject | director | dop | gaffer | electric | …
      "portrait": null,                  // path string when Tarek adds a portrait
      "imdb": "nm5007366", "imdbUrl": "…",
      "instagram": "tarekreco", "instagramUrl": "…"
    }
  ]
}

// data/films.json
{
  "_meta": { "version": "1.0", "lastUpdated": "2026-07-27" },
  "films": [
    {
      "id":    "els-mals-noms-2025",
      "title": "Els Mals Noms",
      "year":  2025,
      "role":  "Gaffer",                // Tarek's role on this production
      "type":  "Largometraje",          // Largometraje | Serie TV | Cortometraje
      "credits": {
        "production": ["Lamalanga Produccions Audiovisuals", "Admirable Films"],
        "director":   ["marc-ortiz-prades"],   // ← people.json ids, not display names
        "dop":        [],
        "gaffer":     ["tarek-recolons"],
        "electrics":  []
      }
    }
  ]
}

// data/work.json
{
  "_meta": { "version": "1.0", "lastUpdated": "2026-07-27" },
  "rows": [                              // ordered; first row first
    { "filmId": "els-mals-noms-2025" },
    { "filmId": "un-altre-home-2025" }
  ]
}

// data/site.json      { brand, contact{email, imdbId, imdbUrl, instagram, instagramUrl}, stats{yearsExperience, featureFilms, availability} }
// data/kit.json       { items: [{ name, category }] }                       // category: led | hmi | grip | distro
// data/companies.json { companies: [{ id, name, kind, logo, logoAlt?, count, description{en,es}, url, urlLabel }] }
// data/i18n.json      { _meta, en: { … }, es: { … } }

// data/people.json (collaborator entries, used in the Partners section):
//   {
//     "id": "juli-carne-martorell",
//     "name": "Juli Carné Martorell",
//     "kind": "collaborator",          // subject | director | dop | gaffer | electric | collaborator
//     "relationship": "dp",            // for kind:collaborator only; dp | electric | …
//                                       // drives which section on the Partners page they fall into
//     "portrait": "assets/images/partners/juli-carne-martorell.jpg",
//     "count": 0,
//     "description": { "en": "…", "es": "…" },
//     "url": "https://example.com",
//     "urlLabel": "Portfolio"
//   }

// The "Partners" section on the index page is a *view*: it composes
// companies + collaborator-people into one page. partners.js owns the
// section config; data ownership lives in the two entity files.
```

### Adding a new film (quick recipe)

1. If the film has a new director or DP, add them to `data/people.json` first.
2. Add the film record to `data/films.json` (id = kebab-cased `title-year`).
3. Add `{filmId: "<that id>"}` to `data/work.json` in the position you want.
4. Run `node scripts/inline-content.mjs` to re-inline the JSON into the HTML
   files (only needed if you're previewing via `file://`; live deploys auto-fetch).
5. Commit + push. Live in ~30s.

## Adding a new translated string

1. Add the key to both `en` and `es` objects in `data/i18n.json`
2. Reference it in HTML: `<span data-i18n="my.new.key">Default English</span>`
3. For HTML content (with `<em>` etc.): use `data-i18n-html="my.new.key"`
4. For attributes (e.g. `aria-label`): use `data-i18n-attr="aria-label:my.new.key"`

## Language behavior

- **Auto-detect from `navigator.language`:** Spanish-speaking browsers get Spanish; everything else gets English.
- **Manual override:** `EN · ES` pill in the header; choice is persisted in `localStorage`.
- **Force a default per page:** set `<html lang="es">` (or `en`) at the top.
- **URL param `?lang=es`** overrides everything (useful for sharing a Spanish link).

## Mobile-first behavior

- Default styles target **phone (≤720px)** — touch targets ≥44px, single-column layouts, hamburger nav.
- `@media (min-width: 900px)` blocks restore desktop: full nav inline, table layout for credits, 2-column about, 3-column kit grid, multi-column contact list.
- `@media (max-width: 720px)` strips hover transitions and animations (no hover on phones anyway).

## Theme swap

Header has a small `⇄` button cycling between **Tungsten** (warm gold) and **Anamorphic** (cool cyan). Saved to `localStorage`.

To set a build-time default, change the `href` of the `<link id="theme-css">` element in `index.html`.

## Deploy

`git push` to `main` on github.com → Cloudflare Pages deploys in ~30 seconds.

To rollback: Cloudflare dashboard → Pages → `cinema-lighttech-portfolio` → Deployments → click any past deployment → "Roll back to this deploy".

## Preview locally

```bash
cd cinema-lighttech-portfolio
npm run build   # aggregates data/films/ + data/people/ → data/*.json
python3 -m http.server 8000
# Open http://localhost:8000 in any browser
```

The build step (v3.14.16+) regenerates `data/films.json` and `data/people.json`
from the folder-based collections that the Decap admin edits. It's idempotent,
takes <1 second, requires Node 18+. If you skip the build, you'll see stale
data on the local preview.

## Build step (Cloudflare Pages)

The Cloudflare Pages project for this site must have its build command set
to `npm run build` (Settings → Builds & deployments → Build command).
Without it, the live site keeps serving the old single-file aggregates even
after Tarek publishes new entries through the admin.

## Open decisions (with Tarek)

## Open decisions (with Tarek)

- Decide hero photo: keep BTS / swap to portrait / drop background
- Confirm bio voice (1st vs 3rd person; longer version?)
- Confirm or trim the 11 credits to 6–8 for the public cut
- Showreel: Vimeo/YouTube embed vs self-hosted (R2) — depends on trailer licensing
- ~~Pick the real domain (`tarekrecolons.com` vs other)~~ — resolved 2026-08-05: domain is `recalone.com`

## What this site does NOT do (deliberate)

- No analytics, no cookies, no third-party requests beyond Google Fonts.
- No JavaScript framework, no Tailwind, no build step. Raw, fast, modifiable.
- No "AI chatbot" or generated copy.
- No drag-and-drop file upload UI (deliberately — adds complexity without enough value at 2-3 updates/year).

## Content management (CMS)

A Decap CMS admin panel is available at `/admin` (Phase 1, see `docs/issues/08-git-based-cms.md`). Tarek (or any GitHub collaborator on this repo) can log in via GitHub OAuth and edit films, work order, people, companies, site config, and translations from a web UI. Changes commit directly to this repo → Cloudflare Pages rebuilds → site updates in ~30-60s. No database.

The OAuth handshake is brokered by a Cloudflare Worker (see `cloudflare-worker/oauth-proxy.js`). Setup steps in `admin/SETUP.md`.

If any of those become hard requirements later, that's a separate decision.