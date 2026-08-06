# Admin panel setup guide

This walks through getting the `/admin` panel live for the first time.
After the first setup, day-to-day usage is just "go to `/admin`, log in, edit".

---

## Cloudflare Pages build command (do this once)

**v3.14.16+ requires a build step.** The Decap admin edits `films` and
`people` as folder-based collections (one file per entry) because the
relation widget doesn't index file-based collections reliably. A tiny
build script (`scripts/build.js`) aggregates those folders back to the
single `data/films.json` and `data/people.json` files the production
site reads.

In the Cloudflare Pages dashboard for this project:
1. Go to **Settings → Builds & deployments**
2. **Build command**: `npm run build`
3. **Build output directory**: `/` (unchanged — site is plain static)
4. **Environment variables**: none required (the Worker handles secrets)
5. Save

If you skip this, the live site will keep serving the old
`data/films.json` / `data/people.json` aggregates even after the admin
publishes new entries. Symptom: admin edits save fine, but the public
site shows stale data.

For local development, just run `npm run build` from the repo root
before opening `index.html` in your browser. The build is idempotent
and takes <1 second.

---

## Prerequisites

- A GitHub account (Tarek or whoever will edit content)
- Cloudflare account (for the OAuth proxy Worker)
- `wrangler` CLI installed locally (`npm install -g wrangler`) — or use the Cloudflare dashboard instead
- Node.js 18+ (only needed locally to run `npm run build`)

## Step 1: Tarek gets a GitHub account

If Tarek doesn't have one yet:
1. Go to https://github.com/signup
2. Pick a username (e.g. `tarekrecolons` or whatever Tarek wants)
3. Use a real email — GitHub sends important security alerts there
4. Free tier is enough

**5 minutes.** Free.

## Step 2: Add Tarek as a collaborator on the repo

1. Go to https://github.com/rubereco/cinema-lighttech-portfolio/settings/access
2. Click "Add people"
3. Enter Tarek's GitHub username
4. Role: "Write" (so he can push commits; he can NOT merge to main without a PR review)
5. Send the invitation

Tarek accepts the email invitation. Now Tarek's GitHub account has push access to the repo.

## Step 3: Create the GitHub OAuth app

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** `Recalone Admin`
   - **Homepage URL:** `https://recalone.com`
   - **Application description:** `Content management for recalone.com`
   - **Authorization callback URL:** `https://oauth.recalone.com/callback` (must match your worker's URL + `/callback` exactly — see step 4)
4. Click "Register application"
5. On the next page, click "Generate a new client secret"
6. **Copy the Client ID and the Client Secret** — you'll need them in Step 4

Keep the client secret in a password manager. Don't commit it.

## Step 4: Deploy the OAuth proxy Cloudflare Worker

Option A: With `wrangler` (faster, recommended)

```bash
cd cloudflare-worker
npm install -g wrangler       # if you don't have it
wrangler login                # authenticate with Cloudflare
wrangler secret put GITHUB_CLIENT_ID        # paste client ID from step 3
wrangler secret put GITHUB_CLIENT_SECRET    # paste client secret from step 3
wrangler deploy
```

Wrangler prints the worker URL (something like `https://decap-oauth-proxy.YOUR-SUBDOMAIN.workers.dev`).

Option B: With the Cloudflare dashboard (no CLI)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create
2. Name: `decap-oauth-proxy`
3. Click "Create Worker"
4. Paste the contents of `cloudflare-worker/oauth-proxy.js`
5. Click "Save and Deploy"
6. Go to Settings → Variables → add:
   - `GITHUB_CLIENT_ID` (text, encrypted)
   - `GITHUB_CLIENT_SECRET` (text, encrypted)
7. Go back to the worker → Triggers → add a custom domain (e.g. `oauth.recalone.com`). The custom domain must match what you put in the GitHub OAuth callback URL exactly.

Either way, you end up with a worker URL.

## Step 5: Update `admin/config.yml` with the worker URL

In `admin/config.yml`, find the `base_url` line and update it:

```yaml
backend:
  name: github
  repo: rubereco/cinema-lighttech-portfolio
  branch: wip/portfolio-r1
  base_url: https://oauth.recalone.com   # ← your worker URL
  auth_endpoint: auth
  open_authoring: false
  squash_merges: true
```

Commit and push this change.

## Step 6: Test the login

1. Go to `https://recalone.com/admin`
2. You should see the Decap CMS login page
3. Click "Login with GitHub"
4. A popup opens with GitHub's authorization screen
5. Click "Authorize"
6. The popup closes, you're in the Decap editor
7. You should see the 6 collections: Films, Work order, People, Companies, Site config, Translations

**If you see "Authentication failed"**: check the browser console for the error. Most common causes:
- `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` not set in the Worker
- The callback URL in the GitHub OAuth app doesn't match the Worker's URL + `/callback`
- You're logged into GitHub as a user that isn't a collaborator on the repo

## Step 7: First end-to-end test

In the Decap editor (with `publish_mode: editorial_workflow` enabled):
1. Click "Work order" → click into the first film row
2. Change the role from "Gaffer" to "Gaffer (test edit)"
3. Click "Save as draft" (top right — NOT "Publish" yet)
4. Decap shows "Saving draft…" — the change goes to a separate draft branch
5. Now make a second change in another collection (e.g. add a new company in Companies)
6. Click "Save as draft" again
7. Click the **Workflow** tab at the top — you'll see both drafts
8. Click **Publish** on one (or use the bulk publish if available) — Decap opens/updates a single PR to wip/portfolio-r1
9. Merge the PR in GitHub (or wait for auto-merge)
10. Cloudflare Pages rebuilds the preview URL with BOTH changes
11. Refresh — both changes should be live

Without editorial_workflow, step 10 would have triggered TWO separate Cloudflare builds (one per save). With it, it's just ONE build for all your changes.

## What to do if something breaks

- **Can't log in** — check the Cloudflare Worker logs (`wrangler tail`) and the browser console. 99% of "can't log in" bugs are either wrong OAuth credentials in the Worker env, or the callback URL mismatch.
- **Save fails with 403/404** — your GitHub account isn't a collaborator on the repo. Add yourself in Step 2.
- **Save succeeds but live site doesn't change** — Cloudflare Pages hasn't rebuilt yet. Wait 60s and hard-refresh. Check the Pages deploy log at https://dash.cloudflare.com → Pages → your project → Deployments. **Also confirm the build command is set to `npm run build`** (see top of this file) — without it, the live site keeps serving the old data/films.json and data/people.json aggregates even after the publish.
- **JSON syntax error in i18n** — roll back via git: `git checkout HEAD~1 -- data/i18n.json`, then commit + push the fix.

## Data model (v3.14.18)

Four collections, fully normalized. No duplication of role info anywhere.

1. **Jobs** (`data/jobs/<id>.json`) — the catalog of possible roles. Each job has:
   - `id` (kebab-case): e.g. `gaffer`, `dop`, `sparks`
   - `name.en` / `name.es`: human-readable, i18n
   - `category`: which department (direction / cinematography / lighting / sound / production / other). Drives the partners page section a jobId falls into.

   Adding a new role is just adding a file: `data/jobs/<id>.json`.

2. **People** (`data/people/<id>.json`) — just a collaborator. Bio + contact + partnership:
   - `partnership` (optional): `{jobIds: [...], since: <year>, description.i18n}` — which jobs this person partners with Tarek in. The partners page shows them in each section that matches their jobIds' categories.
   - `portrait`, `description.i18n` (bio), `imdb`, `instagram`, `url`, `urlLabel`
   - **No `kind` field** — a person is not "a dop" or "a gaffer", they are a person. Their role on a specific film is on that film, not on them.
   - **No `works` field** — the list of films they've worked on is derived from the film credits, no duplication.

3. **Films** (`data/films/<id>.json`):
   - `credits.people`: flat list of `{personId, jobId, description.i18n}` — every credit on this film references a person AND a job. The person can be on a film multiple times if they did multiple jobs.
   - `credits.production`: free-text list of production companies.
   - The film modal groups credits by the jobId's category: direction → Director row, cinematography → DoP row, lighting → split into Gaffer + Electrics rows, etc.

4. **Work order** (`data/work.json`):
   - Unchanged. Ordered list of `{filmId}` rows. Drives the homepage poster wall.

5. **Companies** (`data/companies.json`):
   - Unchanged. Equipment houses, post houses, etc. (not normalized the same way — they're a small fixed list, no need for a folder collection yet.)

**Adding a credit on a film:** open the film → credits → "+ Add person" → pick from the People dropdown → pick a Job from the Jobs dropdown (shows "Director of Photography (cinematography)" so you know what you're picking) → optional i18n description. Doesn't auto-add the person to a partnership.

**Adding a partnership:** open the person → Partnership → set `jobIds` (one or more from the Jobs dropdown) → optional `since` year → optional i18n description. Makes them appear on the partners page in the sections for those jobIds' categories.

These two are independent — a credit on a film does NOT auto-add a partnership, and vice versa. Gives Tarek full control over each separately.

**Current job catalog (15 entries):**

| Category | Jobs |
|---|---|
| Direction | director, assistant-director |
| Cinematography | dop, camera-operator, 1st-ac, 2nd-ac |
| Lighting | gaffer, best-boy-electric, electric, sparks |
| Sound | sound-mixer |
| Production | producer, production-manager |
| Other | writer, editor |

Add more via the admin (Jobs collection) as needed.

## For future work (Phase 2, not now)

- **Cloudflare Access** — move auth entirely to Cloudflare Zero Trust so the `/admin` URL returns 404 to non-team-members. More setup, more secure.
- **Cloudflare R2** — large photo uploads bypass the repo, land in a bucket. Good for >100 MB of photos total.
- **Structured i18n fields** — promote `data/i18n.json` from raw JSON editor to per-key widgets. Useful if Tarek is editing translations often.
- **Film detail per-credit descriptions** — the new `description.i18n` on each film credit is currently collected but not rendered on the public site. Would need a small UI change to show "Marc Ortiz Prades — Director — 'A character study set in Barcelona...'" on the film detail page.
- **Production companies as a Jobs-style collection** — currently `credits.production` is a free-text list. Could be its own folder collection so it's searchable + consistent.
