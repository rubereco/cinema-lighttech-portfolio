# Implement Git-based CMS (Decap / TinaCMS / Sanity)

**Context:** Current maintenance model is **Option A** (agreed 2026-07-03): Tarek edits `data/content.json` on his phone, sends the file to rubereco via Telegram, rubereco resizes photos + commits + pushes. This works but requires rubereco as a bottleneck for every change.

**Goal:** Replace (or augment) Option A with a Git-based CMS that lets Tarek self-serve changes (add a film, swap cover photos, update partner list, change role credits) without code or git knowledge.

## Three options to evaluate

### Option 1: Decap CMS (formerly Netlify CMS) — **recommended**

- **Pros:** Mature, free, open source, no backend required. Git-based — commits directly to the repo, triggering Cloudflare Pages rebuilds automatically. Supports image upload (writes files into the repo). Works with any static host.
- **Cons:** Admin UI requires a login. Decap needs GitHub OAuth to authenticate the editor (i.e. Tarek). User said "don't want a public web-login" — but Decap's login is private-by-default (you whitelist GitHub usernames, no public signup). Tarek would log in via GitHub → only he can access.
- **Setup:** Add `admin/` folder with `index.html` + `config.yml`, deploy as `/admin` route on Cloudflare Pages.
- **Cost:** Free.
- **Editor UX:** Decent. Markdown editor, image upload, structured fields. Mobile-friendly admin interface.

### Option 2: TinaCMS (self-hosted or Cloud)

- **Pros:** Modern UI, real-time visual editing (see changes as you type), Git-based commits. Self-hosted = free.
- **Cons:** Self-hosted requires running a Node server (additional infra: e.g. Fly.io, Railway — paid tiers). Cloud version is paid ($29+/month for basic). Cloudflare Pages doesn't host dynamic backends, so self-hosting needs a separate service.
- **Setup:** Either self-host the Tina backend or use the Cloud tier.
- **Cost:** Free (self-hosted, with infra cost) or $29+/month (Cloud).
- **Editor UX:** Best-in-class. Visual editing of live page.

### Option 3: Sanity (hosted structured content)

- **Pros:** Hosted content platform. Structured schemas, real-time updates without rebuilds (can use ISR-style). Free tier covers a small portfolio site.
- **Cons:** **Not Git-based.** Sanity stores content in its own database, not in your repo. You'd need a build step to fetch Sanity content → write to repo → trigger rebuild. Defeats the "no build step" principle the portfolio is built on.
- **Setup:** Requires Cloudflare Pages Function or build step.
- **Cost:** Free for <10K docs, paid tiers after.
- **Editor UX:** Studio UI, good for non-technical editors.

## Recommendation

**Decap CMS** is the best fit because:
- Free and open source
- Git-based (preserves the current "no build step" architecture)
- Direct commit to repo → Cloudflare auto-deploys
- Single auth via GitHub (private, only Tarek has access)
- Self-hosted admin interface runs as a static page on Cloudflare Pages

**Trade-off:** Tarek needs a GitHub account + 5 minutes of setup. After that, he edits through a web UI at `tarekrecolons.com/admin` and changes ship automatically.

## Tasks

- [ ] **Confirm:** does Tarek have a GitHub account?
- [ ] **Auth strategy:** decide between
  - (a) **GitHub OAuth** (Tarek logs in via GitHub — private by default, no public signup)
  - (b) **Netlify Identity** (uses Netlify as auth broker, even if not hosting on Netlify)
  - (c) **Custom OAuth provider** via Cloudflare Worker
  - **Recommendation:** (a) — simplest, no extra services.
- [ ] **Define content schemas** in `admin/config.yml`:
  - `work[]` — main page credits table
  - `showcase[]` — showcase projects (title, year, cover image, photos, description, type, directives, status)
  - `kit[]` — equipment list
  - `partners[]` — partners & credits (see issue #06)
  - `i18n` — translations (or skip — keep as raw JSON edit)
- [ ] **Image handling:** decide where uploaded photos land:
  - (a) Committed to repo (current model — fine for <100 MB total)
  - (b) Pushed to Cloudflare R2 (see issue "Cloudflare R2") for high-res originals
- [ ] **Set up `admin/` folder** with `index.html` + `config.yml`
- [ ] **Configure GitHub OAuth app** for the portfolio domain (callback URL: `https://tarekrecolons.com/admin/callback`)
- [ ] **Document the editor workflow** for Tarek (how to log in, how to add a project, how to upload a photo, what fields are required)
- [ ] **Test end-to-end:** Tarek adds a new work credit via the CMS → repo commit → Cloudflare rebuild → live site updated within 60s

## Migration plan

Keep the Option A flow running in parallel for 2 weeks while Tarek learns the CMS. After confidence is built, retire Option A and have rubereco handle only the photo-resize / commit step (CMS auto-commits raw changes, but raw photos may still need pre-processing).

## Affected files

- `admin/index.html` (new — Decap admin loader)
- `admin/config.yml` (new — content schemas)
- `README.md` — document the new CMS workflow

## Status

Pending user decision (which CMS + auth strategy).