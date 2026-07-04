# Showcase "Unreleased" work: visual indicator for finished-but-unpublished films

Currently `showcase[]` items have a `status` field with two values: `released` or `in-production`. Add a third state: **`unreleased`** — for films Tarek has wrapped but that haven't premiered yet (post-production, festival circuit, awaiting distribution).

## Why this matters

Shows recent activity. A 2024 film Tarek lit but that won't release until 2026 should still appear on his portfolio as a recent credit, even if the public can't see it yet. Otherwise the visible portfolio looks stale.

## Tasks

### Schema

- [ ] Add `unreleased` as a valid `status` value in `data/content.json` projects.
- [ ] Add an optional `expectedRelease` field (string, e.g. "Q3 2026" or "TBD" or "Festival circuit 2026").
- [ ] Update at least one project as `unreleased` if Tarek has such a project (e.g. an unreleased 2024 or 2025 film he lit).

### Visual treatment

- [ ] **Grid card badge:**
  - `released` → small "Released" pill, low contrast (current behavior, keep)
  - `in-production` → amber "In Production" pill (current Saw badge, keep)
  - `unreleased` → new muted-grey or outlined pill, e.g. "Coming soon" or "Awaiting release"
- [ ] **Project page header:**
  - Replace generic status with the new state
  - If `expectedRelease` is set, show it under the title (e.g. "Awaiting release · Q3 2026")
- [ ] **i18n keys** in `data/i18n.json`:
  - `status.released` = "Released" / "Estrenada"
  - `status.inProduction` = "In production" / "En producción"
  - `status.unreleased` = "Unreleased" / "Sin estrenar"
  - `status.awaitingRelease` = "Awaiting release" / "Pendiente de estreno"

### Sort order on grid

- [ ] Default sort: `in-production` first, then `unreleased`, then `released` (most recent activity first)
- [ ] Optionally: within `released`, sort by year descending

### Content rules for unreleased projects

- [ ] **Cover image:** may use a placeholder, a behind-the-scenes photo, or the official poster (per director's discretion). Note that some directors prefer not to publicize unreleased work — make the cover easily replaceable.
- [ ] **Description:** keep generic / avoid plot spoilers.
- [ ] **Photos:** may be limited (some productions restrict BTS photography until release).

## Affected files

- `data/content.json` — new status values + `expectedRelease` field
- `data/i18n.json` — new keys
- `assets/js/showcase.js` — render new status + sort order
- `assets/css/showcase.css` — new badge style
- `scripts/inline-content.mjs` — re-run

## Status

Pending. Mostly UI work; no schema-breaking changes.