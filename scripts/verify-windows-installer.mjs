#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { accessSync, chmodSync, constants, existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPackagedDesktopTreeRoot } from "./desktop-resource-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function usage() {
  console.error("Usage: node scripts/verify-windows-installer.mjs <installer.exe>");
  console.error("   or: node scripts/verify-windows-installer.mjs --release-root <dir>");
}

function resolve7ZipBinary() {
  for (const candidate of ["7z", "7zz", "bsdtar"]) {
    const result = spawnSync("bash", ["-lc", `command -v ${candidate}`], { encoding: "utf8" });
    if (result.status === 0) {
      return { binary: result.stdout.trim(), kind: candidate };
    }
  }

  const requireFromRoot = createRequire(join(repoRoot, "package.json"));
  const { path7za } = requireFromRoot("7zip-bin");
  chmodSync(path7za, 0o755);
  accessSync(path7za, constants.X_OK);
  return { binary: path7za, kind: "7za" };
}

function verifySearchRoot(searchRoot, label) {
  const resolvedSearchRoot = resolve(searchRoot);
  const resolvedRoot = findPackagedDesktopTreeRoot(resolvedSearchRoot);
  console.log(`Windows installer payload verified at ${resolvedRoot} from ${label}.`);
}

function extractWith7Zip(binary, installerPath, extractionRoot) {
  const result = spawnSync(binary, ["x", `-o${extractionRoot}`, "-y", installerPath], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      `7-Zip extraction failed for ${installerPath}: ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`
    );
  }
}

function extractWithBsdtar(binary, installerPath, extractionRoot) {
  const result = spawnSync(binary, ["-xf", installerPath, "-C", extractionRoot], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      `bsdtar extraction failed for ${installerPath}: ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`
    );
  }
}

const args = process.argv.slice(2);
const releaseRootFlagIndex = args.indexOf("--release-root");

let installerPath = "";
let releaseRoot = "";

if (releaseRootFlagIndex !== -1) {
  releaseRoot = args[releaseRootFlagIndex + 1] ?? "";
  if (!releaseRoot) {
    usage();
    process.exit(1);
  }

  const nsisDir = resolve(releaseRoot, "bundle/nsis");
  const exeCandidate = spawnSync(
    "bash",
    ["-lc", `shopt -s nullglob; files=("${nsisDir}"/*.exe); [[ \${#files[@]} -gt 0 ]] && printf '%s' "\${files[0]}"`],
    { encoding: "utf8" }
  );
  installerPath = exeCandidate.stdout.trim();
} else {
  installerPath = args[0] ?? "";
}

if (!installerPath) {
  usage();
  process.exit(1);
}

const resolvedInstaller = resolve(installerPath);
if (!existsSync(resolvedInstaller)) {
  console.error(`Windows installer not found at ${resolvedInstaller}`);
  process.exit(1);
}

if (releaseRoot) {
  try {
    verifySearchRoot(releaseRoot, "release tree");
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Release-tree verification failed, falling back to installer extraction: ${message}`);
  }
}

const extractionRoot = mkdtempSync(join(tmpdir(), "elms-windows-installer-"));

try {
  const { binary, kind } = resolve7ZipBinary();
  if (kind === "bsdtar") {
    extractWithBsdtar(binary, resolvedInstaller, extractionRoot);
  } else {
    extractWith7Zip(binary, resolvedInstaller, extractionRoot);
  }

  verifySearchRoot(extractionRoot, "extracted NSIS payload");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(extractionRoot, { recursive: true, force: true });
}
