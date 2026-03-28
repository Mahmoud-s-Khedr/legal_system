#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";

const repoRoot = process.cwd();
const DOC_ROOT = join(repoRoot, "docs");
const README = join(repoRoot, "README.md");

function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkAll(full, out);
    } else if (st.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function walkMarkdown(dir) {
  return walkAll(dir).filter((p) => extname(p) === ".md");
}

function rel(path) {
  return path.replace(`${repoRoot}/`, "");
}

function slugifyHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function collectHeadings(md) {
  const headings = new Set();
  for (const line of md.split("\n")) {
    const m = line.match(/^#{1,6}\s+(.+)$/);
    if (!m) continue;
    headings.add(slugifyHeading(m[1]));
  }
  return headings;
}

function parseJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const docsFiles = walkMarkdown(DOC_ROOT);
const mdFiles = [README, ...docsFiles];

const errors = [];

// 1) Broken links check (relative links + anchors)
for (const file of mdFiles) {
  const content = readFileSync(file, "utf8");
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[1].trim();
    if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:") || target.startsWith("#")) {
      continue;
    }

    const [linkPathRaw, anchor] = target.split("#");
    const linkPath = linkPathRaw.split("?")[0];
    const resolved = resolve(dirname(file), linkPath);
    if (!existsSync(resolved)) {
      errors.push(`[broken-link] ${rel(file)} -> ${target}`);
      continue;
    }

    if (anchor && extname(resolved) === ".md" && !/^L\d+$/i.test(anchor)) {
      const targetContent = readFileSync(resolved, "utf8");
      const headings = collectHeadings(targetContent);
      const expected = slugifyHeading(anchor);
      if (expected && !headings.has(expected)) {
        errors.push(`[broken-anchor] ${rel(file)} -> ${target}`);
      }
    }
  }
}

// 2) Script references in docs must exist in package scripts
const packageJsons = [
  join(repoRoot, "package.json"),
  ...readdirSync(join(repoRoot, "apps")).map((d) => join(repoRoot, "apps", d, "package.json")).filter(existsSync),
  ...readdirSync(join(repoRoot, "packages")).map((d) => join(repoRoot, "packages", d, "package.json")).filter(existsSync)
];

const knownScripts = new Set();
for (const p of packageJsons) {
  const pkg = parseJson(p);
  for (const scriptName of Object.keys(pkg.scripts ?? {})) {
    knownScripts.add(scriptName);
  }
}

const pnpmBuiltins = new Set([
  "install",
  "add",
  "remove",
  "update",
  "up",
  "exec",
  "dlx",
  "create",
  "why",
  "list",
  "outdated",
  "audit",
  "prune",
  "publish",
  "pack",
  "tsx",
  "turbo"
]);

for (const file of mdFiles) {
  const content = readFileSync(file, "utf8");
  const codeTicks = [...content.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  for (const cmd of codeTicks) {
    if (!cmd.trim().startsWith("pnpm ")) continue;

    // pnpm run <script>
    let m = cmd.match(/\bpnpm\s+run\s+([a-zA-Z0-9:_-]+)/);
    if (m) {
      const script = m[1];
      if (!knownScripts.has(script)) {
        errors.push(`[missing-script] ${rel(file)} references \`${cmd}\` -> \`${script}\``);
      }
      continue;
    }

    // pnpm --filter ... <script>
    m = cmd.match(/\bpnpm(?:\s+--filter\s+\S+)+\s+([a-zA-Z0-9:_-]+)/);
    if (m) {
      const script = m[1];
      if (!pnpmBuiltins.has(script) && !knownScripts.has(script)) {
        errors.push(`[missing-script] ${rel(file)} references \`${cmd}\` -> \`${script}\``);
      }
      continue;
    }

    // plain pnpm <script>
    m = cmd.match(/\bpnpm\s+([a-zA-Z0-9:_-]+)/);
    if (m) {
      const script = m[1];
      if (!pnpmBuiltins.has(script) && !knownScripts.has(script)) {
        errors.push(`[missing-script] ${rel(file)} references \`${cmd}\` -> \`${script}\``);
      }
    }
  }
}

// 3) API route groups in docs/dev/06-api-reference.md must exist in backend routes
const apiDocPath = join(repoRoot, "docs/dev/06-api-reference.md");
if (existsSync(apiDocPath)) {
  const apiDoc = readFileSync(apiDocPath, "utf8");
  const documentedPrefixes = new Set(
    [...apiDoc.matchAll(/`(\/api\/[a-z0-9\/-]+)`/g)]
      .map((m) => m[1])
      .filter((p) => p.startsWith("/api/"))
      .map((p) => {
        const seg = p.split("/").filter(Boolean);
        return `/${seg[0]}/${seg[1]}`;
      })
  );

  const routeFiles = walkAll(join(repoRoot, "packages/backend/src/modules"))
    .filter((p) => p.endsWith(".routes.ts"));
  const actualPrefixes = new Set();
  for (const rf of routeFiles) {
    const src = readFileSync(rf, "utf8");
    for (const m of src.matchAll(/["'`](\/api\/[^"'`\s]+)["'`]/g)) {
      const path = m[1];
      const seg = path.split("/").filter(Boolean);
      actualPrefixes.add(`/${seg[0]}/${seg[1]}`);
    }
  }

  for (const prefix of documentedPrefixes) {
    if (!actualPrefixes.has(prefix)) {
      errors.push(`[missing-route-prefix] docs/dev/06-api-reference.md documents ${prefix} but no matching backend route found`);
    }
  }
}

// 4) Env vars documented in docs/dev/03-environment-variables.md must exist in backend env schema
const envDocPath = join(repoRoot, "docs/dev/03-environment-variables.md");
if (existsSync(envDocPath)) {
  const envDoc = readFileSync(envDocPath, "utf8");
  const documentedVars = new Set(
    [...envDoc.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1])
  );

  const envTs = readFileSync(join(repoRoot, "packages/backend/src/config/env.ts"), "utf8");
  const envSchemaVars = new Set(
    [...envTs.matchAll(/^\s*([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1])
  );

  const allowedNonSchemaTokens = new Set(["CLOUD", "LOCAL", "VITE_SENTRY_DSN", "POSTGRES_PASSWORD"]);

  for (const name of documentedVars) {
    if (!envSchemaVars.has(name) && !allowedNonSchemaTokens.has(name)) {
      errors.push(`[unknown-env-var] docs/dev/03-environment-variables.md mentions ${name} but it is not in env schema`);
    }
  }
}

if (errors.length > 0) {
  console.error(`docs truth verification failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(`docs truth verification passed: ${mdFiles.length} markdown files checked.`);
