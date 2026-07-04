# Confirm "Saw" project title

`data/content.json` currently lists a 2026 project titled **"Saw"** with status `in-production`.

**Questions for Tarek:**
- Is "Saw" the final title or a working title? (Some productions are renamed before release.)
- Director name (currently `—`)?
- Expected release year/month?
- Final accent color for the badge? (Currently `#E8A33D` tungsten amber — placeholder until confirmed.)

**Where to update:**
```json
{
  "slug": "saw-2026",
  "title": "Saw",           // ← confirm
  "year": 2026,
  "role": "Gaffer",
  "director": "—",          // ← add name
  "status": "in-production",
  "accent": "#E8A33D",      // ← optional
  ...
}
```

After updating, run `node scripts/inline-content.mjs` to regenerate the inlined blocks in `index.html` and `showcase.html`, then commit.