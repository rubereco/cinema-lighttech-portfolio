# Add pre-commit hook to auto-run `inline-content.mjs`

`scripts/inline-content.mjs` regenerates the `<script type="application/json">` blocks inside `index.html` and `showcase.html` from `data/content.json` and `data/i18n.json`. Without running it after edits, the `file://` preview path breaks.

**Goal:** A `.git/hooks/pre-commit` (or `lefthook.yml` / `husky`) that auto-runs the script when `data/*.json` changes.

**Implementation options:**

**Option A — pure git hook (simplest):**
```bash
# .git/hooks/pre-commit
#!/bin/sh
if git diff --cached --name-only | grep -q "^data/.*\.json$"; then
  node scripts/inline-content.mjs
  git add index.html showcase.html
fi
```

**Option B — lefthook / husky (cross-platform, easier to share):**
- Add `lefthook.yml` with a `pre-commit` job
- Document in README

**Status:** Pending. Currently runs manually after every `data/*.json` edit.

**Risk if forgotten:** `file://` previews show stale content; live deploy still works (fetches fresh).