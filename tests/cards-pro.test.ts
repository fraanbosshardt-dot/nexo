// Tarjetas: editar/borrar, fechas por mes, dos monedas, suscripciones, cargos, pagar una parte, devoluciones,
// adelantar cuotas, compras que faltan del PDF y gastos por persona.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { accountBalances, createAccount, payObligation } from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import { advancePlan, addSubscription, calendar, cardGroups, cardOverview, cardPurchase, cardRefund, cardStatus, chargeSubscriptions, closeStatements, createCard, deleteCard, missingPurchases, projectedCardPayments, setCycle, updateCard } from "@/server/cards";
import { parseStatementText } from "@/server/statement-pdf";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t?.stop(); });

let n = 0;
async function setup(extra: Partial<Parameters<typeof createCard>[2]> = {}) {
  const user = await db.user.create({ data: { email: `cp${++n}@test.com`, name: "Prueba", passwordHash: "x" } });
  const ws = (await createWorkspaceForUser(db, user.id)).id;
  const bank = await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "1000000", initialDate: d("2026-10-01") });
  const card = await createCard(db, ws, { issuer: "Banco", name: "Visa", limit: "1000000", currency: "ARS", closingDay: 25, dueDay: 5, payAccountId: bank.id, startDate: d("2026-11-01"), ...extra });
  // La tarjeta "existe" desde octubre, para que cierre resúmenes en las fechas de las pruebas.
  await db.creditCard.updateMany({ where: { workspaceId: ws }, data: { createdAt: d("2026-10-26") } });
  return { ws, bank, card };
}
const bal = async (ws: string, id: string) => (await accountBalances(db, ws)).get(id)!.toNumber();

describe("editar y eliminar", () => {
  it("editar cambia días y límite; eliminar borra todo y el banco vuelve a como estaba", async () => {
    const { ws, bank, card } = await setup();
    await updateCard(db, ws, card.id, { issuer: "Banco", name: "Visa Oro", limit: "2000000", closingDay: 24, dueDay: 4, payAccountId: bank.id });
    const c = await db.creditCard.findUniqueOrThrow({ where: { id: card.id } });
    expect([c.name, c.closingDay, Number(c.limitAmount)]).toEqual(["Visa Oro", 24, 2000000]);
    await cardPurchase(db, ws, { cardId: card.id, description: "Super", amount: "1000", date: d("2026-11-10") });
    await closeStatements(db, ws, d("2026-11-30"));
    const st = await cardStatus(db, ws, card.id, d("2026-11-30"));
    await payObligation(db, ws, { obligationId: st.open[0].id, accountId: bank.id, amount: "1000", date: d("2026-12-01") });
    expect(await bal(ws, bank.id)).toBe(999000);
    await deleteCard(db, ws, card.id);
    expect(await db.creditCard.count({ where: { workspaceId: ws } })).toBe(0);
    expect(await bal(ws, bank.id)).toBe(1000000);
  });
});

describe("fechas por mes", () => {
  it("si el banco mueve el cierre, la compra entra en ese resumen y vence en la fecha nueva", async () => {
    const { ws, card } = await setup();
    await setCycle(db, ws, card.id, { usualClosing: d("2026-11-25"), closingDate: d("2026-11-28"), dueDate: d("2026-12-09") });
    await cardPurchase(db, ws, { cardId: card.id, description: "Ropa", amount: "500", date: d("2026-11-27") });
    await closeStatements(db, ws, d("2026-11-30"));
    const s = await db.cardStatement.findFirstOrThrow({ where: { cardId: card.id } });
    expect([s.closingDate.toISOString().slice(0, 10), s.dueDate.toISOString().slice(0, 10), Number(s.totalAmount)]).toEqual(["2026-11-28", "2026-12-09", 500]);
    const cal = calendar({ closingDay: 25, dueDay: 5, cycles: await db.cardCycle.findMany({ where: { cardId: card.id } }) });
    expect(cal.next(d("2026-11-28")).toISOString().slice(0, 10)).toBe("2026-12-25");
  });
});

describe("dos monedas", () => {
  it("las compras en dólares van a su propio resumen y el uso del límite las suma", async () => {
    const { ws, card } = await setup({ currency2: "USD" });
    const child = await db.creditCard.findFirstOrThrow({ where: { parentId: card.id } });
    expect(child.currency).toBe("USD");
    await cardPurchase(db, ws, { cardId: card.id, description: "Netflix", amount: "10", currency: "USD", date: d("2026-11-10") });
    await cardPurchase(db, ws, { cardId: card.id, description: "Super", amount: "1000", date: d("2026-11-10") });
    await closeStatements(db, ws, d("2026-11-30"));
    const sts = await db.cardStatement.findMany({ where: { cardId: { in: [card.id, child.id] } } });
    expect(sts.map((s) => `${s.cardId === child.id ? "USD" : "ARS"}:${Number(s.totalAmount)}`).sort()).toEqual(["ARS:1000", "USD:10"]);
    await db.exchangeRate.create({ data: { workspaceId: ws, base: "USD", quote: "ARS", kind: "manual", sell: "1000", source: "manual", fetchedAt: new Date() } });
    const g = (await cardGroups(db, ws, d("2026-11-30")))[0];
    expect(g.child?.card.id).toBe(child.id);
    expect(Number(g.used)).toBe(11000);
    expect(g.usagePct).toBe(1);
  });
});

describe("suscripciones y cargos", () => {
  it("se cargan solas sin duplicar, y el resumen suma los cargos fijos", async () => {
    const { ws, card } = await setup({ monthlyFee: "300" });
    await addSubscription(db, ws, { cardId: card.id, description: "Gimnasio", amount: "2000", dayOfMonth: 3, startDate: d("2026-11-01") });
    await chargeSubscriptions(db, ws, d("2026-11-20"));
    await chargeSubscriptions(db, ws, d("2026-11-20"));
    expect(await db.transaction.count({ where: { workspaceId: ws, description: "Gimnasio" } })).toBe(1);
    await closeStatements(db, ws, d("2026-11-30"));
    const s = await db.cardStatement.findFirstOrThrow({ where: { cardId: card.id } });
    expect(Number(s.totalAmount)).toBe(2300);
    // El próximo resumen ya cuenta la suscripción y los cargos aunque todavía no se cargaron.
    const next = (await projectedCardPayments(db, ws, d("2026-11-30"), d("2027-01-10")))[0];
    expect(Number(next.amount)).toBe(2300);
  });
});

describe("pagar una parte", () => {
  it("lo que falta pasa al próximo resumen con el interés de financiación", async () => {
    const { ws, bank, card } = await setup({ financeRate: "120" });
    await cardPurchase(db, ws, { cardId: card.id, description: "Tele", amount: "10000", date: d("2026-11-10") });
    await closeStatements(db, ws, d("2026-11-26"));
    const st = await cardStatus(db, ws, card.id, d("2026-11-26"));
    await payObligation(db, ws, { obligationId: st.open[0].id, accountId: bank.id, amount: "4000", date: d("2026-12-04") });
    await closeStatements(db, ws, d("2026-12-26"));
    const dec = await db.cardStatement.findFirstOrThrow({ where: { cardId: card.id, closingDate: d("2026-12-25") } });
    expect(Number(dec.carriedAmount)).toBe(6000);
    expect(Number(dec.totalAmount)).toBe(6600); // 6.000 + 10% de interés del mes (TNA 120%)
    expect((await db.obligation.findUniqueOrThrow({ where: { id: st.open[0].id } })).status).toBe("CANCELLED");
    const now = await cardStatus(db, ws, card.id, d("2026-12-26"));
    expect(now.owed.toNumber()).toBe(6600);
  });
});

describe("devoluciones y cuotas", () => {
  it("una devolución baja el resumen y adelantar cuotas las mete en el próximo", async () => {
    const { ws, card } = await setup();
    await cardPurchase(db, ws, { cardId: card.id, description: "Heladera", amount: "6000", installments: 6, date: d("2026-11-10") });
    await cardRefund(db, ws, { cardId: card.id, description: "Reintegro", amount: "200", date: d("2026-11-12") });
    let o = (await cardOverview(db, ws, d("2026-11-20")))[0];
    expect(o.nextAmount.toNumber()).toBe(800); // cuota 1.000 − 200
    await advancePlan(db, ws, (await db.installmentPlan.findFirstOrThrow({ where: { cardId: card.id } })).id, d("2026-11-20"));
    o = (await cardOverview(db, ws, d("2026-11-20")))[0];
    expect(o.nextAmount.toNumber()).toBe(5800);
    expect(o.futureInstallments.toNumber()).toBe(6000);
    await closeStatements(db, ws, d("2026-12-30"));
    const dec = await db.cardStatement.findFirst({ where: { cardId: card.id, closingDate: d("2026-12-25") } });
    expect(dec).toBeNull(); // no quedan cuotas para diciembre
  });
});

describe("revisar el resumen y adicionales", () => {
  it("encuentra en el PDF las compras que no están en Finan", async () => {
    const { ws, card } = await setup();
    await cardPurchase(db, ws, { cardId: card.id, description: "SUPER", amount: "1500", date: d("2026-11-03") });
    const p = parseStatementText(`CIERRE ACTUAL 25/11/26\nVENCIMIENTO ACTUAL 05/12/26\n03/11/26 SUPERMERCADO DIA 1.500,00\n07/11/26 FARMACIA CENTRAL 2.340,50\nSALDO ACTUAL 3.840,50`);
    expect(p.purchases.map((x) => x.description)).toEqual(["SUPERMERCADO DIA", "FARMACIA CENTRAL"]);
    const miss = await missingPurchases(db, ws, card.id, p.purchases);
    expect(miss).toEqual([{ date: "2026-11-07", description: "FARMACIA CENTRAL", amount: "2340.50" }]);
  });

  it("separa lo que gastó cada persona", async () => {
    const { ws, card } = await setup({ holders: ["Ana"] });
    await cardPurchase(db, ws, { cardId: card.id, description: "Libros", amount: "700", date: d("2026-11-10"), holder: "Ana" });
    await cardPurchase(db, ws, { cardId: card.id, description: "Nafta", amount: "300", date: d("2026-11-11") });
    const o = (await cardOverview(db, ws, d("2026-11-20")))[0];
    expect(o.spentNow.byHolder.map((x) => `${x.name}:${x.amount.toNumber()}`)).toEqual(["Ana:700", "Titular:300"]);
  });
});
