# Remove obsolete photo category tabs (BTS / Stills / Process) from project pages

Project pages in `showcase.html` currently have 4 filter tabs above the photo grid: **All · BTS · Stills · Process**. These were inherited from a generic photo-gallery pattern but don't add value for a portfolio where each project has 5–8 carefully curated photos that should all show by default.

## Tasks

- [ ] **Delete tab markup** from `showcase.html` (the `<nav class="project-tabs">` element and its 4 tab buttons).
- [ ] **Delete tab-render JS** from `assets/js/showcase.js`:
  - Remove the `renderProjectTabs()` function (if exists)
  - Remove the filter logic that hides/shows photo tiles based on tab state
  - Remove any state variable for `activeTab`
- [ ] **Remove i18n keys** from `data/i18n.json`:
  - `showcase.tabAll`
  - `showcase.tabBts`
  - `showcase.tabStill`
  - `showcase.tabProcess`
- [ ] **All photos show in a single flat grid** (the existing masonry / uniform grid layout — no filter UI).
- [ ] **Update lightbox keyboard shortcuts doc** if it referenced tab switching (probably doesn't).
- [ ] **Verify:**
  - Photo grid renders all photos on initial load
  - Lightbox still works (click photo → fullscreen → arrows / Esc)
  - No console errors after removal
  - Mobile + desktop layouts look good without the tabs row
- [ ] **Run `scripts/inline-content.mjs`** to remove the deleted i18n keys from inlined JSON.

## Why this change

- The category system forces every photo into a bucket, but the photo sets are small enough that filtering adds friction.
- The portfolio's visual story per project reads better as a sequence than as grouped sets.
- Fewer clicks for visitors = better portfolio browsing.

## Affected files

- `showcase.html` — remove tab markup
- `assets/js/showcase.js` — remove tab logic
- `data/i18n.json` — remove 4 keys
- `assets/css/showcase.css` — possibly remove `.project-tabs` styles (cosmetic)
- `scripts/inline-content.mjs` — re-run

## Status

Pending. Small, contained change — 30 minutes of work.