import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for third-party credentials at rest (connections
 * table). Key: TOKEN_ENCRYPTION_KEY, base64-encoded 32 bytes.
 */

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return key;
}

export type Encrypted = { iv: string; tag: string; data: string; v: 1 };

export function encryptJson(value: unknown): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
    v: 1,
  };
}

export function decryptJson<T>(enc: Encrypted): T {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(enc.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(enc.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8")) as T;
}
