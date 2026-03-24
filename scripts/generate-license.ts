#!/usr/bin/env tsx
/**
 * ELMS Desktop License Generator
 *
 * Generates a signed license file for the ELMS desktop application.
 * The license payload is signed with RSA-2048 PKCS#1v15 + SHA-256.
 * The embedded public key in the Tauri binary (keys/public.pem) must
 * match the private key used here.
 *
 * Usage:
 *   tsx scripts/generate-license.ts \
 *     --firm "Firm Display Name" \
 *     --slug "firm-slug" \
 *     --expires 2027-03-20 \
 *     [--private-key apps/desktop/src-tauri/keys/private.pem] \
 *     [--out elms.license]
 *
 *   When --private-key is omitted a fresh key pair is generated and
 *   the public key PEM is printed to stdout for embedding.
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

const firm = flag("firm");
const slug = flag("slug");
const expiresArg = flag("expires");
const privateKeyPath = flag("private-key");
const outPath = flag("out") ?? "elms.license";

if (!firm || !slug || !expiresArg) {
  console.error(
    "Usage: tsx scripts/generate-license.ts --firm <name> --slug <slug> --expires <YYYY-MM-DD> [--private-key <path>] [--out <path>]"
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
  console.log("\n--- PUBLIC KEY (embed in apps/desktop/src-tauri/keys/public.pem) ---");
  console.log(publicKeyPem);
  console.log("--- END PUBLIC KEY ---\n");
}

// ── Build license payload ─────────────────────────────────────────────────────

const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

// Parse expires as UTC midnight.
const expiresAt = new Date(`${expiresArg}T00:00:00Z`).toISOString().replace(/\.\d{3}Z$/, "Z");
if (isNaN(new Date(expiresAt).getTime())) {
  console.error(`Invalid --expires date: ${expiresArg}. Expected format: YYYY-MM-DD`);
  process.exit(1);
}

// Canonical payload — field order must exactly match LicensePayload in license.rs.
const payload = {
  firm,
  slug,
  issuedAt,
  expiresAt,
  features: ["core"]
};

const payloadJson = JSON.stringify(payload);

// ── Sign ──────────────────────────────────────────────────────────────────────

const sign = createSign("sha256");
sign.update(payloadJson);
sign.end();
const signatureBuffer = sign.sign(privateKeyPem);
const signature = signatureBuffer.toString("base64");

// ── Write license file ────────────────────────────────────────────────────────

const license = { ...payload, signature };
writeFileSync(outPath, JSON.stringify(license, null, 2) + "\n", "utf8");

console.log(`License written to: ${outPath}`);
console.log(`  Firm:    ${firm}`);
console.log(`  Slug:    ${slug}`);
console.log(`  Issued:  ${issuedAt}`);
console.log(`  Expires: ${expiresAt}`);

if (publicKeyPem) {
  console.log(
    "\nTo embed this key, copy the PUBLIC KEY block above into:\n  apps/desktop/src-tauri/keys/public.pem"
  );
}
