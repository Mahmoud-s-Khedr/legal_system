import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const FILE_PATTERN = /\.(ts|tsx)$/;
const invalidClassPattern = /(?:^|\s)[^\s"'`]*accentHover[^\s"'`]*/g;

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(target));
      continue;
    }
    if (FILE_PATTERN.test(entry.name)) {
      files.push(target);
    }
  }
  return files;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, "utf8");
  const matches = [...content.matchAll(invalidClassPattern)];
  for (const match of matches) {
    offenders.push({ file, value: match[0].trim() });
  }
}

if (!offenders.length) {
  console.log("Tailwind token check passed.");
  process.exit(0);
}

console.error("Invalid Tailwind token candidates found:");
for (const offender of offenders) {
  console.error(`- ${path.relative(process.cwd(), offender.file)} -> ${offender.value}`);
}
process.exit(1);
