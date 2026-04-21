#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_MIN = 80;
const minArgIndex = process.argv.indexOf("--min");
const minFromArg = minArgIndex >= 0 ? process.argv[minArgIndex + 1] : undefined;
const minRaw = process.env.COVERAGE_DIFF_MIN ?? minFromArg ?? String(DEFAULT_MIN);
const minCoverage = Number(minRaw);

if (!Number.isFinite(minCoverage)) {
  console.error("Invalid diff coverage minimum. Use --min <number> or COVERAGE_DIFF_MIN.");
  process.exit(1);
}

function readLcovExecutableLines(lcovPath) {
  const map = new Map();
  const content = readFileSync(lcovPath, "utf8");
  let currentFile = null;

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      currentFile = resolve(line.slice(3));
      if (!map.has(currentFile)) {
        map.set(currentFile, new Map());
      }
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("DA:")) {
      const payload = line.slice(3).split(",");
      const lineNumber = Number(payload[0]);
      const hits = Number(payload[1]);
      if (Number.isFinite(lineNumber) && Number.isFinite(hits)) {
        map.get(currentFile).set(lineNumber, hits > 0);
      }
      continue;
    }

    if (line === "end_of_record") {
      currentFile = null;
    }
  }

  return map;
}

function getBaseRef() {
  const explicitBase = process.env.COVERAGE_DIFF_BASE_SHA?.trim();
  if (explicitBase) {
    return explicitBase;
  }

  const explicitHead = process.env.COVERAGE_DIFF_HEAD_SHA?.trim();
  if (explicitHead) {
    return `${explicitHead}~1`;
  }

  try {
    return execSync("git merge-base HEAD origin/main", { encoding: "utf8" }).trim();
  } catch {
    return "HEAD~1";
  }
}

function getHeadRef() {
  const explicitHead = process.env.COVERAGE_DIFF_HEAD_SHA?.trim();
  return explicitHead || "HEAD";
}

function getChangedAddedLines(baseRef, headRef) {
  const diffOutput = execSync(
    `git diff --unified=0 --no-color ${baseRef}...${headRef} -- packages/backend/src packages/frontend/src packages/shared/src`,
    { encoding: "utf8" }
  );

  const changed = new Map();
  let currentFile = null;

  for (const line of diffOutput.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = resolve(line.slice(6));
      if (!changed.has(currentFile)) {
        changed.set(currentFile, new Set());
      }
      continue;
    }

    if (!line.startsWith("@@") || !currentFile) {
      continue;
    }

    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!match) {
      continue;
    }

    const start = Number(match[1]);
    const count = match[2] ? Number(match[2]) : 1;
    if (count <= 0) {
      continue;
    }

    const lines = changed.get(currentFile);
    for (let i = 0; i < count; i += 1) {
      lines.add(start + i);
    }
  }

  return changed;
}

const lcovFiles = [
  "packages/backend/coverage/lcov.info",
  "packages/frontend/coverage/lcov.info",
  "packages/shared/coverage/lcov.info"
];

const executableLines = new Map();
for (const file of lcovFiles) {
  if (!existsSync(file)) {
    console.error(`Missing ${file}. Run pnpm test:coverage first.`);
    process.exit(1);
  }
  const fileMap = readLcovExecutableLines(file);
  for (const [sourceFile, lines] of fileMap.entries()) {
    executableLines.set(sourceFile, lines);
  }
}

const baseRef = getBaseRef();
const headRef = getHeadRef();
let changed;

try {
  changed = getChangedAddedLines(baseRef, headRef);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to compute git diff from ${baseRef} to ${headRef}: ${message}`);
  process.exit(1);
}

let executableChanged = 0;
let coveredChanged = 0;

for (const [filePath, lines] of changed.entries()) {
  const lineHits = executableLines.get(filePath);
  if (!lineHits) {
    continue;
  }

  for (const lineNumber of lines) {
    if (!lineHits.has(lineNumber)) {
      continue;
    }
    executableChanged += 1;
    if (lineHits.get(lineNumber)) {
      coveredChanged += 1;
    }
  }
}

if (executableChanged === 0) {
  console.log("Diff coverage: 100.00% (no changed executable lines)");
  process.exit(0);
}

const pct = (coveredChanged / executableChanged) * 100;
console.log(
  `Diff coverage: ${pct.toFixed(2)}% (${coveredChanged}/${executableChanged}) against minimum ${minCoverage}%`
);

if (pct < minCoverage) {
  process.exit(1);
}
