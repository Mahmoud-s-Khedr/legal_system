#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname, "..");
const outDir = process.env.PERF_OUT_DIR
  ? resolve(process.cwd(), process.env.PERF_OUT_DIR)
  : resolve(root, ".logs", "performance");
mkdirSync(outDir, { recursive: true });

const suites = [
  { name: "api-baseline", file: "tests/load/api-baseline.js" },
  { name: "auth", file: "tests/load/auth.js" },
  { name: "document-upload", file: "tests/load/document-upload.js" },
  { name: "cases-write-update", file: "tests/load/cases-write-update.js" },
  { name: "hearings-events", file: "tests/load/hearings-events.js" },
  { name: "billing-credit", file: "tests/load/billing-credit.js" },
  { name: "notifications", file: "tests/load/notifications.js" },
  { name: "library-search", file: "tests/load/library-search.js" },
  { name: "research", file: "tests/load/research.js" },
  { name: "search-global", file: "tests/load/search-global.js" },
  { name: "portal-auth-read", file: "tests/load/portal-auth-read.js" },
  { name: "import-preview", file: "tests/load/import-preview.js" }
];

const requestedSuites = process.env.PERF_SUITES
  ? new Set(process.env.PERF_SUITES.split(",").map((x) => x.trim()).filter(Boolean))
  : null;
const selectedSuites = requestedSuites ? suites.filter((s) => requestedSuites.has(s.name)) : suites;

for (const suite of selectedSuites) {
  const summaryFile = resolve(outDir, `${suite.name}.summary.json`);
  const command = ["run", "--summary-export", summaryFile, suite.file];
  const result = spawnSync("k6", command, {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[perf] Baselines captured in ${outDir}`);
