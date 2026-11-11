// Resúmenes de tarjeta cargados a mano o desde el PDF.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { accountBalances, createAccount, monthSummary, payObligation } from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import { cardPurchase, cardStatus, createCard, loadStatement, statementAmount } from "@/server/cards";
import { parseStatementText } from "@/server/statement-pdf";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t?.stop(); });

async function setup(email: string) {
  const user = await db.user.create({ data: { email, name: "Prueba", passwordHash: "x" } });
  const ws = await createWorkspaceForUser(db, user.id);
  const bank = await createAccount(db, ws.id, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "2000000", initialDate: d("2026-10-01") });
  const card = await createCard(db, ws.id, { issuer: "Banco", name: "Visa", limit: "3000000", currency: "ARS", closingDay: 25, dueDay: 5, startDate: d("2026-11-01") });
  return { ws, bank, card };
}

describe("Resumen cargado a mano", () => {
  it("trae la deuda anterior sin contarla como gasto, y las cuotas que siguen aparecen solas", async () => {
    const { ws, bank, card } = await setup("res1@test.com");
    await loadStatement(db, ws.id, { cardId: card.id, closingDate: d("2026-10-25"), dueDate: d("2026-11-05"), total: "450000", minimum: "45000", carry: [{ description: "Heladera", amount: "50000", remaining: 3 }] });
    const st = await cardStatus(db, ws.id, card.id, d("2026-11-01"));
    expect(st.owed.toFixed(2)).toBe("450000.00");
    expect(st.overdue).toBe(false);
    const bal = await accountBalances(db, ws.id);
    expect(bal.get(card.accountId!)!.toFixed(2)).toBe("-600000.00"); // 450.000 del resumen + 3 × 50.000
    const sum = await monthSummary(db, ws.id, "2026-10", "ARS", d("2026-11-01"));
    expect(sum.expense.toFixed(2)).toBe("0.00"); // no es un gasto nuevo
    const full = await db.creditCard.findUniqueOrThrow({ where: { id: card.id }, include: { plans: true, statements: true } });
    expect((await statementAmount(db, full, d("2026-11-25"))).total.toFixed(2)).toBe("50000.00");
    expect((await statementAmount(db, full, d("2027-02-25"))).total.toFixed(2)).toBe("0.00");
    // Pagarlo deja la tarjeta al día.
    await payObligation(db, ws.id, { obligationId: st.open[0].id, accountId: bank.id, amount: "450000", date: d("2026-11-04") });
    const after = await cardStatus(db, ws.id, card.id, d("2026-11-06"));
    expect(after.open.length).toBe(0);
  });

  it("si el resumen ya tenía compras cargadas en Finan, solo ajusta la diferencia", async () => {
    const { ws, card } = await setup("res2@test.com");
    await cardPurchase(db, ws.id, { cardId: card.id, description: "Super", amount: "100000", date: d("2026-11-10") });
    await loadStatement(db, ws.id, { cardId: card.id, closingDate: d("2026-11-25"), dueDate: d("2026-12-05"), total: "130000" });
    const bal = await accountBalances(db, ws.id);
    expect(bal.get(card.accountId!)!.toFixed(2)).toBe("-130000.00");
    const st = await cardStatus(db, ws.id, card.id, d("2026-11-26"));
    expect(st.owed.toFixed(2)).toBe("130000.00");
  });

  it("rechaza datos imposibles", async () => {
    const { ws, card } = await setup("res3@test.com");
    await expect(loadStatement(db, ws.id, { cardId: card.id, closingDate: d("2026-10-25"), dueDate: d("2026-10-20"), total: "1000" })).rejects.toThrow(/vencimiento/);
    await expect(loadStatement(db, ws.id, { cardId: card.id, closingDate: d("2026-10-25"), dueDate: d("2026-11-05"), total: "1000", minimum: "2000" })).rejects.toThrow(/mínimo/);
  });
});

describe("Lectura del PDF (texto)", () => {
  it("encuentra cierre, vencimiento, total, mínimo y cuotas", () => {
    const text = `VISA SIGNATURE
CIERRE ACTUAL 23-Oct-26   VENCIMIENTO ACTUAL 03-Nov-26
SALDO ACTUAL $ 1.234.567,89
PAGO MINIMO $ 98.765,43
05-09-26 FRAVEGA HELADERA C.03/06 45.000,00
12-10-26 NETFLIX 12.999,00
18-08-26 GARBARINO TV Cuota 2 de 12 30.500,50`;
    const p = parseStatementText(text);
    expect(p.closingDate).toBe("2026-10-23");
    expect(p.dueDate).toBe("2026-11-03");
    expect(p.total).toBe("1234567.89");
    expect(p.minimum).toBe("98765.43");
    expect(p.carry).toEqual([
      { description: "FRAVEGA HELADERA", amount: "45000.00", remaining: 3 },
      { description: "GARBARINO TV", amount: "30500.50", remaining: 10 },
    ]);
  });
  it("si no encuentra un dato lo deja vacío en vez de inventarlo", () => {
    const p = parseStatementText("Resumen de cuenta. Gracias por elegirnos.");
    expect(p.total).toBeNull();
    expect(p.closingDate).toBeNull();
    expect(p.carry).toEqual([]);
  });
});
