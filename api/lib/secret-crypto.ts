import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(appEncryptionKey: string) {
  return createHash("sha256").update(appEncryptionKey).digest();
}

export function encryptSecret(plainText: string, appEncryptionKey: string) {
  if (!appEncryptionKey.trim()) {
    throw new Error("APP_ENCRYPTION_KEY is not configured");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(appEncryptionKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(encryptedSecret: string, appEncryptionKey: string) {
  if (!appEncryptionKey.trim()) {
    throw new Error("APP_ENCRYPTION_KEY is not configured");
  }

  const [version, ivBase64, authTagBase64, encryptedBase64] =
    encryptedSecret.split(":");

  if (version !== "v1" || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Unsupported encrypted secret format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(appEncryptionKey),
    Buffer.from(ivBase64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
