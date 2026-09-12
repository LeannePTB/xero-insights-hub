// Server-only TOTP (RFC 6238) code generation.
//
// Used by the live access-test runner so it can complete a real second-factor
// challenge for the three security test accounts without any human, and without
// the owner pasting a TOTP secret anywhere. The secrets themselves live
// encrypted in public.security_test_accounts and never leave the server.
//
// Never import this from client-reachable modules.

import { createHmac } from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error("totp: not a base32 secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Six-digit TOTP code for a base32 secret, 30-second step, SHA-1 (what Supabase issues). */
export function totpCode(secretBase32: string, at: Date = new Date()): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(at.getTime() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const bin =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}
