/**
 * i18n-audit.ts
 *
 * Finds translation keys present in `en` but missing in `ar` or `fr`
 * across all locale JSON files in packages/frontend/src/i18n/locales/.
 *
 * Usage:
 *   pnpm tsx scripts/i18n-audit.ts
 *   pnpm tsx scripts/i18n-audit.ts --fix   # exits with code 1 if any keys missing
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "../packages/frontend/src/i18n/locales");
const LANGS = ["ar", "en", "fr"] as const;
const REFERENCE_LANG = "en";

// ── Helpers ───────────────────────────────────────────────────────────────────

type JsonObject = {
  [key: string]: JsonValue;
};

type JsonValue = string | JsonObject;

/** Flatten a nested JSON object into dot-notation keys */
function flattenKeys(obj: Record<string, JsonValue>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      keys.push(...flattenKeys(v as Record<string, JsonValue>, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

function loadLocale(lang: string, namespace: string): Record<string, JsonValue> {
  const path = join(localesDir, lang, `${namespace}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, JsonValue>;
  } catch {
    return {};
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const namespaces = readdirSync(join(localesDir, REFERENCE_LANG))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

let totalMissing = 0;

for (const ns of namespaces) {
  const referenceData = loadLocale(REFERENCE_LANG, ns);
  const referenceKeys = flattenKeys(referenceData);

  const missingByLang: Record<string, string[]> = {};

  for (const lang of LANGS) {
    if (lang === REFERENCE_LANG) continue;
    const langData = loadLocale(lang, ns);
    const langKeys = new Set(flattenKeys(langData));
    const missing = referenceKeys.filter((k) => !langKeys.has(k));
    if (missing.length > 0) {
      missingByLang[lang] = missing;
    }
  }

  if (Object.keys(missingByLang).length > 0) {
    console.log(`\n📁 ${ns}.json`);
    for (const [lang, keys] of Object.entries(missingByLang)) {
      console.log(`  ❌ [${lang}] missing ${keys.length} key(s):`);
      for (const key of keys) {
        console.log(`       • ${key}`);
      }
      totalMissing += keys.length;
    }
  } else {
    console.log(`✅ ${ns}.json — complete`);
  }
}

console.log(`\n──────────────────────────────`);
if (totalMissing === 0) {
  console.log(`✅ All translations complete.`);
} else {
  console.log(`⚠️  Total missing keys: ${totalMissing}`);
  const failOnMissing = process.argv.includes("--fail");
  if (failOnMissing) {
    process.exit(1);
  }
}
