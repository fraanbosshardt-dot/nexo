import { describe, expect, it, beforeAll } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { base32Decode, base32Encode, generateTotpSecret, otpauthUrl, totpAt, verifyTotp } from "@/lib/auth/totp";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
});

describe("contraseñas", () => {
  it("guarda un hash y no la contraseña", async () => {
    const h = await hashPassword("clave1234");
    expect(h).not.toContain("clave1234");
    expect(await verifyPassword("clave1234", h)).toBe(true);
    expect(await verifyPassword("otra1234", h)).toBe(false);
  });
  it("pide 8 caracteres y un número", () => {
    expect(passwordProblem("corta1")).toMatch(/8 caracteres/);
    expect(passwordProblem("sinnumeros")).toMatch(/número/);
    expect(passwordProblem("buena1234")).toBeNull();
  });
});

describe("verificación en dos pasos (TOTP)", () => {
  // Vector oficial de RFC 6238 (SHA-1): clave "12345678901234567890", t = 59 s → 94287082 (8 dígitos).
  const rfcKey = Buffer.from("12345678901234567890", "ascii");
  it("cumple el vector de prueba de RFC 6238", () => {
    expect(totpAt(rfcKey, 59_000, { digits: 8 })).toBe("94287082");
    expect(totpAt(rfcKey, 1111111109_000, { digits: 8 })).toBe("07081804");
  });
  it("codifica y decodifica base32", () => {
    expect(base32Decode(base32Encode(rfcKey)).toString("ascii")).toBe("12345678901234567890");
  });
  it("acepta el código actual y rechaza uno viejo", () => {
    const s = generateTotpSecret();
    const now = Date.UTC(2026, 10, 6, 12, 0, 0);
    expect(verifyTotp(s, totpAt(s, now), now)).toBe(true);
    expect(verifyTotp(s, totpAt(s, now - 30_000), now)).toBe(true); // tolerancia de 30 s
    expect(verifyTotp(s, totpAt(s, now - 120_000), now)).toBe(false);
    expect(verifyTotp(s, "12345", now)).toBe(false);
  });
  it("arma el enlace para Google Authenticator", () => {
    expect(otpauthUrl("ABC", "ana@ejemplo.com")).toContain("otpauth://totp/Guafra%3Aana%40ejemplo.com?secret=ABC");
  });
  it("cifra el secreto antes de guardarlo", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
  });
});
