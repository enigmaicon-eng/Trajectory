import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// §10: AES-256-GCM via Node crypto, key from BYOK_ENCRYPTION_KEY (32 bytes,
// base64). Originally specified for encrypting `user_credentials` at rest;
// repurposed here to encrypt the session-scoped BYOK cookie instead (see
// `byok-session.ts` and project memory "ai-provider-strategy" for why BYOK
// keys are never persisted server-side in v1).

function key(): Buffer {
  const b64 = process.env.BYOK_ENCRYPTION_KEY;
  if (!b64) throw new Error("BYOK_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must decode to 32 bytes");
  return buf;
}

/** iv.ciphertext.authTag, each base64url. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, ciphertext, authTag].map((b) => b.toString("base64url")).join(".");
}

/** Returns null on any malformed input or failed auth-tag check, never throws. */
export function decrypt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ivB64, ciphertextB64, authTagB64] = parts;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, "base64url")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
