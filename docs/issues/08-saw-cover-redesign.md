# Redesign Saw cover (placeholder feels sparse in hero view)

`assets/projects/saw-2026/cover.svg` is a dark gradient with very subtle clapperboard + aperture glyphs (opacity 0.18). On the **grid card** (small, 4:5) it reads fine — looks like a moody "current project" placeholder.

But on the **project hero** (full-width, ~520px wide on desktop), the same SVG looks empty / unfinished because the decorative elements fade into the background.

**Options to consider:**
1. **Bold the glyphs** — raise opacity 0.18 → 0.5–0.7, add a centered typographic mark
2. **Move the "IN PRODUCTION" badge to a more central location** so it dominates
3. **Add a subtle vimeo-like play-icon overlay** hinting at film
4. **Just generate a real cover image** — even a behind-the-scenes polaroid from set would work better than any SVG
5. **Use a different design language** for in-production projects vs released ones (e.g. animated striped border, slightly different grid treatment)

**Status:** Pending user feedback. Real photos from Saw production would solve this naturally (issue #04) but a quick SVG redesign is faster.

**Affected files:** `assets/projects/saw-2026/cover.svg`, possibly the gradient/styling in `scripts/generate-placeholders.mjs` for future in-production projects.