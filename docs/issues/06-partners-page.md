# New "Partners & Credits" page

A dedicated page listing the equipment houses, partners, and photography directors Tarek works with. Each entry has a name, type, and link (Website or Instagram).

## Schema (preview)

```jsonc
// data/content.json
{
  "partners": [
    {
      "name": "Cinearte",
      "type": "equipment-house",     // equipment-house | rental | partner | dp
      "url": "https://cinearte.example.com",
      "label": "Website",            // optional: "Website" | "Instagram" | custom
      "location": "Barcelona, ES"    // optional
    },
    {
      "name": "@paulo_dop",
      "type": "dp",
      "url": "https://instagram.com/paulo_dop",
      "label": "Instagram",
      "notes": {
        "en": "DP on Saw, Calladita",
        "es": "DF en Saw, Calladita"
      }
    }
  ]
}
```

## Tasks

### Content

- [ ] **Seed the `partners[]` array** in `data/content.json` with Tarek's actual collaborators. At minimum:
  - 2–3 equipment houses he rents from regularly
  - 2–3 DPs he works with repeatedly
  - Any partner companies / studios he has standing relationships with
- [ ] Each entry should have at least a `name` and either `url` or `notes` (preferably both).

### Page

- [ ] **Create `partners.html`** with structure:
  - Same nav as `index.html` / `showcase.html` (header, mobile menu, language toggle, theme).
  - Hero / intro: short copy explaining what this page is (EN + ES).
  - Sections grouped by `type`:
    - Equipment Houses
    - Rental Partners
    - Cinematographers / DPs
    - Other Partners
  - Each entry: name (clickable link), type label, location (if set), notes (if set).
- [ ] **Add nav link** from `index.html` and `showcase.html`. Suggested placement: under the existing nav, as a sub-item or alongside "About".
- [ ] **i18n keys** in `data/i18n.json`:
  - `partners.pageTitle` = "Partners & Credits" / "Colaboradores y Créditos"
  - `partners.intro` = "The equipment houses, rental partners, and cinematographers I work with." / "Las casas de equipos, partners de alquiler y directores de fotografía con los que trabajo."
  - `partners.section.equipment` = "Equipment Houses" / "Casas de Equipos"
  - `partners.section.rental` = "Rental Partners" / "Partners de Alquiler"
  - `partners.section.dp` = "Cinematographers" / "Directores de Fotografía"
  - `partners.section.other` = "Other Partners" / "Otros Colaboradores"
  - `partners.empty` = "No partners listed yet." / "Aún no hay colaboradores listados."

### Styling

- [ ] Use the existing card / link pattern (consistent with project cards).
- [ ] External links open in new tab (`target="_blank"`) with `rel="noopener noreferrer"`.
- [ ] Empty state: show "No partners listed yet" if a section is empty.
- [ ] Run `scripts/inline-content.mjs` to refresh the inlined JSON in all HTML files (including the new `partners.html`).

### Verification

- [ ] All links resolve (no 404s).
- [ ] No broken / placeholder data ships — only verified partners.
- [ ] Mobile layout: partners stack vertically with full-width cards.
- [ ] Hover/focus states for clickable links.

## Affected files

- `partners.html` (new)
- `index.html` — add nav link
- `showcase.html` — add nav link
- `data/content.json` — new `partners[]` array
- `data/i18n.json` — new keys
- `assets/css/base.css` — partners card styles (or new file)
- `assets/js/main.js` — render nav link dynamically
- `scripts/inline-content.mjs` — re-run to include `partners.html` in the inline pass (currently only does index.html and showcase.html — needs update)

## Status

Pending. Real data needed from Tarek before page is meaningful.