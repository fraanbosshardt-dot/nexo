// Pruebas de los módulos: recurrencias, tarjetas, deudas, flujo de caja, cuotas y cereal.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { accountBalances, createAccount, monthSummary, openObligations, payObligation } from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import { applyWeekend, changeRuleFrom, createRule, materialize, occurrences } from "@/server/recurring";
import { cardOverview, cardPurchase, closeStatements, closingFor, createCard, dueFor } from "@/server/cards";
import { buildSchedule, cancelDebt, createDebt, debtDetail } from "@/server/debts";
import { canAfford, forecast } from "@/server/forecast";
import { createGrainSale, grainNet } from "@/server/grain";
import { netWorth, saveManualRate } from "@/server/wealth";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const TODAY = d("2026-11-06");

async function space(email: string, initial = "1000000") {
  const user = await db.user.create({ data: { email, name: "Prueba", passwordHash: "x" } });
  const ws = await createWorkspaceForUser(db, user.id);
  const bank = await createAccount(db, ws.id, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: initial, initialDate: d("2026-11-01") });
  return { ws, bank };
}

beforeAll(async () => { t = await startTestDb(); db = t.db; });
afterAll(async () => t?.stop());

describe("recurrencias", () => {
  it("usa el último día cuando el mes no tiene ese día y mueve los fines de semana", () => {
    const r = { frequency: "MONTHLY" as const, interval: 1, dayOfMonth: 31, startDate: d("2026-01-31"), endDate: null, weekendRule: "NONE" as const };
    expect(occurrences(r, d("2026-01-01"), d("2026-04-30")).map((x) => x.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(applyWeekend(d("2026-11-07"), "NEXT_BUSINESS_DAY").toISOString().slice(0, 10)).toBe("2026-11-09"); // sábado → lunes
    expect(applyWeekend(d("2026-11-08"), "PREVIOUS_BUSINESS_DAY").toISOString().slice(0, 10)).toBe("2026-11-06"); // domingo → viernes
  });

  it("5. Generar dos veces no duplica y editar la regla no cambia el pasado", async () => {
    const s = await space("rec@ejemplo.com");
    const rule = await createRule(db, s.ws.id, { direction: "PAYABLE", description: "Expensas", amount: "185000", currency: "ARS", frequency: "MONTHLY", dayOfMonth: 10, startDate: d("2026-10-10") });
    await materialize(db, s.ws.id, d("2026-12-31"));
    await materialize(db, s.ws.id, d("2026-12-31"));
    expect(await db.obligation.count({ where: { recurringRuleId: rule.id } })).toBe(3); // oct, nov, dic
    const oct = await db.obligation.findFirstOrThrow({ where: { recurringRuleId: rule.id, economicPeriod: "2026-10" } });
    await payObligation(db, s.ws.id, { obligationId: oct.id, accountId: s.bank.id, amount: "185000", date: d("2026-10-10") });
    await changeRuleFrom(db, s.ws.id, rule.id, d("2026-12-01"), { amount: "200000" });
    await materialize(db, s.ws.id, d("2026-12-31"));
    const all = await db.obligation.findMany({ where: { workspaceId: s.ws.id }, orderBy: { dueDate: "asc" } });
    expect(all.map((o) => o.amount.toFixed(0))).toEqual(["185000", "185000", "200000"]);
    expect(all[0].status).toBe("SETTLED");
  });
});

describe("tarjetas", () => {
  it("calcula cierre y vencimiento", () => {
    expect(closingFor(d("2026-11-03"), 26).toISOString().slice(0, 10)).toBe("2026-11-26");
    expect(closingFor(d("2026-11-27"), 26).toISOString().slice(0, 10)).toBe("2026-12-26");
    expect(dueFor(d("2026-11-26"), 7).toISOString().slice(0, 10)).toBe("2026-12-07");
  });

  it("6. Una compra en cuotas no duplica el gasto al pagar la tarjeta", async () => {
    const s = await space("card@ejemplo.com");
    const card = await createCard(db, s.ws.id, { issuer: "Banco", name: "Visa", limit: "2500000", currency: "ARS", closingDay: 26, dueDay: 7, startDate: d("2026-10-01") });
    await db.creditCard.update({ where: { id: card.id }, data: { createdAt: d("2026-10-01") } });
    await cardPurchase(db, s.ws.id, { cardId: card.id, description: "Heladera", amount: "600000", date: d("2026-10-10"), installments: 6 });
    await cardPurchase(db, s.ws.id, { cardId: card.id, description: "Nafta", amount: "50000", date: d("2026-10-12") });
    await closeStatements(db, s.ws.id, TODAY);
    const st = await db.cardStatement.findFirstOrThrow({ where: { cardId: card.id } });
    expect(st.totalAmount.toFixed(0)).toBe("150000"); // 1.ª cuota (100.000) + nafta (50.000)
    const ob = await db.obligation.findUniqueOrThrow({ where: { id: st.obligationId! } });
    await payObligation(db, s.ws.id, { obligationId: ob.id, accountId: s.bank.id, amount: "150000", date: d("2026-11-07") });
    const oct = await monthSummary(db, s.ws.id, "2026-10", "ARS", TODAY);
    const nov = await monthSummary(db, s.ws.id, "2026-11", "ARS", TODAY);
    expect(oct.expense.toFixed(0)).toBe("650000"); // las compras cuentan en su mes, una sola vez
    expect(nov.expense.toFixed(0)).toBe("0"); // el pago del resumen es una transferencia, no otro gasto
    const spent = await db.transaction.aggregate({ where: { workspaceId: s.ws.id, type: "EXPENSE" }, _sum: { amount: true } });
    expect(spent._sum.amount?.toFixed(0)).toBe("650000"); // los gastos se cuentan una sola vez
    const ov = (await cardOverview(db, s.ws.id, TODAY))[0];
    expect(ov.debt.toFixed(0)).toBe("500000"); // quedan 5 cuotas de 100.000
    expect((await accountBalances(db, s.ws.id)).get(s.bank.id)!.toFixed(0)).toBe("850000");
  });
});

describe("deudas", () => {
  it("arma el cronograma francés con cuotas iguales que devuelven el capital", () => {
    const rows = buildSchedule({ system: "FRENCH", principal: "1200000", installments: 12, tna: "60", firstDue: d("2026-12-10") });
    expect(rows).toHaveLength(12);
    expect(rows[0].total.toFixed(2)).toBe(rows[5].total.toFixed(2));
    expect(rows.reduce((s, r) => s.plus(r.capital), rows[0].capital.minus(rows[0].capital)).toFixed(2)).toBe("1200000.00");
    expect(rows[11].balance.toFixed(2)).toBe("0.00");
  });
  it("no inventa la tasa: sin TNA pide la cuota", () => {
    expect(() => buildSchedule({ system: "FRENCH", principal: "1000", installments: 3, firstDue: d("2026-12-01") })).toThrow(/TNA/);
    const r = buildSchedule({ system: "FRENCH", principal: "300000", installments: 3, installmentAmount: "110000", firstDue: d("2026-12-01") });
    expect(r.reduce((s, x) => s.plus(x.total), r[0].total.minus(r[0].total)).toFixed(0)).toBe("330000");
  });
  it("7. La cancelación anticipada cierra las cuotas futuras y calcula el ahorro", async () => {
    const s = await space("debt@ejemplo.com");
    const debt = await createDebt(db, s.ws.id, { creditor: "Banco", kind: "Préstamo personal", principal: "600000", currency: "ARS", system: "FRENCH", installments: 6, tna: "80", startDate: d("2026-10-01"), firstDue: d("2026-11-10"), accountId: s.bank.id });
    expect((await accountBalances(db, s.ws.id)).get(s.bank.id)!.toFixed(0)).toBe("1600000");
    expect((await monthSummary(db, s.ws.id, "2026-10", "ARS", TODAY)).income.toFixed(0)).toBe("0"); // el préstamo no es ingreso
    const det = (await debtDetail(db, s.ws.id, debt.id))!;
    const r = await cancelDebt(db, s.ws.id, { debtId: debt.id, accountId: s.bank.id, amount: det.remainingCapital, date: TODAY });
    expect(r.saved.gt(0)).toBe(true);
    expect((await openObligations(db, s.ws.id, TODAY)).length).toBe(0);
    expect((await db.debt.findUniqueOrThrow({ where: { id: debt.id } })).status).toBe("CANCELLED");
  });
});

describe("flujo de caja y cuotas", () => {
  it("8. El saldo proyectado coincide con la suma de los movimientos futuros", async () => {
    const s = await space("flow@ejemplo.com", "500000");
    await createRule(db, s.ws.id, { direction: "RECEIVABLE", description: "Sueldo", amount: "1000000", currency: "ARS", frequency: "MONTHLY", dayOfMonth: 1, startDate: d("2026-12-01") });
    await createRule(db, s.ws.id, { direction: "PAYABLE", description: "Alquiler", amount: "400000", currency: "ARS", frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-12-05") });
    const { rows } = await forecast(db, s.ws.id, { currency: "ARS", today: TODAY, months: 4 });
    expect(rows[0].end.toFixed(0)).toBe("500000");
    expect(rows[1].end.toFixed(0)).toBe("1100000");
    expect(rows[3].end.toFixed(0)).toBe("2300000");
    expect(rows[2].start.toFixed(0)).toBe(rows[1].end.toFixed(0));
  });
  it("responde si se puede comprar en cuotas según el dinero", async () => {
    const s = await space("cuotas@ejemplo.com", "300000");
    await createRule(db, s.ws.id, { direction: "PAYABLE", description: "Alquiler", amount: "250000", currency: "ARS", frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-12-05") });
    await createRule(db, s.ws.id, { direction: "RECEIVABLE", description: "Sueldo", amount: "300000", currency: "ARS", frequency: "MONTHLY", dayOfMonth: 1, startDate: d("2026-12-01") });
    const yes = await canAfford(db, s.ws.id, { currency: "ARS", today: TODAY, price: "120000", installments: 6, firstDue: d("2026-12-07") });
    expect(yes.ok).toBe(true);
    const no = await canAfford(db, s.ws.id, { currency: "ARS", today: TODAY, price: "2400000", installments: 3, firstDue: d("2026-12-07") });
    expect(no.ok).toBe(false);
    expect(no.worst.min.lt(0)).toBe(true);
  });
});

describe("cereal y patrimonio", () => {
  it("calcula el neto con impuesto al cheque y lo suma como cobro pendiente", async () => {
    expect(grainNet({ tonnes: "30", pricePerTonne: "430000", taxPct: "1.2", otherDeductions: "0" }).net.toFixed(0)).toBe("12745200");
    const s = await space("agro@ejemplo.com");
    await createGrainSale(db, s.ws.id, { saleDate: d("2026-11-03"), grain: "Soja", tonnes: "30", pricePerTonne: "430000", priceCurrency: "ARS", taxPct: "1.2", collectDate: d("2026-11-20"), accountId: s.bank.id, collected: false });
    const m = await monthSummary(db, s.ws.id, "2026-11", "ARS", TODAY);
    expect(m.pendingIn.toFixed(0)).toBe("12745200");
  });
  it("no suma monedas sin cotización y usa la que se cargó", async () => {
    const s = await space("nw@ejemplo.com");
    await createAccount(db, s.ws.id, { name: "Dólares", type: "FOREIGN", currency: "USD", initialBalance: "100", initialDate: d("2026-11-01") });
    const a = await netWorth(db, s.ws.id, "ARS");
    expect(a.missingRates).toEqual(["USD"]);
    expect(a.net.toFixed(0)).toBe("1000000");
    await saveManualRate(db, s.ws.id, "USD", "ARS", "1400");
    expect((await netWorth(db, s.ws.id, "ARS")).net.toFixed(0)).toBe("1140000");
  });
});
