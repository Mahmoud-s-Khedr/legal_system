#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const packages = ["@elms/backend", "@elms/frontend", "@elms/shared"];

for (const pkg of packages) {
  const result = spawnSync("pnpm", ["--filter", pkg, "test:coverage"], {
    stdio: "inherit",
    env: process.env
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
}

const summaryResult = spawnSync("node", ["./scripts/coverage/aggregate-summary.mjs"], {
  stdio: "inherit",
  env: process.env
});

if (typeof summaryResult.status === "number" && summaryResult.status !== 0) {
  process.exit(summaryResult.status);
}

if (summaryResult.error) {
  console.error(summaryResult.error.message);
  process.exit(1);
}
