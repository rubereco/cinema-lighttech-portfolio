# Verify `.git` state of the other 3 repos

On 2026-07-03 the `cinema-lighttech-portfolio` repo's `.git` was inadvertently shared with the workspace monorepo — `git rev-parse --git-dir` from inside the portfolio subdir resolved to `/home/node/.openclaw/workspace/.git`, causing a force-push to publish workspace-monorepo files publicly. The portfolio repo was re-initialized fresh and is now clean (verified today).

**Action required for the other 3 repos:**
- `rubereco/yt-music-auto-resume`
- `rubereco/finance`  (location: `aimless/finance` in the workspace?)
- `rubereco/CMR-validator`

For each, run from its own directory:
```bash
git rev-parse --git-dir
```
If the result is the subdir itself (`.git`), it's standalone ✅.
If it points to a parent (e.g. `/home/node/.openclaw/workspace/.git`), it's sharing the monorepo's git — **do not push until fixed**.

**Fix if shared:**
```bash
cd <subdir>
rm -rf .git
git init
git remote add origin git@github.com:rubereco/<repo>.git
# Then re-add files and commit/push from THIS subdir only
```

**Status:** Pending verification. None of the 3 other repos have been touched since the July 3 incident was identified.