# Bug Fixes & UI Cleanup

Three small items to verify or fix.

## 1. Verify local environment fix (file:// preview)

**Background:** Today (2026-07-04) the user reported the site didn't load when opened directly from Explorer (`file://` URL). The fix: inlined `data/content.json` + `data/i18n.json` into `<script type="application/json">` blocks in both `index.html` and `showcase.html`. Fetch path remains as a fallback.

**Verify with the user on their Windows machine (not the WSL sandbox):**
- [ ] Open `index.html` directly from disk in Chrome → renders fully (cover, work table, kit, contact, language toggle)
- [ ] Open `showcase.html` directly → renders the folder grid
- [ ] Click a folder card → opens project view
- [ ] Open `showcase.html#calladita-2023` directly → lands on Calladita's project view
- [ ] Open `showcase.html#<any-slug>` directly → renders that project
- [ ] Open `index.html` in Firefox + Edge → both work
- [ ] Hard-refresh isn't required — inlined data is in the HTML itself, no cache concern

**If something still doesn't work:**
- Open browser devtools → Console tab → check for errors
- Most likely culprit: a relative path wrong on `file://` (e.g. `./assets/...` vs `assets/...`)
- Or a service-worker / cache leftover from a previous deploy
- Or the inlined JSON blocks were missed by `scripts/inline-content.mjs` (run it again)

## 2. Verify language toggle (EN/ES)

**Background:** Language toggle was working in the live site (saw "PROYECTOS", "SOBRE MÍ", etc. in Spanish on the desktop screenshot). But the user reports it's not working — possibly on the local file:// preview, or only on specific pages, or only with certain keys.

**Verify on the live site AND on local file://:**
- [ ] On `index.html` (live + local): click `EN` → `ES`, confirm hero / work / kit / contact / footer / nav all translate
- [ ] On `showcase.html` (live + local): confirm back link, project meta, photo alt text translate
- [ ] localStorage persists the choice across page navigation
- [ ] `<html lang>` attribute updates correctly (matters for SEO + accessibility)
- [ ] On refresh, the saved language persists

**Common failure modes:**
- `data/i18n` inline block missing or corrupted → fallback to fetch fails on file://
- i18n key typo (e.g. `nav.work` vs `nav.works`) → HTML shows raw key
- HTML element missing `data-i18n` attribute → never translates
- i18n key exists in EN but missing in ES → falls back to EN silently (check console)

**Diagnostic:**
- Open devtools → Console → look for `[i18n]` warnings
- Open devtools → Elements → check if `data-i18n` elements have the expected translated text

## 3. Remove "Change Theme" button (Tungsten / Anamórfico)

**Background:** The current site has a theme picker in the nav with two options: **Tungsten** (amber/dark) and **Anamórfico** (cyan/cool). User wants the picker removed entirely. Site ships with one theme (Tungsten, the current default).

**Tasks:**
- [ ] Remove theme-picker markup from `index.html` and `showcase.html`
- [ ] Remove `assets/css/anamorphic.css` from `<link>` tags (keep the file in git history as a reference, or delete entirely)
- [ ] Remove the `data-theme` switching JS from `assets/js/main.js`
- [ ] Remove the "Anamórfico" / "Tungsten" labels + theme-toggle keys from `data/i18n.json`
- [ ] Remove the theme label / switch element from the nav
- [ ] Remove `theme.toggleLabel` and similar i18n keys
- [ ] Verify default theme (`tungsten`) renders correctly across both pages

**Decisions:**
- Keep or delete `anamorphic.css`? Recommendation: keep in repo (history) but remove from active links. If Anamórfico ever returns, the styles are still there.
- Keep or delete the `data-theme` attribute on `<html>`? Recommendation: keep it (set to "tungsten" always) — useful if themes come back.

**Verify after removal:**
- No console errors
- No leftover CSS classes / markup referencing themes
- Nav looks clean without the picker

## Affected files

- `index.html` — verify everything works + remove theme picker
- `showcase.html` — verify everything works + remove theme picker
- `assets/js/main.js` — remove theme switching logic
- `assets/css/anamorphic.css` — optional delete
- `data/i18n.json` — remove theme keys
- `scripts/inline-content.mjs` — re-run to update inline blocks

## Status

Item 1 (local env) likely already fixed — needs verification with user. Item 2 (lang toggle) needs verification — might be working. Item 3 (theme button) is a small cleanup.