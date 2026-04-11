import { createHash, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EditionKey, FirmLifecycleStatus, type LicenseActivationResponseDto } from "@elms/shared";
import { prisma } from "../../db/prisma.js";

export interface LicensePayload {
  firmId: string;
  editionKey: EditionKey;
  expiresAt: string; // ISO date
  firmName?: string;
}

export class LicenseServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function getPublicKey(): string {
  if (process.env.DESKTOP_LICENSE_PUBLIC_KEY) {
    const raw = process.env.DESKTOP_LICENSE_PUBLIC_KEY;
    if (raw.startsWith("-----")) return raw;
    return Buffer.from(raw, "base64").toString("utf-8");
  }

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

export function decodeLicenseKey(licenseKey: string): {
  payload: LicensePayload;
  raw: string;
} {
  const trimmed = licenseKey.trim();
  const dotIdx = trimmed.lastIndexOf(".");
  if (dotIdx === -1) {
    throw new LicenseServiceError("LICENSE_INVALID", "Invalid license key format", 400);
  }

  const payloadB64 = trimmed.slice(0, dotIdx);
  const signatureB64 = trimmed.slice(dotIdx + 1);

  const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadJson) as LicensePayload;
  } catch {
    throw new LicenseServiceError("LICENSE_INVALID", "License key payload is not valid JSON", 400);
  }

  const publicKey = getPublicKey();
  const verify = createVerify("RSA-SHA256");
  verify.update(payloadB64);
  const valid = verify.verify(publicKey, signatureB64, "base64");

  if (!valid) {
    throw new LicenseServiceError("LICENSE_INVALID", "License key signature is invalid", 400);
  }

  return { payload, raw: trimmed };
}

const SELF_SERVE_LICENSE_EDITIONS = new Set<EditionKey>([
  EditionKey.SOLO_OFFLINE,
  EditionKey.SOLO_ONLINE,
  EditionKey.LOCAL_FIRM_OFFLINE,
  EditionKey.LOCAL_FIRM_ONLINE
]);

export async function activateLicense(
  firmId: string,
  licenseKey: string
): Promise<LicenseActivationResponseDto> {
  const { payload, raw } = decodeLicenseKey(licenseKey);

  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: {
      id: true,
      editionKey: true,
      pendingEditionKey: true,
      lifecycleStatus: true,
      settings: {
        select: {
          licenseKeyHash: true
        }
      }
    }
  });

  if (!firm) {
    throw new LicenseServiceError("LICENSE_INVALID", "Firm not found", 404);
  }

  if (payload.firmId !== firmId) {
    throw new LicenseServiceError("LICENSE_FIRM_MISMATCH", "License key is not issued for this firm", 400);
  }

  if (!SELF_SERVE_LICENSE_EDITIONS.has(payload.editionKey)) {
    throw new LicenseServiceError(
      "LICENSE_EDITION_MISMATCH",
      "This edition cannot be self-activated with a license key",
      400
    );
  }

  const expectedEdition = (firm.pendingEditionKey ?? firm.editionKey) as EditionKey;
  if (payload.editionKey !== expectedEdition) {
    throw new LicenseServiceError(
      "LICENSE_EDITION_MISMATCH",
      `License key edition does not match expected edition (${expectedEdition})`,
      400
    );
  }

  if (new Date(payload.expiresAt) <= new Date()) {
    throw new LicenseServiceError("LICENSE_EXPIRED", "License key has expired", 400);
  }

  const keyHash = createHash("sha256").update(raw).digest("hex");

  if (
    firm.settings?.licenseKeyHash === keyHash &&
    firm.lifecycleStatus === FirmLifecycleStatus.LICENSED &&
    firm.pendingEditionKey == null &&
    firm.editionKey === payload.editionKey
  ) {
    return {
      editionKey: payload.editionKey,
      expiresAt: payload.expiresAt,
      firmName: payload.firmName ?? "",
      status: "already_activated"
    };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.firmSettings.upsert({
      where: { firmId },
      create: {
        firmId,
        timezone: "Africa/Cairo",
        licenseKeyHash: keyHash,
        licenseActivatedAt: now
      },
      update: {
        licenseKeyHash: keyHash,
        licenseActivatedAt: now
      }
    }),
    prisma.firm.update({
      where: { id: firmId },
      data: {
        lifecycleStatus: FirmLifecycleStatus.LICENSED as never,
        editionKey: payload.editionKey as never,
        pendingEditionKey: null
      }
    })
  ]);

  return {
    editionKey: payload.editionKey,
    expiresAt: payload.expiresAt,
    firmName: payload.firmName ?? "",
    status: "activated"
  };
}

export interface TrialJsonData {
  firmId: string;
  trialStartedAt: string;
  signature: string;
}

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
