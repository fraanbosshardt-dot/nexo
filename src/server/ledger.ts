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
import { cache } from "react";

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
  const last = await db.account.aggregate({ where: { workspaceId: ws }, _max: { position: true } });
  return db.account.create({
    data: {
      workspaceId: ws,
      position: (last._max.position ?? 0) + 1,
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

// Guardar el orden de las cuentas (el que quedó al arrastrarlas). Solo toca cuentas del espacio.
export async function reorderAccounts(db: Db, ws: string, ids: string[]) {
  // Se ordena un grupo (por ej. Bancos): sus cuentas se reparten los mismos lugares que ya ocupaban.
  const own = await db.account.findMany({ where: { workspaceId: ws, id: { in: ids } }, select: { id: true, position: true } });
  const ok = new Set(own.map((a) => a.id));
  const list = [...new Set(ids)].filter((id) => ok.has(id));
  const slots = own.map((a) => a.position).sort((x, y) => x - y);
  // Si había lugares repetidos, se separan para que el orden quede claro.
  for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 1;
  await db.$transaction(list.map((id, i) => db.account.update({ where: { id }, data: { position: slots[i] } })));
}

// Saldo = saldo inicial + entradas − salidas. Se calcula siempre desde el libro.
// Con asOf, el saldo a esa fecha: lo cargado con fecha posterior todavía no está en la cuenta.
export async function accountBalances(db: Db, ws: string, asOf?: Date): Promise<Map<string, Decimal>> {
  const [accounts, sums] = await Promise.all([
    db.account.findMany({ where: { workspaceId: ws }, select: { id: true, initialBalance: true } }),
    db.transaction.groupBy({ by: ["accountId", "direction"], where: { workspaceId: ws, ...(asOf ? { effectiveDate: { lte: asOf } } : {}) }, _sum: { amount: true } }),
  ]);
  const out = new Map<string, Decimal>(accounts.map((a) => [a.id, dec(a.initialBalance)]));
  for (const s of sums) {
    const v = dec(s._sum.amount ?? 0);
    out.set(s.accountId, (out.get(s.accountId) ?? ZERO).plus(s.direction === "IN" ? v : v.neg()));
  }
  return out;
}

// Para pantallas: dentro de una misma carga, los saldos se calculan una sola vez aunque varias partes los pidan.
// (Las acciones que cambian datos usan accountBalances directo, siempre fresco.)
export const readBalances = cache((db: Db, ws: string, asOfMs: number | null) => accountBalances(db, ws, asOfMs != null ? new Date(asOfMs) : undefined));

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
    // Bloquea el pendiente hasta terminar: dos toques seguidos no registran el pago dos veces.
    await tx.$queryRaw`SELECT "id" FROM "Obligation" WHERE "id" = ${input.obligationId} AND "workspaceId" = ${ws} FOR UPDATE`;
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
      // Cuota de préstamo que vino distinta: el cronograma toma el importe real (la diferencia va como interés y gastos).
      if (ob.sourceType === "debt" && ob.sourceId) {
        const fix = async (obligationId: string, value: Decimal) => {
          const inst = await tx.debtInstallment.findFirst({ where: { obligationId } });
          if (!inst) return;
          const interest = value.minus(dec(inst.capital));
          await tx.debtInstallment.update({ where: { id: inst.id }, data: { total: money(value), ...(interest.gte(0) ? { interest: money(interest) } : { capital: money(value), interest: "0" }) } });
        };
        await fix(ob.id, total);
        if (input.updateFuture) {
          const next = await tx.obligation.findMany({ where: { workspaceId: ws, sourceType: "debt", sourceId: ob.sourceId, status: "PENDING", dueDate: { gt: ob.dueDate } }, select: { id: true } });
          for (const n of next) { await tx.obligation.update({ where: { id: n.id }, data: { amount: money(amount) } }); await fix(n.id, round2(amount)); }
        }
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

// ---------- Evitar duplicados: un cobro o pago cargado a mano que ya estaba como pendiente ----------
const NEAR = 20 * 864e5; // ±20 días

// ¿Hay un pendiente que es lo mismo? Mismo concepto, sentido y moneda, sin pagos y con fecha cercana.
export async function matchingPending(db: Db | Tx, ws: string, q: { kind: "INCOME" | "EXPENSE"; description: string; currency: string; date: Date }) {
  const rows = await db.obligation.findMany({
    where: { workspaceId: ws, status: "PENDING", sourceType: null, direction: q.kind === "INCOME" ? "RECEIVABLE" : "PAYABLE", currency: q.currency, description: { equals: q.description.trim(), mode: "insensitive" }, dueDate: { gte: new Date(q.date.getTime() - NEAR), lte: new Date(q.date.getTime() + NEAR) } },
    include: { payments: true },
  });
  return rows.filter((o) => o.payments.length === 0).sort((a, b) => Math.abs(a.dueDate.getTime() - q.date.getTime()) - Math.abs(b.dueDate.getTime() - q.date.getTime()))[0] ?? null;
}

// Al revés: ¿ya se cargó a mano un cobro o pago que es este pendiente?
export async function matchingPaid(db: Db, ws: string, ob: { direction: ObligationDirection; description: string; currency: string; dueDate: Date }) {
  return db.transaction.findFirst({
    where: { workspaceId: ws, obligationId: null, reversalOfId: null, reversedBy: null, type: ob.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE", currency: ob.currency, description: { equals: ob.description.trim(), mode: "insensitive" }, effectiveDate: { gte: new Date(ob.dueDate.getTime() - NEAR), lte: new Date(ob.dueDate.getTime() + NEAR) } },
    orderBy: { effectiveDate: "desc" },
  });
}

// Unir un movimiento ya cargado con su pendiente: el pendiente queda cobrado o pagado con ese importe (no se duplica).
export async function linkToPending(db: Db, ws: string, transactionId: string, obligationId: string) {
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.findFirst({ where: { id: transactionId, workspaceId: ws } });
    const ob = await tx.obligation.findFirst({ where: { id: obligationId, workspaceId: ws }, include: { payments: true } });
    if (!t || !ob) throw new UserError("No encontramos el movimiento o el pendiente.");
    if (t.obligationId) throw new UserError("Ese movimiento ya está unido a un pendiente.");
    if (ob.status !== "PENDING" && ob.status !== "PARTIAL") throw new UserError("Ese pendiente ya está cerrado.");
    if (ob.sourceType) throw new UserError("Ese pendiente se maneja desde su pantalla.");
    const okType = ob.direction === "RECEIVABLE" ? t.type === "INCOME" : t.type === "EXPENSE";
    if (!okType || t.currency !== ob.currency) throw new UserError("El movimiento no coincide con el pendiente.");
    await tx.transaction.update({ where: { id: t.id }, data: { obligationId: ob.id, economicPeriod: ob.economicPeriod, categoryId: t.categoryId ?? ob.categoryId } });
    // "Fue el total": el pendiente toma el importe real.
    await tx.obligation.update({ where: { id: ob.id }, data: { amount: money(paidSoFar(ob).plus(dec(t.amount))) } });
    return refreshStatus(tx, ob.id);
  });
}

// Corregir algo a futuro (un pendiente): concepto, importe, fecha, categoría y notas.
export async function updateObligation(db: Db, ws: string, id: string, input: { description: string; amount: MoneyValue; dueDate: Date; categoryId: string | null; notes: string | null }) {
  const ob = await db.obligation.findFirst({ where: { id, workspaceId: ws }, include: { payments: true } });
  if (!ob) throw new UserError("No encontramos ese pendiente.");
  if (ob.status === "SETTLED" || ob.status === "CANCELLED") throw new UserError("Ese pendiente ya está cerrado.");
  if (ob.sourceType === "card") throw new UserError("El resumen de la tarjeta se arma con sus compras: corregí la compra desde Movimientos.");
  if (ob.sourceType === "grain") throw new UserError("Este cobro es de una venta de cereal: corregilo desde Ventas de cereal.");
  const description = input.description.trim();
  if (!description) throw new UserError("Poné un concepto.");
  const amount = round2(input.amount);
  if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  const paid = paidSoFar(ob);
  if (paid.gt(amount)) throw new UserError(`Ya ${ob.direction === "RECEIVABLE" ? "cobraste" : "pagaste"} ${paid.toFixed(2).replace(".", ",")}: el importe no puede ser menor.`);
  await ownCategory(db, ws, input.categoryId, ob.direction === "RECEIVABLE" ? "INCOME" : "EXPENSE");
  return db.$transaction(async (tx) => {
    await tx.obligation.update({ where: { id: ob.id }, data: { description, amount: amount.toFixed(2), dueDate: input.dueDate, economicPeriod: period(input.dueDate), categoryId: input.categoryId, notes: input.notes } });
    // Cuota de un préstamo: el cronograma muestra el monto y la fecha nuevos (la diferencia va como interés y gastos).
    if (ob.sourceType === "debt") {
      const inst = await tx.debtInstallment.findFirst({ where: { obligationId: ob.id } });
      if (inst) {
        const interest = amount.minus(dec(inst.capital));
        await tx.debtInstallment.update({ where: { id: inst.id }, data: { total: amount.toFixed(2), dueDate: input.dueDate, ...(interest.gte(0) ? { interest: interest.toFixed(2) } : { capital: amount.toFixed(2), interest: "0" }) } });
      }
    }
    return refreshStatus(tx, ob.id);
  });
}

// Eliminar algo a futuro cargado por error. Si se repite, se cancela solo esta vez (si no, vuelve a aparecer).
export async function deleteObligation(db: Db, ws: string, id: string) {
  const ob = await db.obligation.findFirst({ where: { id, workspaceId: ws }, include: { payments: true } });
  if (!ob) throw new UserError("No encontramos ese pendiente.");
  if (ob.sourceType === "debt") throw new UserError("Es una cuota de un préstamo: corregila acá o eliminá el préstamo desde Deudas y préstamos.");
  if (ob.sourceType === "card") throw new UserError("El resumen de la tarjeta se arma con sus compras: borrá la compra desde Movimientos.");
  if (ob.sourceType === "grain") throw new UserError("Este cobro es de una venta de cereal: borralo desde Ventas de cereal.");
  if (ob.payments.length) throw new UserError("Ya tiene pagos registrados: borralos desde Movimientos o cancelá lo que falta.");
  if (ob.recurringRuleId) return db.obligation.update({ where: { id: ob.id }, data: { status: "CANCELLED" } });
  return db.obligation.delete({ where: { id: ob.id } });
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
  const current = (await accountBalances(db, ws, input.date)).get(account.id) ?? ZERO;
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

// ---------- Borrar y corregir un movimiento ----------
// Si te equivocaste, el movimiento se borra del todo (no queda "anulado") y se deshace lo que dependía de él.

const SAME_LOAD_MS = 10_000; // un pendiente creado junto con el movimiento (pagado en parte, por ejemplo) se borra con él

export async function deleteMovement(db: Db, ws: string, id: string) {
  const t = await db.transaction.findFirst({ where: { id, workspaceId: ws }, include: { obligation: true, reversedBy: true } });
  if (!t) throw new UserError("No encontramos ese movimiento.");
  if (t.obligation?.sourceType === "grain") throw new UserError("Este cobro es de una venta de cereal: borrala o corregila desde Ventas de cereal.");
  if (t.type === "DEBT_DISBURSEMENT") throw new UserError("Es la plata de un préstamo: borrá o cancelá el préstamo desde Deudas y préstamos.");
  // Todo lo que se va junto: las dos patas de una transferencia y, si estaba anulado, su anulación.
  const ids = new Set<string>([t.id]);
  if (t.transferGroupId) for (const l of await db.transaction.findMany({ where: { workspaceId: ws, transferGroupId: t.transferGroupId }, select: { id: true } })) ids.add(l.id);
  for (const x of await db.transaction.findMany({ where: { workspaceId: ws, OR: [{ reversalOfId: { in: [...ids] } }, { id: t.reversalOfId ?? "" }] }, select: { id: true, transferGroupId: true } })) {
    ids.add(x.id);
    if (x.transferGroupId) for (const l of await db.transaction.findMany({ where: { workspaceId: ws, transferGroupId: x.transferGroupId }, select: { id: true } })) ids.add(l.id);
  }
  const all = await db.transaction.findMany({ where: { id: { in: [...ids] } }, select: { id: true, obligationId: true, createdAt: true } });
  const obIds = [...new Set(all.map((x) => x.obligationId).filter(Boolean) as string[])];
  return db.$transaction(async (tx) => {
    const list = [...ids];
    await tx.installmentPlan.deleteMany({ where: { transactionId: { in: list }, card: { workspaceId: ws } } });
    await tx.investmentMovement.deleteMany({ where: { transactionId: { in: list }, investment: { workspaceId: ws } } });
    await tx.goalContribution.deleteMany({ where: { transactionId: { in: list }, goal: { workspaceId: ws } } });
    // Primero las anulaciones (apuntan al original), después el resto.
    await tx.transaction.deleteMany({ where: { id: { in: list }, reversalOfId: { not: null } } });
    await tx.transaction.deleteMany({ where: { id: { in: list } } });
    for (const obId of obIds) {
      const ob = await tx.obligation.findUnique({ where: { id: obId }, include: { payments: true } });
      if (!ob) continue;
      const bornTogether = !ob.recurringRuleId && !ob.sourceType && all.some((x) => x.obligationId === ob.id && Math.abs(x.createdAt.getTime() - ob.createdAt.getTime()) < SAME_LOAD_MS);
      if (bornTogether && ob.payments.length === 0) { await tx.obligation.delete({ where: { id: ob.id } }); continue; }
      const updated = await refreshStatus(tx, ob.id);
      // Una deuda que había quedado pagada vuelve a estar activa si se borra un pago.
      if (ob.sourceType === "debt" && ob.sourceId && updated.status !== "SETTLED") await tx.debt.updateMany({ where: { id: ob.sourceId, workspaceId: ws, status: "PAID" }, data: { status: "ACTIVE" } });
    }
    return { deleted: list.length };
  });
}

// Corregir un movimiento: concepto, categoría, fecha, mes, notas y, cuando se puede, importe y cuenta.
export async function updateMovement(
  db: Db,
  ws: string,
  id: string,
  input: { description: string; categoryId: string | null; effectiveDate: Date; economicPeriod: string; notes: string | null; amount?: MoneyValue | null; accountId?: string | null },
) {
  const t = await db.transaction.findFirst({ where: { id, workspaceId: ws }, include: { reversedBy: true, obligation: true } });
  if (!t) throw new UserError("No encontramos ese movimiento.");
  if (t.reversalOfId || t.reversedBy) throw new UserError("Este movimiento estaba anulado: borralo y cargalo de nuevo.");
  const description = input.description.trim();
  if (!description) throw new UserError("Escribí el concepto.");
  if (input.categoryId && !(await db.category.findFirst({ where: { id: input.categoryId, workspaceId: ws } }))) throw new UserError("No encontramos esa categoría.");
  const plan = await db.installmentPlan.findFirst({ where: { transactionId: t.id } });
  const fixedAmount = !!plan || t.obligation?.sourceType === "grain" || t.type === "DEBT_DISBURSEMENT" || t.type === "INVESTMENT";
  const amount = input.amount != null && !fixedAmount ? round2(input.amount) : null;
  if (amount && !amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  // Cuenta: solo en gastos e ingresos comunes, y a otra de la misma moneda.
  let accountId: string | null = null;
  if (input.accountId && input.accountId !== t.accountId) {
    if (t.transferGroupId || t.obligationId || plan || (t.type !== "INCOME" && t.type !== "EXPENSE")) throw new UserError("La cuenta de este movimiento no se cambia: borralo y cargalo de nuevo.");
    const acc = await ownAccount(db, ws, input.accountId);
    if (acc.currency !== t.currency) throw new UserError(`Elegí una cuenta en ${t.currency}.`);
    accountId = acc.id;
  }
  return db.$transaction(async (tx) => {
    const common = { effectiveDate: input.effectiveDate, ...(amount ? { amount: money(amount) } : {}) };
    await tx.transaction.update({ where: { id: t.id }, data: { ...common, description: description.slice(0, 140), categoryId: t.type === "TRANSFER" ? null : input.categoryId, economicPeriod: input.economicPeriod, notes: input.notes, ...(accountId ? { accountId } : {}) } });
    // Transferencia en la misma moneda: la otra pata cambia igual (importe y fecha).
    if (t.transferGroupId) {
      const legs = await tx.transaction.findMany({ where: { workspaceId: ws, transferGroupId: t.transferGroupId, id: { not: t.id } } });
      const sameCurrency = legs.every((l) => l.currency === t.currency);
      for (const l of legs) await tx.transaction.update({ where: { id: l.id }, data: { effectiveDate: input.effectiveDate, ...(amount && sameCurrency ? { amount: money(amount) } : {}) } });
    }
    if (t.obligationId && amount) await refreshStatus(tx, t.obligationId);
  });
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
  recurringRuleId?: string | null;
  source?: string | null; // "debt" | "card" | "grain"
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
    source: o.sourceType,
    recurringRuleId: o.recurringRuleId,
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
    db.account.findMany({ where: { workspaceId: ws, active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    readBalances(db, ws, today.getTime()),
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
