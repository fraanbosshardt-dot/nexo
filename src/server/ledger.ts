// Motor financiero: cuentas, obligaciones y movimientos de dinero.
// Reglas (ver docs/ARQUITECTURA.md):
// - Un pendiente (Obligation) no mueve dinero. El dinero solo se mueve con un Transaction.
// - Un pago parcial deja el resto pendiente. Las obligaciones vencidas nunca se borran solas.
// - Las transferencias son dos movimientos unidos por transferGroupId y no cuentan como ingreso ni gasto.
// - Todo se filtra por workspaceId; un id de otro espacio se trata como inexistente.
// - Las correcciones no editan el pasado: crean un movimiento opuesto (reversa) vinculado.
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AccountType, Certainty, ObligationDirection } from "@/generated/prisma/enums";
import { dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { period, periodEnd, periodStart } from "@/lib/dates";
import type Decimal from "decimal.js";
import { randomUUID } from "node:crypto";

export type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class UserError extends Error {}

const money = (v: MoneyValue) => round2(v).toFixed(2);

async function ownAccount(db: Tx | Db, ws: string, id: string) {
  const a = await db.account.findFirst({ where: { id, workspaceId: ws } });
  if (!a) throw new UserError("No encontramos esa cuenta.");
  if (!a.active) throw new UserError("Esa cuenta está desactivada.");
  return a;
}

async function ownCategory(db: Tx | Db, ws: string, id: string | null | undefined, kind: "INCOME" | "EXPENSE") {
  if (!id) return null;
  const c = await db.category.findFirst({ where: { id, workspaceId: ws } });
  if (!c) throw new UserError("No encontramos esa categoría.");
  if (c.kind !== kind) throw new UserError(kind === "INCOME" ? "Elegí una categoría de ingreso." : "Elegí una categoría de gasto.");
  return c;
}

// ---------- Cuentas ----------

export async function createAccount(
  db: Db,
  ws: string,
  input: { name: string; institution?: string | null; type: AccountType; currency: string; initialBalance: MoneyValue; initialDate: Date; notes?: string | null },
) {
  const name = input.name.trim();
  if (!name) throw new UserError("Poné un nombre para la cuenta.");
  return db.account.create({
    data: {
      workspaceId: ws,
      name,
      institution: input.institution?.trim() || null,
      type: input.type,
      currency: input.currency,
      initialBalance: money(input.initialBalance),
      initialDate: input.initialDate,
      notes: input.notes?.trim() || null,
    },
  });
}

// Saldo = saldo inicial + entradas − salidas. Se calcula siempre desde el libro.
export async function accountBalances(db: Db, ws: string): Promise<Map<string, Decimal>> {
  const [accounts, sums] = await Promise.all([
    db.account.findMany({ where: { workspaceId: ws }, select: { id: true, initialBalance: true } }),
    db.transaction.groupBy({ by: ["accountId", "direction"], where: { workspaceId: ws }, _sum: { amount: true } }),
  ]);
  const out = new Map<string, Decimal>(accounts.map((a) => [a.id, dec(a.initialBalance)]));
  for (const s of sums) {
    const v = dec(s._sum.amount ?? 0);
    out.set(s.accountId, (out.get(s.accountId) ?? ZERO).plus(s.direction === "IN" ? v : v.neg()));
  }
  return out;
}

// ---------- Obligaciones y pagos ----------

type ObWithPayments = Prisma.ObligationGetPayload<{ include: { payments: true } }>;

export function paidSoFar(ob: ObWithPayments): Decimal {
  const expected = ob.direction === "RECEIVABLE" ? "IN" : "OUT";
  return ob.payments.reduce((acc, t) => acc.plus(t.direction === expected ? dec(t.amount) : dec(t.amount).neg()), ZERO);
}
export const remaining = (ob: ObWithPayments) => dec(ob.amount).minus(paidSoFar(ob));

async function refreshStatus(db: Tx, obligationId: string) {
  const ob = await db.obligation.findUniqueOrThrow({ where: { id: obligationId }, include: { payments: true } });
  if (ob.status === "CANCELLED") return ob;
  const paid = paidSoFar(ob);
  const status = paid.gte(dec(ob.amount)) ? "SETTLED" : paid.gt(0) ? "PARTIAL" : "PENDING";
  return db.obligation.update({ where: { id: ob.id }, data: { status } });
}

export type MovementInput = {
  kind: "INCOME" | "EXPENSE";
  description: string;
  amount: MoneyValue; // importe total (previsto)
  accountId: string;
  categoryId?: string | null;
  economicPeriod?: string; // "AAAA-MM"; por defecto, el mes de la fecha
  status: "PAID" | "PARTIAL" | "PENDING";
  paidAmount?: MoneyValue; // lo que efectivamente se pagó o cobró
  effectiveDate?: Date; // cuándo se movió el dinero
  dueDate?: Date; // cuándo vence lo pendiente
  certainty?: Certainty;
  counterparty?: string | null;
  notes?: string | null;
  tags?: string[];
  idempotencyKey?: string | null;
  userId?: string | null;
};

export async function recordMovement(db: Db, ws: string, input: MovementInput) {
  const description = input.description.trim();
  if (!description) throw new UserError("Falta el concepto.");
  const amount = round2(input.amount);
  if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  const paid = input.status === "PENDING" ? ZERO : round2(input.paidAmount ?? amount);
  if (input.status !== "PENDING" && !paid.gt(0)) throw new UserError("Ingresá cuánto se pagó o cobró.");
  if (input.status === "PARTIAL" && paid.gte(amount)) throw new UserError("Eso cubre el total: elegí pagado o cobrado.");
  if (input.status !== "PAID" && !input.dueDate) throw new UserError("Falta la fecha de vencimiento de lo pendiente.");
  if (input.status !== "PENDING" && !input.effectiveDate) throw new UserError("Falta la fecha del pago o cobro.");

  if (input.idempotencyKey) {
    const dup = await db.transaction.findFirst({ where: { workspaceId: ws, idempotencyKey: input.idempotencyKey } });
    if (dup) return { transactionId: dup.id, obligationId: dup.obligationId, duplicate: true };
  }

  return db.$transaction(async (tx) => {
    const account = await ownAccount(tx, ws, input.accountId);
    const category = await ownCategory(tx, ws, input.categoryId, input.kind);
    const refDate = input.effectiveDate ?? input.dueDate!;
    const economicPeriod = input.economicPeriod ?? period(refDate);
    if (!/^\d{4}-\d{2}$/.test(economicPeriod)) throw new UserError("El mes al que corresponde no es válido.");
    const direction = input.kind === "INCOME" ? "IN" : "OUT";

    // Pagado justo por lo previsto: alcanza con el movimiento.
    // Si hay diferencia, parcial o pendiente: se guarda la obligación con el importe previsto.
    const needsObligation = input.status !== "PAID" || !paid.eq(amount);
    const obligation = needsObligation
      ? await tx.obligation.create({
          data: {
            workspaceId: ws,
            direction: (input.kind === "INCOME" ? "RECEIVABLE" : "PAYABLE") as ObligationDirection,
            description,
            amount: money(amount),
            currency: account.currency,
            categoryId: category?.id ?? null,
            dueDate: input.dueDate ?? input.effectiveDate!,
            economicPeriod,
            certainty: input.certainty ?? "CONFIRMED",
            counterparty: input.counterparty?.trim() || null,
            notes: input.notes?.trim() || null,
            status: input.status === "PENDING" ? "PENDING" : input.status === "PARTIAL" ? "PARTIAL" : "SETTLED",
          },
        })
      : null;

    const transaction =
      input.status === "PENDING"
        ? null
        : await tx.transaction.create({
            data: {
              workspaceId: ws,
              accountId: account.id,
              type: input.kind,
              direction,
              amount: money(paid),
              currency: account.currency,
              description,
              categoryId: category?.id ?? null,
              effectiveDate: input.effectiveDate!,
              economicPeriod,
              obligationId: obligation?.id ?? null,
              tags: input.tags ?? [],
              notes: input.notes?.trim() || null,
              idempotencyKey: input.idempotencyKey ?? null,
              createdById: input.userId ?? null,
            },
          });
    return { transactionId: transaction?.id ?? null, obligationId: obligation?.id ?? null, duplicate: false };
  });
}

export async function payObligation(
  db: Db,
  ws: string,
  input: { obligationId: string; accountId: string; amount: MoneyValue; date: Date; userId?: string | null; settle?: boolean; updateFuture?: boolean },
) {
  return db.$transaction(async (tx) => {
    const ob = await tx.obligation.findFirst({ where: { id: input.obligationId, workspaceId: ws }, include: { payments: true } });
    if (!ob) throw new UserError("No encontramos ese pendiente.");
    if (ob.status === "SETTLED" || ob.status === "CANCELLED") throw new UserError("Ese pendiente ya está cerrado.");
    const account = await ownAccount(tx, ws, input.accountId);
    if (account.currency !== ob.currency) throw new UserError(`Elegí una cuenta en ${ob.currency}.`);
    const amount = round2(input.amount);
    const left = remaining(ob);
    if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
    // "Fue el total": el importe real puede ser distinto del esperado (sueldo variable, una factura que vino distinta).
    if (amount.gt(left) && !input.settle) throw new UserError(`Es más de lo que falta (${left.toFixed(2)}). Si ese fue el total, marcá "Fue el total".`);
    if (account.type === "CREDIT_CARD") throw new UserError("Elegí una cuenta de dinero, no una tarjeta.");
    // Resumen de tarjeta: el gasto ya se registró en cada compra, así que el pago es una transferencia.
    const card = ob.sourceType === "card" && ob.sourceId ? await tx.creditCard.findFirst({ where: { id: ob.sourceId, workspaceId: ws } }) : null;
    const group = card?.accountId ? randomUUID() : null;
    const t = await tx.transaction.create({
      data: {
        workspaceId: ws,
        accountId: account.id,
        type: group ? "TRANSFER" : ob.direction === "RECEIVABLE" ? "INCOME" : ob.sourceType === "debt" ? "DEBT_PAYMENT" : "EXPENSE",
        direction: ob.direction === "RECEIVABLE" ? "IN" : "OUT",
        amount: money(amount),
        currency: ob.currency,
        description: ob.description,
        categoryId: group ? null : ob.categoryId,
        effectiveDate: input.date,
        economicPeriod: ob.economicPeriod, // el mes al que corresponde no cambia aunque se pague después
        obligationId: ob.id,
        transferGroupId: group,
        createdById: input.userId ?? null,
      },
    });
    if (group && card?.accountId) {
      await tx.transaction.create({
        data: { workspaceId: ws, accountId: card.accountId, type: "TRANSFER", direction: "IN", amount: money(amount), currency: ob.currency, description: ob.description, effectiveDate: input.date, economicPeriod: ob.economicPeriod, transferGroupId: group, createdById: input.userId ?? null },
      });
    }
    if (input.settle) {
      const total = paidSoFar(ob).plus(amount);
      await tx.obligation.update({ where: { id: ob.id }, data: { amount: money(total) } });
      // Los meses que vienen usan este monto (solo los pendientes que todavía no se tocaron).
      if (input.updateFuture && ob.recurringRuleId) {
        await tx.recurringRule.updateMany({ where: { id: ob.recurringRuleId, workspaceId: ws }, data: { amount: money(amount) } });
        await tx.obligation.updateMany({ where: { workspaceId: ws, recurringRuleId: ob.recurringRuleId, status: "PENDING", dueDate: { gt: ob.dueDate } }, data: { amount: money(amount) } });
      }
    }
    const updated = await refreshStatus(tx, ob.id);
    if (ob.sourceType === "debt" && ob.sourceId && updated.status === "SETTLED") {
      const left = await tx.obligation.count({ where: { workspaceId: ws, sourceType: "debt", sourceId: ob.sourceId, status: { in: ["PENDING", "PARTIAL"] } } });
      if (left === 0) await tx.debt.updateMany({ where: { id: ob.sourceId, workspaceId: ws, status: "ACTIVE" }, data: { status: "PAID" } });
    }
    return { transactionId: t.id, status: updated.status, remaining: left.minus(amount) };
  });
}

export async function cancelObligation(db: Db, ws: string, obligationId: string) {
  const ob = await db.obligation.findFirst({ where: { id: obligationId, workspaceId: ws } });
  if (!ob) throw new UserError("No encontramos ese pendiente.");
  if (ob.status === "SETTLED") throw new UserError("Ya está saldado: si fue un error, revertí el pago.");
  return db.obligation.update({ where: { id: ob.id }, data: { status: "CANCELLED" } });
}

// ---------- Transferencias, ajustes y reversas ----------

export async function recordTransfer(
  db: Db,
  ws: string,
  input: { fromAccountId: string; toAccountId: string; amount: MoneyValue; toAmount?: MoneyValue; fxRate?: MoneyValue; date: Date; description?: string; userId?: string | null },
) {
  if (input.fromAccountId === input.toAccountId) throw new UserError("Elegí dos cuentas distintas.");
  const amount = round2(input.amount);
  if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  return db.$transaction(async (tx) => {
    const from = await ownAccount(tx, ws, input.fromAccountId);
    const to = await ownAccount(tx, ws, input.toAccountId);
    let toAmount = amount;
    if (from.currency !== to.currency) {
      if (input.toAmount == null) throw new UserError("Entre monedas distintas, indicá la cotización o el importe que entra.");
      toAmount = round2(input.toAmount);
      if (!toAmount.gt(0)) throw new UserError("El importe que entra tiene que ser mayor a cero.");
    }
    const group = randomUUID();
    const base = {
      workspaceId: ws,
      type: "TRANSFER" as const,
      description: input.description?.trim() || `Transferencia ${from.name} → ${to.name}`,
      effectiveDate: input.date,
      economicPeriod: period(input.date),
      transferGroupId: group,
      fxRate: input.fxRate != null ? dec(input.fxRate).toFixed(6) : null,
      fxDate: input.fxRate != null ? input.date : null,
      createdById: input.userId ?? null,
    };
    const out = await tx.transaction.create({ data: { ...base, accountId: from.id, direction: "OUT", amount: money(amount), currency: from.currency } });
    const inn = await tx.transaction.create({ data: { ...base, accountId: to.id, direction: "IN", amount: money(toAmount), currency: to.currency } });
    return { transferGroupId: group, outId: out.id, inId: inn.id };
  });
}

export async function adjustBalance(db: Db, ws: string, input: { accountId: string; targetBalance: MoneyValue; date: Date; userId?: string | null }) {
  const account = await ownAccount(db, ws, input.accountId);
  const current = (await accountBalances(db, ws)).get(account.id) ?? ZERO;
  const diff = round2(input.targetBalance).minus(current);
  await db.account.update({ where: { id: account.id }, data: { lastReconciledAt: new Date() } });
  if (diff.isZero()) return { diff, transactionId: null };
  const t = await db.transaction.create({
    data: {
      workspaceId: ws,
      accountId: account.id,
      type: "ADJUSTMENT",
      direction: diff.gt(0) ? "IN" : "OUT",
      amount: money(diff.abs()),
      currency: account.currency,
      description: "Ajuste por conciliación",
      effectiveDate: input.date,
      economicPeriod: period(input.date),
      createdById: input.userId ?? null,
    },
  });
  return { diff, transactionId: t.id };
}

export async function reverseTransaction(db: Db, ws: string, transactionId: string, userId?: string | null) {
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.findFirst({ where: { id: transactionId, workspaceId: ws }, include: { reversedBy: true } });
    if (!t) throw new UserError("No encontramos ese movimiento.");
    if (t.reversalOfId) throw new UserError("Ese movimiento ya es una reversa.");
    if (t.reversedBy) throw new UserError("Ese movimiento ya fue revertido.");
    const legs = t.transferGroupId ? await tx.transaction.findMany({ where: { workspaceId: ws, transferGroupId: t.transferGroupId } }) : [t];
    const group = t.transferGroupId ? randomUUID() : null;
    for (const leg of legs) {
      await tx.transaction.create({
        data: {
          workspaceId: ws,
          accountId: leg.accountId,
          type: leg.type,
          direction: leg.direction === "IN" ? "OUT" : "IN",
          amount: leg.amount,
          currency: leg.currency,
          description: `Reversa: ${leg.description}`,
          categoryId: leg.categoryId,
          effectiveDate: leg.effectiveDate,
          economicPeriod: leg.economicPeriod,
          obligationId: leg.obligationId,
          transferGroupId: group,
          reversalOfId: leg.id,
          createdById: userId ?? null,
        },
      });
      if (leg.obligationId) await refreshStatus(tx, leg.obligationId);
    }
  });
}

// ---------- Consultas ----------

export type OpenItem = {
  id: string;
  direction: ObligationDirection;
  description: string;
  currency: string;
  dueDate: Date;
  economicPeriod: string;
  amount: Decimal;
  remaining: Decimal;
  certainty: Certainty;
  overdue: boolean;
  status: string;
  category: string | null;
};

export async function openObligations(db: Db, ws: string, today: Date, opts: { until?: Date; direction?: ObligationDirection } = {}): Promise<OpenItem[]> {
  const rows = await db.obligation.findMany({
    where: {
      workspaceId: ws,
      status: { in: ["PENDING", "PARTIAL"] },
      ...(opts.until ? { dueDate: { lte: opts.until } } : {}),
      ...(opts.direction ? { direction: opts.direction } : {}),
    },
    include: { payments: true, category: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((o) => ({
    id: o.id,
    direction: o.direction,
    description: o.description,
    currency: o.currency,
    dueDate: o.dueDate,
    economicPeriod: o.economicPeriod,
    amount: dec(o.amount),
    remaining: remaining(o),
    certainty: o.certainty,
    overdue: o.dueDate < today,
    status: o.status,
    category: o.category?.name ?? null,
  }));
}

const REAL_EXPENSE = ["EXPENSE", "DEBT_PAYMENT", "CARD_PAYMENT"] as const;

export async function monthSummary(db: Db, ws: string, p: string, currency: string, today: Date) {
  const from = periodStart(p), to = periodEnd(p);
  const tx = await db.transaction.findMany({
    where: { workspaceId: ws, currency, effectiveDate: { gte: from, lte: to }, type: { in: ["INCOME", ...REAL_EXPENSE] } },
    select: { type: true, direction: true, amount: true, reversalOfId: true },
  });
  let income = ZERO, expense = ZERO;
  for (const t of tx) {
    const v = dec(t.amount);
    // Una reversa resta del mismo tipo de movimiento al que corrige.
    if (t.type === "INCOME") income = t.direction === "IN" ? income.plus(v) : income.minus(v);
    else expense = t.direction === "OUT" ? expense.plus(v) : expense.minus(v);
  }
  const open = (await openObligations(db, ws, today, { until: to })).filter((o) => o.currency === currency);
  const pendingIn = open.filter((o) => o.direction === "RECEIVABLE");
  const pendingOut = open.filter((o) => o.direction === "PAYABLE");
  const sumR = (l: OpenItem[]) => l.reduce((a, o) => a.plus(o.remaining), ZERO);
  return {
    period: p,
    income,
    expense,
    pendingIn: sumR(pendingIn),
    pendingInConfirmed: sumR(pendingIn.filter((o) => o.certainty === "CONFIRMED")),
    pendingOut: sumR(pendingOut),
    overdue: open.filter((o) => o.overdue),
    open,
  };
}

export async function dashboard(db: Db, ws: string, currency: string, today: Date) {
  const [accounts, balances, summary] = await Promise.all([
    db.account.findMany({ where: { workspaceId: ws, active: true }, orderBy: { createdAt: "asc" } }),
    accountBalances(db, ws),
    monthSummary(db, ws, period(today), currency, today),
  ]);
  const inBase = accounts.filter((a) => a.currency === currency);
  // Lo invertido no es dinero disponible, y la tarjeta es una deuda, no dinero.
  const cash = inBase.filter((a) => a.type !== "INVESTMENT" && a.type !== "CREDIT_CARD").reduce((acc, a) => acc.plus(balances.get(a.id) ?? ZERO), ZERO);
  const invested = inBase.filter((a) => a.type === "INVESTMENT").reduce((acc, a) => acc.plus(balances.get(a.id) ?? ZERO), ZERO);
  const cardDebt = inBase.filter((a) => a.type === "CREDIT_CARD").reduce((acc, a) => acc.minus(balances.get(a.id) ?? ZERO), ZERO);
  const others = accounts.filter((a) => a.currency !== currency && a.type !== "CREDIT_CARD").map((a) => ({ id: a.id, name: a.name, currency: a.currency, balance: balances.get(a.id) ?? ZERO }));
  return {
    cash,
    invested,
    cardDebt,
    others,
    available: cash.minus(summary.pendingOut), // lo que tenés menos todo lo que falta pagar este mes
    projectedEndOfMonth: cash.plus(summary.pendingInConfirmed).minus(summary.pendingOut),
    summary,
    accounts: accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? ZERO })),
  };
}

export async function listMovements(db: Db, ws: string, opts: { period?: string; from?: Date; to?: Date; accountId?: string; take?: number } = {}) {
  return db.transaction.findMany({
    where: {
      workspaceId: ws,
      ...(opts.accountId ? { accountId: opts.accountId } : {}),
      ...(opts.from || opts.to ? { effectiveDate: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : opts.period ? { effectiveDate: { gte: periodStart(opts.period), lte: periodEnd(opts.period) } } : {}),
    },
    include: { account: { select: { name: true, currency: true } }, category: { select: { name: true } }, reversedBy: { select: { id: true } } },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 200,
  });
}
