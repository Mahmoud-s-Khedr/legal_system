#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageNames = ["backend", "frontend", "shared"];
const metric = "lines";
const minExecutableLines = Number(process.env.COVERAGE_HOTSPOT_MIN_LINES ?? 40);

const topArgIndex = process.argv.indexOf("--top");
const topRaw = topArgIndex >= 0 ? process.argv[topArgIndex + 1] : process.env.COVERAGE_HOTSPOT_TOP;
const topN = Number(topRaw ?? 10);

if (!Number.isFinite(topN) || topN <= 0) {
  console.error("Invalid --top value. Use a positive number.");
  process.exit(1);
}

function summaryPath(packageName) {
  return join(repoRoot, "packages", packageName, "coverage", "coverage-summary.json");
}

function loadSummary(packageName) {
  const path = summaryPath(packageName);
  if (!existsSync(path)) {
    throw new Error(`Missing coverage summary for ${packageName} at ${path}. Run pnpm test:coverage first.`);
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const rows = [];
  for (const [file, stats] of Object.entries(parsed)) {
    if (file === "total") {
      continue;
    }

    const metricStats = stats?.[metric];
    const total = metricStats?.total ?? 0;
    const covered = metricStats?.covered ?? 0;
    const pct = metricStats?.pct ?? 0;

    if (total < minExecutableLines) {
      continue;
    }

    rows.push({
      packageName,
      file,
      total,
      covered,
      uncovered: Math.max(0, total - covered),
      pct
    });
  }

  return rows;
}

const rows = packageNames.flatMap((packageName) => loadSummary(packageName));
rows.sort((a, b) => {
  if (b.uncovered !== a.uncovered) {
    return b.uncovered - a.uncovered;
  }
  return a.file.localeCompare(b.file);
});

const topRows = rows.slice(0, topN);

console.log(`Top uncovered files by executable ${metric} (min lines: ${minExecutableLines}, top: ${topN})`);
if (topRows.length === 0) {
  console.log("No files matched the hotspot filters.");
  process.exit(0);
}

for (const row of topRows) {
  console.log(
    `${row.packageName.padEnd(8)}  uncovered ${String(row.uncovered).padStart(5)} / ${String(row.total).padStart(5)}  (${row.pct.toFixed(2)}%)  ${row.file}`
  );
}
