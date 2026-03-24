#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";

const REQUIRED_PACKAGE_FILES = [
  ".env.desktop",
  "packages/frontend/dist/index.html",
  "packages/backend/dist/desktop/server.js",
  "packages/backend/prisma/schema.prisma",
  "packages/backend/dist/desktop/node_modules/.prisma/client/package.json",
  "packages/backend/dist/desktop/node_modules/@prisma/engines/package.json",
  "postgres/.layout.env",
];

const REQUIRED_POSTGRES_EXECUTABLES = [
  "postgres",
  "pg_ctl",
  "initdb",
  "createdb",
  "pg_isready",
];

function fail(message) {
  throw new Error(message);
}

function isSafeRelativePath(relativePath) {
  if (!relativePath || relativePath.startsWith("/")) {
    return false;
  }

  const normalized = normalize(relativePath).replace(/\\/g, "/");
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return false;
  }

  return true;
}

function listFiles(rootDir, currentDir = rootDir, files = []) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      listFiles(rootDir, entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath.slice(rootDir.length + 1).replace(/\\/g, "/"));
    }
  }

  return files;
}

function ensureFileExists(path, label) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    fail(`${label} is missing at ${path}`);
  }

  if (!stats.isFile()) {
    fail(`${label} is not a file at ${path}`);
  }
}

function ensureDirectoryExists(path, label) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    fail(`${label} is missing at ${path}`);
  }

  if (!stats.isDirectory()) {
    fail(`${label} is not a directory at ${path}`);
  }
}

function ensureDirectoryHasRealFiles(path, label) {
  ensureDirectoryExists(path, label);

  const files = listFiles(path).filter((file) => !file.endsWith(".gitkeep"));
  if (files.length === 0) {
    fail(`${label} is empty at ${path}`);
  }
}

function parseLayoutManifest(layoutFile) {
  ensureFileExists(layoutFile, "PostgreSQL layout manifest");

  const entries = {};
  for (const rawLine of readFileSync(layoutFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    entries[key] = value;
  }

  return entries;
}

function resolveLayoutEntry(bundleRoot, manifest, key) {
  const relativePath = manifest[key];
  if (!isSafeRelativePath(relativePath)) {
    fail(`PostgreSQL layout manifest contains an unsafe ${key}: ${relativePath ?? "<missing>"}`);
  }

  const resolvedPath = resolve(bundleRoot, relativePath);
  const expectedPrefix = `${resolve(bundleRoot)}${process.platform === "win32" ? "\\" : "/"}`;
  if (resolvedPath !== resolve(bundleRoot) && !resolvedPath.startsWith(expectedPrefix)) {
    fail(`PostgreSQL layout manifest resolves ${key} outside ${bundleRoot}: ${resolvedPath}`);
  }

  return resolvedPath;
}

function findFirstMatchingFile(rootDir, matcher) {
  return listFiles(rootDir).find((file) => matcher(file));
}

function verifyNodeDirectory(nodeDir) {
  ensureDirectoryHasRealFiles(nodeDir, "Node.js resources");

  const candidates = ["node", "node.exe"].map((entry) => join(nodeDir, entry));
  const nodeBinary = candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  });

  if (!nodeBinary) {
    fail(`Node.js resources are missing the bundled runtime binary under ${nodeDir}`);
  }
}

function verifyPostgresBundle(postgresDir) {
  ensureDirectoryHasRealFiles(postgresDir, "PostgreSQL resources");

  const manifest = parseLayoutManifest(join(postgresDir, ".layout.env"));
  const binDir = resolveLayoutEntry(postgresDir, manifest, "POSTGRES_BIN_DIR");
  const shareDir = resolveLayoutEntry(postgresDir, manifest, "POSTGRES_SHARE_DIR");
  const pkgLibDir = resolveLayoutEntry(postgresDir, manifest, "POSTGRES_PKGLIB_DIR");
  const runtimeLibDir = resolveLayoutEntry(postgresDir, manifest, "POSTGRES_RUNTIME_LIB_DIR");

  ensureDirectoryExists(binDir, "Bundled PostgreSQL bin directory");
  ensureDirectoryExists(shareDir, "Bundled PostgreSQL share directory");
  ensureDirectoryExists(pkgLibDir, "Bundled PostgreSQL compiled extension directory");
  ensureDirectoryExists(runtimeLibDir, "Bundled PostgreSQL runtime library directory");

  ensureDirectoryExists(join(shareDir, "timezonesets"), "Bundled PostgreSQL timezone data");

  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  for (const executable of REQUIRED_POSTGRES_EXECUTABLES) {
    ensureFileExists(join(binDir, `${executable}${executableSuffix}`), `Bundled PostgreSQL executable ${executable}`);
  }

  const pkgLibFiles = listFiles(pkgLibDir);
  if (pkgLibFiles.length === 0) {
    fail(`Bundled PostgreSQL compiled extension directory is empty at ${pkgLibDir}`);
  }

  const runtimeFiles = listFiles(runtimeLibDir);
  if (runtimeFiles.length === 0) {
    fail(`Bundled PostgreSQL runtime library directory is empty at ${runtimeLibDir}`);
  }
}

function verifyPackagedDesktopTree(bundleRoot) {
  ensureDirectoryExists(bundleRoot, "Packaged desktop root");

  for (const relativePath of REQUIRED_PACKAGE_FILES) {
    ensureFileExists(join(bundleRoot, relativePath), `Packaged desktop resource ${relativePath}`);
  }

  verifyNodeDirectory(join(bundleRoot, "node"));
  verifyPostgresBundle(join(bundleRoot, "postgres"));

  if (
    !findFirstMatchingFile(
      bundleRoot,
      (file) => /^packages\/backend\/dist\/desktop\/node_modules\/@prisma\/engines\/schema-engine/.test(file)
    )
  ) {
    fail("Packaged desktop bundle is missing the Prisma schema-engine binary");
  }

  if (
    !findFirstMatchingFile(
      bundleRoot,
      (file) =>
        /^packages\/backend\/dist\/desktop\/node_modules\/@prisma\/engines\/(libquery_engine|query_engine)/.test(file)
    )
  ) {
    fail("Packaged desktop bundle is missing the Prisma query-engine binary");
  }

  if (
    !findFirstMatchingFile(
      bundleRoot,
      (file) => /^packages\/backend\/prisma\/migrations\/.+\/migration\.sql$/.test(file)
    )
  ) {
    fail("Packaged desktop bundle is missing Prisma migrations");
  }
}

function verifySourceDesktopResources(repoRoot) {
  verifyNodeDirectory(join(repoRoot, "apps/desktop/resources/node"));
  verifyPostgresBundle(join(repoRoot, "apps/desktop/resources/postgres"));
}

export {
  verifyPackagedDesktopTree,
  verifySourceDesktopResources,
};
