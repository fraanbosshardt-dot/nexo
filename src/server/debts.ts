// Deudas y préstamos. Cada cuota es un pendiente (Obligation) vinculado a la deuda.
// No se inventan tasas: sin TNA, el cronograma usa el importe de cuota informado o reparte sin interés.
import type { AmortizationSystem } from "@/generated/prisma/enums";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { allocate, dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";
import type Decimal from "decimal.js";

export type ScheduleRow = { k: number; due: Date; capital: Decimal; interest: Decimal; total: Decimal; balance: Decimal };

const addMonths = (d: Date, k: number) => {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + k, day = d.getUTCDate();
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return new Date(Date.UTC(yy, mm, Math.min(day, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())));
};

export function buildSchedule(input: { system: AmortizationSystem; principal: MoneyValue; installments: number; tna?: MoneyValue | null; installmentAmount?: MoneyValue | null; firstDue: Date }): ScheduleRow[] {
  const P = round2(input.principal), n = input.installments;
  if (input.system === "MANUAL" || input.system === "NONE") return [];
  if (!Number.isInteger(n) || n < 1 || n > 480) throw new UserError("La cantidad de cuotas va de 1 a 480.");
  const i = input.tna ? dec(input.tna).dividedBy(100).dividedBy(12) : null;
  const rows: ScheduleRow[] = [];
  let bal = P;
  const push = (k: number, cap: Decimal, int: Decimal) => {
    bal = bal.minus(cap);
    rows.push({ k, due: addMonths(input.firstDue, k - 1), capital: cap, interest: int, total: cap.plus(int), balance: bal });
  };
  if (input.system === "FRENCH" && i && i.gt(0)) {
    const c = round2(P.times(i).dividedBy(dec(1).minus(dec(1).plus(i).pow(-n))));
    for (let k = 1; k <= n; k++) {
      const int = round2(bal.times(i));
      push(k, k === n ? bal : c.minus(int), int);
    }
  } else if (input.system === "GERMAN" && i && i.gt(0)) {
    const caps = allocate(P, n);
    for (let k = 1; k <= n; k++) push(k, caps[k - 1], round2(bal.times(i)));
  } else if (input.system === "AMERICAN" && i && i.gt(0)) {
    for (let k = 1; k <= n; k++) push(k, k === n ? bal : ZERO, round2(P.times(i)));
  } else if (input.installmentAmount && round2(input.installmentAmount).gt(0)) {
    // Sin tasa pero con cuota informada: el interés total es (cuota × n) − capital, repartido parejo.
    const c = round2(input.installmentAmount);
    if (c.times(n).lt(P)) throw new UserError("Con esa cuota no se llega a devolver el capital.");
    const caps = allocate(P, n), ints = allocate(c.times(n).minus(P), n);
    for (let k = 1; k <= n; k++) push(k, caps[k - 1], ints[k - 1]);
  } else if (input.system === "NO_INTEREST") {
    for (const [idx, cap] of allocate(P, n).entries()) push(idx + 1, cap, ZERO);
  } else {
    throw new UserError("Para este sistema, cargá la TNA o el importe de la cuota.");
  }
  return rows;
}

export type DebtInput = {
  creditor: string;
  kind: string;
  principal: MoneyValue;
  currency: string;
  system: AmortizationSystem;
  installments?: number | null;
  tna?: MoneyValue | null;
  tea?: MoneyValue | null;
  cft?: MoneyValue | null;
  installmentAmount?: MoneyValue | null;
  startDate: Date;
  firstDue?: Date | null;
  accountId?: string | null; // si el dinero entró en una cuenta
  paidInstallments?: number; // cuotas ya pagadas antes de cargarla en Finan
  notes?: string | null;
  userId?: string | null;
};

export async function createDebt(db: Db, ws: string, input: DebtInput) {
  if (!input.creditor.trim()) throw new UserError("Indicá a quién le debés.");
  const P = round2(input.principal);
  if (!P.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  const rows = input.system === "MANUAL" || input.system === "NONE" ? [] : buildSchedule({ system: input.system, principal: P, installments: input.installments ?? 0, tna: input.tna, installmentAmount: input.installmentAmount, firstDue: input.firstDue ?? addMonths(input.startDate, 1) });
  const already = Math.min(input.paidInstallments ?? 0, rows.length);
  if (input.accountId && !(await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws } }))) throw new UserError("No encontramos esa cuenta.");
  return db.$transaction(async (tx) => {
    const debt = await tx.debt.create({
      data: {
        workspaceId: ws,
        creditor: input.creditor.trim(),
        kind: input.kind,
        principal: P.toFixed(2),
        currency: input.currency,
        system: input.system,
        tna: input.tna != null ? dec(input.tna).toFixed(4) : null,
        tea: input.tea != null ? dec(input.tea).toFixed(4) : null,
        cft: input.cft != null ? dec(input.cft).toFixed(4) : null,
        installmentAmount: input.installmentAmount != null ? round2(input.installmentAmount).toFixed(2) : null,
        startDate: input.startDate,
        installments: rows.length || null,
        accountId: input.accountId ?? null,
        notes: input.notes?.trim() || null,
      },
    });
    await writeSchedule(tx, ws, debt, rows, already);
    if (input.accountId) {
      // El préstamo entra como dinero, pero no es un ingreso: es una deuda.
      const acc = await tx.account.findFirstOrThrow({ where: { id: input.accountId, workspaceId: ws } });
      await tx.transaction.create({ data: { workspaceId: ws, accountId: acc.id, type: "DEBT_DISBURSEMENT", direction: "IN", amount: P.toFixed(2), currency: acc.currency, description: `Préstamo de ${debt.creditor}`, effectiveDate: input.startDate, economicPeriod: period(input.startDate), notes: `debt:${debt.id}`, createdById: input.userId ?? null } });
    }
    return debt;
  });
}

type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

// Cada cuota es un pendiente (salvo las que ya estaban pagadas antes de cargarla).
async function writeSchedule(tx: Tx, ws: string, debt: { id: string; creditor: string; currency: string }, rows: ScheduleRow[], already: number) {
  for (const r of rows) {
    const ob = r.k <= already
      ? null
      : await tx.obligation.create({
          data: { workspaceId: ws, direction: "PAYABLE", description: `${debt.creditor} — cuota ${r.k}/${rows.length}`, amount: r.total.toFixed(2), currency: debt.currency, dueDate: r.due, economicPeriod: period(r.due), sourceType: "debt", sourceId: debt.id },
        });
    await tx.debtInstallment.create({ data: { debtId: debt.id, number: r.k, dueDate: r.due, capital: r.capital.toFixed(2), interest: r.interest.toFixed(2), total: r.total.toFixed(2), balanceAfter: r.balance.toFixed(2), obligationId: ob?.id ?? null } });
  }
}

// Todo lo que cuelga de una deuda: sus cuotas pendientes, los pagos registrados y la plata que entró.
async function debtLinks(db: Db, ws: string, debt: { id: string; creditor: string; accountId: string | null; principal: MoneyValue; startDate: Date }) {
  const obs = await db.obligation.findMany({ where: { workspaceId: ws, sourceType: "debt", sourceId: debt.id }, select: { id: true } });
  const obIds = obs.map((o) => o.id);
  const payments = await db.transaction.findMany({ where: { workspaceId: ws, OR: [{ obligationId: { in: obIds } }, { notes: `debt:${debt.id}`, type: { not: "DEBT_DISBURSEMENT" } }] }, select: { id: true } });
  // La plata que entró: las nuevas llevan la marca de la deuda; las de antes se reconocen por cuenta, monto, fecha y nombre.
  const disb = await db.transaction.findMany({
    where: { workspaceId: ws, type: "DEBT_DISBURSEMENT", OR: [{ notes: `debt:${debt.id}` }, ...(debt.accountId ? [{ notes: null, accountId: debt.accountId, amount: round2(debt.principal).toFixed(2), effectiveDate: debt.startDate, description: `Préstamo de ${debt.creditor}` }] : [])] },
    select: { id: true },
  });
  return { obIds, paymentIds: payments.map((p) => p.id), disbursementIds: disb.map((d) => d.id) };
}

// Borrar una deuda cargada por error: se va con sus cuotas, los pagos registrados en Finan y la plata que entró.
export async function deleteDebt(db: Db, ws: string, id: string) {
  const debt = await db.debt.findFirst({ where: { id, workspaceId: ws } });
  if (!debt) throw new UserError("No encontramos esa deuda.");
  const l = await debtLinks(db, ws, debt);
  const txIds = [...l.paymentIds, ...l.disbursementIds];
  await db.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { workspaceId: ws, reversalOfId: { in: txIds } } });
    await tx.transaction.deleteMany({ where: { workspaceId: ws, id: { in: txIds } } });
    await tx.debtInstallment.deleteMany({ where: { debtId: debt.id } });
    await tx.obligation.deleteMany({ where: { workspaceId: ws, id: { in: l.obIds } } });
    await tx.debt.delete({ where: { id: debt.id } });
  });
  return { payments: l.paymentIds.length };
}

export type DebtEdit = Omit<DebtInput, "accountId" | "currency" | "userId">;

// Editar una deuda. Sin pagos registrados en Finan, se corrige todo y el cronograma se rearma.
// Con pagos, solo el nombre, el tipo y las notas (para cambiar condiciones: borrarla y cargarla de nuevo).
export async function updateDebt(db: Db, ws: string, id: string, input: DebtEdit) {
  const debt = await db.debt.findFirst({ where: { id, workspaceId: ws } });
  if (!debt) throw new UserError("No encontramos esa deuda.");
  if (!input.creditor.trim()) throw new UserError("Indicá a quién le debés.");
  const l = await debtLinks(db, ws, debt);
  const names = { creditor: input.creditor.trim(), kind: input.kind, notes: input.notes?.trim() || null };
  if (l.paymentIds.length) {
    await db.$transaction(async (tx) => {
      await tx.debt.update({ where: { id: debt.id }, data: names });
      // Las cuotas que faltan llevan el nombre nuevo.
      const sched = await tx.debtInstallment.findMany({ where: { debtId: debt.id, obligationId: { not: null } } });
      for (const r of sched) await tx.obligation.update({ where: { id: r.obligationId! }, data: { description: `${names.creditor} — cuota ${r.number}/${debt.installments ?? sched.length}` } });
    });
    return { rebuilt: false };
  }
  const P = round2(input.principal);
  if (!P.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  const rows = input.system === "MANUAL" || input.system === "NONE" ? [] : buildSchedule({ system: input.system, principal: P, installments: input.installments ?? 0, tna: input.tna, installmentAmount: input.installmentAmount, firstDue: input.firstDue ?? addMonths(input.startDate, 1) });
  const already = Math.min(input.paidInstallments ?? 0, rows.length);
  await db.$transaction(async (tx) => {
    await tx.debtInstallment.deleteMany({ where: { debtId: debt.id } });
    await tx.obligation.deleteMany({ where: { workspaceId: ws, id: { in: l.obIds } } });
    const updated = await tx.debt.update({
      where: { id: debt.id },
      data: {
        ...names, principal: P.toFixed(2), system: input.system,
        tna: input.tna != null ? dec(input.tna).toFixed(4) : null, tea: input.tea != null ? dec(input.tea).toFixed(4) : null, cft: input.cft != null ? dec(input.cft).toFixed(4) : null,
        installmentAmount: input.installmentAmount != null ? round2(input.installmentAmount).toFixed(2) : null,
        startDate: input.startDate, installments: rows.length || null, status: "ACTIVE", cancelledAt: null,
      },
    });
    await writeSchedule(tx, ws, updated, rows, already);
    // Si la plata había entrado en una cuenta, se corrige con el monto, la fecha y el nombre nuevos.
    if (l.disbursementIds.length) await tx.transaction.updateMany({ where: { id: { in: l.disbursementIds } }, data: { amount: P.toFixed(2), effectiveDate: input.startDate, economicPeriod: period(input.startDate), description: `Préstamo de ${names.creditor}`, notes: `debt:${debt.id}` } });
  });
  return { rebuilt: true };
}

// ¿Tiene pagos registrados en Finan? (decide qué se puede editar)
export async function debtHasPayments(db: Db, ws: string, id: string) {
  const debt = await db.debt.findFirst({ where: { id, workspaceId: ws } });
  return debt ? (await debtLinks(db, ws, debt)).paymentIds.length > 0 : false;
}

export async function debtDetail(db: Db, ws: string, debtId: string) {
  const debt = await db.debt.findFirst({ where: { id: debtId, workspaceId: ws }, include: { schedule: { orderBy: { number: "asc" } } } });
  if (!debt) return null;
  const obIds = debt.schedule.map((s) => s.obligationId).filter(Boolean) as string[];
  const obs = await db.obligation.findMany({ where: { id: { in: obIds } }, include: { payments: true } });
  const byId = new Map(obs.map((o) => [o.id, o]));
  const paidOf = (o?: (typeof obs)[number]) => (o ? o.payments.reduce((s, t) => s.plus(t.direction === "OUT" ? dec(t.amount) : dec(t.amount).neg()), ZERO) : null);
  const rows = debt.schedule.map((s) => {
    const o = s.obligationId ? byId.get(s.obligationId) : undefined;
    const status = !s.obligationId ? "PAID_BEFORE" : o?.status ?? "PENDING";
    return { ...s, status, obligationId: s.obligationId, paid: paidOf(o) };
  });
  const settled = rows.filter((r) => r.status === "SETTLED" || r.status === "PAID_BEFORE");
  const open = rows.filter((r) => r.status === "PENDING" || r.status === "PARTIAL");
  const capitalPaid = settled.reduce((s, r) => s.plus(dec(r.capital)), ZERO);
  // Sin cronograma: lo que falta es el capital menos los pagos a cuenta registrados.
  const manualPaid = debt.schedule.length ? ZERO : (await db.transaction.findMany({ where: { workspaceId: ws, type: "DEBT_PAYMENT", notes: `debt:${debt.id}` } })).reduce((s, t) => s.plus(dec(t.amount)), ZERO);
  const remainingCapital = debt.status === "ACTIVE" ? dec(debt.principal).minus(capitalPaid).minus(manualPaid) : ZERO;
  const futureSum = open.reduce((s, r) => s.plus(dec(r.total)).minus(r.paid ?? ZERO), ZERO);
  return { debt, rows, open, settledCount: settled.length, remainingCapital, futureSum, next: open[0] ?? null };
}

export async function listDebts(db: Db, ws: string, today: Date) {
  const debts = await db.debt.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "asc" } });
  const out = [];
  for (const d of debts) {
    const det = (await debtDetail(db, ws, d.id))!;
    out.push({ ...det, overdue: det.open.filter((r) => r.dueDate < today).length });
  }
  return out;
}

// Cancelación total: se paga lo que falta de capital (más comisión, si la hay) y se cierran las cuotas futuras.
export async function cancelDebt(db: Db, ws: string, input: { debtId: string; accountId: string; amount: MoneyValue; date: Date; userId?: string | null }) {
  const det = await debtDetail(db, ws, input.debtId);
  if (!det) throw new UserError("No encontramos esa deuda.");
  if (det.debt.status !== "ACTIVE") throw new UserError("Esa deuda ya está cerrada.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc || acc.type === "CREDIT_CARD") throw new UserError("Elegí una cuenta de dinero.");
  if (acc.currency !== det.debt.currency) throw new UserError(`Elegí una cuenta en ${det.debt.currency}.`);
  const amount = round2(input.amount);
  if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  return db.$transaction(async (tx) => {
    await tx.transaction.create({ data: { workspaceId: ws, accountId: acc.id, type: "DEBT_PAYMENT", direction: "OUT", amount: amount.toFixed(2), currency: acc.currency, description: `Cancelación total — ${det.debt.creditor}`, effectiveDate: input.date, economicPeriod: period(input.date), notes: `debt:${det.debt.id}`, createdById: input.userId ?? null } });
    const ids = det.open.map((r) => r.obligationId).filter(Boolean) as string[];
    if (ids.length) await tx.obligation.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", notes: "Cancelada por pago anticipado" } });
    await tx.debt.update({ where: { id: det.debt.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return { saved: det.futureSum.minus(amount) };
  });
}

// Pago a cuenta de una deuda sin cronograma (por ejemplo, un préstamo de un familiar).
export async function payDebtOnAccount(db: Db, ws: string, input: { debtId: string; accountId: string; amount: MoneyValue; date: Date; userId?: string | null }) {
  const det = await debtDetail(db, ws, input.debtId);
  if (!det) throw new UserError("No encontramos esa deuda.");
  if (det.debt.schedule.length) throw new UserError("Esta deuda tiene cuotas: pagá la cuota desde Próximos pagos.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc || acc.currency !== det.debt.currency) throw new UserError(`Elegí una cuenta en ${det.debt.currency}.`);
  const amount = round2(input.amount);
  if (!amount.gt(0) || amount.gt(det.remainingCapital)) throw new UserError(`El pago tiene que ser mayor a cero y como mucho ${det.remainingCapital.toFixed(2)}.`);
  await db.transaction.create({ data: { workspaceId: ws, accountId: acc.id, type: "DEBT_PAYMENT", direction: "OUT", amount: amount.toFixed(2), currency: acc.currency, description: `Pago a cuenta — ${det.debt.creditor}`, effectiveDate: input.date, economicPeriod: period(input.date), notes: `debt:${det.debt.id}`, createdById: input.userId ?? null } });
  if (amount.eq(det.remainingCapital)) await db.debt.update({ where: { id: det.debt.id }, data: { status: "PAID" } });
}
