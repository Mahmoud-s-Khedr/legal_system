import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type Evidence = {
  file: string;
  line: number;
  snippet: string;
};

type ModelField = {
  name: string;
  type: string;
};

type ModelDef = {
  name: string;
  delegate: string;
  fields: ModelField[];
};

type EnumDef = {
  name: string;
  values: string[];
};

type SourceFile = {
  relPath: string;
  content: string;
  lines: string[];
};

const REPO_ROOT = process.cwd();
const SCHEMA_PATH = path.join(REPO_ROOT, "packages/backend/prisma/schema.prisma");
const RUNTIME_ROOTS = [
  path.join(REPO_ROOT, "packages/backend/src"),
  path.join(REPO_ROOT, "packages/frontend/src")
];
const EXCLUDED_PATH_SEGMENTS = [
  `${path.sep}packages${path.sep}backend${path.sep}src${path.sep}security${path.sep}`,
  `${path.sep}node_modules${path.sep}`
];

function toPosix(input: string): string {
  return input.split(path.sep).join("/");
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDelegate(modelName: string): string {
  return modelName[0].toLowerCase() + modelName.slice(1);
}

function isRuntimeFile(absPath: string): boolean {
  if (!absPath.endsWith(".ts") && !absPath.endsWith(".tsx") && !absPath.endsWith(".js") && !absPath.endsWith(".mjs")) {
    return false;
  }
  const normalized = absPath;
  if (EXCLUDED_PATH_SEGMENTS.some((segment) => normalized.includes(segment))) return false;
  if (/\.test\./.test(normalized) || /\.spec\./.test(normalized)) return false;
  return true;
}

function walkFiles(dir: string, out: string[]) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isRuntimeFile(fullPath)) continue;
    out.push(fullPath);
  }
}

function loadRuntimeFiles(): SourceFile[] {
  const files: string[] = [];
  for (const root of RUNTIME_ROOTS) {
    if (!statSync(root).isDirectory()) continue;
    walkFiles(root, files);
  }
  files.sort();
  return files.map((absPath) => {
    const content = readFileSync(absPath, "utf8");
    return {
      relPath: toPosix(path.relative(REPO_ROOT, absPath)),
      content,
      lines: content.split(/\r?\n/)
    };
  });
}

function parseSchema(schema: string): { models: ModelDef[]; enums: EnumDef[] } {
  const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const enumBlocks = [...schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];

  const models: ModelDef[] = modelBlocks.map((match) => {
    const modelName = match[1];
    const body = match[2];
    const fields: ModelField[] = [];
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;
      const name = tokens[0];
      const type = tokens[1].replace(/\?|\[]/g, "");
      if (name.startsWith("@")) continue;
      fields.push({ name, type });
    }
    return {
      name: modelName,
      delegate: toDelegate(modelName),
      fields
    };
  });

  const enums: EnumDef[] = enumBlocks.map((match) => {
    const enumName = match[1];
    const values: string[] = [];
    for (const rawLine of match[2].split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;
      if (/^[A-Z0-9_]+$/.test(line)) values.push(line);
    }
    return { name: enumName, values };
  });

  return { models, enums };
}

function collectEvidence(files: SourceFile[], regex: RegExp, max = 5): Evidence[] {
  const out: Evidence[] = [];
  for (const file of files) {
    for (let i = 0; i < file.lines.length; i += 1) {
      const line = file.lines[i];
      regex.lastIndex = 0;
      if (!regex.test(line)) continue;
      out.push({
        file: file.relPath,
        line: i + 1,
        snippet: line.trim()
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}

function countMatches(files: SourceFile[], regex: RegExp): number {
  let count = 0;
  for (const file of files) {
    for (const line of file.lines) {
      regex.lastIndex = 0;
      if (regex.test(line)) count += 1;
    }
  }
  return count;
}

function confidenceLabel(level: "high" | "medium"): string {
  return level === "high" ? "High" : "Medium";
}

function printEvidence(evidence: Evidence[]) {
  for (const item of evidence) {
    console.log(`  - ${item.file}:${item.line} — \`${item.snippet}\``);
  }
}

function main() {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const runtimeFiles = loadRuntimeFiles();
  const { models, enums } = parseSchema(schema);
  const modelNames = new Set(models.map((m) => m.name));

  const modelDirect = new Map<
    string,
    {
      prismaEvidence: Evidence[];
      txEvidence: Evidence[];
    }
  >();
  for (const model of models) {
    const prismaRegex = new RegExp(`\\bprisma\\.${escapeRegex(model.delegate)}\\b`);
    const txRegex = new RegExp(`\\btx\\.${escapeRegex(model.delegate)}\\b`);
    modelDirect.set(model.name, {
      prismaEvidence: collectEvidence(runtimeFiles, prismaRegex, 3),
      txEvidence: collectEvidence(runtimeFiles, txRegex, 3)
    });
  }

  const inboundRelationFieldNames = new Map<string, string[]>();
  for (const target of models) inboundRelationFieldNames.set(target.name, []);
  for (const source of models) {
    for (const field of source.fields) {
      if (!modelNames.has(field.type)) continue;
      inboundRelationFieldNames.get(field.type)?.push(field.name);
    }
  }

  const sectionAUnusedModels: Array<{ name: string; confidence: "high" }> = [];
  const sectionAUnusedEnums: Array<{ name: string; confidence: "high" }> = [];
  const sectionBIndirectModels: Array<{
    name: string;
    relationFields: string[];
    evidence: Evidence[];
    confidence: "medium" | "high";
  }> = [];
  const sectionBValueEnums: Array<{
    name: string;
    valuesHit: string[];
    evidence: Evidence[];
    confidence: "medium";
  }> = [];
  const sectionCNonIssues: Array<{
    name: string;
    reason: string;
    evidence: Evidence[];
    confidence: "high" | "medium";
  }> = [];

  for (const model of models) {
    const direct = modelDirect.get(model.name)!;
    const directEvidence = [...direct.prismaEvidence, ...direct.txEvidence];
    if (directEvidence.length > 0) {
      const txOnly = direct.prismaEvidence.length === 0 && direct.txEvidence.length > 0;
      if (txOnly) {
        sectionCNonIssues.push({
          name: model.name,
          reason: "Runtime usage exists through transaction client (`tx.*`) only.",
          evidence: direct.txEvidence,
          confidence: "high"
        });
      }
      continue;
    }

    const relationFields = [...new Set(inboundRelationFieldNames.get(model.name) ?? [])];
    const relationEvidence: Evidence[] = [];
    for (const fieldName of relationFields) {
      const fieldRegex = new RegExp(`\\b${escapeRegex(fieldName)}\\s*:\\s*\\{`);
      const hits = collectEvidence(runtimeFiles, fieldRegex, 3);
      relationEvidence.push(...hits);
      if (relationEvidence.length >= 4) break;
    }

    if (relationEvidence.length > 0) {
      sectionBIndirectModels.push({
        name: model.name,
        relationFields,
        evidence: relationEvidence.slice(0, 4),
        confidence: relationEvidence.length >= 2 ? "high" : "medium"
      });
      continue;
    }

    sectionAUnusedModels.push({ name: model.name, confidence: "high" });
  }

  for (const enumDef of enums) {
    const enumNameRegex = new RegExp(`\\b${escapeRegex(enumDef.name)}\\b`);
    const nameEvidence = collectEvidence(runtimeFiles, enumNameRegex, 3);
    if (nameEvidence.length > 0) continue;

    const valuesHit: string[] = [];
    const valueEvidence: Evidence[] = [];
    for (const value of enumDef.values) {
      const valueRegex = new RegExp(`["'\`]${escapeRegex(value)}["'\`]`);
      const hits = collectEvidence(runtimeFiles, valueRegex, 2);
      if (hits.length > 0) {
        valuesHit.push(value);
        valueEvidence.push(...hits);
      }
    }

    if (valuesHit.length > 0) {
      sectionBValueEnums.push({
        name: enumDef.name,
        valuesHit,
        evidence: valueEvidence.slice(0, 4),
        confidence: "medium"
      });
      continue;
    }

    sectionAUnusedEnums.push({ name: enumDef.name, confidence: "high" });
  }

  sectionAUnusedModels.sort((a, b) => a.name.localeCompare(b.name));
  sectionAUnusedEnums.sort((a, b) => a.name.localeCompare(b.name));
  sectionBIndirectModels.sort((a, b) => a.name.localeCompare(b.name));
  sectionBValueEnums.sort((a, b) => a.name.localeCompare(b.name));
  sectionCNonIssues.sort((a, b) => a.name.localeCompare(b.name));

  console.log("# Runtime-Only Unused Schema Audit (Model/Enum, With Evidence)");
  console.log("");
  console.log("## Scope");
  console.log("- Included: `packages/backend/src/**`, `packages/frontend/src/**`");
  console.log("- Excluded: `**/*.test.*`, `**/*.spec.*`, `packages/backend/src/security/**`, `packages/backend/prisma/seed.ts`, `packages/backend/prisma/migrations/**`");
  console.log("");

  console.log("## Section A: Unused Models/Enums");
  if (sectionAUnusedModels.length === 0 && sectionAUnusedEnums.length === 0) {
    console.log("- None.");
  } else {
    for (const model of sectionAUnusedModels) {
      console.log(`- Model \`${model.name}\` — **Unused** (confidence: ${confidenceLabel(model.confidence)})`);
      const delegateRegex = new RegExp(`\\b(?:prisma|tx)\\.${escapeRegex(toDelegate(model.name))}\\b`);
      console.log(`  - Delegate scan lines matched: ${countMatches(runtimeFiles, delegateRegex)}`);
    }
    for (const enumDef of sectionAUnusedEnums) {
      console.log(`- Enum \`${enumDef.name}\` — **Unused** (confidence: ${confidenceLabel(enumDef.confidence)})`);
      const enumRegex = new RegExp(`\\b${escapeRegex(enumDef.name)}\\b`);
      console.log(`  - Enum-name scan lines matched: ${countMatches(runtimeFiles, enumRegex)}`);
      const valueMatches = enumDef.values
        .map((value) => {
          const valueRegex = new RegExp(`["'\`]${escapeRegex(value)}["'\`]`);
          return countMatches(runtimeFiles, valueRegex);
        })
        .reduce((sum, n) => sum + n, 0);
      console.log(`  - Enum-value literal scan lines matched: ${valueMatches}`);
    }
  }
  console.log("");

  console.log("## Section B: Borderline / Indirectly Used");
  if (sectionBIndirectModels.length === 0 && sectionBValueEnums.length === 0) {
    console.log("- None.");
  } else {
    for (const model of sectionBIndirectModels) {
      console.log(
        `- Model \`${model.name}\` — **Indirectly used** (confidence: ${confidenceLabel(model.confidence)})`
      );
      console.log(`  - Relation fields found in runtime writes/includes: ${model.relationFields.join(", ") || "(none)"}`);
      printEvidence(model.evidence);
    }
    for (const enumDef of sectionBValueEnums) {
      console.log(`- Enum \`${enumDef.name}\` — **Used via string literals** (confidence: ${confidenceLabel(enumDef.confidence)})`);
      console.log(`  - Enum values observed at runtime: ${enumDef.valuesHit.join(", ")}`);
      printEvidence(enumDef.evidence);
    }
  }
  console.log("");

  console.log("## Section C: Non-Issues (Initially Suspicious, Proven Used)");
  if (sectionCNonIssues.length === 0) {
    console.log("- None.");
  } else {
    for (const item of sectionCNonIssues) {
      console.log(`- Model \`${item.name}\` — **Used** (confidence: ${confidenceLabel(item.confidence)})`);
      console.log(`  - ${item.reason}`);
      printEvidence(item.evidence);
    }
  }
}

main();
