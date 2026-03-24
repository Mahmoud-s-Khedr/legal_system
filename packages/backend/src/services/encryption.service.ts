/**
 * Field-level AES-256-GCM encryption service (Phase 6B).
 *
 * Each plaintext value is encrypted as:
 *   <iv:24-hex-chars>:<authTag:32-hex-chars>:<ciphertext:hex>
 *
 * Key derivation:
 *   masterKey = DATA_ENCRYPTION_MASTER_KEY (hex, 64 chars = 32 bytes)
 *   firmKey   = HKDF-SHA256(masterKey, salt=firmId, info="elms-field-enc", 32 bytes)
 *
 * The master key must never be stored in the database. It is read from env at
 * runtime. In development the module falls back to a fixed development key so
 * the server boots without configuration.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit recommended for GCM
const TAG_LEN = 16;
const DEV_MASTER_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

function getMasterKeyBytes(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_MASTER_KEY ?? DEV_MASTER_KEY;
  if (raw.length !== 64) {
    throw new Error(
      "DATA_ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(raw, "hex");
}

function deriveFirmKey(firmId: string): Buffer {
  const master = getMasterKeyBytes();
  return Buffer.from(
    hkdfSync("sha256", master, firmId, "elms-field-enc", KEY_LEN)
  );
}

/**
 * Encrypt a plaintext field value using the per-firm derived key.
 * Returns a string safe to store as TEXT in PostgreSQL.
 */
export function encryptField(plaintext: string, firmId: string): string {
  const key = deriveFirmKey(firmId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value previously encrypted with encryptField.
 * Returns the original plaintext string.
 */
export function decryptField(ciphertext: string, firmId: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted field format");
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = deriveFirmKey(firmId);
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf-8");
}

/**
 * Returns true if the value looks like an encrypted field (iv:tag:data format).
 * Useful for guarding against double-encryption.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return (
    parts.length === 3 &&
    parts[0].length === IV_LEN * 2 &&
    parts[1].length === TAG_LEN * 2
  );
}
