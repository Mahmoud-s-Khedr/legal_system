#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();

const ALLOWED_ROOT_FILES = new Set([
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

const TEXT_EXTENSIONS = [
  ".md",
  ".json",
  ".mjs",
  ".cjs",
  ".js",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
  ".sh",
  ".ps1",
  ".toml",
  ".env",
  ".example"
];

function rel(absPath) {
  return relative(repoRoot, absPath).replaceAll("\\", "/") || ".";
}

function walkFiles(dir, out = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkFiles(full, out);
      continue;
    }
    if (entry.isFile()) out.push(full);
  }
  return out;
}

function isTextPath(path) {
  return TEXT_EXTENSIONS.some((ext) => path.endsWith(ext));
}

const errors = [];

for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (ALLOWED_ROOT_FILES.has(entry.name)) continue;
  errors.push(`[forbidden-root-file] ${entry.name} should be moved under docs/, scripts/, archive/, or a package.`);
}

const files = walkFiles(repoRoot).filter((p) => isTextPath(p));
for (const file of files) {
  const relPath = rel(file);
  if (relPath.startsWith("archive/cloud/")) continue;
  if (relPath === "docs/dev/13-repo-structure-audit.md") continue;
  if (relPath === "scripts/docs/structure-audit.mjs") continue;
  if (relPath === "scripts/docs/structure-check.mjs") continue;

  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, idx) => {
    if (line.includes("apps/web") && !line.includes("archive/cloud/apps/web")) {
      errors.push(`[stale-apps-web-path] ${relPath}:${idx + 1} contains \`apps/web\`; use \`archive/cloud/apps/web\` or remove it.`);
    }
  });
}

if (errors.length > 0) {
  console.error(`structure check failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("structure check passed.");
