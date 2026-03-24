import { createHash, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FirmLifecycleStatus, type EditionKey } from "@elms/shared";
import { prisma } from "../../db/prisma.js";

// ── License payload shape ────────────────────────────────────────────────────

export interface LicensePayload {
  firmId: string;
  editionKey: EditionKey;
  expiresAt: string; // ISO date
  firmName: string;
}

// ── Public key resolution ─────────────────────────────────────────────────────
// The key is embedded at build time via the file at
// apps/desktop/src-tauri/resources/elms_pub.pem, or set via the
// DESKTOP_LICENSE_PUBLIC_KEY env var for testing/CI.

function getPublicKey(): string {
  if (process.env.DESKTOP_LICENSE_PUBLIC_KEY) {
    const raw = process.env.DESKTOP_LICENSE_PUBLIC_KEY;
    // Accept either raw PEM or base64-encoded PEM
    if (raw.startsWith("-----")) return raw;
    return Buffer.from(raw, "base64").toString("utf-8");
  }

  // Attempt to load from the embedded resource path (Tauri sidecar context)
  const candidates = [
    join(process.cwd(), "resources", "elms_pub.pem"),
    join(process.cwd(), "..", "..", "apps", "desktop", "src-tauri", "resources", "elms_pub.pem")
  ];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf-8");
    } catch {
      // not found at this path, try next
    }
  }

  throw new Error(
    "ELMS license public key not found. Set DESKTOP_LICENSE_PUBLIC_KEY env var or provide elms_pub.pem."
  );
}

// ── Core validation ───────────────────────────────────────────────────────────

/**
 * Decode and verify an RSA-SHA256 signed license key.
 * The key is a Base64 string encoding: `<base64(JSON payload)>.<base64(signature)>`
 */
export function decodeLicenseKey(licenseKey: string): {
  payload: LicensePayload;
  raw: string;
} {
  const trimmed = licenseKey.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx === -1) {
    throw Object.assign(new Error("Invalid license key format"), { statusCode: 400 });
  }

  const payloadB64 = trimmed.slice(0, dotIdx);
  const signatureB64 = trimmed.slice(dotIdx + 1);

  const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadJson) as LicensePayload;
  } catch {
    throw Object.assign(new Error("License key payload is not valid JSON"), { statusCode: 400 });
  }

  // Verify RSA-SHA256 signature
  const publicKey = getPublicKey();
  const verify = createVerify("RSA-SHA256");
  verify.update(payloadB64);
  const valid = verify.verify(publicKey, signatureB64, "base64");

  if (!valid) {
    throw Object.assign(new Error("License key signature is invalid"), { statusCode: 400 });
  }

  return { payload, raw: trimmed };
}

// ── activateLicense ───────────────────────────────────────────────────────────

/**
 * Validate and activate a license key for a firm.
 * Transitions the firm to LICENSED status and stores the key hash.
 */
export async function activateLicense(
  firmId: string,
  licenseKey: string
): Promise<{ editionKey: EditionKey; expiresAt: string; firmName: string }> {
  const { payload } = decodeLicenseKey(licenseKey);

  // Guard: firmId must match
  if (payload.firmId !== firmId) {
    throw Object.assign(
      new Error("License key is not issued for this firm"),
      { statusCode: 400 }
    );
  }

  // Guard: license must not be expired
  if (new Date(payload.expiresAt) <= new Date()) {
    throw Object.assign(new Error("License key has expired"), { statusCode: 400 });
  }

  // Store SHA-256 hash of the raw key (never store the key itself)
  const keyHash = createHash("sha256").update(licenseKey.trim()).digest("hex");
  const now = new Date();

  await prisma.$transaction([
    prisma.firmSettings.update({
      where: { firmId },
      data: {
        licenseKeyHash: keyHash,
        licenseActivatedAt: now
      }
    }),
    prisma.firm.update({
      where: { id: firmId },
      data: {
        lifecycleStatus: FirmLifecycleStatus.LICENSED as never,
        editionKey: payload.editionKey as never
      }
    })
  ]);

  return {
    editionKey: payload.editionKey,
    expiresAt: payload.expiresAt,
    firmName: payload.firmName
  };
}

// ── verifyTrialJson ───────────────────────────────────────────────────────────

export interface TrialJsonData {
  firmId: string;
  trialStartedAt: string;
  signature: string;
}

/**
 * Verify the RSA-SHA256 signature on trial.json.
 * The signed payload is the canonical JSON of { firmId, trialStartedAt }.
 *
 * Returns true if valid, false if missing or invalid.
 */
export function verifyTrialJson(data: TrialJsonData): boolean {
  try {
    const publicKey = getPublicKey();
    const signedPayload = JSON.stringify({
      firmId: data.firmId,
      trialStartedAt: data.trialStartedAt
    });

    const verify = createVerify("RSA-SHA256");
    verify.update(signedPayload);
    return verify.verify(publicKey, data.signature, "base64");
  } catch {
    return false;
  }
}
