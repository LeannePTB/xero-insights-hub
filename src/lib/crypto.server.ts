// Server-only AES-256-GCM helpers for wrapping Xero OAuth tokens at rest.
// Format: 12-byte IV ‖ ciphertext ‖ 16-byte auth tag, returned as a Node Buffer
// suitable for direct storage in a Postgres `bytea` column.
//
// Never import this from client-reachable modules. Load via:
//   const { encryptToken, decryptToken } = await import("@/lib/crypto.server");

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) throw new Error("TOKEN_ENC_KEY is not configured.");
  // Accept hex, base64, or raw text. Always derive a 32-byte key.
  let key: Buffer;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    key = Buffer.from(raw, "hex");
  } else {
    const buf = Buffer.from(raw, "utf8");
    if (buf.length === 32) {
      key = buf;
    } else {
      // Hash to 32 bytes if the supplied secret is the wrong length.
      key = createHash("sha256").update(buf).digest();
    }
  }
  if (key.length !== 32) throw new Error("TOKEN_ENC_KEY must derive to 32 bytes for AES-256.");
  return key;
}

export function encryptToken(plaintext: string): Buffer {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptToken: empty plaintext");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]);
}

export function decryptToken(payload: Buffer | Uint8Array | string | null | undefined): string {
  if (payload == null) throw new Error("decryptToken: null payload");
  let buf: Buffer;
  if (typeof payload === "string") {
    // Supabase returns bytea over the wire as a hex string prefixed with "\x".
    buf = payload.startsWith("\\x") ? Buffer.from(payload.slice(2), "hex") : Buffer.from(payload, "base64");
  } else if (Buffer.isBuffer(payload)) {
    buf = payload;
  } else {
    buf = Buffer.from(payload);
  }
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("decryptToken: ciphertext too short");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// Wraps a plaintext token as a Postgres bytea hex literal (\x...) for transport
// over PostgREST. PostgREST writes bytea from a hex-escaped string, not base64.
export function encryptTokenB64(plaintext: string): string {
  return "\\x" + encryptToken(plaintext).toString("hex");
}
