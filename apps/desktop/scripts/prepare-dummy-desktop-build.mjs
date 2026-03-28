#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const pnpmBin = "pnpm";

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: "inherit",
      shell: options.shell ?? (command === pnpmBin && process.platform === "win32")
    });

    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (signal) {
        rejectRun(new Error(`${command} exited with signal ${signal}`));
        return;
      }

      if ((code ?? 1) !== 0) {
        rejectRun(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }

      resolveRun();
    });
  });
}

await run(
  pnpmBin,
  ["--filter", "@elms/frontend", "build"],
  {
    env: {
      ...process.env,
      VITE_DESKTOP_SHELL: "true",
      VITE_DESKTOP_RUNTIME_VARIANT: "dummy",
      VITE_API_BASE_URL: ""
    }
  }
);
