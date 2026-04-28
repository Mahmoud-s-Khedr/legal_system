#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

function metricValue(summary, key, fallback = null) {
  return summary?.metrics?.[key]?.values?.["p(95)"] ?? summary?.metrics?.[key]?.values?.value ?? fallback;
}

const basePath = process.env.PERF_BASELINE_JSON;
const headPath = process.env.PERF_CANDIDATE_JSON;

if (!basePath || !headPath) {
  console.error("PERF_BASELINE_JSON and PERF_CANDIDATE_JSON are required");
  process.exit(2);
}

const baseline = readJson(basePath);
const candidate = readJson(headPath);

const comparisons = [
  { key: "http_req_duration", allowedIncreasePct: Number(process.env.PERF_MAX_P95_REGRESSION_PCT ?? "5") },
  { key: "errors", allowedIncreasePct: Number(process.env.PERF_MAX_ERROR_REGRESSION_PCT ?? "0") }
];

let failed = false;
for (const item of comparisons) {
  const base = metricValue(baseline, item.key);
  const head = metricValue(candidate, item.key);
  if (typeof base !== "number" || typeof head !== "number") {
    continue;
  }
  const max = base * (1 + item.allowedIncreasePct / 100);
  if (head > max) {
    failed = true;
    console.error(
      `[perf-regression] ${item.key} regressed: baseline=${base} candidate=${head} allowedMax=${max.toFixed(2)}`
    );
  } else {
    console.log(`[perf-regression] ${item.key} ok: baseline=${base} candidate=${head}`);
  }
}

process.exit(failed ? 1 : 0);

