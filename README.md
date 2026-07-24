# Tarek Recolons — Portfolio

Static portfolio site. No build step, no framework, no tracking, no cookies.

**Live:** https://tarekrecolons.pages.dev
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
| `index.html` | Single-page bio + work credits + kit + contact |
| `showcase.html` | Visual projects gallery (folder grid → per-project photos) |
| `partners.html` | Partners & Credits (equipment houses, DPs, rental partners) |

## File map

```
cinema-lighttech-portfolio/
├── index.html                  ← THE page. All sections. Single file.
├── showcase.html               ← Visual projects gallery (folder grid + per-project)
├── partners.html               ← Partners & Credits (equipment houses, DPs, rental)
├── codebase_index.json         ← AI navigation map (read first in AI sessions)
├── data/
│   ├── i18n.json               ← EN + ES UI strings (~80 keys)
│   └── content.json            ← Structured content: work, kit, showcase, partners, contact
├── assets/
│   ├── css/
│   │   ├── base.css            ← mobile-first layout + components
│   │   ├── showcase.css        ← showcase page styles (grid, cards, lightbox)
│   │   ├── tungsten.css        ← default theme (cinematic warm)
│   │   └── anamorphic.css      ← alt theme (cool anamorphic look)
│   ├── js/
│   │   ├── main.js             ← i18n + theme + nav + kit filter
│   │   ├── showcase.js         ← showcase render + lazy load + lightbox + hash routing
│   │   └── partners.js         ← partners render (typed, language-aware)
│   ├── images/                 ← hero photo + og-image
│   └── projects/               ← ONE folder per project (cover + photos)
│       ├── saw-2026/
│       │   ├── cover.svg       ← folder cover (replace with cover.jpg when ready)
│       │   ├── photo-01-bts.svg
│       │   ├── photo-02-bts.svg
│       │   └── ...
│       └── els-mals-noms-2025/
│           └── ...
└── scripts/
    └── generate-placeholders.mjs   ← regenerates SVG placeholders (idempotent)
```

## Editing content

| Change | Where |
|---|---|
| Bio text | `data/i18n.json` → `en.about.body` and `es.about.body` |
| Add/remove credit row | `data/content.json` → `work[]` array |
| Update kit item | `data/content.json` → `kit[]` array |
| Add/update contact link | `data/content.json` → `contact{}` |
| Update stats (years, films, etc.) | `data/content.json` → `stats{}` |
| Add/remove/update a showcase project | `data/content.json` → `showcase[]` array |
| Add a translation key | `data/i18n.json` (both `en` and `es`) + `data-i18n="key"` in HTML |
| Switch default theme | `index.html` → `<link id="theme-css" ...>` |

### Tarek's edit flow (the simple model)

The content lives in two files:

1. **`data/content.json`** — structured content Tarek edits on his phone
   (work credits, kit items, contact info, showcase projects).
2. **`data/i18n.json`** — UI strings in EN/ES (nav labels, hero copy, about body).
   Tarek doesn't usually need to touch this.

Workflow when Tarek finishes a new film:

1. Tarek opens `data/content.json` in any text editor on his phone.
2. Copies the last `work` row, edits year/title/role.
3. Sends the file to rubereco on Telegram.
4. rubereco commits + pushes. Live in ~30s.

Photos work differently:

1. Tarek sends photos on Telegram (BTS, stills, process — anywhere on set).
2. rubereco resizes, names them, drops them in `assets/projects/<slug>/`.
3. rubereco updates `data/content.json` paths.
4. rubereco commits + pushes.

Tarek never touches git, the terminal, or image tooling.

### `data/content.json` schema

```jsonc
{
  "contact": { "email", "imdbId", "instagram" },
  "stats":   { "yearsExperience", "featureFilms", "availability" },
  "work":    [ { "year", "project", "role", "production", "type" }, ... ],
  "kit":     [ { "name", "category" }, ... ],   // category: led | hmi | grip | distro
  "showcase":[
    {
      "slug", "title", "year", "role", "director", "status",   // status: in-production | released
      "cover": "assets/projects/<slug>/cover.jpg",
      "summary": { "en": "...", "es": "..." },
      "photos": [ { "src", "kind", "caption" }, ... ]            // kind: bts | still | process
    }
  ]
}
```

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

To set a build-time default, change the `href` of the `<link id="theme-css">` element in `index.html` (or `showcase.html`).

## Showcase page

`showcase.html` is a visual projects gallery — a separate page from `index.html` so the work-credit table stays scannable for SEO/crawlers/agencies.

- **Folder grid** (`showcase.html`): one card per project, cover image dominant, year stripe, title, role, status badge ("In production" amber / "Released" subtle).
- **Per-project view** (`showcase.html#<slug>`): hero cover, title block, photo grid with tabs (All / BTS / Stills / Process), click any photo to open the lightbox. Keyboard nav (←/→/Esc).
- **Hash routing** means `showcase.html#saw-2026` is a shareable link to that project — useful for "send me the Saw BTS shots" emails.

### Image loading strategy (progressive)

The site is photo-heavy on the showcase page. To keep it fast:

1. **IntersectionObserver** — `<img>` tags only get a real `src` once they're within 200px of the viewport. Off-screen images cost nothing.
2. **Responsive `srcset`** — for real `.jpg/.webp` photos, the JS automatically generates `srcset` with 400/800/1200 widths so phones don't download desktop-sized files. Naming convention: drop in `photo-01-bts-400.jpg`, `-800.jpg`, `-1200.jpg` next to `photo-01-bts.jpg`.
3. **`loading="lazy"` + `decoding="async"`** as fallbacks.
4. **Opacity fade-in** on load to avoid layout pop-in.
5. **LQIP / blur-up** — the CSS has the hook (`background: var(--c-surface-2)` placeholder); for real blur-up, set `data-lqip` on each photo with a tiny base64 thumbnail and the JS will set it as `background-image` while the real image loads.

## Deploy

`git push` to `main` on github.com → Cloudflare Pages deploys in ~30 seconds.

To rollback: Cloudflare dashboard → Pages → `cinema-lighttech-portfolio` → Deployments → click any past deployment → "Roll back to this deploy".

## Preview locally

```bash
cd cinema-lighttech-portfolio
python3 -m http.server 8000
# Open http://localhost:8000/showcase.html in any browser
```

No build step, no `npm install`. Just a static file server.

## Open decisions (with Tarek)

- Confirm the real contact email (currently placeholder `contact@tarekrecolons.com`)
- Decide hero photo: keep BTS / swap to portrait / drop background
- Confirm bio voice (1st vs 3rd person; longer version?)
- Confirm or trim the 11 credits to 6–8 for the public cut
- Showreel: Vimeo/YouTube embed vs self-hosted (R2) — depends on trailer licensing
- Pick the real domain (`tarekrecolons.com` vs other)
- Decide which 3–6 projects get initial showcase folders

## What this site does NOT do (deliberate)

- No analytics, no cookies, no third-party requests beyond Google Fonts.
- No JavaScript framework, no Tailwind, no build step. Raw, fast, modifiable.
- No CMS. Content lives in `data/content.json` + `index.html` — change it in any text editor.
- No "AI chatbot" or generated copy.
- No drag-and-drop file upload UI (deliberately — adds complexity without enough value at 2-3 updates/year).

If any of those become hard requirements later, that's a separate decision.