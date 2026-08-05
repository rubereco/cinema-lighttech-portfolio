# Admin panel setup guide

This walks through getting the `/admin` panel live for the first time.
After the first setup, day-to-day usage is just "go to `/admin`, log in, edit".

---

## Prerequisites

- A GitHub account (Tarek or whoever will edit content)
- Cloudflare account (for the OAuth proxy Worker)
- `wrangler` CLI installed locally (`npm install -g wrangler`) — or use the Cloudflare dashboard instead

## Step 1: Tarek gets a GitHub account

If Tarek doesn't have one yet:
1. Go to https://github.com/signup
2. Pick a username (e.g. `tarekrecolons`)
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
   - **Application name:** `Tarek Recolons Admin`
   - **Homepage URL:** `https://tarekrecolons.com`
   - **Application description:** `Content management for tarekrecolons.com`
   - **Authorization callback URL:** `https://oauth.tarekrecolons.com/callback` (or your worker URL + `/callback`)
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
7. Go back to the worker → Triggers → add a custom domain (e.g. `oauth.tarekrecolons.com`)

Either way, you end up with a worker URL.

## Step 5: Update `admin/config.yml` with the worker URL

In `admin/config.yml`, find the `base_url` line and update it:

```yaml
backend:
  name: github
  repo: rubereco/cinema-lighttech-portfolio
  branch: wip/portfolio-r1
  base_url: https://oauth.tarekrecolons.com   # ← your worker URL
  auth_endpoint: auth
  open_authoring: false
  squash_merges: true
```

Commit and push this change.

## Step 6: Test the login

1. Go to `https://tarekrecolons.com/admin`
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

In the Decap editor:
1. Click "Work order" → click into the first film row
2. Change the role from "Gaffer" to "Gaffer (test edit)"
3. Click "Publish" (or "Save" depending on workflow)
4. Decap shows "Committing…", then "Site is deploying…"
5. Wait 30-60 seconds
6. Refresh `tarekrecolons.com` — the change should be live
7. Revert the change so the site stays clean

If this works, you're done with setup. The whole flow takes ~15-20 minutes once the GitHub account + OAuth app exist.

## What to do if something breaks

- **Can't log in** — check the Cloudflare Worker logs (`wrangler tail`) and the browser console. 99% of "can't log in" bugs are either wrong OAuth credentials in the Worker env, or the callback URL mismatch.
- **Save fails with 403/404** — your GitHub account isn't a collaborator on the repo. Add yourself in Step 2.
- **Save succeeds but live site doesn't change** — Cloudflare Pages hasn't rebuilt yet. Wait 60s and hard-refresh. Check the Pages deploy log at https://dash.cloudflare.com → Pages → your project → Deployments.
- **JSON syntax error in i18n** — roll back via git: `git checkout HEAD~1 -- data/i18n.json`, then commit + push the fix.

## For future work (Phase 2, not now)

- **Cloudflare Access** — move auth entirely to Cloudflare Zero Trust so the `/admin` URL returns 404 to non-team-members. More setup, more secure.
- **Cloudflare R2** — large photo uploads bypass the repo, land in a bucket. Good for >100 MB of photos total.
- **Structured i18n fields** — promote `data/i18n.json` from raw JSON editor to per-key widgets. Useful if Tarek is editing translations often.
