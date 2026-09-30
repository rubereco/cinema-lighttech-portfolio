# Tarek Recolons portfolio

Static portfolio for Cloudflare Pages, with a Decap CMS editor at `/admin/`. The content store remains JSON. No database service is required.

## How an admin edit reaches the site

1. Decap CMS uses GitHub sign-in through the OAuth Worker configured in `admin/config.yml`.
2. An editor changes a JSON file and publishes it through the configured editorial workflow. This commits the change to GitHub.
3. Cloudflare Pages runs `npm run build`. `scripts/build.js` combines `data/films/*.json` into `data/films.json` and `data/people/*.json` into `data/people.json`. `scripts/seo.mjs` refreshes the film fallback, structured data, page metadata, and initial About/legal copy from the translation file.
4. Once Pages deploys the new build, the public JavaScript fetches those JSON files. Visitors see the change on the next page load.

For Cloudflare preview deployments, the build points the preview admin at `CF_PAGES_BRANCH`. Its edits read and publish against that branch. The production admin continues to use `main`, so preview translations are visible in the editor before the PR is merged.

This is deployment-based publishing. Admin edits do not update an already open visitor tab immediately.

## Content map

| Content | Admin collection | Source file | Public reader |
| --- | --- | --- | --- |
| Film, order, role, trailer | Películas | `data/films/<id>.json` | `assets/js/main.js`, `assets/js/film-modal.js` via `data/films.json` |
| Partner people | Personas | `data/people/<id>.json` | `assets/js/partners.js` via `data/people.json` |
| Companies | Empresas | `data/companies.json` | `assets/js/partners.js` |
| Contact links and legal email | Sitio | `data/site.json` | `assets/js/site-content.js` on both pages |
| Hero and About photos | Hero carrusel | `data/hero.json` | `assets/js/hero-carousel.js`, `assets/js/about-carousel.js` |
| English/Spanish copy | Traducciones | `data/i18n.json` | `assets/js/i18n.js` on the home and legal pages |

Film records are independent. They store Tarek's role and an optional trailer URL; there are no film-to-person or film-to-job relations. `displayOrder` controls Selected Work, and leaving it empty hides a film from that carousel. The build rejects duplicate orders and malformed trailer URLs.

YouTube and Vimeo trailers play inside the film modal. Other HTTPS trailer links open at the provider's site. Browsers generally require muted autoplay, so visitors can unmute in the player. A film without a trailer shows its poster.

On phones the hero shows only its large photos. Every small hero photo also appears in About, so a single admin edit updates both carousels. About uses a rotating photo ring on mobile and a dot-controlled slider beside the text on desktop.

## Local work

- Run `npm run build` after changing film or person source files. Configure Cloudflare Pages to run `npm run build` and publish the repository root, where `index.html` lives.
- Serve the repository over HTTP to preview it. Opening `index.html` as a local file cannot fetch the JSON data.
- Keep IDs equal to JSON filenames. Store translated English and Spanish text together as entries in `data/i18n.json`. Use `data-i18n` for plain text and `data-i18n-html` for the About and legal HTML blocks.
- Each translation has an `editorLabel` used only for the Spanish admin list. The hidden `key` links the text to the site; editors change the `en` and `es` values.
- OAuth Worker setup is in `admin/SETUP.md`. Secrets belong in Cloudflare Worker secrets, not the repository.

The navbar currently uses the existing vector mark in `assets/images/favicon.svg` as the Recalone mark. Replace that file if the approved brand logo differs.
