// Editar y eliminar préstamos cargados por error.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount, payObligation } from "@/server/ledger";
import { createDebt, debtHasPayments, deleteDebt, updateDebt } from "@/server/debts";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, banco: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const bal = async (id: string) => (await accountBalances(db, ws)).get(id)!.toNumber();
const base = { creditor: "Banco Uno", kind: "Préstamo personal", principal: "1200", currency: "ARS", system: "NO_INTEREST" as const, installments: 12, startDate: d("2026-11-01"), firstDue: d("2026-12-10") };

beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "deu@test.com", name: "Dora", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  banco = (await createAccount(db, ws, { name: "Banco", type: "CHECKING", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("eliminar un préstamo", () => {
  it("se va con sus cuotas, sus pagos y la plata que entró", async () => {
    const debt = await createDebt(db, ws, { ...base, accountId: banco });
    expect(await bal(banco)).toBe(1200);
    const ob = await db.obligation.findFirstOrThrow({ where: { sourceType: "debt", sourceId: debt.id }, orderBy: { dueDate: "asc" } });
    await payObligation(db, ws, { obligationId: ob.id, accountId: banco, amount: "100", date: d("2026-12-10") });
    expect(await bal(banco)).toBe(1100);
    await deleteDebt(db, ws, debt.id);
    expect(await db.debt.count({ where: { id: debt.id } })).toBe(0);
    expect(await db.obligation.count({ where: { sourceType: "debt", sourceId: debt.id } })).toBe(0);
    expect(await db.debtInstallment.count({ where: { debtId: debt.id } })).toBe(0);
    expect(await bal(banco)).toBe(0);
  });

  it("también reconoce la plata de préstamos cargados antes (sin marca)", async () => {
    const debt = await createDebt(db, ws, { ...base, creditor: "Viejo", accountId: banco });
    await db.transaction.updateMany({ where: { type: "DEBT_DISBURSEMENT", notes: `debt:${debt.id}` }, data: { notes: null } });
    await deleteDebt(db, ws, debt.id);
    expect(await bal(banco)).toBe(0);
  });
});

describe("editar un préstamo", () => {
  it("sin pagos: se corrige todo y el cronograma se arma de nuevo", async () => {
    const debt = await createDebt(db, ws, { ...base, accountId: banco });
    const r = await updateDebt(db, ws, debt.id, { ...base, creditor: "Banco Dos", principal: "600", installments: 6 });
    expect(r.rebuilt).toBe(true);
    const sched = await db.debtInstallment.findMany({ where: { debtId: debt.id } });
    expect(sched).toHaveLength(6);
    expect(await db.obligation.count({ where: { sourceType: "debt", sourceId: debt.id } })).toBe(6);
    const ob = await db.obligation.findFirstOrThrow({ where: { sourceType: "debt", sourceId: debt.id } });
    expect(ob.description).toMatch(/^Banco Dos — cuota \d\/6$/);
    expect(await bal(banco)).toBe(600); // la plata que entró también se corrige
    await deleteDebt(db, ws, debt.id);
  });

  it("con pagos: solo cambia el nombre, el tipo y las notas", async () => {
    const debt = await createDebt(db, ws, base);
    const ob = await db.obligation.findFirstOrThrow({ where: { sourceType: "debt", sourceId: debt.id }, orderBy: { dueDate: "asc" } });
    await payObligation(db, ws, { obligationId: ob.id, accountId: banco, amount: "100", date: d("2026-12-10") });
    expect(await debtHasPayments(db, ws, debt.id)).toBe(true);
    const r = await updateDebt(db, ws, debt.id, { ...base, creditor: "Renombrado", principal: "5000", installments: 3, notes: "ok" });
    expect(r.rebuilt).toBe(false);
    const after = await db.debt.findUniqueOrThrow({ where: { id: debt.id } });
    expect([after.creditor, after.principal.toString(), after.notes]).toEqual(["Renombrado", "1200", "ok"]);
    expect(await db.debtInstallment.count({ where: { debtId: debt.id } })).toBe(12);
    const pend = await db.obligation.findFirstOrThrow({ where: { sourceType: "debt", sourceId: debt.id, status: "PENDING" } });
    expect(pend.description).toMatch(/^Renombrado/);
  });
});
