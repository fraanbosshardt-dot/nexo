// Pago anticipado de una parte (baja la cuota o el plazo) y refinanciación (F6 y F9).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount, payObligation } from "@/server/ledger";
import { createDebt, debtDetail, prepayDebt, refinanceDebt } from "@/server/debts";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, banco: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const loan = (creditor: string) => createDebt(db, ws, { creditor, kind: "Préstamo personal", principal: "120000", currency: "ARS", system: "FRENCH", installments: 12, tna: "60", startDate: d("2026-11-01"), firstDue: d("2026-12-10") });
const payFirst = async (debtId: string) => {
  const det = (await debtDetail(db, ws, debtId))!;
  await payObligation(db, ws, { obligationId: det.open[0].obligationId!, accountId: banco, amount: det.open[0].total, date: d("2026-12-10") });
};

beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "pre@test.com", name: "Pre", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  banco = (await createAccount(db, ws, { name: "Banco", type: "CHECKING", currency: "ARS", initialBalance: "1000000", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("pago anticipado", () => {
  it("baja la cuota: mismas cuotas que faltan, cuota más chica y lo pagado intacto", async () => {
    const debt = await loan("Banco A");
    await payFirst(debt.id);
    const before = (await debtDetail(db, ws, debt.id))!;
    const r = await prepayDebt(db, ws, { debtId: debt.id, accountId: banco, amount: "50000", date: d("2026-12-15"), mode: "cuota" });
    const after = (await debtDetail(db, ws, debt.id))!;
    expect(after.open.length).toBe(before.open.length);
    expect(Number(after.open[0].total)).toBeLessThan(Number(before.open[0].total));
    expect(after.remainingCapital.toNumber()).toBeCloseTo(before.remainingCapital.toNumber() - 50000, 1);
    expect(after.settledCount).toBe(1);
    expect(after.open[0].number).toBe(2);
    expect(r.saved.toNumber()).toBeGreaterThan(0);
  });

  it("baja el plazo: la misma cuota, menos cuotas", async () => {
    const debt = await loan("Banco B");
    const before = (await debtDetail(db, ws, debt.id))!;
    await prepayDebt(db, ws, { debtId: debt.id, accountId: banco, amount: "40000", date: d("2026-11-20"), mode: "plazo" });
    const after = (await debtDetail(db, ws, debt.id))!;
    expect(after.open.length).toBeLessThan(before.open.length);
    expect(Number(after.open[0].total)).toBeCloseTo(Number(before.open[0].total), 0);
    expect(Number(after.open.at(-1)!.balanceAfter)).toBe(0);
    expect(after.debt.installments).toBe(after.open.length);
  });

  it("el pago sale de la cuenta y no deja pagar todo por acá", async () => {
    const debt = await loan("Banco C");
    const saldo = (await accountBalances(db, ws)).get(banco)!.toNumber();
    await prepayDebt(db, ws, { debtId: debt.id, accountId: banco, amount: "10000", date: d("2026-11-20"), mode: "cuota" });
    expect((await accountBalances(db, ws)).get(banco)!.toNumber()).toBeCloseTo(saldo - 10000, 2);
    await expect(prepayDebt(db, ws, { debtId: debt.id, accountId: banco, amount: "999999", date: d("2026-11-20"), mode: "cuota" })).rejects.toThrow(/Cancelar total/);
  });
});

describe("refinanciar", () => {
  it("rearma lo que falta con condiciones nuevas, sin perder lo pagado", async () => {
    const debt = await loan("Banco D");
    await payFirst(debt.id);
    const r = await refinanceDebt(db, ws, { debtId: debt.id, principal: "115000", installments: 24, tna: "40", firstDue: d("2027-01-10"), date: d("2026-12-20") });
    const after = (await debtDetail(db, ws, debt.id))!;
    expect(r.installments).toBe(24);
    expect(after.settledCount).toBe(1);
    expect(after.open.length).toBe(24);
    expect(after.open[0].number).toBe(2);
    expect(after.debt.installments).toBe(25);
    expect(after.remainingCapital.toNumber()).toBeCloseTo(115000, 1);
    expect(after.debt.notes).toMatch(/Refinanciado/);
    const obs = await db.obligation.findMany({ where: { workspaceId: ws, sourceId: debt.id, status: "PENDING" } });
    expect(obs.length).toBe(24);
    expect(obs.every((o) => /cuota \d+\/25/.test(o.description))).toBe(true);
  });
});
