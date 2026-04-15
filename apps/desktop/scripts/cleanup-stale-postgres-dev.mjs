#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const targetBinary = resolve(scriptDir, "../src-tauri/target/debug/postgres/bin/postgres");
const LOG_PREFIX = "[desktop:dev-cleanup]";

function log(message) {
  process.stdout.write(`${LOG_PREFIX} ${message}\n`);
}

function warn(message) {
  process.stderr.write(`${LOG_PREFIX} ${message}\n`);
}

function listCandidatePids() {
  const output = execFileSync("ps", ["-eo", "pid=,args="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const pids = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const firstSpace = line.indexOf(" ");
    if (firstSpace <= 0) {
      continue;
    }

    const pidText = line.slice(0, firstSpace).trim();
    const args = line.slice(firstSpace + 1).trim();
    const pid = Number.parseInt(pidText, 10);

    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
      continue;
    }

    if (args.startsWith(targetBinary)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const alive = pids.filter(isAlive);
    if (alive.length === 0) {
      return [];
    }
    await sleep(200);
  }
  return pids.filter(isAlive);
}

async function main() {
  let candidatePids = [];
  try {
    candidatePids = listCandidatePids();
  } catch (error) {
    warn(`Unable to scan process list: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  if (candidatePids.length === 0) {
    log("No stale embedded Postgres process found.");
    return;
  }

  log(
    `Found stale embedded Postgres process${candidatePids.length > 1 ? "es" : ""}: ${candidatePids.join(", ")}`
  );

  for (const pid of candidatePids) {
    if (sendSignal(pid, "SIGTERM")) {
      log(`Sent SIGTERM to PID ${pid}.`);
    }
  }

  let remaining = await waitForExit(candidatePids, 2500);
  if (remaining.length === 0) {
    log("Stale embedded Postgres process cleanup finished.");
    return;
  }

  warn(`PID${remaining.length > 1 ? "s" : ""} still running after SIGTERM: ${remaining.join(", ")}`);
  for (const pid of remaining) {
    if (sendSignal(pid, "SIGKILL")) {
      warn(`Sent SIGKILL to PID ${pid}.`);
    }
  }

  remaining = await waitForExit(remaining, 1000);
  if (remaining.length > 0) {
    warn(`Unable to stop stale PID${remaining.length > 1 ? "s" : ""}: ${remaining.join(", ")}`);
    process.exit(1);
  }

  log("Stale embedded Postgres process cleanup finished.");
}

await main();
