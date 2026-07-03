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

## File map

```
cinema-lighttech-portfolio/
├── index.html                  ← THE page. All sections. Single file.
├── codebase_index.json         ← AI navigation map (read first in AI sessions)
├── data/
│   └── i18n.json               ← EN + ES translations (~64 strings)
├── assets/
│   ├── css/
│   │   ├── base.css            ← mobile-first layout + components
│   │   ├── tungsten.css        ← default theme (cinematic warm)
│   │   └── anamorphic.css      ← alt theme (cool anamorphic look)
│   ├── js/
│   │   └── main.js             ← i18n + theme + nav + kit filter
│   └── images/
│       ├── hero-forest.jpg     ← BTS photo
│       └── og-image.svg        ← 1200×630 OG image for link previews
└── README.md
```

## Editing content

| Change | Where |
|---|---|
| Bio text | `data/i18n.json` → `en.about.body` and `es.about.body` |
| Add/remove credit row | `index.html` → `<tbody>` of `#work` |
| Update kit item | `index.html` → `<li class="kit-item" data-cat="...">` |
| Add a translation key | `data/i18n.json` (both `en` and `es`) + `data-i18n="key"` in `index.html` |
| Switch default theme | `index.html` → `<link id="theme-css" ...>` |

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

## Open decisions (with Tarek)

- Confirm the real contact email (currently placeholder `contact@tarekrecolons.com`)
- Decide hero photo: keep BTS / swap to portrait / drop background
- Confirm bio voice (1st vs 3rd person; longer version?)
- Confirm or trim the 11 credits to 6–8 for the public cut
- Showreel: Vimeo/YouTube embed vs self-hosted (R2) — depends on trailer licensing
- Pick the real domain (`tarekrecolons.com` vs other)

## What this site does NOT do (deliberate)

- No analytics, no cookies, no third-party requests beyond Google Fonts.
- No JavaScript framework, no Tailwind, no build step. Raw, fast, modifiable.
- No CMS. Content lives in `index.html` — change it in any text editor.
- No "AI chatbot" or generated copy.

If any of those become hard requirements later, that's a separate decision.