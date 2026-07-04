// scripts/create-issues.mjs
// Creates all draft issues stored in docs/issues/*.md on GitHub.
//
// Usage:
//   1. Get a GitHub Personal Access Token (Settings → Developer settings →
//      Personal access tokens → Tokens (classic), scope: repo + write:org)
//   2. Set env: export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
//   3. Run:     node scripts/create-issues.mjs
//
// Each .md file's first line "# Title" becomes the issue title.
// The rest becomes the body. Filename becomes the issue slug (for tracking).
//
// Idempotency: re-running skips issues whose title already exists in the repo.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ISSUES_DIR = resolve(ROOT, "docs/issues");
const REPO = "rubereco/cinema-lighttech-portfolio";

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error("Set GH_TOKEN environment variable first.");
  console.error("Get one at: https://github.com/settings/tokens (scope: repo)");
  process.exit(1);
}

const headers = {
  Authorization: `token ${TOKEN}`,
  "User-Agent": "create-issues.mjs",
  Accept: "application/vnd.github+json",
};

async function gh(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function listExistingTitles() {
  const titles = new Set();
  let page = 1;
  while (true) {
    const issues = await gh(`/repos/${REPO}/issues?state=all&per_page=100&page=${page}`);
    if (issues.length === 0) break;
    for (const i of issues) titles.add(i.title.trim());
    if (issues.length < 100) break;
    page++;
  }
  return titles;
}

function parseMd(path) {
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/^#\s+(.+?)\n([\s\S]*)$/);
  if (!m) throw new Error(`Bad format in ${path}: first line must be "# Title"`);
  return { title: m[1].trim(), body: m[2].trim() };
}

async function main() {
  if (!existsSync(ISSUES_DIR)) {
    console.error(`Missing ${ISSUES_DIR}. Run \`mkdir -p docs/issues\` and add .md files.`);
    process.exit(1);
  }

  const files = readdirSync(ISSUES_DIR).filter((f) => f.endsWith(".md")).sort();
  if (files.length === 0) {
    console.error(`No .md files found in ${ISSUES_DIR}.`);
    process.exit(1);
  }

  console.log(`Found ${files.length} issue drafts. Checking existing issues on ${REPO}…\n`);
  const existing = await listExistingTitles();

  let created = 0, skipped = 0;
  for (const file of files) {
    const { title, body } = parseMd(resolve(ISSUES_DIR, file));
    if (existing.has(title)) {
      console.log(`  ⏭  ${title}  (already exists)`);
      skipped++;
      continue;
    }
    const issue = await gh(`/repos/${REPO}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    console.log(`  ✓ ${title}  → ${issue.html_url}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});