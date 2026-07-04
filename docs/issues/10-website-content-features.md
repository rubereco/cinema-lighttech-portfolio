# Website content & features (main page + showcase)

Five sub-features for the main page and individual film pages.

## Sub-tasks

### 1. Make film thumbnails on main page clickable → project pages

Currently the main page (`index.html`) shows a `<table>` of work credits with thumbnails in the first column. The thumbnails should link to the corresponding project's showcase page (`showcase.html#<slug>`) when a project exists in `data/content.json`.

- [ ] Identify which work entries have a matching `showcase[]` slug
- [ ] Wrap the thumbnail `<img>` (or the row) in an `<a href="showcase.html#<slug>">` for matching rows
- [ ] Add hover state (subtle border tint matching the project's accent color)
- [ ] Non-matching rows (films not in showcase) remain plain

### 2. Update project detail (film page) metadata fields

Each project page in `showcase.html` currently shows: cover, title, year, role, status. **Add:**
- **Title** ✅ (already present)
- **Year** ✅ (already present)
- **Short Description** ✅ (already present as `project.summary`)
- **Type** (Feature / Series / Short / Commercial) — add `project.type` to schema + render with i18n key
- **My Role** ✅ (already present, e.g. "Gaffer")
- **Important Directives** — new field. Interpret as "production constraints / key creative notes from director/DP that shaped the lighting work" (e.g. "Natural light only", "No lights above eye level", "One day exterior shoot", "Day-for-night"). Add as `project.directives` (array of strings, EN/ES).

### 3. Remove obsolete photo category tags from project pages

User feedback: the `All / BTS / Stills / Process` tabs feel redundant and visually noisy. Remove them.

- [ ] Delete tab markup from `showcase.html`
- [ ] Delete tab-render JS from `assets/js/showcase.js`
- [ ] Delete i18n keys `showcase.tabAll`, `showcase.tabBts`, `showcase.tabStill`, `showcase.tabProcess`
- [ ] All photos show in a single flat grid (masonry or uniform grid)

### 4. Showcase "Unreleased" work (finished but not yet published)

Currently `status` is either `released` or `in-production`. Add a third state: **`finished` / `unreleased`** — for films Tarek has wrapped but that haven't premiered yet.

- [ ] Add `unreleased` as a valid status in `data/content.json`
- [ ] UI treatment: distinct badge (e.g. grey/muted vs amber for in-production)
- [ ] On project page, show "Available from <expected date>" if known
- [ ] On grid card, the badge is visible but more subtle than `released` or `in-production`

### 5. New "Partners & Credits" page

A dedicated page listing the equipment houses, partners, and photography directors Tarek works with. Each entry has:
- Name
- Type (equipment house / partner / DP)
- Link (Website or Instagram)

- [ ] Add `data/content.json` → `partners[]` array with shape `{ name, type, url, label? }`
- [ ] Create `partners.html` with the layout (grid or grouped sections)
- [ ] Add nav link from `index.html` and `showcase.html` (probably under "About" group)
- [ ] i18n keys for the page title, section headers, type labels
- [ ] Seed with Tarek's actual partners when available

## Schema addition (preview)

```jsonc
{
  "slug": "saw-2026",
  "title": "Saw",
  "year": 2026,
  "type": "Feature",            // NEW
  "role": "Gaffer",
  "director": "—",
  "status": "in-production",    // released | in-production | unreleased
  "directives": [                // NEW — production constraints / creative notes
    "Natural light only — no diffusion on windows",
    "Single-source tungsten practicals"
  ],
  ...
}
```

## Status

Pending user approval on each sub-task. Some are quick (link thumbs, remove tabs) — others need real data (partners list, directive text per project).