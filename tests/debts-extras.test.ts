// Préstamos con IVA sobre los intereses, seguro sobre el saldo y cargos fijos (F2).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { buildSchedule, cftOf, createDebt } from "@/server/debts";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const sum = (xs: { toNumber(): number }[]) => xs.reduce((s, x) => s + x.toNumber(), 0);

beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "iva@test.com", name: "Iva", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("cuota pura + IVA + seguro", () => {
  const base = { system: "FRENCH" as const, principal: "100000", installments: 12, tna: "60", firstDue: d("2026-12-10") };

  it("sin cargos, el cronograma queda igual que antes", () => {
    const a = buildSchedule(base);
    const b = buildSchedule({ ...base, extras: { vatPct: null, insurancePct: "0", insuranceFixed: null } });
    expect(b.map((r) => r.total.toFixed(2))).toEqual(a.map((r) => r.total.toFixed(2)));
  });

  it("suma el IVA sobre el interés de cada cuota y el seguro sobre el saldo de ese mes", () => {
    const pure = buildSchedule(base);
    const rows = buildSchedule({ ...base, extras: { vatPct: "21", insurancePct: "0.1", insuranceFixed: "50" } });
    // Cuota 1: interés de 100.000 al 5% = 5.000 → IVA 1.050; seguro 0,1% de 100.000 = 100 + 50 fijo.
    expect(rows[0].interest.toFixed(2)).toBe("5000.00");
    expect(rows[0].vat!.toFixed(2)).toBe("1050.00");
    expect(rows[0].insurance!.toFixed(2)).toBe("150.00");
    expect(rows[0].total.toFixed(2)).toBe(pure[0].total.plus(1200).toFixed(2));
    // El seguro baja con el saldo; el capital y el interés no cambian.
    expect(rows[5].insurance!.lt(rows[0].insurance!)).toBe(true);
    expect(rows.map((r) => r.capital.toFixed(2))).toEqual(pure.map((r) => r.capital.toFixed(2)));
    expect(rows.at(-1)!.balance.toFixed(2)).toBe("0.00");
    // Con cargos, el costo total (CFT) es mayor que la tasa sola.
    const tea = (Math.pow(1.05, 12) - 1) * 100;
    expect(cftOf("100000", rows.map((r) => r.total.toNumber()))).toBeGreaterThan(tea + 5);
  });

  it("se guarda en la deuda y cada cuota a pagar ya trae el total con IVA y seguro", async () => {
    const debt = await createDebt(db, ws, { creditor: "Banco Dos", kind: "Préstamo personal", currency: "ARS", startDate: d("2026-11-10"), ...base, installmentAmount: null, vatPct: "21", insurancePct: "0.1", insuranceFixed: null });
    const saved = await db.debt.findUniqueOrThrow({ where: { id: debt.id }, include: { schedule: { orderBy: { number: "asc" } } } });
    expect(String(saved.vatPct)).toBe("21");
    expect(Number(saved.schedule[0].vat)).toBe(1050);
    expect(Number(saved.schedule[0].insurance)).toBe(100);
    const obs = await db.obligation.findMany({ where: { workspaceId: ws, sourceId: debt.id }, orderBy: { dueDate: "asc" } });
    expect(Number(obs[0].amount)).toBe(Number(saved.schedule[0].total));
    expect(sum(obs.map((o) => ({ toNumber: () => Number(o.amount) })))).toBeCloseTo(sum(saved.schedule.map((r) => ({ toNumber: () => Number(r.total) }))), 2);
  });

  it("con cuotas a medida no suma nada (el total del banco ya los trae)", async () => {
    const debt = await createDebt(db, ws, { creditor: "Banco Tres", kind: "Préstamo personal", principal: "1000", currency: "ARS", system: "MANUAL", startDate: d("2026-11-10"), rows: [{ due: d("2026-12-10"), total: "600" }, { due: d("2027-01-10"), total: "600" }], vatPct: "21" });
    const saved = await db.debt.findUniqueOrThrow({ where: { id: debt.id }, include: { schedule: true } });
    expect(saved.vatPct).toBeNull();
    expect(saved.schedule.every((r) => Number(r.vat) === 0)).toBe(true);
  });
});
