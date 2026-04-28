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
  { name: "document-upload", file: "tests/load/document-upload.js" }
];

for (const suite of suites) {
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

