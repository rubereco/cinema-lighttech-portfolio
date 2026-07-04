# Bug fixes & UI cleanup

Three small items.

## 1. Fix local environment (verify the `file://` fix landed correctly)

**Background:** Today (2026-07-04) the user reported the site didn't load when opened directly from Explorer (`file://` URL). We fixed it by inlining `data/content.json` + `data/i18n.json` into `<script type="application/json">` blocks in both `index.html` and `showcase.html`. The fetch path remains as a fallback.

**Verify:**
- [ ] Open `index.html` directly from disk in Chrome and Firefox → both should render fully (cover, work table, kit, contact, language toggle)
- [ ] Open `showcase.html` directly → should render the folder grid + clicking a folder opens the project view
- [ ] Open `showcase.html#calladita-2023` directly → should land on Calladita's project view
- [ ] Test on the user's Windows machine (not the WSL sandbox) to confirm no path issues
- [ ] Confirm hard-refresh isn't required — inlined data is in the HTML itself, no cache concern

**If something still doesn't work:**
- Open browser devtools → Console tab → look for errors
- Most likely culprit: a relative path that's wrong on `file://` (e.g. `./assets/...` vs `assets/...`)
- Or a service-worker / cache leftover from a previous deploy

## 2. Fix language toggle (verify EN/ES works end-to-end)

**Background:** Language toggle was working in the live site today (saw "TAREK RECOLONS", "PROYECTOS", etc. in Spanish on desktop). But the user reports it's not working — possibly on the local file:// preview, or only on specific pages.

**Verify:**
- [ ] On `index.html` (live): click `EN` → `ES`, confirm hero/work/kit/contact/footer all translate
- [ ] On `showcase.html` (live): confirm tab labels, back link, and project meta translate
- [ ] On `index.html` (local file://): same toggle, no errors in console
- [ ] Check localStorage persists the choice across page navigation
- [ ] Check `<html lang>` attribute updates correctly (matters for SEO + accessibility)
- [ ] On refresh, does the saved language persist?

**Common failure modes:**
- `data/i18n` inline block missing or corrupted → fallback to fetch fails on file://
- i18n key typo (e.g. `nav.work` vs `nav.works`) → HTML shows raw key
- HTML element missing `data-i18n` attribute → never translates

## 3. Remove old UI: "Change Theme" button

**Background:** The current site has a theme picker in the nav with two options: **Tungsten** (amber/dark) and **Anamórfico** (cyan/cool). Tarek wants the picker removed entirely. The site should ship with one theme (presumably Tungsten, the current default).

- [ ] Remove theme-picker markup from `index.html` and `showcase.html`
- [ ] Remove `assets/css/anamorphic.css` from the project (or keep the file as a reference)
- [ ] Remove the `data-theme` switching JS from `assets/js/main.js`
- [ ] Remove the "Anamórfico" / "Tungsten" labels from `data/i18n.json`
- [ ] Remove the theme label / switch from the nav
- [ ] Verify default theme (`tungsten`) renders correctly across both pages

**Optional:** if Anamórfico ever comes back as a "dark/light" toggle, keep `anamorphic.css` in git history but remove from active links.

## Status

Item 1 likely resolved today (verify with user). Items 2 and 3 need user-side verification + 10 minutes of cleanup work.