// Tarjetas de crédito. La tarjeta es una cuenta de deuda (CREDIT_CARD):
// - una compra es un GASTO en esa cuenta (se cuenta una sola vez, en su categoría y su mes);
// - pagar el resumen es una TRANSFERENCIA desde el banco a la tarjeta (no es otro gasto).
// Así nunca se duplica el gasto entre la compra y el pago.
import type { Db } from "./ledger";
import { accountBalances, UserError } from "./ledger";
import { allocate, dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";
import type Decimal from "decimal.js";

const utc = (y: number, m: number, d: number) => {
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(yy, mm, Math.min(d, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())));
};

// Cierre del ciclo que contiene la fecha d.
export function closingFor(d: Date, closingDay: number): Date {
  const c = utc(d.getUTCFullYear(), d.getUTCMonth(), closingDay);
  return d <= c ? c : utc(d.getUTCFullYear(), d.getUTCMonth() + 1, closingDay);
}
export const nextClosing = (closing: Date, closingDay: number, k = 1) => utc(closing.getUTCFullYear(), closing.getUTCMonth() + k, closingDay);
export const prevClosing = (closing: Date, closingDay: number) => nextClosing(closing, closingDay, -1);
// Vencimiento: el primer "día de vencimiento" después del cierre.
export function dueFor(closing: Date, dueDay: number): Date {
  const same = utc(closing.getUTCFullYear(), closing.getUTCMonth(), dueDay);
  return same > closing ? same : utc(closing.getUTCFullYear(), closing.getUTCMonth() + 1, dueDay);
}

export async function createCard(
  db: Db,
  ws: string,
  input: { issuer: string; name: string; last4?: string | null; limit: MoneyValue; currency: string; closingDay: number; dueDay: number; payAccountId?: string | null; startDate: Date },
) {
  if (!input.name.trim()) throw new UserError("Poné un nombre para la tarjeta.");
  if (input.closingDay < 1 || input.closingDay > 31 || input.dueDay < 1 || input.dueDay > 31) throw new UserError("Los días de cierre y vencimiento van del 1 al 31.");
  if (input.last4 && !/^\d{4}$/.test(input.last4)) throw new UserError("Los últimos 4 números tienen que ser 4 dígitos.");
  if (input.payAccountId && !(await db.account.findFirst({ where: { id: input.payAccountId, workspaceId: ws } }))) throw new UserError("No encontramos la cuenta de pago.");
  return db.$transaction(async (tx) => {
    const acc = await tx.account.create({
      data: { workspaceId: ws, name: input.name.trim(), institution: input.issuer.trim() || null, type: "CREDIT_CARD", currency: input.currency, initialBalance: "0", initialDate: input.startDate },
    });
    return tx.creditCard.create({
      data: {
        workspaceId: ws,
        issuer: input.issuer.trim(),
        name: input.name.trim(),
        last4: input.last4 || null,
        limitAmount: round2(input.limit).toFixed(2),
        currency: input.currency,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        payAccountId: input.payAccountId ?? null,
        accountId: acc.id,
      },
    });
  });
}

// Compra con tarjeta, en un pago o en cuotas. El gasto se registra una vez, por el total.
export async function cardPurchase(
  db: Db,
  ws: string,
  input: { cardId: string; description: string; amount: MoneyValue; categoryId?: string | null; date: Date; installments?: number; financedTotal?: MoneyValue | null; userId?: string | null },
) {
  const card = await db.creditCard.findFirst({ where: { id: input.cardId, workspaceId: ws } });
  if (!card || !card.accountId) throw new UserError("No encontramos esa tarjeta.");
  const description = input.description.trim();
  if (!description) throw new UserError("Falta el concepto.");
  const n = input.installments ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 60) throw new UserError("Las cuotas van de 1 a 60.");
  const total = round2(input.financedTotal ?? input.amount);
  if (!total.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  if (input.categoryId && !(await db.category.findFirst({ where: { id: input.categoryId, workspaceId: ws, kind: "EXPENSE" } }))) throw new UserError("Elegí una categoría de gasto.");
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        workspaceId: ws,
        accountId: card.accountId!,
        type: "EXPENSE",
        direction: "OUT",
        amount: total.toFixed(2),
        currency: card.currency,
        description: n > 1 ? `${description} (${n} cuotas)` : description,
        categoryId: input.categoryId ?? null,
        effectiveDate: input.date,
        economicPeriod: period(input.date),
        createdById: input.userId ?? null,
      },
    });
    if (n > 1) {
      await tx.installmentPlan.create({
        data: {
          cardId: card.id,
          description,
          purchaseDate: input.date,
          totalAmount: total.toFixed(2),
          installments: n,
          installmentAmount: allocate(total, n)[n - 1].toFixed(2),
          interestFree: input.financedTotal == null,
          categoryId: input.categoryId ?? null,
          transactionId: t.id,
          firstStatementDate: closingFor(input.date, card.closingDay),
        },
      });
    }
    return t;
  });
}

type CardWithPlans = Awaited<ReturnType<typeof loadCard>>;
async function loadCard(db: Db, ws: string, cardId: string) {
  const card = await db.creditCard.findFirst({ where: { id: cardId, workspaceId: ws }, include: { plans: true, statements: { orderBy: { closingDate: "desc" } } } });
  if (!card || !card.accountId) throw new UserError("No encontramos esa tarjeta.");
  return card;
}

// Cuánto entra en el resumen que cierra en "closing": compras en un pago del ciclo + cuotas que caen en ese ciclo.
export async function statementAmount(db: Db, card: CardWithPlans, closing: Date): Promise<{ total: Decimal; purchases: Decimal; installments: Decimal }> {
  const from = prevClosing(closing, card.closingDay);
  const planTx = new Set(card.plans.map((p) => p.transactionId).filter(Boolean) as string[]);
  const tx = await db.transaction.findMany({
    where: { accountId: card.accountId!, type: "EXPENSE", effectiveDate: { gt: from, lte: closing } },
    select: { id: true, amount: true, direction: true },
  });
  const purchases = tx.filter((t) => !planTx.has(t.id)).reduce((s, t) => (t.direction === "OUT" ? s.plus(dec(t.amount)) : s.minus(dec(t.amount))), ZERO);
  let installments = ZERO;
  for (const p of card.plans) {
    const first = p.firstStatementDate ?? closingFor(p.purchaseDate, card.closingDay);
    const k = (closing.getUTCFullYear() - first.getUTCFullYear()) * 12 + closing.getUTCMonth() - first.getUTCMonth();
    if (k >= 0 && k < p.installments) installments = installments.plus(allocate(p.totalAmount, p.installments)[k]);
  }
  return { total: round2(purchases.plus(installments)), purchases, installments };
}

// Cierra los resúmenes vencidos (hasta hoy) y crea su pendiente de pago. Idempotente.
export async function closeStatements(db: Db, ws: string, today: Date) {
  const cards = await db.creditCard.findMany({ where: { workspaceId: ws, active: true }, include: { plans: true, statements: true } });
  for (const card of cards) {
    if (!card.accountId) continue;
    let c = closingFor(card.createdAt, card.closingDay);
    for (let i = 0; i < 36 && c <= today; i++, c = nextClosing(c, card.closingDay)) {
      if (card.statements.some((s) => s.closingDate.getTime() === c.getTime())) continue;
      const { total } = await statementAmount(db, card, c);
      if (!total.gt(0)) continue;
      const due = dueFor(c, card.dueDay);
      await db.$transaction(async (tx) => {
        const ob = await tx.obligation.create({
          data: { workspaceId: ws, direction: "PAYABLE", description: `${card.name} — resumen ${period(c)}`, amount: total.toFixed(2), currency: card.currency, dueDate: due, economicPeriod: period(c), sourceType: "card", sourceId: card.id },
        });
        await tx.cardStatement.create({ data: { cardId: card.id, closingDate: c, dueDate: due, totalAmount: total.toFixed(2), minimumAmount: round2(total.times("0.1")).toFixed(2), obligationId: ob.id } });
      });
    }
  }
}

// Resúmenes futuros estimados (cuotas ya comprometidas y compras del ciclo abierto), para el flujo de caja.
export async function projectedCardPayments(db: Db, ws: string, today: Date, until: Date) {
  const cards = await db.creditCard.findMany({ where: { workspaceId: ws, active: true }, include: { plans: true, statements: true } });
  const out: { date: Date; amount: Decimal; currency: string; description: string }[] = [];
  for (const card of cards) {
    let c = closingFor(today, card.closingDay);
    if (card.statements.some((s) => s.closingDate.getTime() === c.getTime())) c = nextClosing(c, card.closingDay);
    for (let i = 0; i < 60; i++, c = nextClosing(c, card.closingDay)) {
      const due = dueFor(c, card.dueDay);
      if (due > until) break;
      const { total } = await statementAmount(db, card, c);
      if (total.gt(0)) out.push({ date: due, amount: total, currency: card.currency, description: `${card.name} — resumen ${period(c)} (estimado)` });
    }
  }
  return out;
}

export async function cardOverview(db: Db, ws: string, today: Date) {
  const [cards, balances] = await Promise.all([
    db.creditCard.findMany({ where: { workspaceId: ws }, include: { plans: true, statements: { orderBy: { closingDate: "desc" }, take: 6 } }, orderBy: { createdAt: "asc" } }),
    accountBalances(db, ws),
  ]);
  const result = [];
  for (const card of cards) {
    const debt = (balances.get(card.accountId!) ?? ZERO).neg(); // saldo negativo de la cuenta = lo que debés
    const open = closingFor(today, card.closingDay);
    const current = card.statements.find((s) => s.closingDate.getTime() === open.getTime()) ? nextClosing(open, card.closingDay) : open;
    const next = await statementAmount(db, card, current);
    const lastStatement = card.statements[0] ?? null;
    const lastOb = lastStatement?.obligationId ? await db.obligation.findUnique({ where: { id: lastStatement.obligationId }, include: { payments: true } }) : null;
    const futureInstallments = card.plans.reduce((s, p) => {
      const first = p.firstStatementDate ?? closingFor(p.purchaseDate, card.closingDay);
      const k = (current.getUTCFullYear() - first.getUTCFullYear()) * 12 + current.getUTCMonth() - first.getUTCMonth();
      const parts = allocate(p.totalAmount, p.installments);
      return s.plus(parts.slice(Math.max(0, k)).reduce((a, x) => a.plus(x), ZERO));
    }, ZERO);
    result.push({
      card,
      debt: debt.lt(0) ? ZERO : debt,
      available: dec(card.limitAmount).minus(debt.lt(0) ? ZERO : debt),
      nextClosing: current,
      nextDue: dueFor(current, card.dueDay),
      nextAmount: next.total,
      futureInstallments,
      lastStatement,
      lastObligation: lastOb,
      activePlans: card.plans.filter((p) => {
        const first = p.firstStatementDate ?? closingFor(p.purchaseDate, card.closingDay);
        const k = (current.getUTCFullYear() - first.getUTCFullYear()) * 12 + current.getUTCMonth() - first.getUTCMonth();
        return k < p.installments;
      }),
    });
  }
  return result;
}
