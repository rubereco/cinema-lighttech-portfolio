# Replace project photo SVG placeholders with real BTS/stills

`assets/projects/*/photo-*.svg` files are placeholder SVGs from `scripts/generate-placeholders.mjs`. Each project folder should have 5–8 real photos instead.

**Maintenance flow (Option A — agreed 2026-07-03):**
1. Tarek sends photos via Telegram (any size, multiple per message)
2. rubereco handles resize (mozjpeg q82, max 1200px wide), naming (`photo-NN-kind.jpg`), commit, push
3. Cloudflare auto-deploys

**Per-project needs:**
| Project | Current placeholders | Status |
|---|---|---|
| `saw-2026` | 8 photos | **in production** — wait until wrap |
| `els-mals-noms-2025` | 6 photos | released — request from Tarek |
| `calladita-2023` | 6 photos | released — request from Tarek |
| `the-bookshop-2017` | 5 photos | released — request from Tarek |
| `boca-norte-2019` | 6 photos | released — request from Tarek |

**Naming convention:** `photo-01-bts.jpg`, `photo-02-still.jpg`, etc.
- `bts` = behind the scenes (lighting setup, crew, gear)
- `still` = finished frame / final shot
- `process` = diagrams, tests, prep

**Caption field:** Empty in `content.json` — Tarek to add Spanish + English short captions if desired.

**Subtask:** generate 400/800/1200 srcset variants per photo so `showcase.js` lazy-loads the right size. (See #05.)