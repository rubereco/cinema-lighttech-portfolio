# Add project metadata fields: Type and Important Directives

Each project page in `showcase.html` currently displays: cover, title, year, role, status. Add two new fields:

## New schema fields in `data/content.json`

```jsonc
{
  "slug": "saw-2026",
  "title": "Saw",
  "year": 2026,
  "type": "Feature",            // NEW: Feature | Series | Short | Commercial | Other
  "role": "Gaffer",
  "director": "—",
  "status": "in-production",
  "directives": [                // NEW: array of short strings (EN + ES via object)
    {
      "en": "Natural light only — no diffusion on windows",
      "es": "Solo luz natural — sin difusores en ventanas"
    },
    {
      "en": "Single-source tungsten practicals",
      "es": "Una sola fuente tungsteno en plano"
    }
  ],
  ...
}
```

## Tasks

- [ ] **Add `type` field** to all 5 projects in `data/content.json` → `showcase[]`. Use one of: `Feature`, `Series`, `Short`, `Commercial`, `Other`.
- [ ] **Add `directives` field** to all 5 projects. For projects without known directives, use an empty array `[]` (no placeholder text). Tarek can fill these in later.
- [ ] **i18n keys** in `data/i18n.json`:
  - `project.typeLabel` = "Type" / "Tipo"
  - `project.directivesLabel` = "Important Directives" / "Directrices Importantes"
  - `project.types.feature` = "Feature" / "Largometraje"
  - `project.types.series` = "Series" / "Serie"
  - `project.types.short` = "Short" / "Cortometraje"
  - `project.types.commercial` = "Commercial" / "Comercial"
  - `project.types.other` = "Other" / "Otro"
- [ ] **Render in `showcase.html` project view:**
  - Display `type` next to existing meta line (e.g. "2026 · GAFFER · FEATURE").
  - Add a "Directives" block below the description: a small bulleted list, styled subtly.
  - Empty state: hide the Directives block entirely if the array is empty.
- [ ] **Render in `showcase.html` folder grid card:**
  - Add small type label under the year (e.g. "2026 · Feature").
- [ ] **Update `scripts/generate-placeholders.mjs`** to include the new fields in placeholder project structure (so re-running it doesn't lose them).
- [ ] **Run `scripts/inline-content.mjs`** to refresh the inlined JSON in both HTML files.
- [ ] **Verify:**
  - Both languages render the new fields correctly.
  - Empty directives block is hidden in projects without directives (none currently, but design defensively).
  - Mobile layout doesn't break with the new fields.

## Affected files

- `data/content.json` — new fields on all 5 projects
- `data/i18n.json` — new keys
- `assets/js/showcase.js` — render new fields in project view
- `assets/css/showcase.css` — directive list styling
- `scripts/generate-placeholders.mjs` — keep new fields in template
- `scripts/inline-content.mjs` — re-run to update inline blocks

## Status

Pending. Medium effort — schema change + render logic + i18n.