# Make film thumbnails on the main page clickable → project pages

The main page (`index.html`) shows a `<table>` of work credits where the first column is a small film thumbnail. These thumbnails should link to the corresponding project's showcase page when a project exists in `data/content.json`.

## Tasks

- [ ] **Inventory:** identify which work entries in `data/content.json` → `work[]` have a matching entry in `showcase[]` (matched by film title or year).
- [ ] **Schema:** add a `slug` field to `work[]` entries that map to showcase projects (e.g. `work[i].slug = "calladita-2023"`). Update `data/content.json` accordingly.
- [ ] **HTML markup** in `index.html`:
  - For rows with a matching slug, wrap the `<img>` (or whole row) in `<a href="showcase.html#${slug}">`.
  - For rows without a match, leave as plain thumbnail (no link).
- [ ] **Hover state** on linked thumbs:
  - Subtle border tint matching the project's accent color (`projects[slug].accent`).
  - Slight scale-up or shadow for affordance.
  - Cursor: pointer (free with `<a>`).
- [ ] **Accessibility:**
  - `<a>` should have `aria-label="View ${title} project"` for screen readers.
  - Visible focus ring for keyboard users.
- [ ] **Inlined data refresh:** run `node scripts/inline-content.mjs` after schema changes so the inline JSON blocks in `index.html` reflect the new fields.
- [ ] **Verify:**
  - Clicking thumbnail navigates to the correct `showcase.html#<slug>`.
  - Browser back button returns to main page in correct scroll position.
  - Hash-based deep link works (e.g. shared `index.html` → click → showcase page).

## Affected files

- `data/content.json` — add `slug` field to work entries
- `index.html` — wrap thumbnails in `<a>` for matching rows
- `assets/css/base.css` — hover state styles
- `scripts/inline-content.mjs` — no change, just re-run

## Status

Pending. Quick win — small markup + CSS change.