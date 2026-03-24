#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");
const repoRoot = resolve(packageDir, "../..");
const pnpmBin = "pnpm";

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? packageDir,
      env: options.env ?? process.env,
      stdio: "inherit",
      shell: options.shell ?? (command === pnpmBin && process.platform === "win32"),
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
  ["exec", "tsup", "--clean"],
  {
    env: {
      ...process.env,
      ELMS_BUILD_TARGET: "desktop",
    },
  }
);

await run("node", [resolve(repoRoot, "scripts/desktop-bundle-extras.mjs")], {
  cwd: packageDir,
});
