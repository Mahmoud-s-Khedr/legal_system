/**
 * desktop-bundle-extras.mjs
 *
 * After tsup bundles the backend into a single server.js, this script uses
 * `pnpm deploy --prod` to resolve all production dependencies (including the
 * Prisma CLI, which is now a regular dependency) and copies them into
 * dist/node_modules/.
 *
 * Packages are copied individually (not as a single bulk cpSync) because
 * pnpm's --legacy deploy creates top-level entries as relative symlinks into
 * .pnpm/package@ver/node_modules/pkg/. A bulk cpSync triggers Node.js's
 * cycle/inode deduplication and copies only ~36 KB of metadata instead of the
 * full package tree. Per-package copy with dereference:true works correctly.
 *
 * Run after `tsup` in the build:desktop script.
 */

import {
  cpSync,
  mkdirSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const REQUIRED_PRISMA_RUNTIME_PACKAGES = [
  "@prisma/config",
  "@prisma/engines",
  "c12",
  "jiti",
  "dotenv",
  "rc9",
  "destr",
  "effect",
  "fast-check",
  "pure-rand",
  "deepmerge-ts",
  "empathic",
  "defu",
];

const PRISMA_QUERY_ENGINE_PREFIXES = ["libquery_engine", "query_engine"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const backendDir = join(root, "packages", "backend");
const desktopDistDir = join(backendDir, "dist", "desktop");
const workspacePnpmStore = join(root, "node_modules", ".pnpm");
const deployDir = join(root, ".desktop-deploy-tmp", `${Date.now()}-${process.pid}`);
const destNodeModules = join(desktopDistDir, "node_modules");
const swaggerUiStaticDest = join(desktopDistDir, "static");

// ── Clean up previous artifacts ───────────────────────────────────────────────

console.log("[desktop-bundle-extras] Preparing external node_modules ...");

if (existsSync(deployDir)) {
  rmSync(deployDir, { recursive: true, force: true });
}
if (existsSync(destNodeModules)) {
  rmSync(destNodeModules, { recursive: true, force: true });
}

// ── Run pnpm deploy to resolve all symlinks and get real files ────────────────

console.log("[desktop-bundle-extras] Running pnpm deploy --prod ...");
execSync(
  `pnpm --filter @elms/backend deploy --prod --legacy "${deployDir}"`,
  { cwd: root, stdio: "inherit" }
);

const deployedNodeModules = join(deployDir, "node_modules");
if (!existsSync(deployedNodeModules)) {
  throw new Error(`pnpm deploy did not produce node_modules at ${deployedNodeModules}`);
}

// ── Generate Prisma client using the workspace's Prisma CLI ─────────────────

console.log("[desktop-bundle-extras] Running prisma generate ...");
execSync("pnpm --filter @elms/backend exec prisma generate", {
  cwd: root,
  stdio: "inherit"
});

// ── Copy all production packages from deploy output ──────────────────────────
// Phase 1: direct production deps (top-level entries in deploy output)
// Phase 2: hoisted transitive deps (pnpm puts these in .pnpm/node_modules/)
//
// Each package is copied individually with dereference:true so that symlinks
// in pnpm's virtual store are resolved to real files before copying.

console.log("[desktop-bundle-extras] Copying production packages into dist/node_modules ...");
mkdirSync(destNodeModules, { recursive: true });

// Phase 1: direct production deps (top-level entries in deploy output)
let copiedCount = copyPackagesFromDir(deployedNodeModules, destNodeModules);
// Phase 2: hoisted transitive deps (.pnpm/node_modules/)
copiedCount += copyPackagesFromDir(
  join(deployedNodeModules, ".pnpm", "node_modules"),
  destNodeModules
);
// Phase 3: packages only in the versioned pnpm store (e.g. @prisma/engines which
// pnpm does not hoist). Iterate each .pnpm/<pkg@version>/node_modules/ entry.
copiedCount += copyAllFromPnpmStore(
  join(deployedNodeModules, ".pnpm"),
  destNodeModules
);
// Phase 4: explicitly backfill required Prisma runtime packages if any are
// still missing due pnpm layout differences.
copiedCount += copyRequiredPackagesFromDeploy(
  deployedNodeModules,
  destNodeModules,
  REQUIRED_PRISMA_RUNTIME_PACKAGES
);

const copiedSizeKb = getDirSizeKb(destNodeModules);
console.log(`  ✓ ${copiedCount} packages copied (${formatSize(copiedSizeKb)})`);

const swaggerUiStaticSource = join(
  destNodeModules,
  "@fastify",
  "swagger-ui",
  "static"
);
if (existsSync(swaggerUiStaticSource)) {
  cpSync(swaggerUiStaticSource, swaggerUiStaticDest, {
    recursive: true,
    dereference: true
  });
  console.log("  ✓ swagger-ui static assets copied");
}

// ── Validate critical Prisma runtime artifacts ───────────────────────────────

const requiredPrismaRuntimePaths = [
  join(destNodeModules, "prisma", "build", "index.js"),
  join(destNodeModules, "@prisma", "engines", "package.json"),
];

for (const pkg of REQUIRED_PRISMA_RUNTIME_PACKAGES) {
  requiredPrismaRuntimePaths.push(join(destNodeModules, pkg, "package.json"));
}

for (const requiredPath of requiredPrismaRuntimePaths) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Required Prisma runtime artifact missing after copy: ${requiredPath}`);
  }
}

const prismaEnginesDir = join(destNodeModules, "@prisma", "engines");
backfillPrismaEngineBinariesFromWorkspace(workspacePnpmStore, prismaEnginesDir);

const prismaEngineEntries = existsSync(prismaEnginesDir) ? readdirSync(prismaEnginesDir) : [];
const hasSchemaEngine = prismaEngineEntries.some((name) => name.startsWith("schema-engine"));

if (!hasSchemaEngine) {
  throw new Error(
    `Missing Prisma schema-engine binary after copy in ${prismaEnginesDir}`
  );
}

// ── Copy .prisma/client (generated) from workspace node_modules ─────────────
// Prisma generate outputs to the pnpm store. We find it by resolving from the
// @prisma/client package in the workspace.

const workspacePrismaClient = join(root, "node_modules", ".pnpm");
const prismaGenDir = findPrismaGeneratedClient(workspacePrismaClient);
const prismaGenDest = join(destNodeModules, ".prisma", "client");

if (prismaGenDir) {
  mkdirSync(dirname(prismaGenDest), { recursive: true });
  cpSync(prismaGenDir, prismaGenDest, { recursive: true, dereference: true });
  const sizeKb = getDirSizeKb(prismaGenDest);
  console.log(`  ✓ .prisma/client (${formatSize(sizeKb)})`);
} else {
  throw new Error(".prisma/client not found — run 'prisma generate' first");
}

const refreshedEngineEntries = existsSync(prismaEnginesDir) ? readdirSync(prismaEnginesDir) : [];
const hasQueryEngineInEngines = refreshedEngineEntries.some((name) =>
  PRISMA_QUERY_ENGINE_PREFIXES.some((prefix) => name.startsWith(prefix))
);
const prismaClientEntries = readdirSync(prismaGenDest);
const hasQueryEngineInClient = prismaClientEntries.some((name) =>
  PRISMA_QUERY_ENGINE_PREFIXES.some((prefix) => name.startsWith(prefix))
);

if (!hasQueryEngineInEngines && !hasQueryEngineInClient) {
  throw new Error(
    `Missing Prisma query engine library after copy. ` +
      `libquery_engine in @prisma/engines=${hasQueryEngineInEngines}, ` +
      `libquery_engine in .prisma/client=${hasQueryEngineInClient}`
  );
}

// ── Clean up temporary deploy directory ──────────────────────────────────────

rmSync(deployDir, { recursive: true, force: true });

// ── Report total dist size ──────────────────────────────────────────────────

const totalSizeKb = getDirSizeKb(desktopDistDir);
console.log(`[desktop-bundle-extras] Done. Total dist: ${formatSize(totalSizeKb)}`);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Copy all packages from srcDir into dstDir one package at a time.
 * Each package is copied with dereference:true so pnpm symlinks are resolved
 * to real files. Scoped packages (@scope/pkg) are handled by recursing into
 * the scope directory. Already-present packages are skipped to avoid
 * filesystem churn and ENOTEMPTY race conditions while traversing pnpm layouts.
 */
function copyPackagesFromDir(srcDir, dstDir) {
  if (!existsSync(srcDir)) return 0;
  let count = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.name.startsWith("@")) {
      if (entry.name === "@elms") continue; // workspace packages: already bundled or circular
      // Scoped package directory — recurse into it
      mkdirSync(dst, { recursive: true });
      count += copyPackagesFromDir(src, dst);
    } else if (!existsSync(dst)) {
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst, { recursive: true, dereference: true });
      count++;
    }
  }
  return count;
}

/**
 * Walk each versioned entry in pnpmDir (.pnpm/pkg@version/) and copy all
 * packages found inside its node_modules/ into dstDir. Skips the hoisted
 * node_modules/ directory at the top of .pnpm/ (already handled by Phase 2).
 */
function copyAllFromPnpmStore(pnpmDir, dstDir) {
  if (!existsSync(pnpmDir)) return 0;
  let count = 0;
  for (const entry of readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const nodeModulesPath = join(pnpmDir, entry.name, "node_modules");
    if (existsSync(nodeModulesPath)) {
      count += copyPackagesFromDir(nodeModulesPath, dstDir);
    }
  }
  return count;
}

function copyRequiredPackagesFromDeploy(deployedNodeModules, dstNodeModules, packageNames) {
  let count = 0;
  for (const packageName of packageNames) {
    const destinationDir = join(dstNodeModules, packageName);
    const destinationPackageJson = join(destinationDir, "package.json");
    if (existsSync(destinationPackageJson)) {
      continue;
    }

    const sourceDir = findPackageInDeployOutput(deployedNodeModules, packageName);
    if (!sourceDir) {
      continue;
    }

    mkdirSync(dirname(destinationDir), { recursive: true });
    cpSync(sourceDir, destinationDir, { recursive: true, dereference: true });
    count++;
  }

  return count;
}

function findPackageInDeployOutput(deployedNodeModules, packageName) {
  const directCandidates = [
    join(deployedNodeModules, packageName),
    join(deployedNodeModules, ".pnpm", "node_modules", packageName),
  ];

  for (const candidate of directCandidates) {
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  const pnpmStoreDir = join(deployedNodeModules, ".pnpm");
  if (!existsSync(pnpmStoreDir)) {
    return null;
  }

  for (const entry of readdirSync(pnpmStoreDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const candidate = join(pnpmStoreDir, entry.name, "node_modules", packageName);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  return null;
}

function findPrismaGeneratedClient(pnpmDir) {
  // Prisma generates to node_modules/.pnpm/@prisma+client@<version>_*/node_modules/.prisma/client
  try {
    const entries = readdirSync(pnpmDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith("@prisma+client@") && entry.isDirectory()) {
        const candidate = join(pnpmDir, entry.name, "node_modules", ".prisma", "client");
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function backfillPrismaEngineBinariesFromWorkspace(workspacePnpmDir, destinationEnginesDir) {
  mkdirSync(destinationEnginesDir, { recursive: true });
  const sourceEnginesDir = findWorkspacePrismaEnginesDir(workspacePnpmDir);
  if (!sourceEnginesDir) {
    return;
  }

  const binaries = readdirSync(sourceEnginesDir).filter(
    (name) => name.startsWith("schema-engine") || name.startsWith("libquery_engine")
  );

  for (const fileName of binaries) {
    const source = join(sourceEnginesDir, fileName);
    const destination = join(destinationEnginesDir, fileName);
    if (!existsSync(destination)) {
      cpSync(source, destination, { dereference: true });
    }
  }
}

function findWorkspacePrismaEnginesDir(workspacePnpmDir) {
  if (!existsSync(workspacePnpmDir)) {
    return null;
  }

  for (const entry of readdirSync(workspacePnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("@prisma+engines@")) {
      continue;
    }

    const candidate = join(workspacePnpmDir, entry.name, "node_modules", "@prisma", "engines");
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  return null;
}

function getDirSizeKb(dir) {
  let total = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += getDirSizeKb(entryPath);
      } else {
        total += statSync(entryPath).size;
      }
    }
  } catch { /* ignore */ }
  return Math.round(total / 1024);
}

function formatSize(kb) {
  if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}
