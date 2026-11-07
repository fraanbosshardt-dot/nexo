import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { checkIdToken, readStart, startGoogle } from "@/lib/auth/google";
import { findOrCreateGoogleUser } from "@/server/google-auth";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

const tok = (p: object) => `x.${Buffer.from(JSON.stringify(p)).toString("base64url")}.y`;
const good = { iss: "https://accounts.google.com", aud: "cid", exp: Math.floor(Date.now() / 1000) + 600, nonce: "n1", email_verified: true, sub: "g-1", email: "Ana@Gmail.com", name: "Ana Pérez" };

describe("id_token de Google", () => {
  it("acepta uno correcto y normaliza el correo", () => {
    expect(checkIdToken(tok(good), { clientId: "cid", nonce: "n1" })).toEqual({ sub: "g-1", email: "ana@gmail.com", name: "Ana Pérez" });
  });
  it("rechaza otro destinatario, otro emisor, nonce distinto, vencido o correo sin verificar", () => {
    const o = { clientId: "cid", nonce: "n1" };
    expect(checkIdToken(tok({ ...good, aud: "otra" }), o)).toBeNull();
    expect(checkIdToken(tok({ ...good, iss: "https://malo.com" }), o)).toBeNull();
    expect(checkIdToken(tok({ ...good, nonce: "n2" }), o)).toBeNull();
    expect(checkIdToken(tok({ ...good, exp: 1000 }), o)).toBeNull();
    expect(checkIdToken(tok({ ...good, email_verified: false }), o)).toBeNull();
    expect(checkIdToken("basura", o)).toBeNull();
  });
  it("arma el pedido con PKCE y guarda el estado", () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    const { url, cookie } = startGoogle("https://nexo.app", "registro");
    const u = new URL(url);
    const st = readStart(cookie)!;
    expect(u.searchParams.get("redirect_uri")).toBe("https://nexo.app/api/auth/google/callback");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(st.state);
    expect(u.toString()).not.toContain(st.verifier);
    expect(st.desde).toBe("registro");
    expect(readStart("{malo")).toBeNull();
  });
});

describe("cuenta con Google", () => {
  let t: Awaited<ReturnType<typeof startTestDb>>;
  let db: PrismaClient;
  beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
  afterAll(async () => { await t.stop(); });

  it("crea la cuenta con su espacio y después la reconoce", async () => {
    const r = await findOrCreateGoogleUser(db, { sub: "s-new", email: "nuevo@gmail.com", name: "Nuevo" });
    expect(r.ok && r.created).toBe(true);
    const u = await db.user.findUniqueOrThrow({ where: { email: "nuevo@gmail.com" }, include: { memberships: true } });
    expect(u.memberships).toHaveLength(1);
    expect(await verifyPassword("", u.passwordHash)).toBe(false);
    const again = await findOrCreateGoogleUser(db, { sub: "s-new", email: "nuevo@gmail.com", name: "Nuevo" });
    expect(again.ok && !again.created && again.userId === u.id).toBe(true);
  });

  it("vincula una cuenta existente sin confirmar: borra la contraseña y cierra sesiones", async () => {
    const u = await db.user.create({ data: { email: "papa@gmail.com", name: "Papá", passwordHash: await hashPassword("clave1234") } });
    await db.session.create({ data: { tokenHash: "h-papa", userId: u.id, expiresAt: new Date(Date.now() + 1e7) } });
    const r = await findOrCreateGoogleUser(db, { sub: "s-papa", email: "papa@gmail.com", name: "Papá" });
    expect(r.ok && r.linked && r.passwordCleared).toBe(true);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.googleSub).toBe("s-papa");
    expect(after.passwordHash).toBe("");
    expect(after.emailVerified).not.toBeNull();
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("no mezcla dos cuentas de Google ni deja entrar a una suspendida", async () => {
    expect(await findOrCreateGoogleUser(db, { sub: "s-otra", email: "papa@gmail.com", name: "X" })).toEqual({ ok: false, why: "otra" });
    await db.user.update({ where: { email: "nuevo@gmail.com" }, data: { suspendedAt: new Date() } });
    expect(await findOrCreateGoogleUser(db, { sub: "s-new", email: "nuevo@gmail.com", name: "Nuevo" })).toEqual({ ok: false, why: "bloqueada" });
  });
});
