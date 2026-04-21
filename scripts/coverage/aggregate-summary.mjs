#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCoveragePolicySnapshot } from "./threshold-policy.mjs";

const repoRoot = process.cwd();
const packageNames = ["backend", "frontend", "shared"];
const metrics = ["lines", "statements", "functions", "branches"];
const pkgToWorkspace = {
  backend: "@elms/backend",
  frontend: "@elms/frontend",
  shared: "@elms/shared"
};

function formatPct(value) {
  return `${value.toFixed(2)}%`;
}

function loadSummary(packageName) {
  const summaryPath = join(
    repoRoot,
    "packages",
    packageName,
    "coverage",
    "coverage-summary.json"
  );

  if (!existsSync(summaryPath)) {
    throw new Error(
      `Missing coverage summary for ${packageName} at ${summaryPath}. Run pnpm test:coverage first.`
    );
  }

  const parsed = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (!parsed.total) {
    throw new Error(`Coverage summary for ${packageName} is missing a total section.`);
  }

  return parsed.total;
}

const policy = getCoveragePolicySnapshot();
const week4Thresholds = policy.phases.week4;
console.log(`Coverage policy phase: ${policy.activePhase}`);
console.log("");

const totals = {
  lines: { covered: 0, total: 0 },
  statements: { covered: 0, total: 0 },
  functions: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 }
};

for (const packageName of packageNames) {
  const workspaceName = pkgToWorkspace[packageName];
  const summary = loadSummary(packageName);
  const thresholds = policy.thresholds[workspaceName];
  const finalThresholds = week4Thresholds[workspaceName];

  console.log(`Package ${workspaceName}`);
  for (const metric of metrics) {
    const covered = summary[metric]?.covered ?? 0;
    const total = summary[metric]?.total ?? 0;
    const pct = summary[metric]?.pct ?? 0;
    const threshold = thresholds[metric];
    const finalThreshold = finalThresholds[metric];
    const pass = pct >= threshold;
    const gapToActive = Math.max(0, threshold - pct);
    const gapToWeek4 = Math.max(0, finalThreshold - pct);

    totals[metric].covered += covered;
    totals[metric].total += total;

    console.log(
      `  ${metric.padEnd(10)} ${formatPct(pct).padStart(8)}  threshold ${String(threshold).padStart(2)}%  ${pass ? "PASS" : "FAIL"}  gap(active): ${formatPct(gapToActive)}  gap(week4): ${formatPct(gapToWeek4)}`
    );
  }
  console.log("");
}

console.log("System aggregate (weighted by executable items)");
for (const metric of metrics) {
  const covered = totals[metric].covered;
  const total = totals[metric].total;
  const pct = total > 0 ? (covered / total) * 100 : 100;
  console.log(`  ${metric.padEnd(10)} ${formatPct(pct).padStart(8)} (${covered}/${total})`);
}
