#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const repoRoot = resolve(scriptDir, "../../..");

const subcommand = process.argv[2];
const commandMap = {
  check: ["check", "--manifest-path", "src-tauri/Cargo.toml"],
  test: ["test", "--manifest-path", "src-tauri/Cargo.toml"],
  clippy: ["clippy", "--manifest-path", "src-tauri/Cargo.toml", "--all-targets", "--", "-D", "warnings"],
};

if (!subcommand || !commandMap[subcommand]) {
  console.error("Usage: node ./scripts/cargo-runner.mjs <check|test|clippy>");
  process.exit(2);
}

function ensureDistDirectories() {
  mkdirSync(resolve(repoRoot, "packages/backend/dist/desktop"), { recursive: true });
  mkdirSync(resolve(repoRoot, "packages/frontend/dist"), { recursive: true });
}

function runCargo(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("cargo", args, {
      cwd: desktopRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectRun(new Error(`cargo exited with signal ${signal}`));
        return;
      }

      if ((code ?? 1) !== 0) {
        rejectRun(new Error(`cargo exited with code ${code ?? 1}`));
        return;
      }

      resolveRun();
    });
  });
}

try {
  ensureDistDirectories();
  await runCargo(commandMap[subcommand]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
