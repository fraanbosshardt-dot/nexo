// Cifrado de secretos guardados en la base (por ejemplo, la clave de la verificación en dos pasos).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Falta AUTH_SECRET (32 bytes en base64). Mirá .env.example.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1") throw new Error("Formato de secreto desconocido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
