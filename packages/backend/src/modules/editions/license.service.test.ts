import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { EditionKey, FirmLifecycleStatus } from "@elms/shared";

const mockFirm = {
  findUnique: vi.fn(),
  update: vi.fn()
};

const mockFirmSettings = {
  upsert: vi.fn()
};

const mockPrisma = {
  firm: mockFirm,
  firmSettings: mockFirmSettings,
  $transaction: vi.fn()
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));

const { activateLicense, decodeLicenseKey, LicenseServiceError } = await import("./license.service.js");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

const previousPublicKey = process.env.DESKTOP_LICENSE_PUBLIC_KEY;

beforeAll(() => {
  process.env.DESKTOP_LICENSE_PUBLIC_KEY = publicKey;
});

afterAll(() => {
  if (previousPublicKey === undefined) {
    delete process.env.DESKTOP_LICENSE_PUBLIC_KEY;
    return;
  }
  process.env.DESKTOP_LICENSE_PUBLIC_KEY = previousPublicKey;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFirmSettings.upsert.mockResolvedValue({});
  mockFirm.update.mockResolvedValue({});
  mockPrisma.$transaction.mockResolvedValue([]);
});

function makeActivationKey(payload: {
  firmId: string;
  editionKey: EditionKey;
  expiresAt: string;
  firmName?: string;
}) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const sign = createSign("RSA-SHA256");
  sign.update(payloadB64);
  sign.end();
  const signatureB64 = sign.sign(privateKey).toString("base64");
  return `${payloadB64}.${signatureB64}`;
}

function makeFirmState(overrides?: Partial<{
  editionKey: EditionKey;
  pendingEditionKey: EditionKey | null;
  lifecycleStatus: FirmLifecycleStatus;
  licenseKeyHash: string | null;
}>) {
  const {
    editionKey = EditionKey.SOLO_OFFLINE,
    pendingEditionKey = null,
    lifecycleStatus = FirmLifecycleStatus.ACTIVE,
    licenseKeyHash = null
  } = overrides ?? {};

  return {
    id: "firm-1",
    editionKey,
    pendingEditionKey,
    lifecycleStatus,
    settings: { licenseKeyHash }
  };
}

describe("decodeLicenseKey", () => {
  it("rejects invalid signature", () => {
    const key = makeActivationKey({
      firmId: "firm-1",
      editionKey: EditionKey.SOLO_OFFLINE,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    const tampered = `${key.slice(0, -2)}ab`;

    expect(() => decodeLicenseKey(tampered)).toThrowError(LicenseServiceError);
    expect(() => decodeLicenseKey(tampered)).toThrowError("License key signature is invalid");
  });
});

describe("activateLicense", () => {
  it("activates a valid license and marks firm as LICENSED", async () => {
    const key = makeActivationKey({
      firmId: "firm-1",
      editionKey: EditionKey.SOLO_OFFLINE,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    mockFirm.findUnique.mockResolvedValue(makeFirmState());

    const result = await activateLicense("firm-1", key);

    expect(result.status).toBe("activated");
    expect(result.editionKey).toBe(EditionKey.SOLO_OFFLINE);
    expect(result.firmName).toBe("");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockFirmSettings.upsert).toHaveBeenCalledTimes(1);
    expect(mockFirm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "firm-1" },
        data: expect.objectContaining({
          lifecycleStatus: FirmLifecycleStatus.LICENSED,
          editionKey: EditionKey.SOLO_OFFLINE,
          pendingEditionKey: null
        })
      })
    );
  });

  it("returns already_activated for same key and licensed state", async () => {
    const key = makeActivationKey({
      firmId: "firm-1",
      editionKey: EditionKey.SOLO_OFFLINE,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    const keyHash = createHash("sha256").update(key).digest("hex");
    mockFirm.findUnique.mockResolvedValue(
      makeFirmState({
        lifecycleStatus: FirmLifecycleStatus.LICENSED,
        licenseKeyHash: keyHash
      })
    );

    const result = await activateLicense("firm-1", key);

    expect(result.status).toBe("already_activated");
    expect(result.firmName).toBe("");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects firm mismatch", async () => {
    const key = makeActivationKey({
      firmId: "firm-2",
      editionKey: EditionKey.SOLO_OFFLINE,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    mockFirm.findUnique.mockResolvedValue(makeFirmState());

    await expect(activateLicense("firm-1", key)).rejects.toMatchObject({
      code: "LICENSE_FIRM_MISMATCH"
    });
  });

  it("rejects edition mismatch", async () => {
    const key = makeActivationKey({
      firmId: "firm-1",
      editionKey: EditionKey.SOLO_ONLINE,
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
    mockFirm.findUnique.mockResolvedValue(
      makeFirmState({
        editionKey: EditionKey.SOLO_OFFLINE,
        pendingEditionKey: EditionKey.SOLO_OFFLINE
      })
    );

    await expect(activateLicense("firm-1", key)).rejects.toMatchObject({
      code: "LICENSE_EDITION_MISMATCH"
    });
  });

  it("rejects expired key", async () => {
    const key = makeActivationKey({
      firmId: "firm-1",
      editionKey: EditionKey.SOLO_OFFLINE,
      expiresAt: "2000-01-01T00:00:00.000Z"
    });
    mockFirm.findUnique.mockResolvedValue(makeFirmState());

    await expect(activateLicense("firm-1", key)).rejects.toMatchObject({
      code: "LICENSE_EXPIRED"
    });
  });
});
