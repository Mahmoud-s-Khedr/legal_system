#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const pnpmBin = "pnpm";
const desktopBackendUrl = process.env.DESKTOP_BACKEND_URL ?? "http://127.0.0.1:7854";

const child = spawn(
  pnpmBin,
  ["--filter", "@elms/frontend", "dev", "--host", "127.0.0.1", "--port", "5173"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_DESKTOP_SHELL: "true",
      VITE_DESKTOP_RUNTIME_VARIANT: "dummy",
      DESKTOP_BACKEND_URL: desktopBackendUrl
    },
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
