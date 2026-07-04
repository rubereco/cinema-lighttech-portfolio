# Image srcset variant generator (400 / 800 / 1200 px)

`showcase.js` expects photos named `photo-NN-kind.jpg` to also have `-400.jpg`, `-800.jpg`, `-1200.jpg` siblings so it can lazy-load the right size via `<img srcset>`. The auto-generation is **not yet built**.

**What's needed:**
A small Node.js script that:
1. Reads every `photo-NN-kind.{jpg,png,webp}` in `assets/projects/*/`
2. Generates `-400`, `-800`, `-1200` variants using `sharp`
3. Saves them alongside the source
4. Skips variants already present (idempotent)
5. Logs total bytes saved vs full-resolution

**Naming example:**
```
photo-01-bts.jpg         (full size, e.g. 1600px wide)
photo-01-bts-400.jpg     (mobile @ 1x)
photo-01-bts-800.jpg     (tablet @ 2x)
photo-01-bts-1200.jpg    (desktop @ 1x, retina @ 2x)
```

**Use cases:**
- Run manually after adding new photos
- Run in pre-commit hook (only when photo files change)
- Run in a Cloudflare Worker / R2 bucket pipeline (long-term, see #02)

**Status:** Pending — currently only full-size JPEGs exist for the 4 cover images.

**Estimated first-run cost:** ~30 seconds for 30 source photos (sharp is fast).