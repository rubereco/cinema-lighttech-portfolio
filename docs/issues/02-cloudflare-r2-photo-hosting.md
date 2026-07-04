# Provision Cloudflare R2 bucket for high-res project photos

Repo currently hosts cover JPEGs (~70–400 KB each) inline. Future BTS/stills galleries will be larger (10+ photos × multi-MB each = tens of MB per project).

**Goal:** Move project photos to a Cloudflare R2 bucket (`tarek-portfolio-photos`), served via a custom domain or R2.dev subdomain. Repo stays lean.

**Considerations:**
- R2 has no egress fees (only storage + ops) — ideal for portfolio traffic
- Public bucket access via `*.r2.dev` subdomain, or custom domain (e.g. `photos.tarekrecolons.com`)
- Need an image transform/optimization layer? Cloudflare Images? Or pre-resize and store 400/800/1200 variants?
- Lifecycle rules: archive originals to R2 infrequent access after processing

**Status:** Paused at "card step" from 2026-07-03 (was buying Cloudflare credit before domain decision).

**Depends on:** #01 (custom domain makes the bucket URL cleaner)

**Next action:** Decide R2 plan + image variant strategy, then provision.