// Tarjetas de crédito. La tarjeta es una cuenta de deuda (CREDIT_CARD):
// - una compra es un GASTO en esa cuenta (se cuenta una sola vez, en su categoría y su mes);
// - pagar el resumen es una TRANSFERENCIA desde el banco a la tarjeta (no es otro gasto).
// Así nunca se duplica el gasto entre la compra y el pago.
// Una tarjeta con consumos en dos monedas (ej.: pesos y dólares) son dos "tarjetas" unidas por parentId:
// comparten cierre y vencimiento, y cada moneda tiene su resumen.
import type { Db } from "./ledger";
import { accountBalances, readBalances, paidSoFar, remaining, UserError } from "./ledger";
import { allocate, dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";
import type Decimal from "decimal.js";

const utc = (y: number, m: number, d: number) => {
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(yy, mm, Math.min(d, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())));
};
const monthKey = (y: number, m: number) => { const d = utc(y, m, 1); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

// Cierre del ciclo que contiene la fecha d (con el día de cierre habitual).
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

// Calendario de la tarjeta: el día habitual, salvo los meses en que el banco cierra o vence en otra fecha.
export type Cycle = { month: string; closingDate: Date; dueDate: Date };
export function calendar(card: { closingDay: number; dueDay: number; cycles?: Cycle[] }) {
  const ov = new Map((card.cycles ?? []).map((c) => [c.month, c]));
  const closeOf = (y: number, m: number) => ov.get(monthKey(y, m))?.closingDate ?? utc(y, m, card.closingDay);
  const monthOf = (c: Date): [number, number] => {
    const y = c.getUTCFullYear(), m = c.getUTCMonth();
    for (const dm of [0, -1, 1]) if (closeOf(y, m + dm).getTime() === c.getTime()) return [y, m + dm];
    return [y, m];
  };
  const cal = {
    closingFor(d: Date): Date {
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      for (const dm of [-1, 0, 1, 2]) { const c = closeOf(y, m + dm); if (d <= c) return c; }
      return closeOf(y, m + 2);
    },
    next(c: Date, k = 1): Date { const [y, m] = monthOf(c); return closeOf(y, m + k); },
    prev(c: Date): Date { return cal.next(c, -1); },
    due(c: Date): Date { const [y, m] = monthOf(c); return ov.get(monthKey(y, m))?.dueDate ?? dueFor(c, card.dueDay); },
    index(c: Date): number { const [y, m] = monthOf(c); return y * 12 + m; },
    month(c: Date): string { const [y, m] = monthOf(c); return monthKey(y, m); },
    usual(c: Date): { closing: Date; due: Date } { const [y, m] = monthOf(c); const cl = utc(y, m, card.closingDay); return { closing: cl, due: dueFor(cl, card.dueDay) }; },
  };
  return cal;
}

type Plan = { totalAmount: MoneyValue; installments: number; firstStatementDate: Date | null; purchaseDate: Date; advancedTo: Date | null };
// Cuánto de un plan en cuotas cae en el resumen que cierra en "closing" (respeta las cuotas adelantadas).
function planPart(cal: ReturnType<typeof calendar>, p: Plan, closing: Date): Decimal {
  const first = p.firstStatementDate ?? cal.closingFor(p.purchaseDate);
  const k = cal.index(closing) - cal.index(first);
  if (k < 0 || k >= p.installments) return ZERO;
  const parts = allocate(p.totalAmount, p.installments);
  if (p.advancedTo) {
    const ka = cal.index(p.advancedTo) - cal.index(first);
    if (k > ka) return ZERO;
    if (k === ka) return parts.slice(k).reduce((s, x) => s.plus(x), ZERO);
  }
  return parts[k];
}
// Cuotas que faltan desde "closing" (incluido).
function planLeft(cal: ReturnType<typeof calendar>, p: Plan, closing: Date): { left: Decimal; paid: number; perMonth: Decimal } {
  const first = p.firstStatementDate ?? cal.closingFor(p.purchaseDate);
  const k = Math.max(0, cal.index(closing) - cal.index(first));
  const parts = allocate(p.totalAmount, p.installments);
  if (p.advancedTo && cal.index(p.advancedTo) < cal.index(closing)) return { left: ZERO, paid: p.installments, perMonth: ZERO };
  return { left: parts.slice(k).reduce((s, x) => s.plus(x), ZERO), paid: Math.min(k, p.installments), perMonth: parts[Math.min(k, parts.length - 1)] };
}

async function loadCard(db: Db, ws: string, cardId: string) {
  const card = await db.creditCard.findFirst({ where: { id: cardId, workspaceId: ws }, include: { plans: true, cycles: true, subscriptions: true, statements: { orderBy: { closingDate: "desc" } } } });
  if (!card || !card.accountId) throw new UserError("No encontramos esa tarjeta.");
  return card;
}
type FullCard = Awaited<ReturnType<typeof loadCard>>;

// Las fechas de cada suscripción entre "from" (excluido) y "to" (incluido).
function subDates(s: { dayOfMonth: number; startDate: Date; endDate: Date | null }, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let y = from.getUTCFullYear(), m = from.getUTCMonth(), i = 0; i < 40; i++, m++) {
    const d = utc(y, m, s.dayOfMonth);
    if (d > to) break;
    if (d > from && d >= s.startDate && (!s.endDate || d <= s.endDate)) out.push(d);
  }
  return out;
}

// Cuánto entra en el resumen que cierra en "closing": compras del ciclo (menos devoluciones) + cuotas que caen.
// Si el resumen todavía no cerró ("today" antes del cierre), suma lo que se va a cargar solo: suscripciones y cargos fijos.
type CardLike = Omit<FullCard, "cycles" | "subscriptions"> & { cycles?: Cycle[]; subscriptions?: FullCard["subscriptions"] };
type CardTx = { id: string; amount: MoneyValue; direction: string; idempotencyKey: string | null; effectiveDate: Date; categoryId?: string | null; cardHolder?: string | null };
// Todas las compras de la tarjeta en un rango, de una sola vez (para no consultar la base mes por mes).
async function cardTxs(db: Db, accountId: string, from: Date, to: Date): Promise<CardTx[]> {
  return db.transaction.findMany({ where: { accountId, type: "EXPENSE", effectiveDate: { gt: from, lte: to } }, select: { id: true, amount: true, direction: true, idempotencyKey: true, effectiveDate: true, categoryId: true, cardHolder: true } });
}
export async function statementAmount(db: Db, card: CardLike, closing: Date, today?: Date, pre?: CardTx[]): Promise<{ total: Decimal; purchases: Decimal; installments: Decimal; extras: Decimal }> {
  const cal = calendar(card);
  const from = cal.prev(closing);
  const planTx = new Set(card.plans.map((p) => p.transactionId).filter(Boolean) as string[]);
  const tx = pre ? pre.filter((t) => t.effectiveDate > from && t.effectiveDate <= closing) : await cardTxs(db, card.accountId!, from, closing);
  const purchases = tx.filter((t) => !planTx.has(t.id)).reduce((s, t) => (t.direction === "OUT" ? s.plus(dec(t.amount)) : s.minus(dec(t.amount))), ZERO);
  const installments = card.plans.reduce((s, p) => s.plus(planPart(cal, p, closing)), ZERO);
  let extras = ZERO;
  if (today && closing >= today) {
    const keys = new Set(tx.map((t) => t.idempotencyKey).filter(Boolean));
    for (const s of card.subscriptions ?? []) for (const d of subDates(s, from, closing)) if (!keys.has(`sub:${s.id}:${d.toISOString().slice(0, 10)}`)) extras = extras.plus(dec(s.amount));
    if (card.monthlyFee && dec(card.monthlyFee).gt(0) && !keys.has(`cardfee:${card.id}:${closing.toISOString().slice(0, 10)}`)) extras = extras.plus(dec(card.monthlyFee));
  }
  return { total: round2(purchases.plus(installments).plus(extras)), purchases, installments, extras };
}

// ---------- Alta, edición y baja ----------

export type CardInput = {
  issuer: string; name: string; last4?: string | null; limit: MoneyValue; currency: string; closingDay: number; dueDay: number; payAccountId?: string | null;
  currency2?: string | null; financeRate?: MoneyValue | null; monthlyFee?: MoneyValue | null; alertPct?: number | null; holders?: string[];
  mode?: "SIMPLE" | "DETAILED";
};

function checkCard(input: CardInput) {
  if (!input.name.trim()) throw new UserError("Poné un nombre para la tarjeta.");
  if (input.closingDay < 1 || input.closingDay > 31 || input.dueDay < 1 || input.dueDay > 31) throw new UserError("Los días de cierre y vencimiento van del 1 al 31.");
  if (input.last4 && !/^\d{4}$/.test(input.last4)) throw new UserError("Los últimos 4 números tienen que ser 4 dígitos.");
  if (input.closingDay === input.dueDay) throw new UserError("El cierre y el vencimiento no pueden ser el mismo día. Fijate en tu resumen: el vencimiento suele ser unos 10 días después del cierre.");
  if (input.currency2 && input.currency2 === input.currency) throw new UserError("La segunda moneda tiene que ser distinta de la principal.");
  if (input.alertPct != null && (input.alertPct < 1 || input.alertPct > 100)) throw new UserError("El aviso de uso del límite va de 1% a 100%.");
  if (input.financeRate != null && (dec(input.financeRate).lt(0) || dec(input.financeRate).gt(1000))) throw new UserError("Revisá la tasa de financiación.");
}
const extra = (input: CardInput) => ({
  financeRate: input.financeRate != null ? dec(input.financeRate).toFixed(4) : null,
  monthlyFee: input.monthlyFee != null && dec(input.monthlyFee).gt(0) ? round2(input.monthlyFee).toFixed(2) : null,
  alertPct: input.alertPct ?? null,
  holders: [...new Set((input.holders ?? []).map((h) => h.trim()).filter(Boolean))].slice(0, 6),
  ...(input.mode ? { mode: input.mode } : {}),
});

export async function createCard(db: Db, ws: string, input: CardInput & { startDate: Date }) {
  checkCard(input);
  if (input.payAccountId && !(await db.account.findFirst({ where: { id: input.payAccountId, workspaceId: ws } }))) throw new UserError("No encontramos la cuenta de pago.");
  return db.$transaction(async (tx) => {
    const acc = await tx.account.create({ data: { workspaceId: ws, name: input.name.trim(), institution: input.issuer.trim() || null, type: "CREDIT_CARD", currency: input.currency, initialBalance: "0", initialDate: input.startDate } });
    const card = await tx.creditCard.create({
      data: { workspaceId: ws, issuer: input.issuer.trim(), name: input.name.trim(), last4: input.last4 || null, limitAmount: round2(input.limit).toFixed(2), currency: input.currency, closingDay: input.closingDay, dueDay: input.dueDay, payAccountId: input.payAccountId ?? null, accountId: acc.id, ...extra(input) },
    });
    if (input.currency2) await addSecondCurrency(tx as unknown as Db, ws, card, input.currency2, input.startDate);
    return card;
  });
}

async function addSecondCurrency(db: Db, ws: string, card: { id: string; name: string; issuer: string; last4: string | null; closingDay: number; dueDay: number; payAccountId: string | null }, currency: string, startDate: Date) {
  const acc = await db.account.create({ data: { workspaceId: ws, name: `${card.name} (${currency})`, institution: card.issuer || null, type: "CREDIT_CARD", currency, initialBalance: "0", initialDate: startDate } });
  const mode = (card as { mode?: string }).mode ?? "DETAILED";
  return db.creditCard.create({ data: { mode, workspaceId: ws, issuer: card.issuer, name: `${card.name} (${currency})`, last4: card.last4, limitAmount: "0", currency, closingDay: card.closingDay, dueDay: card.dueDay, payAccountId: card.payAccountId, accountId: acc.id, parentId: card.id } });
}

export async function updateCard(db: Db, ws: string, id: string, input: Omit<CardInput, "currency"> & { active?: boolean }) {
  const card = await db.creditCard.findFirst({ where: { id, workspaceId: ws, parentId: null } });
  if (!card) throw new UserError("No encontramos esa tarjeta.");
  checkCard({ ...input, currency: card.currency } as CardInput);
  if (input.payAccountId && !(await db.account.findFirst({ where: { id: input.payAccountId, workspaceId: ws } }))) throw new UserError("No encontramos la cuenta de pago.");
  const child = await db.creditCard.findFirst({ where: { workspaceId: ws, parentId: card.id } });
  return db.$transaction(async (tx) => {
    const base = { issuer: input.issuer.trim(), last4: input.last4 || null, closingDay: input.closingDay, dueDay: input.dueDay, payAccountId: input.payAccountId ?? null, ...(input.active != null ? { active: input.active } : {}) };
    const updated = await tx.creditCard.update({ where: { id: card.id }, data: { ...base, name: input.name.trim(), limitAmount: round2(input.limit).toFixed(2), ...extra(input as CardInput) } });
    await tx.account.update({ where: { id: card.accountId! }, data: { name: input.name.trim(), institution: input.issuer.trim() || null, ...(input.active != null ? { active: input.active } : {}) } });
    if (child) {
      const n = `${input.name.trim()} (${child.currency})`;
      await tx.creditCard.update({ where: { id: child.id }, data: { ...base, name: n, ...(input.mode ? { mode: input.mode } : {}) } });
      await tx.account.update({ where: { id: child.accountId! }, data: { name: n, institution: input.issuer.trim() || null, ...(input.active != null ? { active: input.active } : {}) } });
    } else if (input.currency2) {
      await addSecondCurrency(tx as unknown as Db, ws, updated, input.currency2, new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
    }
    return updated;
  });
}

// Borrar una tarjeta cargada por error: se va con sus compras, cuotas, resúmenes y los pagos registrados
// (el banco desde el que pagaste vuelve a como estaba).
export async function deleteCard(db: Db, ws: string, id: string) {
  const card = await db.creditCard.findFirst({ where: { id, workspaceId: ws, parentId: null } });
  if (!card) throw new UserError("No encontramos esa tarjeta.");
  const cards = [card, ...(await db.creditCard.findMany({ where: { workspaceId: ws, parentId: card.id } }))];
  const ids = cards.map((c) => c.id), accs = cards.map((c) => c.accountId).filter(Boolean) as string[];
  const obs = await db.obligation.findMany({ where: { workspaceId: ws, sourceType: "card", sourceId: { in: ids } }, select: { id: true } });
  const obIds = obs.map((o) => o.id);
  const pays = await db.transaction.findMany({ where: { workspaceId: ws, OR: [{ obligationId: { in: obIds } }, { accountId: { in: accs } }] }, select: { id: true, transferGroupId: true } });
  const groups = [...new Set(pays.map((p) => p.transferGroupId).filter(Boolean) as string[])];
  await db.$transaction(async (tx) => {
    const all = await tx.transaction.findMany({ where: { workspaceId: ws, OR: [{ id: { in: pays.map((p) => p.id) } }, { transferGroupId: { in: groups } }] }, select: { id: true } });
    const txIds = all.map((t) => t.id);
    await tx.transaction.deleteMany({ where: { workspaceId: ws, reversalOfId: { in: txIds } } });
    await tx.installmentPlan.deleteMany({ where: { cardId: { in: ids } } });
    await tx.transaction.deleteMany({ where: { workspaceId: ws, id: { in: txIds } } });
    await tx.cardStatement.deleteMany({ where: { cardId: { in: ids } } });
    await tx.obligation.deleteMany({ where: { workspaceId: ws, id: { in: obIds } } });
    await tx.creditCard.deleteMany({ where: { id: { in: [...ids].reverse() } } });
    await tx.account.deleteMany({ where: { workspaceId: ws, id: { in: accs } } });
  });
}

// Este mes cierra o vence en otra fecha (vale para todas las monedas de la tarjeta).
export async function setCycle(db: Db, ws: string, cardId: string, input: { usualClosing: Date; closingDate: Date; dueDate: Date }) {
  const card = await loadCard(db, ws, cardId);
  if (card.parentId) throw new UserError("Cambiá las fechas desde la tarjeta principal.");
  if (input.dueDate <= input.closingDate) throw new UserError("El vencimiento tiene que ser después del cierre.");
  const cal = calendar(card);
  const month = cal.month(input.usualClosing);
  const prev = cal.prev(input.usualClosing), next = cal.next(input.usualClosing);
  if (input.closingDate <= prev || input.closingDate >= next) throw new UserError("La fecha de cierre tiene que quedar entre el cierre anterior y el siguiente.");
  const ids = [card.id, ...(await db.creditCard.findMany({ where: { workspaceId: ws, parentId: card.id }, select: { id: true } })).map((c) => c.id)];
  const closed = await db.cardStatement.findFirst({ where: { cardId: { in: ids }, closingDate: cal.closingFor(input.usualClosing) } });
  if (closed) throw new UserError("Ese resumen ya cerró. Si el banco lo cerró en otra fecha, corregilo cargando el resumen.");
  const usual = cal.usual(input.usualClosing);
  const same = usual.closing.getTime() === input.closingDate.getTime() && usual.due.getTime() === input.dueDate.getTime();
  await db.$transaction(async (tx) => {
    for (const id of ids) {
      if (same) await tx.cardCycle.deleteMany({ where: { cardId: id, month } });
      else await tx.cardCycle.upsert({ where: { cardId_month: { cardId: id, month } }, create: { cardId: id, month, closingDate: input.closingDate, dueDate: input.dueDate }, update: { closingDate: input.closingDate, dueDate: input.dueDate } });
    }
    // Las compras en cuotas que empezaban en ese resumen siguen en el mismo resumen.
    const was = cal.closingFor(input.usualClosing);
    await tx.installmentPlan.updateMany({ where: { cardId: { in: ids }, firstStatementDate: was }, data: { firstStatementDate: input.closingDate } });
  });
}

// ---------- Compras, devoluciones y cuotas ----------

// Compra con tarjeta, en un pago o en cuotas. El gasto se registra una vez, por el total.
// Si la compra es en la otra moneda de la tarjeta (ej.: dólares), va a esa parte de la tarjeta.
export async function cardPurchase(
  db: Db,
  ws: string,
  input: { cardId: string; description: string; amount: MoneyValue; categoryId?: string | null; date: Date; installments?: number; financedTotal?: MoneyValue | null; currency?: string | null; holder?: string | null; idempotencyKey?: string | null; userId?: string | null },
) {
  let card = await loadCard(db, ws, input.cardId);
  if (input.currency && input.currency !== card.currency) {
    const other = await db.creditCard.findFirst({ where: { workspaceId: ws, currency: input.currency, OR: [{ parentId: card.parentId ?? card.id }, { id: card.parentId ?? "-" }] } });
    if (!other) throw new UserError(`Esta tarjeta no tiene consumos en ${input.currency}. Agregalo en "Editar tarjeta".`);
    card = await loadCard(db, ws, other.id);
  }
  const description = input.description.trim();
  if (!description) throw new UserError("Falta el concepto.");
  const n = input.installments ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 60) throw new UserError("Las cuotas van de 1 a 60.");
  const total = round2(input.financedTotal ?? input.amount);
  if (!total.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  if (input.categoryId && !(await db.category.findFirst({ where: { id: input.categoryId, workspaceId: ws, kind: "EXPENSE" } }))) throw new UserError("Elegí una categoría de gasto.");
  const dup = input.idempotencyKey ? await db.transaction.findFirst({ where: { workspaceId: ws, idempotencyKey: input.idempotencyKey } }) : null;
  if (dup) return dup;
  const cal = calendar(card);
  const cycle = cal.closingFor(input.date);
  const closed = card.statements.find((s) => s.closingDate.getTime() === cycle.getTime());
  if (closed?.loaded && !input.idempotencyKey) throw new UserError(`Esa compra es del resumen que cerró el ${cycle.toISOString().slice(8, 10)}/${cycle.toISOString().slice(5, 7)}, y ese resumen ya lo cargaste completo desde el banco: si la sumás se cuenta dos veces. Si es de este mes, revisá la fecha.`);
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        workspaceId: ws, accountId: card.accountId!, type: "EXPENSE", direction: "OUT", amount: total.toFixed(2), currency: card.currency,
        description: n > 1 ? `${description} (${n} cuotas)` : description, categoryId: input.categoryId ?? null,
        effectiveDate: input.date, economicPeriod: period(input.date), cardHolder: input.holder?.trim() || null, idempotencyKey: input.idempotencyKey ?? null, createdById: input.userId ?? null,
      },
    });
    if (n > 1) {
      await tx.installmentPlan.create({
        data: { cardId: card.id, description, purchaseDate: input.date, totalAmount: total.toFixed(2), installments: n, installmentAmount: allocate(total, n)[n - 1].toFixed(2), interestFree: input.financedTotal == null, categoryId: input.categoryId ?? null, transactionId: t.id, firstStatementDate: cal.closingFor(input.date) },
      });
    }
    // Compra olvidada de un resumen que Finan ya había cerrado solo: ese resumen se actualiza.
    if (closed && !closed.loaded) {
      const add = n > 1 ? allocate(total, n)[0] : total;
      await tx.cardStatement.update({ where: { id: closed.id }, data: { totalAmount: dec(closed.totalAmount).plus(add).toFixed(2) } });
      if (closed.obligationId) {
        const ob = await tx.obligation.findUnique({ where: { id: closed.obligationId }, include: { payments: true } });
        if (ob) await tx.obligation.update({ where: { id: ob.id }, data: { amount: dec(ob.amount).plus(add).toFixed(2), status: paidSoFar(ob).gte(dec(ob.amount).plus(add)) ? "SETTLED" : paidSoFar(ob).gt(0) ? "PARTIAL" : "PENDING" } });
      }
    }
    return t;
  });
}

// Devolución o reintegro: baja el resumen (es un gasto en negativo, en la misma categoría).
export async function cardRefund(db: Db, ws: string, input: { cardId: string; description: string; amount: MoneyValue; date: Date; categoryId?: string | null; currency?: string | null; holder?: string | null; userId?: string | null }) {
  let card = await loadCard(db, ws, input.cardId);
  if (input.currency && input.currency !== card.currency) {
    const other = await db.creditCard.findFirst({ where: { workspaceId: ws, parentId: card.id, currency: input.currency } });
    if (!other) throw new UserError(`Esta tarjeta no tiene consumos en ${input.currency}.`);
    card = await loadCard(db, ws, other.id);
  }
  const amount = round2(input.amount);
  if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  if (!input.description.trim()) throw new UserError("Poné qué te devolvieron.");
  return db.transaction.create({
    data: { workspaceId: ws, accountId: card.accountId!, type: "EXPENSE", direction: "IN", amount: amount.toFixed(2), currency: card.currency, description: input.description.trim(), categoryId: input.categoryId ?? null, effectiveDate: input.date, economicPeriod: period(input.date), cardHolder: input.holder?.trim() || null, notes: "Devolución o reintegro", createdById: input.userId ?? null },
  });
}

// Adelantar las cuotas que faltan: entran todas en el próximo resumen que cierra.
export async function advancePlan(db: Db, ws: string, planId: string, today: Date) {
  const plan = await db.installmentPlan.findFirst({ where: { id: planId, card: { workspaceId: ws } } });
  if (!plan) throw new UserError("No encontramos esa compra en cuotas.");
  const card = await loadCard(db, ws, plan.cardId);
  const cal = calendar(card);
  let next = cal.closingFor(today);
  if (card.statements.some((s) => s.closingDate.getTime() === next.getTime())) next = cal.next(next);
  const { left } = planLeft(cal, plan, next);
  if (!left.gt(0)) throw new UserError("Esa compra ya no tiene cuotas por pagar.");
  await db.installmentPlan.update({ where: { id: plan.id }, data: { advancedTo: next } });
  return { closing: next, amount: left };
}

// ---------- Suscripciones y débitos automáticos ----------

export async function addSubscription(db: Db, ws: string, input: { cardId: string; description: string; amount: MoneyValue; dayOfMonth: number; categoryId?: string | null; holder?: string | null; startDate: Date; currency?: string | null }) {
  let card = await loadCard(db, ws, input.cardId);
  if (input.currency && input.currency !== card.currency) {
    const other = await db.creditCard.findFirst({ where: { workspaceId: ws, parentId: card.id, currency: input.currency } });
    if (!other) throw new UserError(`Esta tarjeta no tiene consumos en ${input.currency}.`);
    card = await loadCard(db, ws, other.id);
  }
  if (!input.description.trim()) throw new UserError("Poné qué es (ej.: Netflix).");
  if (!round2(input.amount).gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  if (!(input.dayOfMonth >= 1 && input.dayOfMonth <= 31)) throw new UserError("El día del mes va del 1 al 31.");
  return db.cardSubscription.create({ data: { cardId: card.id, description: input.description.trim(), amount: round2(input.amount).toFixed(2), dayOfMonth: input.dayOfMonth, categoryId: input.categoryId ?? null, holder: input.holder?.trim() || null, startDate: input.startDate } });
}

export async function endSubscription(db: Db, ws: string, id: string, today: Date) {
  const s = await db.cardSubscription.findFirst({ where: { id, card: { workspaceId: ws } } });
  if (!s) throw new UserError("No encontramos esa suscripción.");
  await db.cardSubscription.update({ where: { id }, data: { endDate: today } });
}

// Carga sola cada suscripción el día que se cobra (hasta hoy). Idempotente.
export async function chargeSubscriptions(db: Db, ws: string, today: Date) {
  const subs = await db.cardSubscription.findMany({ where: { card: { workspaceId: ws, active: true }, OR: [{ endDate: null }, { endDate: { gte: new Date(today.getTime() - 400 * 864e5) } }] }, include: { card: true } });
  for (const s of subs) {
    const from = new Date(Math.max(s.startDate.getTime() - 864e5, today.getTime() - 400 * 864e5));
    for (const d of subDates(s, from, today)) {
      await cardPurchase(db, ws, { cardId: s.cardId, description: s.description, amount: s.amount, categoryId: s.categoryId, date: d, holder: s.holder, idempotencyKey: `sub:${s.id}:${d.toISOString().slice(0, 10)}` });
    }
  }
}

// ---------- Cierre de resúmenes ----------

// Cierra los resúmenes vencidos (hasta hoy) y crea su pendiente de pago. Idempotente.
// - Suma los cargos fijos de la tarjeta (si tiene).
// - Si del resumen anterior pagaste solo una parte, lo que faltó pasa a este con el interés de financiación (si cargaste la tasa).
export async function closeStatements(db: Db, ws: string, today: Date) {
  await chargeSubscriptions(db, ws, today);
  const ids = (await db.creditCard.findMany({ where: { workspaceId: ws, active: true }, select: { id: true } })).map((c) => c.id);
  for (const id of ids) {
    const card = await loadCard(db, ws, id);
    const cal = calendar(card);
    let c = cal.closingFor(card.createdAt);
    for (let i = 0; i < 36 && c <= today; i++, c = cal.next(c)) {
      if (card.statements.some((s) => s.closingDate.getTime() === c.getTime())) continue;
      const iso = c.toISOString().slice(0, 10);
      const p = period(c);
      // Cargos fijos del resumen.
      if (card.monthlyFee && dec(card.monthlyFee).gt(0) && !(await db.transaction.findFirst({ where: { workspaceId: ws, idempotencyKey: `cardfee:${card.id}:${iso}` } }))) {
        await db.transaction.create({ data: { workspaceId: ws, accountId: card.accountId!, type: "EXPENSE", direction: "OUT", amount: round2(card.monthlyFee).toFixed(2), currency: card.currency, description: `${card.name}: cargos del resumen`, effectiveDate: c, economicPeriod: p, idempotencyKey: `cardfee:${card.id}:${iso}`, notes: "Mantenimiento, seguro y otros cargos fijos" } });
      }
      // Lo que quedó sin pagar de resúmenes anteriores en los que pagaste una parte.
      const partial = await db.obligation.findMany({ where: { workspaceId: ws, sourceType: "card", sourceId: card.id, status: "PARTIAL", dueDate: { lt: c } }, include: { payments: true } });
      const carried = partial.reduce((s, o) => s.plus(remaining(o)), ZERO);
      if (carried.gt(0) && card.financeRate && dec(card.financeRate).gt(0) && !(await db.transaction.findFirst({ where: { workspaceId: ws, idempotencyKey: `cardint:${card.id}:${iso}` } }))) {
        const interest = round2(carried.times(dec(card.financeRate)).dividedBy(1200));
        if (interest.gt(0)) await db.transaction.create({ data: { workspaceId: ws, accountId: card.accountId!, type: "EXPENSE", direction: "OUT", amount: interest.toFixed(2), currency: card.currency, description: `${card.name}: intereses por pagar menos que el total`, effectiveDate: c, economicPeriod: p, idempotencyKey: `cardint:${card.id}:${iso}`, notes: `Sobre ${carried.toFixed(2)} a ${dec(card.financeRate).toFixed(2)}% anual` } });
      }
      const { total: base } = await statementAmount(db, card, c);
      const total = round2(base.plus(carried));
      if (!total.gt(0)) continue;
      const due = cal.due(c);
      await db.$transaction(async (tx) => {
        for (const o of partial) await tx.obligation.update({ where: { id: o.id }, data: { status: "CANCELLED", notes: `Lo que faltó pagar pasó al resumen ${p}` } });
        const ob = await tx.obligation.create({ data: { workspaceId: ws, direction: "PAYABLE", description: `${card.name} — resumen ${p}`, amount: total.toFixed(2), currency: card.currency, dueDate: due, economicPeriod: p, sourceType: "card", sourceId: card.id } });
        await tx.cardStatement.create({ data: { cardId: card.id, closingDate: c, dueDate: due, totalAmount: total.toFixed(2), minimumAmount: round2(total.times("0.1")).toFixed(2), carriedAmount: carried.toFixed(2), obligationId: ob.id } });
      });
    }
  }
}

// Resúmenes futuros estimados (cuotas, compras del ciclo abierto, suscripciones y cargos), para el flujo de caja.
export async function projectedCardPayments(db: Db, ws: string, today: Date, until: Date) {
  const cards = await db.creditCard.findMany({ where: { workspaceId: ws, active: true, accountId: { not: null } }, include: { plans: true, cycles: true, subscriptions: true, statements: { orderBy: { closingDate: "desc" } } } });
  const out: { date: Date; amount: Decimal; currency: string; description: string }[] = [];
  const all = await Promise.all(cards.map(async (card) => {
    const cal = calendar(card);
    const first = cal.closingFor(today);
    const txs = await cardTxs(db, card.accountId!, cal.prev(first), until);
    return { card, cal, txs };
  }));
  for (const { card, cal, txs } of all) {
    let c = cal.closingFor(today);
    if (card.statements.some((s) => s.closingDate.getTime() === c.getTime())) c = cal.next(c);
    for (let i = 0; i < 60; i++, c = cal.next(c)) {
      const due = cal.due(c);
      if (due > until) break;
      let { total } = await statementAmount(db, card, c, today, txs);
      if (card.mode === "SIMPLE" && !total.gt(0) && card.statements.length) total = dec([...card.statements].sort((a, b) => b.closingDate.getTime() - a.closingDate.getTime())[0].totalAmount);
      if (total.gt(0)) out.push({ date: due, amount: total, currency: card.currency, description: `${card.name} — resumen ${period(c)} (estimado)` });
    }
  }
  return out;
}

// En qué se fue un resumen: por categoría y por persona (titular y adicionales). Usa datos ya traídos.
function breakdown(card: FullCard, closing: Date, pre: CardTx[], catName: Map<string, string>, holderOf: Map<string, string | null>) {
  const cal = calendar(card);
  const from = cal.prev(closing);
  const planTx = new Set(card.plans.map((p) => p.transactionId).filter(Boolean) as string[]);
  const tx = pre.filter((t) => t.effectiveDate > from && t.effectiveDate <= closing).map((t) => ({ ...t, category: t.categoryId ? { name: catName.get(t.categoryId) ?? "Sin categoría" } : null }));
  const byCat = new Map<string, Decimal>(), byHolder = new Map<string, Decimal>();
  const add = (m: Map<string, Decimal>, k: string, v: Decimal) => m.set(k, (m.get(k) ?? ZERO).plus(v));
  for (const t of tx) {
    if (planTx.has(t.id)) continue;
    const v = t.direction === "OUT" ? dec(t.amount) : dec(t.amount).neg();
    add(byCat, t.category?.name ?? "Sin categoría", v);
    add(byHolder, t.cardHolder ?? "Titular", v);
  }
  for (const p of card.plans) {
    const v = planPart(cal, p, closing);
    if (!v.gt(0)) continue;
    add(byCat, (p.categoryId && catName.get(p.categoryId)) || "Sin categoría", v);
    add(byHolder, (p.transactionId && holderOf.get(p.transactionId)) || "Titular", v);
  }
  const sort = (m: Map<string, Decimal>) => [...m.entries()].map(([name, amount]) => ({ name, amount })).filter((x) => !x.amount.isZero()).sort((a, b) => b.amount.comparedTo(a.amount));
  return { byCategory: sort(byCat), byHolder: sort(byHolder) };
}

export async function cardOverview(db: Db, ws: string, today: Date) {
  const [cards, balances, cats] = await Promise.all([
    db.creditCard.findMany({ where: { workspaceId: ws }, include: { plans: true, cycles: true, subscriptions: true, statements: { orderBy: { closingDate: "desc" }, take: 12 } }, orderBy: { createdAt: "asc" } }),
    readBalances(db, ws, null),
    db.category.findMany({ where: { workspaceId: ws }, select: { id: true, name: true } }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  // Lo que se necesita de todas las tarjetas, en pocas consultas y en paralelo.
  const lastObIds = cards.map((c) => c.statements[0]?.obligationId).filter(Boolean) as string[];
  const planTxIds = cards.flatMap((c) => c.plans.map((p) => p.transactionId).filter(Boolean) as string[]);
  const [lastObs, planHolders, txsBy] = await Promise.all([
    lastObIds.length ? db.obligation.findMany({ where: { id: { in: lastObIds } }, include: { payments: true } }) : Promise.resolve([]),
    planTxIds.length ? db.transaction.findMany({ where: { id: { in: planTxIds } }, select: { id: true, cardHolder: true } }) : Promise.resolve([]),
    Promise.all(cards.map((card) => {
      const cal = calendar(card);
      const open = cal.closingFor(today);
      const current = card.statements.find((s) => s.closingDate.getTime() === open.getTime()) ? cal.next(open) : open;
      const lastClosed = card.statements[0]?.closingDate ?? cal.prev(current);
      const from = cal.prev(lastClosed < current ? lastClosed : current);
      return card.accountId ? cardTxs(db, card.accountId, from, current) : Promise.resolve([] as CardTx[]);
    })),
  ]);
  const holderOf = new Map(planHolders.map((t) => [t.id, t.cardHolder]));
  const result = [];
  for (const [ci, card] of cards.entries()) {
    const cal = calendar(card);
    const txs = txsBy[ci];
    const debt = (balances.get(card.accountId!) ?? ZERO).neg(); // saldo negativo de la cuenta = lo que debés
    const open = cal.closingFor(today);
    const current = card.statements.find((s) => s.closingDate.getTime() === open.getTime()) ? cal.next(open) : open;
    const next = await statementAmount(db, card, current, today, txs);
    // Modo simple: sin compras cargadas, el próximo resumen se estima como el último.
    const simpleGuess = card.mode === "SIMPLE" && !next.total.gt(0) && card.statements[0] ? dec(card.statements[0].totalAmount) : null;
    const lastStatement = card.statements[0] ?? null;
    const lastOb = lastStatement?.obligationId ? lastObs.find((o) => o.id === lastStatement.obligationId) ?? null : null;
    const futureInstallments = card.plans.reduce((s, p) => s.plus(planLeft(cal, p, current).left), ZERO);
    const lastClosed = lastStatement?.closingDate ?? cal.prev(current);
    const spentNow = breakdown(card, current, txs, catName, holderOf), spentLast = breakdown(card, lastClosed, txs, catName, holderOf);
    const usual = cal.usual(current);
    result.push({
      card,
      debt: debt.lt(0) ? ZERO : debt,
      available: dec(card.limitAmount).minus(debt.lt(0) ? ZERO : debt),
      nextClosing: current,
      nextDue: cal.due(current),
      nextUsual: usual,
      nextMoved: usual.closing.getTime() !== current.getTime() || usual.due.getTime() !== cal.due(current).getTime(),
      nextAmount: simpleGuess ?? next.total,
      nextIsGuess: !!simpleGuess,
      nextExtras: next.extras,
      futureInstallments,
      lastStatement,
      lastObligation: lastOb,
      spentNow,
      spentLast,
      lastClosed,
      activePlans: card.plans
        .map((p) => ({ ...p, ...planLeft(cal, p, current) }))
        .filter((p) => p.left.gt(0)),
      subscriptions: card.subscriptions.filter((s) => !s.endDate || s.endDate >= today),
    });
  }
  return result;
}

// ---------- Estado de la tarjeta y carga de resúmenes ----------

// Resúmenes sin pagar (todos, no solo el último): así sabemos si estás al día o atrasado.
export async function cardStatus(db: Db, ws: string, cardId: string, today: Date) {
  const obs = await db.obligation.findMany({ where: { workspaceId: ws, sourceType: "card", sourceId: cardId, status: { in: ["PENDING", "PARTIAL"] } }, include: { payments: true }, orderBy: { dueDate: "asc" } });
  const open = obs.map((o) => ({ id: o.id, dueDate: o.dueDate, description: o.description, remaining: remaining(o), overdue: o.dueDate < today, partial: o.status === "PARTIAL" })).filter((o) => o.remaining.gt(0));
  return { open, owed: open.reduce((s, o) => s.plus(o.remaining), ZERO), overdue: open.some((o) => o.overdue) };
}

export type CarryInstallment = { description: string; amount: MoneyValue; remaining: number };

// Carga a mano (o desde el PDF, siempre confirmado por la persona) un resumen de la tarjeta.
// La deuda que trae se registra como AJUSTE en la cuenta de la tarjeta: no es un gasto nuevo
// (las compras fueron antes de usar Finan), así no se cuenta dos veces.
export async function loadStatement(db: Db, ws: string, input: { cardId: string; closingDate: Date; dueDate: Date; total: MoneyValue; minimum?: MoneyValue | null; carry?: CarryInstallment[]; userId?: string | null }) {
  const card = await loadCard(db, ws, input.cardId);
  const cal = calendar(card);
  const total = round2(input.total);
  if (total.lt(0)) throw new UserError("El total no puede ser negativo.");
  if (input.dueDate < input.closingDate) throw new UserError("El vencimiento tiene que ser después del cierre.");
  const minimum = input.minimum != null ? round2(input.minimum) : round2(total.times("0.1"));
  if (minimum.gt(total)) throw new UserError("El pago mínimo no puede ser mayor que el total.");
  const carry = (input.carry ?? []).filter((c) => c.description.trim() || dec(c.amount).gt(0));
  for (const c of carry) {
    if (!c.description.trim()) throw new UserError("Poné qué compraste en cada cuota que sigue.");
    if (!round2(c.amount).gt(0)) throw new UserError(`El importe de la cuota de "${c.description}" tiene que ser mayor a cero.`);
    if (!Number.isInteger(c.remaining) || c.remaining < 1 || c.remaining > 60) throw new UserError(`Las cuotas que faltan de "${c.description}" van de 1 a 60.`);
  }
  const existing = card.statements.find((s) => s.closingDate.getTime() === input.closingDate.getTime()) ?? null;
  // Lo que Finan ya tenía para ese resumen (compras cargadas acá), para ajustar solo la diferencia.
  const base = existing ? dec(existing.totalAmount) : (await statementAmount(db, card, input.closingDate)).total;
  const delta = total.minus(base);
  const p = period(input.closingDate);
  const simple = card.mode === "SIMPLE";
  const cat = simple ? await cardCategory(db, ws) : null;
  return db.$transaction(async (tx) => {
    let obligationId = existing?.obligationId ?? null;
    if (existing) {
      const ob = obligationId ? await tx.obligation.findUnique({ where: { id: obligationId }, include: { payments: true } }) : null;
      if (ob && paidSoFar(ob).gt(total)) throw new UserError("Ya pagaste más que ese total. Revisá el importe.");
      if (ob) await tx.obligation.update({ where: { id: ob.id }, data: { amount: total.toFixed(2), dueDate: input.dueDate, status: paidSoFar(ob).gte(total) ? "SETTLED" : paidSoFar(ob).gt(0) ? "PARTIAL" : "PENDING" } });
      await tx.cardStatement.update({ where: { id: existing.id }, data: { totalAmount: total.toFixed(2), minimumAmount: minimum.toFixed(2), dueDate: input.dueDate, loaded: true } });
    } else {
      const ob = total.gt(0) ? await tx.obligation.create({ data: { workspaceId: ws, direction: "PAYABLE", description: `${card.name} — resumen ${p}`, amount: total.toFixed(2), currency: card.currency, dueDate: input.dueDate, economicPeriod: p, sourceType: "card", sourceId: card.id } }) : null;
      obligationId = ob?.id ?? null;
      await tx.cardStatement.create({ data: { cardId: card.id, closingDate: input.closingDate, dueDate: input.dueDate, totalAmount: total.toFixed(2), minimumAmount: minimum.toFixed(2), obligationId, loaded: true } });
    }
    if (!delta.isZero() && simple) {
      // Modo simple: lo que trae el resumen es lo que gastaste ese mes con la tarjeta (una sola vez).
      await tx.transaction.create({ data: { workspaceId: ws, accountId: card.accountId!, type: "EXPENSE", direction: delta.gt(0) ? "OUT" : "IN", amount: delta.abs().toFixed(2), currency: card.currency, description: `Resumen ${card.name} ${p}`, categoryId: cat, effectiveDate: input.closingDate, economicPeriod: p, notes: "Total del resumen (modo simple)", createdById: input.userId ?? null } });
    } else if (!delta.isZero()) {
      await tx.transaction.create({ data: { workspaceId: ws, accountId: card.accountId!, type: "ADJUSTMENT", direction: delta.gt(0) ? "OUT" : "IN", amount: delta.abs().toFixed(2), currency: card.currency, description: `Resumen ${p} cargado (deuda anterior a Finan)`, effectiveDate: input.closingDate, economicPeriod: p, createdById: input.userId ?? null } });
    }
    const next = cal.next(input.closingDate);
    for (const c of carry) {
      const per = round2(c.amount), all = per.times(c.remaining);
      await tx.installmentPlan.create({ data: { cardId: card.id, description: c.description.trim().slice(0, 120), purchaseDate: input.closingDate, totalAmount: all.toFixed(2), installments: c.remaining, installmentAmount: per.toFixed(2), interestFree: true, firstStatementDate: next } });
      await tx.transaction.create({ data: { workspaceId: ws, accountId: card.accountId!, type: "ADJUSTMENT", direction: "OUT", amount: all.toFixed(2), currency: card.currency, description: `Cuotas que siguen: ${c.description.trim().slice(0, 80)}`, effectiveDate: input.closingDate, economicPeriod: p, createdById: input.userId ?? null } });
    }
    return { obligationId };
  });
}

// Categoría de gasto "Tarjeta de crédito" (para el modo simple). Se crea si no existe.
async function cardCategory(db: Db, ws: string) {
  const c = await db.category.findFirst({ where: { workspaceId: ws, kind: "EXPENSE", parentId: null, name: { equals: "Tarjeta de crédito", mode: "insensitive" } } });
  return (c ?? (await db.category.create({ data: { workspaceId: ws, kind: "EXPENSE", name: "Tarjeta de crédito" } }))).id;
}

// Compras del resumen (leídas del PDF) que no están cargadas en Finan: mismo importe y fecha cercana (±3 días).
export async function missingPurchases(db: Db, ws: string, cardId: string, lines: { date: string; description: string; amount: string; currency?: string | null }[]) {
  const main = await loadCard(db, ws, cardId);
  const all = [main, ...(await db.creditCard.findMany({ where: { workspaceId: ws, parentId: main.id }, include: { plans: true, cycles: true, subscriptions: true, statements: true } }))];
  const accs = all.map((c) => c.accountId!).filter(Boolean);
  const dates = lines.map((l) => new Date(`${l.date}T00:00:00Z`).getTime()).filter((n) => !Number.isNaN(n));
  if (!dates.length) return [];
  const tx = await db.transaction.findMany({ where: { workspaceId: ws, accountId: { in: accs }, type: "EXPENSE", effectiveDate: { gte: new Date(Math.min(...dates) - 5 * 864e5), lte: new Date(Math.max(...dates) + 5 * 864e5) } }, select: { id: true, amount: true, effectiveDate: true, currency: true } });
  const plans = await db.installmentPlan.findMany({ where: { cardId: { in: all.map((c) => c.id) } }, select: { installmentAmount: true, description: true } });
  const used = new Set<string>();
  return lines.filter((l) => {
    const d = new Date(`${l.date}T00:00:00Z`).getTime();
    const amt = round2(l.amount);
    const hit = tx.find((t) => !used.has(t.id) && round2(t.amount).eq(amt) && Math.abs(t.effectiveDate.getTime() - d) <= 3 * 864e5);
    if (hit) { used.add(hit.id); return false; }
    // Una cuota de una compra que ya está en Finan tampoco falta.
    if (plans.some((p) => round2(p.installmentAmount).eq(amt))) return false;
    return true;
  });
}

// Tarjetas agrupadas: cada una con su parte en la otra moneda (si tiene), su estado y cuánto del límite usás.
// El límite es uno solo: lo de la otra moneda se pasa a la principal con la cotización oficial.
export async function cardGroups(db: Db, ws: string, today: Date) {
  const all = await cardOverview(db, ws, today);
  const statuses = await Promise.all(all.map((c) => cardStatus(db, ws, c.card.id, today)));
  const rows = all.map((c, i) => ({ ...c, status: statuses[i] }));
  const { latestRates } = await import("./wealth");
  const ratesBy = new Map<string, Awaited<ReturnType<typeof latestRates>>>();
  const out = [];
  for (const m of rows.filter((c) => !c.card.parentId)) {
    const child = rows.find((x) => x.card.parentId === m.card.id) ?? null;
    let used = m.debt;
    let rate: Decimal | null = null;
    if (child && child.debt.gt(0)) {
      if (!ratesBy.has(m.card.currency)) ratesBy.set(m.card.currency, await latestRates(db, ws, m.card.currency));
      rate = ratesBy.get(m.card.currency)!.get(child.card.currency)?.rate ?? null;
      if (rate) used = used.plus(child.debt.times(rate));
    }
    const limit = dec(m.card.limitAmount);
    const usagePct = limit.gt(0) ? Math.round(used.dividedBy(limit).times(100).toNumber()) : null;
    out.push({ ...m, child, used: round2(used), available: limit.minus(used), usagePct, rate, overAlert: m.card.alertPct != null && usagePct != null && usagePct >= m.card.alertPct });
  }
  return out;
}
