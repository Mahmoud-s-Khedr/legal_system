#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const env = { ...process.env };
const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const tauriConfigPath = resolve(desktopRoot, "src-tauri/tauri.conf.json");

// linuxdeploy's bundled strip can fail on RELR-enabled libs.
// Ensure plain `pnpm --filter @elms/desktop tauri build` is stable on Linux.
if (platform() === "linux" && args[0] === "build" && !env.NO_STRIP) {
  env.NO_STRIP = "1";
}

function resolveDesktopEnvSource() {
  const localEnvPath = resolve(desktopRoot, ".env.desktop");
  if (existsSync(localEnvPath)) {
    return localEnvPath;
  }

  const exampleEnvPath = resolve(desktopRoot, ".env.desktop.example");
  if (existsSync(exampleEnvPath)) {
    return exampleEnvPath;
  }

  throw new Error(
    "Desktop env defaults not found. Expected apps/desktop/.env.desktop or apps/desktop/.env.desktop.example."
  );
}

function withBuildConfigOverride(buildArgs) {
  const tempDir = mkdtempSync(join(process.cwd(), ".tauri-config-"));
  const overridePath = join(tempDir, "tauri.bundle.env.json");
  const config = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  const envSourcePath = resolveDesktopEnvSource();
  const resources = { ...(config.bundle?.resources ?? {}) };
  resources[envSourcePath] = ".env.desktop";

  writeFileSync(
    overridePath,
    JSON.stringify({
      bundle: {
        resources,
      },
    })
  );

  return {
    args: [buildArgs[0], "--config", overridePath, ...buildArgs.slice(1)],
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

let childArgs = args;
let cleanup = () => {};

if (args[0] === "build") {
  const override = withBuildConfigOverride(args);
  childArgs = override.args;
  cleanup = override.cleanup;
}

const child = spawn("tauri", childArgs, {
  stdio: "inherit",
  shell: true,
  env
});

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  cleanup();
  throw error;
});
