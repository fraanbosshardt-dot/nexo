// Reglas recurrentes: generan pendientes (Obligation) sin duplicar y sin tocar el pasado.
import type { Frequency, ObligationDirection, WeekendRule } from "@/generated/prisma/enums";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { dec, round2, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";

type RuleLike = {
  frequency: Frequency;
  interval: number;
  dayOfMonth: number | null;
  startDate: Date;
  endDate: Date | null;
  weekendRule: WeekendRule;
  pausedAt?: Date | null;
};

const MONTHS: Partial<Record<Frequency, number>> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12, CUSTOM: 1 };
const DAYS: Partial<Record<Frequency, number>> = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 };

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Sábado o domingo → día hábil anterior o siguiente, según la regla.
export function applyWeekend(d: Date, rule: WeekendRule): Date {
  const w = d.getUTCDay();
  if (rule === "NONE" || (w !== 0 && w !== 6)) return d;
  const shift = rule === "PREVIOUS_BUSINESS_DAY" ? (w === 6 ? -1 : -2) : w === 6 ? 2 : 1;
  return new Date(d.getTime() + shift * 864e5);
}

// Fechas "teóricas" de la regla entre from y to (sin mover por fin de semana).
export function occurrences(rule: RuleLike, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (rule.startDate > end) return out;
  const months = MONTHS[rule.frequency];
  if (months) {
    const step = months * Math.max(1, rule.interval);
    const day = rule.dayOfMonth ?? rule.startDate.getUTCDate();
    for (let k = 0; k < 1200; k++) {
      const y = rule.startDate.getUTCFullYear(), m = rule.startDate.getUTCMonth() + k * step;
      const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
      // Fecha inexistente (31 en un mes de 30): se usa el último día del mes.
      const d = utc(yy, mm, Math.min(day, lastDay(yy, mm)));
      if (d > end) break;
      if (d >= rule.startDate && d >= from) out.push(d);
    }
  } else {
    const step = (DAYS[rule.frequency] ?? 30) * Math.max(1, rule.interval) * 864e5;
    for (let t = rule.startDate.getTime(); t <= end.getTime() && out.length < 2000; t += step) if (t >= from.getTime()) out.push(new Date(t));
  }
  return out;
}

// Importe de una ocurrencia con aumento programado (por ejemplo, +6% cada 3 meses).
export function amountFor(rule: { amount: MoneyValue; increasePct?: MoneyValue | null; increaseEveryMonths?: number | null; startDate: Date }, occ: Date) {
  const base = dec(rule.amount);
  if (!rule.increasePct || !rule.increaseEveryMonths) return round2(base);
  const months = (occ.getUTCFullYear() - rule.startDate.getUTCFullYear()) * 12 + occ.getUTCMonth() - rule.startDate.getUTCMonth();
  const steps = Math.max(0, Math.floor(months / rule.increaseEveryMonths));
  return round2(base.times(dec(1).plus(dec(rule.increasePct).dividedBy(100)).pow(steps)));
}

// Crea los pendientes de las reglas hasta "until". Es idempotente: la clave (regla, fecha) es única.
export async function materialize(db: Db, ws: string, until: Date) {
  const rules = await db.recurringRule.findMany({ where: { workspaceId: ws, pausedAt: null, startDate: { lte: until } } });
  let created = 0;
  for (const r of rules) {
    const dates = occurrences(r, r.startDate, until);
    if (!dates.length) continue;
    const res = await db.obligation.createMany({
      skipDuplicates: true,
      data: dates.map((d) => ({
        workspaceId: ws,
        direction: r.direction,
        description: r.description,
        amount: amountFor(r, d).toFixed(2),
        currency: r.currency,
        categoryId: r.categoryId,
        dueDate: applyWeekend(d, r.weekendRule),
        occurrenceDate: d,
        economicPeriod: period(d),
        recurringRuleId: r.id,
      })),
    });
    created += res.count;
  }
  return created;
}

export type RuleInput = {
  direction: ObligationDirection;
  description: string;
  amount: MoneyValue;
  currency: string;
  categoryId?: string | null;
  accountId?: string | null;
  frequency: Frequency;
  interval?: number;
  dayOfMonth?: number | null;
  startDate: Date;
  endDate?: Date | null;
  weekendRule?: WeekendRule;
  variableAmount?: boolean;
  increasePct?: MoneyValue | null;
  increaseEveryMonths?: number | null;
};

export async function createRule(db: Db, ws: string, input: RuleInput) {
  if (!input.description.trim()) throw new UserError("Falta el concepto.");
  if (!round2(input.amount).gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  if (input.endDate && input.endDate < input.startDate) throw new UserError("La fecha de fin es anterior al inicio.");
  if (input.dayOfMonth != null && (input.dayOfMonth < 1 || input.dayOfMonth > 31)) throw new UserError("El día del mes tiene que estar entre 1 y 31.");
  if (input.categoryId && !(await db.category.findFirst({ where: { id: input.categoryId, workspaceId: ws } }))) throw new UserError("No encontramos esa categoría.");
  return db.recurringRule.create({
    data: {
      workspaceId: ws,
      direction: input.direction,
      description: input.description.trim(),
      amount: round2(input.amount).toFixed(2),
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      accountId: input.accountId ?? null,
      frequency: input.frequency,
      interval: input.interval ?? 1,
      dayOfMonth: input.dayOfMonth ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      weekendRule: input.weekendRule ?? "NONE",
      variableAmount: input.variableAmount ?? false,
      increasePct: input.increasePct != null ? dec(input.increasePct).toFixed(4) : null,
      increaseEveryMonths: input.increaseEveryMonths ?? null,
    },
  });
}

// Borra los pendientes futuros de una regla que no tengan pagos (los pagados quedan como historial).
async function dropFuture(db: Db, ruleId: string, from: Date) {
  const future = await db.obligation.findMany({ where: { recurringRuleId: ruleId, occurrenceDate: { gte: from }, status: "PENDING" }, include: { payments: true } });
  const ids = future.filter((o) => o.payments.length === 0).map((o) => o.id);
  if (ids.length) await db.obligation.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

// "Esta y las futuras": cierra la versión actual el día anterior y crea una nueva. El pasado no cambia.
export async function changeRuleFrom(db: Db, ws: string, ruleId: string, from: Date, changes: Partial<RuleInput>) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos esa regla.");
  return db.$transaction(async (tx) => {
    await tx.recurringRule.update({ where: { id: r.id }, data: { endDate: new Date(from.getTime() - 864e5) } });
    await dropFuture(tx as unknown as Db, r.id, from);
    return tx.recurringRule.create({
      data: {
        workspaceId: ws,
        direction: r.direction,
        description: changes.description?.trim() || r.description,
        amount: changes.amount != null ? round2(changes.amount).toFixed(2) : r.amount,
        currency: r.currency,
        categoryId: changes.categoryId !== undefined ? changes.categoryId : r.categoryId,
        accountId: r.accountId,
        frequency: changes.frequency ?? r.frequency,
        interval: changes.interval ?? r.interval,
        dayOfMonth: changes.dayOfMonth !== undefined ? changes.dayOfMonth : r.dayOfMonth,
        startDate: from,
        endDate: changes.endDate !== undefined ? changes.endDate : r.endDate, // la fecha "hasta" se mantiene
        weekendRule: changes.weekendRule ?? r.weekendRule,
        variableAmount: changes.variableAmount ?? r.variableAmount,
        increasePct: r.increasePct,
        increaseEveryMonths: r.increaseEveryMonths,
        previousVersionId: r.id,
      },
    });
  });
}

export async function pauseRule(db: Db, ws: string, ruleId: string, paused: boolean, today: Date) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos esa regla.");
  if (paused) await dropFuture(db, r.id, today);
  return db.recurringRule.update({ where: { id: r.id }, data: { pausedAt: paused ? new Date() : null } });
}

// Fecha "hasta": se puede poner, cambiar o sacar. Lo que queda después de esa fecha se borra (si no tiene pagos).
export async function setRuleEnd(db: Db, ws: string, ruleId: string, endDate: Date | null) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos esa regla.");
  if (endDate && endDate < r.startDate) throw new UserError("La fecha hasta tiene que ser después de la primera vez.");
  if (endDate) await dropFuture(db, r.id, new Date(endDate.getTime() + 864e5));
  return db.recurringRule.update({ where: { id: r.id }, data: { endDate } });
}

// Borrar del todo: se van los pendientes futuros sin pagos; lo ya pagado o cobrado queda como estaba (suelto).
export async function deleteRule(db: Db, ws: string, ruleId: string) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos esa regla.");
  return db.$transaction(async (tx) => {
    const obs = await tx.obligation.findMany({ where: { recurringRuleId: r.id, workspaceId: ws }, include: { payments: true } });
    const drop = obs.filter((o) => o.payments.length === 0 && o.status === "PENDING").map((o) => o.id);
    if (drop.length) await tx.obligation.deleteMany({ where: { id: { in: drop } } });
    await tx.obligation.updateMany({ where: { recurringRuleId: r.id, workspaceId: ws }, data: { recurringRuleId: null } });
    await tx.recurringRule.updateMany({ where: { previousVersionId: r.id, workspaceId: ws }, data: { previousVersionId: null } });
    await tx.recurringRule.delete({ where: { id: r.id } });
    return { removedPending: drop.length };
  });
}

export async function endRule(db: Db, ws: string, ruleId: string, today: Date) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos esa regla.");
  await dropFuture(db, r.id, today);
  return db.recurringRule.update({ where: { id: r.id }, data: { endDate: today } });
}

export function nextOccurrence(rule: RuleLike, today: Date): Date | null {
  if (rule.pausedAt) return null;
  const horizon = new Date(today.getTime() + 800 * 864e5);
  const d = occurrences(rule, today, horizon)[0];
  return d ? applyWeekend(d, rule.weekendRule) : null;
}

// ---------- Proyectados: lo que las reglas van a generar más adelante, calculado al vuelo (no se guarda) ----------
export type Projected = { ruleId: string; occurrence: Date; dueDate: Date; description: string; amount: ReturnType<typeof amountFor>; currency: string; direction: ObligationDirection; variable: boolean };

export async function projectedItems(db: Db, ws: string, from: Date, to: Date): Promise<Projected[]> {
  const rules = await db.recurringRule.findMany({ where: { workspaceId: ws, pausedAt: null, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] } });
  if (!rules.length) return [];
  // Lo que ya existe como pendiente (o se pagó, o se canceló) no se vuelve a mostrar.
  const existing = await db.obligation.findMany({ where: { workspaceId: ws, recurringRuleId: { in: rules.map((r) => r.id) }, occurrenceDate: { gte: from, lte: to } }, select: { recurringRuleId: true, occurrenceDate: true } });
  const taken = new Set(existing.map((o) => `${o.recurringRuleId}|${o.occurrenceDate?.toISOString().slice(0, 10)}`));
  const out: Projected[] = [];
  for (const r of rules) {
    for (const d of occurrences(r, from, to)) {
      if (taken.has(`${r.id}|${d.toISOString().slice(0, 10)}`)) continue;
      out.push({ ruleId: r.id, occurrence: d, dueDate: applyWeekend(d, r.weekendRule), description: r.description, amount: amountFor(r, d), currency: r.currency, direction: r.direction, variable: r.variableAmount });
    }
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// Convierte un proyectado en un pendiente de verdad (para pagarlo por adelantado o cancelarlo). Devuelve su id.
export async function materializeOccurrence(db: Db, ws: string, ruleId: string, occurrence: Date) {
  const r = await db.recurringRule.findFirst({ where: { id: ruleId, workspaceId: ws } });
  if (!r) throw new UserError("No encontramos ese pago que se repite.");
  const valid = occurrences(r, occurrence, occurrence).some((d) => d.getTime() === occurrence.getTime());
  if (!valid) throw new UserError("Esa fecha no corresponde a este pago que se repite.");
  await db.obligation.createMany({
    skipDuplicates: true,
    data: [{ workspaceId: ws, direction: r.direction, description: r.description, amount: amountFor(r, occurrence).toFixed(2), currency: r.currency, categoryId: r.categoryId, dueDate: applyWeekend(occurrence, r.weekendRule), occurrenceDate: occurrence, economicPeriod: period(occurrence), recurringRuleId: r.id }],
  });
  const ob = await db.obligation.findFirst({ where: { workspaceId: ws, recurringRuleId: r.id, occurrenceDate: occurrence }, select: { id: true } });
  if (!ob) throw new UserError("No pudimos preparar ese pago. Probá de nuevo.");
  return ob.id;
}
