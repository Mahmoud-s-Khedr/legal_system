import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const LOCALES_DIR = path.join(SRC_DIR, "i18n", "locales");
const LANGS = ["ar", "en", "fr"];
const NAMESPACES = ["app", "auth"];

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}

function getLocaleKeys() {
  const keys = {};
  for (const lang of LANGS) {
    keys[lang] = {};
    for (const ns of NAMESPACES) {
      const file = path.join(LOCALES_DIR, lang, `${ns}.json`);
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      keys[lang][ns] = flatten(json);
    }
  }
  return keys;
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

function inferDefaultNamespace(source) {
  const arrCall = source.match(/useTranslation\(\s*\[\s*(["'`])(app|auth)\1/);
  if (arrCall) return arrCall[2];
  const directCall = source.match(/useTranslation\(\s*(["'`])(app|auth)\1\s*\)/);
  if (directCall) return directCall[2];
  return "app";
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function extractCalls(file, source) {
  const calls = [];
  const defaultNs = inferDefaultNamespace(source);
  const regex = /\bt\(\s*(["'`])([^"'`]+)\1/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const rawKey = match[2];
    if (rawKey.includes("${")) continue;

    let ns = defaultNs;
    let key = rawKey;
    const colonIdx = rawKey.indexOf(":");
    if (colonIdx > 0) {
      ns = rawKey.slice(0, colonIdx);
      key = rawKey.slice(colonIdx + 1);
    }

    if (!NAMESPACES.includes(ns)) continue;
    calls.push({ file, line: lineOf(source, match.index), ns, key });
  }
  return calls;
}

const localeKeys = getLocaleKeys();
const files = walkFiles(SRC_DIR);
const calls = files.flatMap((file) => extractCalls(file, fs.readFileSync(file, "utf8")));

const missing = [];
for (const call of calls) {
  for (const lang of LANGS) {
    if (!localeKeys[lang][call.ns].has(call.key)) {
      missing.push({ lang, ...call });
    }
  }
}

if (missing.length) {
  console.error(`Found ${missing.length} missing i18n key references:`);
  for (const m of missing) {
    const rel = path.relative(process.cwd(), m.file);
    console.error(`- [${m.lang}] ${m.ns}.${m.key} -> ${rel}:${m.line}`);
  }
  process.exit(1);
}

console.log(`i18n check passed: ${calls.length} translation calls verified across ${LANGS.join(", ")}.`);
