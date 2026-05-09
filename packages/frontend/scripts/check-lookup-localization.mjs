import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

const DB_LOOKUP_ENUM_NAMES = [
  "CaseType",
  "CourtLevel",
  "CourtType",
  "PartyRole",
  "DocumentType",
  "HearingOutcome",
  "PaymentMethod"
];

const LABEL_AR_ALLOWLIST = new Set([
  "lib/locationLookups.ts",
  "lib/lookupLabel.ts",
  "routes/app/LookupSettingsDetailPage.tsx"
]);

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }

    const isSourceFile = /\.(ts|tsx)$/.test(entry.name);
    const isTestFile = /\.test\.(ts|tsx)$/.test(entry.name);
    if (isSourceFile && !isTestFile) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function formatRelative(filePath) {
  return path.relative(SRC_DIR, filePath).replaceAll("\\", "/");
}

const files = walkFiles(SRC_DIR);
const violations = [];

for (const file of files) {
  const relPath = formatRelative(file);
  const source = fs.readFileSync(file, "utf8");

  const labelArRegex = /\.labelAr\b/g;
  if (!LABEL_AR_ALLOWLIST.has(relPath)) {
    let match;
    while ((match = labelArRegex.exec(source)) !== null) {
      violations.push({
        file: relPath,
        line: lineOf(source, match.index),
        rule: "no-direct-labelAr",
        message: "Avoid direct .labelAr usage in user-facing code; use localized lookup resolver/hook."
      });
    }
  }

  const enumPattern = DB_LOOKUP_ENUM_NAMES.join("|");
  const getEnumLookupRegex = new RegExp(
    String.raw`getEnumLabel\(\s*t\s*,\s*["'](${enumPattern})["']`,
    "g"
  );

  let enumMatch;
  while ((enumMatch = getEnumLookupRegex.exec(source)) !== null) {
    violations.push({
      file: relPath,
      line: lineOf(source, enumMatch.index),
      rule: "no-getEnumLabel-for-db-lookups",
      message: `Do not use getEnumLabel for DB lookup entity \"${enumMatch[1]}\"; use localized lookup resolver/hook.`
    });
  }
}

if (violations.length > 0) {
  console.error(`Lookup localization guard failed with ${violations.length} issue(s):`);
  for (const violation of violations) {
    console.error(
      `- [${violation.rule}] ${violation.file}:${violation.line} ${violation.message}`
    );
  }
  process.exit(1);
}

console.log(`Lookup localization guard passed across ${files.length} source files.`);
