#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
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

function parseProcCmdline(cmdlineBuffer) {
  const raw = cmdlineBuffer.toString("utf8").replace(/\u0000+$/u, "");
  if (!raw) {
    return "<unknown command>";
  }

  return raw.replace(/\u0000/gu, " ").trim();
}

function normalizeProcExePath(path) {
  return path.replace(/ \(deleted\)$/u, "");
}

function findExecutableHolders(candidatePaths) {
  if (process.platform === "win32") {
    return [];
  }

  const candidateSet = new Set(candidatePaths);
  const holders = [];

  let procEntries = [];
  try {
    procEntries = readdirSync("/proc", { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  for (const pid of procEntries) {
    try {
      const exePath = normalizeProcExePath(readlinkSync(`/proc/${pid}/exe`));
      if (!candidateSet.has(exePath)) {
        continue;
      }

      const cmdline = parseProcCmdline(readFileSync(`/proc/${pid}/cmdline`));
      holders.push({
        pid,
        exePath,
        cmdline,
      });
    } catch {
      // Ignore transient / permission denied process entries.
    }
  }

  return holders;
}

function findPostgresExecutableCandidates() {
  const executableNames = ["postgres", "pg_ctl", "initdb", "createdb", "pg_isready"];
  const resourceBinDir = resolve(desktopRoot, "resources/postgres/bin");
  const targetDirs = [
    resolve(desktopRoot, "src-tauri/target/debug/postgres/bin"),
    resolve(desktopRoot, "src-tauri/target/release/postgres/bin"),
  ];

  const candidates = [];
  for (const executableName of executableNames) {
    const possiblePaths = [
      resolve(resourceBinDir, executableName),
      ...targetDirs.map((dir) => resolve(dir, executableName)),
    ];

    for (const path of possiblePaths) {
      try {
        const stats = statSync(path);
        if (stats.isFile()) {
          candidates.push(path);
        }
      } catch {
        // Ignore missing paths.
      }
    }
  }

  return candidates;
}

function runPreflightChecks() {
  const candidates = findPostgresExecutableCandidates();
  if (candidates.length === 0) {
    return;
  }

  const holders = findExecutableHolders(candidates);
  if (holders.length === 0) {
    return;
  }

  console.error("[cargo-runner] Desktop compile preflight failed: bundled PostgreSQL executables are currently in use.");
  for (const holder of holders) {
    console.error(`  - pid=${holder.pid} exe=${holder.exePath}`);
    console.error(`    cmd=${holder.cmdline}`);
  }

  console.error(
    "[cargo-runner] Stop running desktop/tauri processes that own these binaries, then retry `pnpm --filter @elms/desktop cargo:check`."
  );
  process.exit(1);
}

function resolveCargoEnvironment(currentSubcommand) {
  const env = { ...process.env };

  if (currentSubcommand === "check" && !env.CARGO_TARGET_DIR) {
    const isolatedCheckTarget = resolve(desktopRoot, "src-tauri/target/check-isolated");
    mkdirSync(isolatedCheckTarget, { recursive: true });
    env.CARGO_TARGET_DIR = isolatedCheckTarget;
  }

  return env;
}

function runCargo(args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("cargo", args, {
      cwd: desktopRoot,
      env,
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
  runPreflightChecks();
  const cargoEnv = resolveCargoEnvironment(subcommand);
  await runCargo(commandMap[subcommand], cargoEnv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
