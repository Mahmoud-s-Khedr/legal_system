#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { platform, tmpdir } from "node:os";
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

  const productionExampleEnvPath = resolve(desktopRoot, "desktop-env.production.example");
  if (existsSync(productionExampleEnvPath)) {
    return productionExampleEnvPath;
  }

  throw new Error(
    "Desktop env defaults not found. Expected apps/desktop/.env.desktop or apps/desktop/desktop-env.production.example."
  );
}

function parseEnvFile(envPath) {
  const parsed = {};
  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    parsed[key] = value;
  }
  return parsed;
}

function assertDesktopLicensePublicKeyForBuild() {
  const envSourcePath = resolveDesktopEnvSource();
  const envFromFile = parseEnvFile(envSourcePath);
  const envValue = (env.DESKTOP_LICENSE_PUBLIC_KEY ?? envFromFile.DESKTOP_LICENSE_PUBLIC_KEY ?? "").trim();

  if (!envValue) {
    throw new Error(
      `DESKTOP_LICENSE_PUBLIC_KEY is required for desktop build packaging. Set it in process env or ${envSourcePath}.`
    );
  }
}

function withBuildConfigOverride(buildArgs) {
  const tempDir = mkdtempSync(join(tmpdir(), "elms-tauri-config-"));
  const overridePath = join(tempDir, "tauri.bundle.env.json");
  const config = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
  const envSourcePath = resolveDesktopEnvSource();
  const resources = Object.fromEntries(
    Object.entries(config.bundle?.resources ?? {}).filter(([, destination]) => destination !== ".env.desktop")
  );
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
  assertDesktopLicensePublicKeyForBuild();
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
