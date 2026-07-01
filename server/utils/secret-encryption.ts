import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const raw =
    process.env.AGENT_SETTINGS_ENCRYPTION_KEY ||
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!raw) {
    throw new Error(
      "AGENT_SETTINGS_ENCRYPTION_KEY (or SETTINGS_ENCRYPTION_KEY / JWT_SECRET) must be set to encrypt agent API keys",
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt plaintext; returns base64 payload (iv + authTag + ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Decrypt payload produced by encryptSecret. */
export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function isEncryptionConfigured(): boolean {
  return !!(
    process.env.AGENT_SETTINGS_ENCRYPTION_KEY ||
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET
  );
}
