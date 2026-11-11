// Borrar y corregir movimientos cargados por error: se van del todo y se deshace lo que dependía de ellos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount, deleteMovement, payObligation, recordMovement, recordTransfer, reverseTransaction, updateMovement } from "@/server/ledger";
import { cardPurchase, createCard } from "@/server/cards";
import { createGrainSale } from "@/server/grain";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, banco: string, caja: string, usd: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const bal = async (id: string) => (await accountBalances(db, ws)).get(id)!.toNumber();
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "mov@test.com", name: "Mora", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  banco = (await createAccount(db, ws, { name: "Banco", type: "CHECKING", currency: "ARS", initialBalance: "1000", initialDate: d("2026-11-01") })).id;
  caja = (await createAccount(db, ws, { name: "Caja", type: "CASH", currency: "ARS", initialBalance: "0", initialDate: d("2026-11-01") })).id;
  usd = (await createAccount(db, ws, { name: "Dólares", type: "SAVINGS", currency: "USD", initialBalance: "0", initialDate: d("2026-11-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

const base = { categoryId: null, economicPeriod: "2026-11", notes: null };

describe("borrar un movimiento", () => {
  it("un ingreso cargado por error se va del todo y el saldo vuelve", async () => {
    const r = await recordMovement(db, ws, { kind: "INCOME", description: "Error", amount: "500", accountId: banco, status: "PAID", effectiveDate: d("2026-11-05") });
    expect(await bal(banco)).toBe(1500);
    await deleteMovement(db, ws, r.transactionId!);
    expect(await db.transaction.count({ where: { id: r.transactionId! } })).toBe(0);
    expect(await bal(banco)).toBe(1000);
  });

  it("una transferencia se borra con sus dos partes", async () => {
    const tr = await recordTransfer(db, ws, { fromAccountId: banco, toAccountId: caja, amount: "200", date: d("2026-11-06") });
    await deleteMovement(db, ws, tr.inId);
    expect(await db.transaction.count({ where: { transferGroupId: tr.transferGroupId } })).toBe(0);
    expect([await bal(banco), await bal(caja)]).toEqual([1000, 0]);
  });

  it("el pago de un pendiente: el pendiente vuelve a quedar por pagar", async () => {
    const p = await recordMovement(db, ws, { kind: "EXPENSE", description: "Luz", amount: "100", accountId: banco, status: "PENDING", dueDate: d("2026-11-20") });
    await db.obligation.update({ where: { id: p.obligationId! }, data: { createdAt: d("2026-10-01") } }); // cargado antes que el pago
    const pay = await payObligation(db, ws, { obligationId: p.obligationId!, accountId: banco, amount: "100", date: d("2026-11-10") });
    await deleteMovement(db, ws, pay.transactionId);
    expect((await db.obligation.findUniqueOrThrow({ where: { id: p.obligationId! } })).status).toBe("PENDING");
    expect(await bal(banco)).toBe(1000);
  });

  it("un gasto pagado en parte se borra junto con lo que quedaba pendiente", async () => {
    const r = await recordMovement(db, ws, { kind: "EXPENSE", description: "Arreglo", amount: "300", accountId: banco, status: "PARTIAL", paidAmount: "100", effectiveDate: d("2026-11-07"), dueDate: d("2026-11-25") });
    await deleteMovement(db, ws, r.transactionId!);
    expect(await db.obligation.count({ where: { id: r.obligationId! } })).toBe(0);
  });

  it("una compra en cuotas se borra con sus cuotas", async () => {
    const card = await createCard(db, ws, { issuer: "Visa", name: "Visa", limit: "100000", currency: "ARS", closingDay: 24, dueDay: 5, startDate: d("2026-11-01") });
    const tx = await cardPurchase(db, ws, { cardId: card.id, description: "Tele", amount: "1200", installments: 6, date: d("2026-11-08") });
    await deleteMovement(db, ws, tx.id);
    expect(await db.installmentPlan.count({ where: { cardId: card.id } })).toBe(0);
  });

  it("un movimiento que estaba anulado se borra junto con su anulación", async () => {
    const r = await recordMovement(db, ws, { kind: "EXPENSE", description: "Viejo", amount: "50", accountId: banco, status: "PAID", effectiveDate: d("2026-11-03") });
    await reverseTransaction(db, ws, r.transactionId!);
    await deleteMovement(db, ws, r.transactionId!);
    expect(await db.transaction.count({ where: { OR: [{ id: r.transactionId! }, { reversalOfId: r.transactionId! }] } })).toBe(0);
    expect(await bal(banco)).toBe(1000);
  });

  it("el cobro de una venta de cereal se borra desde Ventas de cereal", async () => {
    const s = await createGrainSale(db, ws, { saleDate: d("2026-11-02"), grain: "Soja", tonnes: "1", pricePerTonne: "100", priceCurrency: "ARS", taxPct: "0", collectDate: d("2026-11-02"), accountId: banco, collected: true });
    const pay = await db.transaction.findFirstOrThrow({ where: { obligationId: s.obligationId! } });
    await expect(deleteMovement(db, ws, pay.id)).rejects.toThrow(/Ventas de cereal/);
  });
});

describe("corregir un movimiento", () => {
  it("importe y cuenta de un gasto común", async () => {
    const r = await recordMovement(db, ws, { kind: "EXPENSE", description: "Café", amount: "10", accountId: banco, status: "PAID", effectiveDate: d("2026-11-09") });
    const before = await bal(banco);
    await updateMovement(db, ws, r.transactionId!, { ...base, description: "Café con leche", effectiveDate: d("2026-11-09"), amount: "12", accountId: caja });
    const t2 = await db.transaction.findUniqueOrThrow({ where: { id: r.transactionId! } });
    expect([t2.description, t2.amount.toString(), t2.accountId]).toEqual(["Café con leche", "12", caja]);
    expect(await bal(banco)).toBe(before + 10);
  });

  it("no deja pasar a una cuenta en otra moneda", async () => {
    const r = await recordMovement(db, ws, { kind: "EXPENSE", description: "Taxi", amount: "5", accountId: banco, status: "PAID", effectiveDate: d("2026-11-09") });
    await expect(updateMovement(db, ws, r.transactionId!, { ...base, description: "Taxi", effectiveDate: d("2026-11-09"), accountId: usd })).rejects.toThrow(/ARS/);
  });

  it("el importe de una transferencia cambia en las dos partes", async () => {
    const tr = await recordTransfer(db, ws, { fromAccountId: banco, toAccountId: caja, amount: "100", date: d("2026-11-10") });
    await updateMovement(db, ws, tr.outId, { ...base, description: "Paso a caja", effectiveDate: d("2026-11-11"), amount: "150" });
    const legs = await db.transaction.findMany({ where: { transferGroupId: tr.transferGroupId } });
    expect(legs.map((l) => l.amount.toString())).toEqual(["150", "150"]);
    expect(legs.every((l) => l.effectiveDate.getTime() === d("2026-11-11").getTime())).toBe(true);
  });

  it("corregir el importe de un pago actualiza el estado del pendiente", async () => {
    const p = await recordMovement(db, ws, { kind: "EXPENSE", description: "Gas", amount: "80", accountId: banco, status: "PENDING", dueDate: d("2026-11-20") });
    const pay = await payObligation(db, ws, { obligationId: p.obligationId!, accountId: banco, amount: "80", date: d("2026-11-12") });
    expect((await db.obligation.findUniqueOrThrow({ where: { id: p.obligationId! } })).status).toBe("SETTLED");
    await updateMovement(db, ws, pay.transactionId, { ...base, description: "Gas", effectiveDate: d("2026-11-12"), amount: "50" });
    expect((await db.obligation.findUniqueOrThrow({ where: { id: p.obligationId! } })).status).toBe("PARTIAL");
  });
});
