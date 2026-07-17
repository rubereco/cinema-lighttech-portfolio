#!/usr/bin/env bash
# deploy.sh — push the local commits to GitHub so Cloudflare Pages auto-deploys
# Run this on rubereco's actual machine (where git credentials are configured).
# The OpenClaw sandbox has no SSH keys / GitHub token, so it can't push directly.

set -euo pipefail

REPO_DIR="${1:-$(pwd)}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Tarek Portfolio — deploy to GitHub → Cloudflare Pages"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Verify it's the right repo
if [ ! -f "$REPO_DIR/showcase.html" ]; then
  echo "❌ showcase.html not found in $REPO_DIR"
  echo "   Usage: ./deploy.sh /path/to/cinema-lighttech-portfolio"
  exit 1
fi

cd "$REPO_DIR"
echo "📁 Repo: $(pwd)"
echo ""

# Status check
echo "── git status ────────────────────────────────────────────────"
git status --short
echo ""

# Remote check
REMOTE=$(git remote get-url origin 2>/dev/null || git remote get-url github-ssh 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  echo "❌ No git remote configured. Add one with:"
  echo "   git remote add origin git@github.com:rubereco/cinema-lighttech-portfolio.git"
  exit 1
fi
echo "🔗 Remote: $REMOTE"
echo ""

# Commits to push
echo "── commits to push ──────────────────────────────────────────"
git log --oneline "$REMOTE/main..HEAD" 2>/dev/null || git log --oneline -4
echo ""

# Confirm
read -rp "Push these commits to $REMOTE? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "── pushing ──────────────────────────────────────────────────"
git push -u origin main
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Pushed!"
echo ""
echo "  Cloudflare Pages will auto-deploy in ~30 seconds."
echo "  Live URL: https://tarekrecolons.pages.dev/showcase.html"
echo "═══════════════════════════════════════════════════════════════"