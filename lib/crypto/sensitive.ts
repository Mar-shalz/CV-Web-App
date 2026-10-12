import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Field level encryption for the sensitive_details table (date of birth, gender,
 * state of origin, NYSC dates). AES-256-GCM, a fresh 96 bit IV per value, and
 * the row's user id bound in as additional data so a ciphertext copied to
 * another user's row fails to decrypt.
 *
 * Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 * Keys: SENSITIVE_DATA_KEY_V1 holds 32 random bytes, base64. Rotation adds V2.
 */
const VERSION = "v1";

function key(version: string): Buffer {
  const raw = process.env[`SENSITIVE_DATA_KEY_${version.toUpperCase()}`];
  if (!raw) throw new Error(`Missing SENSITIVE_DATA_KEY_${version.toUpperCase()}`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("Sensitive data key must be 32 bytes");
  return buf;
}

export function encryptField(plaintext: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(VERSION), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptField(payload: string, userId: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (!version || !ivB64 || !tagB64 || ctB64 === undefined) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(version), Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}
