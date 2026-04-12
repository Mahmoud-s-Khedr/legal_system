#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const inventoryDir = join(repoRoot, "docs", "_inventory");
const reportPath = join(repoRoot, "docs", "dev", "13-repo-structure-audit.md");
const treePath = join(inventoryDir, "repository-tree.txt");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".turbo",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
  "blob-report",
  ".vite",
  "target"
]);

const ROOT_OWNERSHIP = [
  { path: "apps/", owner: "Desktop shell and platform wrappers" },
  { path: "packages/", owner: "Shippable application code (backend, frontend, shared)" },
  { path: "docs/", owner: "User/dev/architecture/business documentation" },
  { path: "scripts/", owner: "Operational, release, and quality tooling scripts" },
  { path: "tests/", owner: "Cross-package e2e/load tests" },
  { path: "archive/", owner: "Historical assets not part of active runtime" }
];

function rel(absPath) {
  return relative(repoRoot, absPath).replaceAll("\\", "/") || ".";
}

function walkFiles(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const relPath = rel(full);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkFiles(full, out);
      continue;
    }

    if (entry.isFile()) out.push(relPath);
  }
  return out;
}

function buildTreeLines(dir, prefix = "", isRoot = true) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !(entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    const branch = isRoot ? "" : last ? "└── " : "├── ";
    const full = join(dir, entry.name);

    lines.push(`${prefix}${branch}${entry.name}${entry.isDirectory() ? "/" : ""}`);

    if (entry.isDirectory()) {
      const childPrefix = isRoot ? "" : `${prefix}${last ? "    " : "│   "}`;
      lines.push(...buildTreeLines(full, childPrefix, false));
    }
  });

  return lines;
}

function findLooseRootArtifacts() {
  const allowedRootFiles = new Set([
    ".dockerignore",
    ".editorconfig",
    ".env.example",
    ".gitignore",
    ".lighthouserc.json",
    ".prettierignore",
    ".prettierrc.json",
    "README.md",
    "eslint.config.mjs",
    "package.json",
    "playwright.config.ts",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "turbo.json"
  ]);

  const rootEntries = readdirSync(repoRoot, { withFileTypes: true });
  return rootEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !allowedRootFiles.has(name))
    .sort();
}

function collectAppsWebRefs(files) {
  const refs = [];
  for (const file of files) {
    if (file.startsWith("archive/cloud/")) continue;
    if (file === "docs/dev/13-repo-structure-audit.md") continue;
    if (file === "scripts/docs/structure-audit.mjs") continue;
    if (file === "scripts/docs/structure-check.mjs") continue;
    let content;
    try {
      content = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("apps/web") && !line.includes("archive/cloud/apps/web")) {
        refs.push({ file, line: idx + 1, text: line.trim() });
      }
    });
  }
  return refs;
}

mkdirSync(inventoryDir, { recursive: true });

const allFiles = walkFiles(repoRoot);
const tree = ["./", ...buildTreeLines(repoRoot)];
writeFileSync(treePath, `${tree.join("\n")}\n`, "utf8");

const looseRootArtifacts = findLooseRootArtifacts();
const appsWebRefs = collectAppsWebRefs(allFiles);

const duplicateOrLegacyAreas = [
  "Archived cloud deployment assets are preserved under `archive/cloud/` and should not be used as active runtime paths.",
  "Desktop runtime resources under `apps/desktop/resources/` are generated/bundled outputs and should remain out of source-truth docs except packaging guides."
];

const report = [
  "# 13 — Repository Structure Audit",
  "",
  `Audit date: 2026-04-12`,
  "",
  "## Snapshot",
  "",
  "- Canonical tree snapshot: `docs/_inventory/repository-tree.txt`",
  `- Total tracked files scanned (excluding generated directories): ${allFiles.length}`,
  `- Stale \`apps/web\` references outside archive scope: ${appsWebRefs.length}`,
  "",
  "## Duplicate / Legacy Areas",
  "",
  ...duplicateOrLegacyAreas.map((item) => `- ${item}`),
  "",
  "## Misplaced Root Artifacts",
  "",
  ...(looseRootArtifacts.length === 0
    ? ["- None detected."]
    : looseRootArtifacts.map((item) => `- \`${item}\``)),
  "",
  "## Stale Path Reference Classification (`apps/web`)",
  "",
  ...(appsWebRefs.length === 0
    ? ["- None detected outside `archive/cloud/`."]
    : appsWebRefs.map((entry) => `- UPDATE: \`${entry.file}:${entry.line}\` -> ${entry.text}`)),
  "",
  "## Top-Level Ownership",
  "",
  ...ROOT_OWNERSHIP.map((item) => `- \`${item.path}\` — ${item.owner}`),
  "",
  "## Source of Truth",
  "",
  "- `docs/_inventory/source-of-truth.md`",
  "- `docs/dev/02-repo-structure.md`"
].join("\n");

writeFileSync(reportPath, `${report}\n`, "utf8");

console.log(`wrote ${rel(treePath)}`);
console.log(`wrote ${rel(reportPath)}`);
console.log(`stale apps/web refs outside archive scope: ${appsWebRefs.length}`);
