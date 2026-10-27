# Admin setup and editing

The `/admin/` page runs Decap CMS. `config.yml` points to the GitHub repository and the OAuth Worker at `https://oauth.recalone.com`. Editors need repository access through GitHub. OAuth secrets are held by the Worker; see `cloudflare-worker/wrangler.toml` for its configuration.

The Worker sends login tokens only to its approved admin origins and checks the GitHub OAuth state. Its defaults cover `recalone.com`, `www.recalone.com`, and the production `tarekrecolons.pages.dev` URL. To sign in from a specific Cloudflare preview URL, add that exact HTTPS origin to the Worker's comma-separated `ADMIN_ORIGINS` variable and redeploy the Worker. The Worker code change also requires a separate Worker deployment; a Pages build alone does not update it.

Cloudflare Pages must run `npm run build` and publish the repository root, where `index.html` lives. Decap's editorial workflow publishes source JSON to GitHub; Pages then builds and deploys the updated static site. The public site reads the generated JSON on the next load.

## Editing guide

- **Películas:** Add or edit one file per film. The `id` must match the filename. Enter title, year, type, Tarek's role, poster, order, and optional HTTPS trailer URL. Give each visible film a unique `displayOrder`. Clearing it hides that film from Selected Work. Delete a film to remove it from the built list.
- **Trailer URL:** YouTube and Vimeo are embedded and autoplay muted in the detail modal. Vimeo unlisted links must keep their full privacy hash. RTVE, IMDb and future providers open from a link in the modal. A blank URL leaves the poster visible.
- **Personas:** Add partner people and choose their categories directly. No job records or film-credit links are needed.
- **Empresas:** Edit company names, logos, links and other details in `data/companies.json`.
- **Hero carrusel:** Large photos appear on desktop and mobile. Small photos appear in the desktop hero and in both About carousels. Give every photo a unique ID. For each small photo, add matching `about.photo.<id>.alt` English and Spanish text under **Traducciones** before publishing.
- **Traducciones:** Each entry in `data/i18n.json` has one key and English and Spanish values. The About and legal page body values contain HTML, so edit those carefully. The same file is used on both pages.
- **Sitio:** Contact links are stored in `data/site.json`. Changing the email also updates both language versions of the legal notice.

After publishing, check the GitHub/Cloudflare Pages build. A duplicate film order, an invalid trailer URL or an ID/filename mismatch will stop the build and leave the last deployed version live.
