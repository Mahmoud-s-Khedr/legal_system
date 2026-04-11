#!/usr/bin/env tsx
/**
 * ELMS Activation Key Generator
 *
 * Default mode: generates an activation key in the backend format:
 *   <base64(payload-json)>.<base64(signature)>
 * where signature = RSA-SHA256(payloadB64).
 *
 * Legacy mode (--legacy-json): generates the historical JSON license file.
 *
 * Usage:
 *   tsx scripts/generate-license.ts \
 *     --firm-id "uuid" \
 *     --edition-key solo_offline \
 *     --expires-at 2027-03-20 \
 *     [--private-key apps/desktop/src-tauri/keys/private.pem] \
 *     [--out activation.key]
 *
 *   When --private-key is omitted a fresh key pair is generated and
 *   the public key PEM is printed to stdout for embedding in:
 *   apps/desktop/src-tauri/resources/elms_pub.pem (or DESKTOP_LICENSE_PUBLIC_KEY env).
 */

import { createSign, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const legacyJsonMode = hasFlag("legacy-json");

const firmId = flag("firm-id");
const editionKey = flag("edition-key");
const expiresAtArg = flag("expires-at");

const legacyFirm = flag("firm");
const legacySlug = flag("slug");
const legacyExpires = flag("expires");
const privateKeyPath = flag("private-key");
const outPath = flag("out");

if (!legacyJsonMode && (!firmId || !editionKey || !expiresAtArg)) {
  console.error(
    "Usage: tsx scripts/generate-license.ts --firm-id <uuid> --edition-key <edition> --expires-at <YYYY-MM-DD> [--private-key <path>] [--out <path>]"
  );
  process.exit(1);
}

if (legacyJsonMode && (!legacyFirm || !legacySlug || !legacyExpires)) {
  console.error(
    "Legacy mode usage: tsx scripts/generate-license.ts --legacy-json --firm <name> --slug <slug> --expires <YYYY-MM-DD> [--private-key <path>] [--out <path>]"
  );
  process.exit(1);
}

const EDITION_KEYS = [
  "solo_offline",
  "solo_online",
  "local_firm_offline",
  "local_firm_online",
  "enterprise"
] as const;

if (editionKey && !EDITION_KEYS.includes(editionKey as (typeof EDITION_KEYS)[number])) {
  console.error(
    `Invalid --edition-key: ${editionKey}. Expected one of: ${EDITION_KEYS.join(", ")}`
  );
  process.exit(1);
}

// ── Key handling ──────────────────────────────────────────────────────────────

let privateKeyPem: string;
let publicKeyPem: string | null = null;

if (privateKeyPath) {
  privateKeyPem = readFileSync(privateKeyPath, "utf8");
} else {
  console.log("No --private-key provided — generating a fresh RSA-2048 key pair.");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  privateKeyPem = privateKey as string;
  publicKeyPem = publicKey as string;
  console.log("\n--- PUBLIC KEY (embed in apps/desktop/src-tauri/resources/elms_pub.pem) ---");
  console.log(publicKeyPem);
  console.log("--- END PUBLIC KEY ---\n");
}

// ── Date helpers ───────────────────────────────────────────────────────────────

const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

function parseDateAtUtcMidnight(value: string, optionName: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (isNaN(parsed.getTime())) {
    console.error(`Invalid ${optionName} date: ${value}. Expected format: YYYY-MM-DD`);
    process.exit(1);
  }

  return parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── Sign helper ────────────────────────────────────────────────────────────────

function signBase64Payload(payloadB64: string): string {
  const sign = createSign("RSA-SHA256");
  sign.update(payloadB64);
  sign.end();
  return sign.sign(privateKeyPem).toString("base64");
}

if (legacyJsonMode) {
  // ── Legacy JSON mode (compatibility only) ───────────────────────────────────
  const expiresAt = parseDateAtUtcMidnight(legacyExpires!, "--expires");

  const payload = {
    firm: legacyFirm!,
    slug: legacySlug!,
    issuedAt,
    expiresAt,
    features: ["core"]
  };

  const payloadJson = JSON.stringify(payload);
  const sign = createSign("sha256");
  sign.update(payloadJson);
  sign.end();
  const signature = sign.sign(privateKeyPem).toString("base64");

  const license = { ...payload, signature };
  const outputPath = outPath ?? "elms.license";
  writeFileSync(outputPath, JSON.stringify(license, null, 2) + "\n", "utf8");

  console.log(`Legacy JSON license written to: ${outputPath}`);
  console.log(`  Firm:    ${legacyFirm}`);
  console.log(`  Slug:    ${legacySlug}`);
  console.log(`  Issued:  ${issuedAt}`);
  console.log(`  Expires: ${expiresAt}`);

  if (publicKeyPem) {
    console.log(
      "\nTo embed this key, copy the PUBLIC KEY block above into:\n  apps/desktop/src-tauri/resources/elms_pub.pem"
    );
  }
  process.exit(0);
}

// ── Activation key mode (default) ─────────────────────────────────────────────

const expiresAt = parseDateAtUtcMidnight(expiresAtArg!, "--expires-at");
const payload = {
  firmId: firmId!,
  editionKey: editionKey!,
  expiresAt
};
const payloadJson = JSON.stringify(payload);
const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64");
const signatureB64 = signBase64Payload(payloadB64);
const activationKey = `${payloadB64}.${signatureB64}`;

if (outPath) {
  writeFileSync(outPath, activationKey + "\n", "utf8");
  console.log(`Activation key written to: ${outPath}`);
}

console.log("\nActivation key:");
console.log(activationKey);
console.log("\nPayload:");
console.log(JSON.stringify(payload, null, 2));

if (publicKeyPem) {
  console.log(
    "\nTo embed this key, copy the PUBLIC KEY block above into:\n  apps/desktop/src-tauri/resources/elms_pub.pem"
  );
}

if (!outPath) {
  console.log("\nTip: pass --out <path> to save the activation key to a file.");
}

if (hasFlag("firm") || hasFlag("slug") || hasFlag("expires")) {
  console.log("\nNote: --firm/--slug/--expires are legacy flags and only apply with --legacy-json.");
}

if (!firmId || !editionKey || !expiresAtArg) {
  // Should be unreachable due to earlier guard, but keeps type narrowing explicit.
  process.exit(1);
}
