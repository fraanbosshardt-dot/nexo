// Pruebas de aceptación del motor financiero sobre PostgreSQL real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import {
  accountBalances, adjustBalance, createAccount, dashboard, monthSummary, openObligations,
  payObligation, recordMovement, recordTransfer, reverseTransaction, UserError,
} from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import type { PrismaClient } from "@/generated/prisma/client";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const NOV5 = d("2026-11-05");

async function newSpace(email: string) {
  const user = await db.user.create({ data: { email, name: "Prueba", passwordHash: "x" } });
  const ws = await createWorkspaceForUser(db, user.id, "Personal");
  const galicia = await createAccount(db, ws.id, { name: "Caja de ahorro", type: "SAVINGS", currency: "ARS", initialBalance: "100000", initialDate: d("2026-11-01") });
  const mp = await createAccount(db, ws.id, { name: "Billetera", type: "WALLET", currency: "ARS", initialBalance: "0", initialDate: d("2026-11-01") });
  return { user, ws, galicia, mp };
}
const bal = async (ws: string, id: string) => (await accountBalances(db, ws)).get(id)!.toFixed(2);

beforeAll(async () => {
  t = await startTestDb();
  db = t.db;
});
afterAll(async () => t?.stop());

describe("reglas financieras", () => {
  it("1. Una transferencia entre cuentas no aumenta los ingresos", async () => {
    const s = await newSpace("t1@ejemplo.com");
    await recordTransfer(db, s.ws.id, { fromAccountId: s.galicia.id, toAccountId: s.mp.id, amount: "30000", date: NOV5 });
    const m = await monthSummary(db, s.ws.id, "2026-11", "ARS", NOV5);
    expect(m.income.toFixed(2)).toBe("0.00");
    expect(m.expense.toFixed(2)).toBe("0.00");
    expect(await bal(s.ws.id, s.galicia.id)).toBe("70000.00");
    expect(await bal(s.ws.id, s.mp.id)).toBe("30000.00");
    const dash = await dashboard(db, s.ws.id, "ARS", NOV5);
    expect(dash.cash.toFixed(2)).toBe("100000.00"); // el patrimonio no se duplica
  });

  it("2. Un ingreso previsto no aumenta el saldo real", async () => {
    const s = await newSpace("t2@ejemplo.com");
    await recordMovement(db, s.ws.id, { kind: "INCOME", description: "Alquiler", amount: "650000", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-11-10") });
    expect(await bal(s.ws.id, s.galicia.id)).toBe("100000.00");
    const m = await monthSummary(db, s.ws.id, "2026-11", "ARS", NOV5);
    expect(m.pendingIn.toFixed(2)).toBe("650000.00");
    expect(m.income.toFixed(2)).toBe("0.00");
  });

  it("3. Una obligación vencida sigue pendiente al empezar el mes siguiente", async () => {
    const s = await newSpace("t3@ejemplo.com");
    await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Gas de octubre", amount: "27800", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-10-28"), economicPeriod: "2026-10" });
    const dec1 = d("2026-12-01");
    const m = await monthSummary(db, s.ws.id, "2026-12", "ARS", dec1);
    expect(m.overdue.map((o) => o.description)).toContain("Gas de octubre");
    expect(m.pendingOut.toFixed(2)).toBe("27800.00");
  });

  it("4. Un gasto de octubre pagado en noviembre conserva las dos fechas", async () => {
    const s = await newSpace("t4@ejemplo.com");
    const { obligationId } = await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Gas de octubre", amount: "27800", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-10-28"), economicPeriod: "2026-10" });
    const r = await payObligation(db, s.ws.id, { obligationId: obligationId!, accountId: s.galicia.id, amount: "27800", date: NOV5 });
    const tx = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId } });
    expect(tx.economicPeriod).toBe("2026-10");
    expect(tx.effectiveDate.toISOString().slice(0, 10)).toBe("2026-11-05");
    expect(r.status).toBe("SETTLED");
  });

  it("8. El saldo es la suma cronológica de los movimientos", async () => {
    const s = await newSpace("t8@ejemplo.com");
    await recordMovement(db, s.ws.id, { kind: "INCOME", description: "Sueldo", amount: "1950000", accountId: s.galicia.id, status: "PAID", effectiveDate: d("2026-11-02") });
    await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Prepaga", amount: "168000", accountId: s.galicia.id, status: "PAID", effectiveDate: d("2026-11-05") });
    await recordTransfer(db, s.ws.id, { fromAccountId: s.galicia.id, toAccountId: s.mp.id, amount: "150000", date: d("2026-11-04") });
    const txs = await db.transaction.findMany({ where: { accountId: s.galicia.id }, orderBy: { effectiveDate: "asc" } });
    const manual = txs.reduce((a, x) => a + (x.direction === "IN" ? 1 : -1) * Number(x.amount) * 100, 100000 * 100) / 100;
    expect(await bal(s.ws.id, s.galicia.id)).toBe(manual.toFixed(2));
    expect(await bal(s.ws.id, s.galicia.id)).toBe("1732000.00");
  });

  it("9. Un pago parcial deja el resto pendiente", async () => {
    const s = await newSpace("t9@ejemplo.com");
    const r = await recordMovement(db, s.ws.id, { kind: "INCOME", description: "Honorarios", amount: "400000", paidAmount: "150000", accountId: s.galicia.id, status: "PARTIAL", effectiveDate: d("2026-10-30"), dueDate: d("2026-11-13") });
    expect(await bal(s.ws.id, s.galicia.id)).toBe("250000.00");
    const open = await openObligations(db, s.ws.id, NOV5);
    expect(open[0].remaining.toFixed(2)).toBe("250000.00");
    expect(open[0].status).toBe("PARTIAL");
    await expect(payObligation(db, s.ws.id, { obligationId: r.obligationId!, accountId: s.galicia.id, amount: "300000", date: NOV5 })).rejects.toThrow(UserError);
    const p = await payObligation(db, s.ws.id, { obligationId: r.obligationId!, accountId: s.galicia.id, amount: "250000", date: NOV5 });
    expect(p.status).toBe("SETTLED");
  });

  it("10. Cambiar de moneda no modifica el importe original y guarda la cotización", async () => {
    const s = await newSpace("t10@ejemplo.com");
    const usd = await createAccount(db, s.ws.id, { name: "Caja USD", type: "FOREIGN", currency: "USD", initialBalance: "0", initialDate: d("2026-11-01") });
    await expect(recordTransfer(db, s.ws.id, { fromAccountId: s.galicia.id, toAccountId: usd.id, amount: "70750", date: NOV5 })).rejects.toThrow(/cotización/);
    const r = await recordTransfer(db, s.ws.id, { fromAccountId: s.galicia.id, toAccountId: usd.id, amount: "70750", toAmount: "50", fxRate: "1415", date: NOV5 });
    const out = await db.transaction.findUniqueOrThrow({ where: { id: r.outId } });
    const inn = await db.transaction.findUniqueOrThrow({ where: { id: r.inId } });
    expect(out.amount.toFixed(2)).toBe("70750.00");
    expect(inn.amount.toFixed(2)).toBe("50.00");
    expect(out.fxRate?.toFixed(2)).toBe("1415.00");
    const dash = await dashboard(db, s.ws.id, "ARS", NOV5);
    expect(dash.cash.toFixed(2)).toBe("29250.00"); // no suma dólares con pesos
    expect(dash.others[0].balance.toFixed(2)).toBe("50.00");
  });

  it("11. Las inversiones no se confunden con el dinero disponible", async () => {
    const s = await newSpace("t11@ejemplo.com");
    const broker = await createAccount(db, s.ws.id, { name: "Cuenta comitente", type: "INVESTMENT", currency: "ARS", initialBalance: "500000", initialDate: d("2026-11-01") });
    const dash = await dashboard(db, s.ws.id, "ARS", NOV5);
    expect(dash.cash.toFixed(2)).toBe("100000.00");
    expect(dash.invested.toFixed(2)).toBe("500000.00");
    expect(broker.id).toBeTruthy();
  });

  it("12. Un usuario nunca puede ver ni tocar datos de otro espacio", async () => {
    const a = await newSpace("t12a@ejemplo.com");
    const b = await newSpace("t12b@ejemplo.com");
    const { obligationId } = await recordMovement(db, a.ws.id, { kind: "EXPENSE", description: "Privado", amount: "1000", accountId: a.galicia.id, status: "PENDING", dueDate: d("2026-11-20") });
    await expect(payObligation(db, b.ws.id, { obligationId: obligationId!, accountId: b.galicia.id, amount: "1000", date: NOV5 })).rejects.toThrow(/No encontramos/);
    await expect(recordMovement(db, b.ws.id, { kind: "EXPENSE", description: "x", amount: "1", accountId: a.galicia.id, status: "PAID", effectiveDate: NOV5 })).rejects.toThrow(/No encontramos/);
    await expect(recordTransfer(db, b.ws.id, { fromAccountId: b.galicia.id, toAccountId: a.mp.id, amount: "1", date: NOV5 })).rejects.toThrow(/No encontramos/);
    expect((await openObligations(db, b.ws.id, NOV5)).length).toBe(0);
    expect((await accountBalances(db, b.ws.id)).has(a.galicia.id)).toBe(false);
  });
});

describe("trazabilidad", () => {
  it("una reversa corrige sin borrar y reabre el pendiente", async () => {
    const s = await newSpace("rev@ejemplo.com");
    const r = await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Expensas", amount: "185000", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-11-10") });
    const p = await payObligation(db, s.ws.id, { obligationId: r.obligationId!, accountId: s.galicia.id, amount: "100000", date: NOV5 });
    expect(await bal(s.ws.id, s.galicia.id)).toBe("0.00");
    await reverseTransaction(db, s.ws.id, p.transactionId);
    expect(await bal(s.ws.id, s.galicia.id)).toBe("100000.00");
    const ob = await db.obligation.findUniqueOrThrow({ where: { id: r.obligationId! } });
    expect(ob.status).toBe("PENDING");
    expect(await db.transaction.count({ where: { workspaceId: s.ws.id } })).toBe(2);
    await expect(reverseTransaction(db, s.ws.id, p.transactionId)).rejects.toThrow(/ya fue revertido/);
  });

  it("pagado por un importe distinto del previsto guarda los dos", async () => {
    const s = await newSpace("dif@ejemplo.com");
    const r = await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Reparación", amount: "90000", paidAmount: "96000", accountId: s.galicia.id, status: "PAID", effectiveDate: NOV5 });
    const ob = await db.obligation.findUniqueOrThrow({ where: { id: r.obligationId! } });
    const tx = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId! } });
    expect(ob.amount.toFixed(2)).toBe("90000.00");
    expect(tx.amount.toFixed(2)).toBe("96000.00");
  });

  it("la conciliación crea un ajuste registrado y la misma clave no duplica", async () => {
    const s = await newSpace("conc@ejemplo.com");
    const a = await adjustBalance(db, s.ws.id, { accountId: s.galicia.id, targetBalance: "96500", date: NOV5 });
    expect(a.diff.toFixed(2)).toBe("-3500.00");
    expect(await bal(s.ws.id, s.galicia.id)).toBe("96500.00");
    const k = { kind: "EXPENSE" as const, description: "Café", amount: "2500", accountId: s.galicia.id, status: "PAID" as const, effectiveDate: NOV5, idempotencyKey: "form-123" };
    await recordMovement(db, s.ws.id, k);
    const again = await recordMovement(db, s.ws.id, k);
    expect(again.duplicate).toBe(true);
    expect(await bal(s.ws.id, s.galicia.id)).toBe("94000.00");
  });

  it("el disponible del mes resta todo lo que falta pagar este mes", async () => {
    const s = await newSpace("disp@ejemplo.com");
    await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Colegio", amount: "60000", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-11-28") });
    await recordMovement(db, s.ws.id, { kind: "EXPENSE", description: "Seguro diciembre", amount: "50000", accountId: s.galicia.id, status: "PENDING", dueDate: d("2026-12-22") });
    const dash = await dashboard(db, s.ws.id, "ARS", NOV5);
    expect(dash.available.toFixed(2)).toBe("40000.00");
  });
});
