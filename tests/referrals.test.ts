import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { attachReferral, ensureReferralCode, isReferralCode, newReferralCode, referralStats, rewardReferral, REFERRAL_MAX_REWARDS } from "@/server/referrals";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const mk = async (email: string) => {
  const u = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "" } });
  const ws = await createWorkspaceForUser(db, u.id);
  return { id: u.id, ws: ws.id };
};
const sub = (ws: string) => db.subscription.findUnique({ where: { workspaceId: ws } });
beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t.stop(); });

describe("referidos", () => {
  it("el código es corto, sin letras confusas, y se crea una sola vez", async () => {
    for (let i = 0; i < 100; i++) expect(isReferralCode(newReferralCode())).toBe(true);
    const a = await mk("ana@test.com");
    const c1 = await ensureReferralCode(db, a.id);
    expect(await ensureReferralCode(db, a.id)).toBe(c1);
  });

  it("invitar: los dos reciben Pro una sola vez al terminar la bienvenida", async () => {
    const ana = await db.user.findUniqueOrThrow({ where: { email: "ana@test.com" } });
    const anaWs = (await db.membership.findFirstOrThrow({ where: { userId: ana.id } })).workspaceId;
    const beto = await mk("beto@test.com");
    expect(await attachReferral(db, beto.id, ana.referralCode)).toBe(true);
    expect(await attachReferral(db, ana.id, ana.referralCode)).toBe(false); // a sí misma, no
    expect(await attachReferral(db, beto.id, "zzzzzzzz")).toBe(false); // código que no existe
    const r = await rewardReferral(db, beto.id);
    expect(r.rewarded).toBe(true);
    expect((await sub(beto.ws))?.plan).toBe("PRO");
    expect((await sub(anaWs))?.plan).toBe("PRO");
    expect((await rewardReferral(db, beto.id)).rewarded).toBe(false); // no se premia dos veces
    expect((await referralStats(db, ana.id)).rewarded).toBe(1);
  });

  it("sin código, no pasa nada", async () => {
    const c = await mk("caro@test.com");
    expect(await attachReferral(db, c.id, undefined)).toBe(false);
    expect((await rewardReferral(db, c.id)).rewarded).toBe(false);
  });

  it("quien invita tiene un tope de premios; la persona invitada recibe igual", async () => {
    const ana = await db.user.findUniqueOrThrow({ where: { email: "ana@test.com" } });
    for (let i = 0; i < REFERRAL_MAX_REWARDS; i++) {
      const u = await mk(`amigo${i}@test.com`);
      await attachReferral(db, u.id, ana.referralCode);
      const r = await rewardReferral(db, u.id);
      expect(r.rewarded).toBe(true);
      if (i === REFERRAL_MAX_REWARDS - 1) expect(r.referrerGets).toBe(false);
    }
    expect((await referralStats(db, ana.id)).left).toBe(0);
  });
});
