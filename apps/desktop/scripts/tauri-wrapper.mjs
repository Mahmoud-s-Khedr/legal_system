#!/usr/bin/env node
import { spawn } from "node:child_process";
import { platform } from "node:os";

const args = process.argv.slice(2);
const env = { ...process.env };

// linuxdeploy's bundled strip can fail on RELR-enabled libs.
// Ensure plain `pnpm --filter @elms/desktop tauri build` is stable on Linux.
if (platform() === "linux" && args[0] === "build" && !env.NO_STRIP) {
  env.NO_STRIP = "1";
}

const child = spawn("tauri", args, {
  stdio: "inherit",
  shell: true,
  env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
