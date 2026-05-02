#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

function metricValue(summary, key, stat, fallback = null) {
  const values = summary?.metrics?.[key]?.values;
  if (!values) return fallback;
  if (stat in values) return values[stat];
  return values.value ?? fallback;
}

const basePath = process.env.PERF_BASELINE_JSON;
const headPath = process.env.PERF_CANDIDATE_JSON;
const baseDir = process.env.PERF_BASELINE_DIR;
const headDir = process.env.PERF_CANDIDATE_DIR;
const suites = (process.env.PERF_SUITES ?? "api-baseline,auth,document-upload")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

if ((!basePath || !headPath) && (!baseDir || !headDir)) {
  console.error("Either PERF_BASELINE_JSON+PERF_CANDIDATE_JSON OR PERF_BASELINE_DIR+PERF_CANDIDATE_DIR are required");
  process.exit(2);
}

const comparisons = [
  { key: "http_req_duration", stat: "p(50)", allowedIncreasePct: Number(process.env.PERF_MAX_P50_REGRESSION_PCT ?? "7") },
  { key: "http_req_duration", stat: "p(95)", allowedIncreasePct: Number(process.env.PERF_MAX_P95_REGRESSION_PCT ?? "5") },
  { key: "http_req_duration", stat: "p(99)", allowedIncreasePct: Number(process.env.PERF_MAX_P99_REGRESSION_PCT ?? "5") },
  { key: "errors", stat: "rate", allowedIncreasePct: Number(process.env.PERF_MAX_ERROR_REGRESSION_PCT ?? "0") }
];

let failed = false;
const targets = basePath && headPath
  ? [{ name: "single", baseline: readJson(basePath), candidate: readJson(headPath) }]
  : suites.map((suite) => ({
      name: suite,
      baseline: readJson(resolve(baseDir, `${suite}.summary.json`)),
      candidate: readJson(resolve(headDir, `${suite}.summary.json`))
    }));

for (const target of targets) {
  for (const item of comparisons) {
    const base = metricValue(target.baseline, item.key, item.stat);
    const head = metricValue(target.candidate, item.key, item.stat);
    if (typeof base !== "number" || typeof head !== "number") {
      continue;
    }
    const max = base * (1 + item.allowedIncreasePct / 100);
    if (head > max) {
      failed = true;
      console.error(
        `[perf-regression] [${target.name}] ${item.key}.${item.stat} regressed: baseline=${base} candidate=${head} allowedMax=${max.toFixed(2)}`
      );
    } else {
      console.log(`[perf-regression] [${target.name}] ${item.key}.${item.stat} ok: baseline=${base} candidate=${head}`);
    }
  }
}

process.exit(failed ? 1 : 0);
