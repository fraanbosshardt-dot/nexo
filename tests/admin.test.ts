import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { can, roleFor } from "@/server/admin-team";
import { applyProGrant, giftPro } from "@/server/grants";
import { checkCoupon, deleteAccount, discounted, exportAccountData, normCode } from "@/server/admin-accounts";
import { funnel, overview, signupsByDay, revenueByMonth } from "@/server/admin-metrics";
import { audienceUsers } from "@/server/admin-comms";
import { announcementFor } from "@/server/settings";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, recordMovement } from "@/server/ledger";
import { effectivePlan } from "@/server/plans";
import { splitRef } from "@/server/billing";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t.stop(); });

const mkUser = async (email: string, extra: object = {}) => {
  const u = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "", ...extra } });
  const ws = await createWorkspaceForUser(db, u.id, "Personal");
  return { u, ws };
};

describe("roles del panel", () => {
  it("cada rol puede lo suyo y nada más", () => {
    expect(can("VIEWER", "view")).toBe(true);
    expect(can("VIEWER", "support")).toBe(false);
    expect(can("SUPPORT", "support")).toBe(true);
    expect(can("SUPPORT", "owner")).toBe(false);
    expect(can("OWNER", "owner")).toBe(true);
  });
  it("ADMIN_EMAILS es dueño; la lista blanca da su rol; el resto no entra", async () => {
    process.env.ADMIN_EMAILS = "Jefe@Gmail.com";
    await db.adminMember.create({ data: { email: "ayuda@gmail.com", role: "SUPPORT" } });
    expect(await roleFor(db, "jefe@gmail.com")).toBe("OWNER");
    expect(await roleFor(db, "AYUDA@gmail.com")).toBe("SUPPORT");
    expect(await roleFor(db, "otro@gmail.com")).toBeNull();
  });
});

describe("Pro reservado y regalado", () => {
  it("la cuenta nueva arranca con Pro si el correo estaba reservado, una sola vez", async () => {
    await db.proGrant.create({ data: { email: "cristian@gmail.com", days: null } });
    const { ws } = await mkUser("cristian@gmail.com");
    expect(await applyProGrant(db, "Cristian@gmail.com", ws.id)).toBe(true);
    const sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
    expect(effectivePlan(sub)).toBe("PRO");
    expect(sub.trialEndsAt).toBeNull();
    expect(await applyProGrant(db, "cristian@gmail.com", ws.id)).toBe(false);
  });
  it("regalar días suma sobre una prueba vigente y no pisa una suscripción paga", async () => {
    const { ws } = await mkUser("regalo@gmail.com");
    await giftPro(db, ws.id, 10);
    await giftPro(db, ws.id, 10);
    const sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } });
    const days = (sub.trialEndsAt!.getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(19.9);
    expect(effectivePlan(sub)).toBe("PRO");
    const { ws: paid } = await mkUser("paga@gmail.com");
    await db.subscription.update({ where: { workspaceId: paid.id }, data: { plan: "PRO", status: "ACTIVE", provider: "mercadopago", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } });
    expect(await giftPro(db, paid.id, 30)).toBe("paga");
  });
});

describe("cupones", () => {
  it("valida código, vencimiento y usos, y calcula el descuento", async () => {
    expect(normCode(" bien-venida 2026! ")).toBe("BIEN-VENIDA2026");
    await db.coupon.create({ data: { code: "MITAD", percentOff: 50, maxUses: 1 } });
    await db.coupon.create({ data: { code: "VIEJO", percentOff: 10, expiresAt: new Date(Date.now() - 864e5) } });
    expect((await checkCoupon(db, "mitad")).ok).toBe(true);
    expect((await checkCoupon(db, "viejo")).ok).toBe(false);
    expect((await checkCoupon(db, "nada")).ok).toBe(false);
    await db.coupon.update({ where: { code: "MITAD" }, data: { uses: 1 } });
    expect((await checkCoupon(db, "MITAD")).ok).toBe(false);
    expect(discounted(4999, 20)).toBe(3999.2);
    expect(splitRef("ws1|MITAD")).toEqual({ ws: "ws1", coupon: "MITAD", checkout: null });
    expect(splitRef("ws1")).toEqual({ ws: "ws1", coupon: null, checkout: null });
  });
});

describe("datos personales", () => {
  it("exporta todo y borra la cuenta con su espacio completo", async () => {
    const { u, ws } = await mkUser("borrar@gmail.com");
    const acc = await createAccount(db, ws.id, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "1000", initialDate: new Date("2026-10-01T00:00:00Z") });
    await recordMovement(db, ws.id, { kind: "EXPENSE", description: "Super", amount: "100", accountId: acc.id, status: "PAID", effectiveDate: new Date("2026-10-05T00:00:00Z") });
    await recordMovement(db, ws.id, { kind: "EXPENSE", description: "Luz", amount: "50", accountId: acc.id, status: "PENDING", dueDate: new Date("2026-11-20T00:00:00Z") });
    await db.supportTicket.create({ data: { userId: u.id, subject: "Hola", body: "Ayuda" } });
    await db.auditLog.create({ data: { action: "auth.login", userId: u.id } });
    const data = await exportAccountData(db, u.id);
    expect(data.user.email).toBe("borrar@gmail.com");
    expect(data.spaces[0].accounts).toHaveLength(1);
    expect(data.spaces[0].transactions.length).toBeGreaterThanOrEqual(1);
    expect(data.supportTickets).toHaveLength(1);
    expect((await deleteAccount(db, u.id)).deletedSpaces).toBe(1);
    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await db.workspace.findUnique({ where: { id: ws.id } })).toBeNull();
    expect(await db.account.count({ where: { workspaceId: ws.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "auth.login", userId: null } })).toBeGreaterThanOrEqual(1);
  });
});

describe("números del negocio", () => {
  it("cuenta altas, activos, embudo y cobrado sin romperse con la base vacía de pagos", async () => {
    await db.user.updateMany({ data: { lastSeenAt: new Date() } });
    const o = await overview(db, { monthly: 5, yearly: 50 });
    expect(o.users).toBe(3);
    expect(o.dau).toBe(o.users);
    expect(o.paid).toBe(1);
    expect(o.mrr).toBe(5);
    const days = await signupsByDay(db, 30);
    expect(days).toHaveLength(30);
    expect(days[29].n).toBe(o.users);
    const f = await funnel(db);
    expect(f[0].n).toBe(o.users);
    const rev = await revenueByMonth(db, 6);
    expect(rev).toHaveLength(6);
    expect(rev.every((r) => r.n === 0)).toBe(true);
  });
  it("arma el público de un correo según el plan", async () => {
    const pro = await audienceUsers(db, "pro");
    expect(pro.map((u) => u.email)).toEqual(expect.arrayContaining(["cristian@gmail.com", "paga@gmail.com"]));
    expect((await audienceUsers(db, "free")).some((u) => u.email === "paga@gmail.com")).toBe(false);
  });
  it("el aviso respeta el plan y la fecha", () => {
    const a = { text: "Hola", tone: "info" as const, audience: "pro" as const, until: "2026-01-01", link: null };
    expect(announcementFor(a, "PRO", new Date("2025-12-31T10:00:00Z"))).not.toBeNull();
    expect(announcementFor(a, "FREE", new Date("2025-12-31T10:00:00Z"))).toBeNull();
    expect(announcementFor(a, "PRO", new Date("2026-01-02T10:00:00Z"))).toBeNull();
  });
});
