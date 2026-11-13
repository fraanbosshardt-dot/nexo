// Confirmar el correo: el código de 6 números, cuándo se exige y qué cuentas abandonadas se borran solas.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { abandonedUnverified, checkVerifyCode, needsVerifiedEmail, verifyCode } from "@/server/email-verify";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 13, 12);
const old = new Date(NOW - 40 * DAY);
const mk = async (email: string, data: Record<string, unknown> = {}) => {
  const u = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x", createdAt: old, ...data } });
  const ws = await createWorkspaceForUser(db, u.id);
  return { u, ws: ws.id };
};

beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t.stop(); });
afterEach(() => { delete process.env.RESEND_API_KEY; });

describe("código de 6 números", () => {
  it("sirve para ese usuario y ese correo, al menos 30 minutos", () => {
    const code = verifyCode("u1", "a@b.com", NOW);
    expect(code).toMatch(/^\d{6}$/);
    expect(checkVerifyCode("u1", "a@b.com", code, NOW)).toBe(true);
    expect(checkVerifyCode("u1", "A@B.com", ` ${code.slice(0, 3)} ${code.slice(3)} `, NOW + 29 * 60_000)).toBe(true);
    expect(checkVerifyCode("u2", "a@b.com", code, NOW)).toBe(false);
    expect(checkVerifyCode("u1", "otro@b.com", code, NOW)).toBe(false);
    expect(checkVerifyCode("u1", "a@b.com", code, NOW + 61 * 60_000)).toBe(false);
    expect(checkVerifyCode("u1", "a@b.com", "12345", NOW)).toBe(false);
  });
});

describe("cuándo se exige el correo confirmado", () => {
  it("solo con los correos configurados y si no está confirmado", () => {
    expect(needsVerifiedEmail({ emailVerified: null })).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    expect(needsVerifiedEmail({ emailVerified: null })).toBe(true);
    expect(needsVerifiedEmail({ emailVerified: new Date() })).toBe(false);
  });
});

describe("cuentas sin confirmar que se borran solas", () => {
  it("solo las viejas, sin confirmar, sin uso, sin Google, sin Pro y fuera del equipo", async () => {
    const borrar = await mk("abandonada@test.com");
    await mk("confirmada@test.com", { emailVerified: old });
    await mk("google@test.com", { googleSub: "g-1" });
    await mk("nueva@test.com", { createdAt: new Date(NOW - 5 * DAY) });
    await mk("usada@test.com", { lastSeenAt: new Date(NOW - 2 * DAY) });
    const pro = await mk("pro@test.com");
    await db.subscription.update({ where: { workspaceId: pro.ws }, data: { plan: "PRO", status: "TRIALING" } });
    await mk("equipo@test.com");
    await db.adminMember.create({ data: { email: "equipo@test.com", role: "SUPPORT" } });
    await mk("duenio@test.com");

    const found = (await abandonedUnverified(db, NOW, ["DUENIO@test.com"])).map((u) => u.email);
    expect(found).toEqual([borrar.u.email]);
  });
});
