import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

function runScript(args: string[]) {
  const result = spawnSync("pnpm", ["tsx", "scripts/generate-license.ts", ...args], {
    encoding: "utf8"
  });

  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

describe("generate-license.ts", () => {
  it("emits backend-compatible activation key format and signs payloadB64", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "elms-license-test-"));
    const outPath = join(tempDir, "activation.key");

    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const privateKeyPath = join(tempDir, "private.pem");
    writeFileSync(privateKeyPath, privateKey, "utf8");

    const result = runScript([
      "--firm-id",
      "11111111-1111-1111-1111-111111111111",
      "--edition-key",
      "solo_offline",
      "--expires-at",
      "2030-01-01",
      "--private-key",
      privateKeyPath,
      "--out",
      outPath
    ]);

    expect(result.code).toBe(0);
    const key = readFileSync(outPath, "utf8").trim();
    expect(key).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);

    const dotIdx = key.lastIndexOf(".");
    const payloadB64 = key.slice(0, dotIdx);
    const signatureB64 = key.slice(dotIdx + 1);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8")) as Record<string, string>;

    expect(payload.firmId).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload).not.toHaveProperty("firmName");
    expect(payload.editionKey).toBe("solo_offline");
    expect(payload.expiresAt).toBe("2030-01-01T00:00:00Z");

    const verify = createVerify("RSA-SHA256");
    verify.update(payloadB64);
    verify.end();
    expect(verify.verify(publicKey, signatureB64, "base64")).toBe(true);
  });

  it("supports legacy JSON compatibility mode", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "elms-license-test-"));
    const outPath = join(tempDir, "legacy.license");

    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const privateKeyPath = join(tempDir, "private.pem");
    writeFileSync(privateKeyPath, privateKey, "utf8");

    const result = runScript([
      "--legacy-json",
      "--firm",
      "Legacy Firm",
      "--slug",
      "legacy-firm",
      "--expires",
      "2030-01-01",
      "--private-key",
      privateKeyPath,
      "--out",
      outPath
    ]);

    expect(result.code).toBe(0);
    const legacy = JSON.parse(readFileSync(outPath, "utf8")) as Record<string, unknown>;
    expect(legacy.firm).toBe("Legacy Firm");
    expect(legacy.slug).toBe("legacy-firm");
    expect(legacy.expiresAt).toBe("2030-01-01T00:00:00Z");
    expect(typeof legacy.signature).toBe("string");
  });

});
