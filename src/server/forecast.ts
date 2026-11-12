// Flujo de caja proyectado: saldo real de hoy + cobros y pagos futuros, en orden de fecha.
// Lo usan el Flujo de caja, el Simulador, "¿Puedo comprarlo en cuotas?" y las Alertas.
import type { Db } from "./ledger";
import { accountBalances, remaining } from "./ledger";
import { amountFor, applyWeekend, occurrences } from "./recurring";
import { projectedCardPayments } from "./cards";
import { allocate, dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { addMonths, period, periodEnd, periodStart } from "@/lib/dates";
import type Decimal from "decimal.js";

export const MATERIALIZE_DAYS = 45; // las reglas recurrentes se guardan como pendientes hasta esta cantidad de días

export type Certainty = "conf" | "prob" | "hipo";
export type FlowEvent = { date: Date; amount: Decimal; description: string; kind: "pending" | "recurring" | "card" | "sim"; certainty: "CONFIRMED" | "PROBABLE" | "HYPOTHETICAL" };
export type ForecastRow = { period: string; start: Decimal; realizedIn: Decimal; realizedOut: Decimal; pendingIn: Decimal; pendingOut: Decimal; end: Decimal; result: Decimal; min: Decimal; minDate: Date | null };
export type Adjust = { expensePct?: number; extra?: { date: Date; amount: MoneyValue; description: string }[]; dropRuleIds?: string[] };

export async function forecast(db: Db, ws: string, opts: { currency: string; today: Date; months: number; certainty?: Certainty; adjust?: Adjust }) {
  const { currency, today } = opts;
  const months = Math.max(1, Math.min(60, opts.months));
  const p0 = period(today);
  const horizon = periodEnd(addMonths(p0, months - 1));
  const allowed = opts.certainty === "hipo" ? ["CONFIRMED", "PROBABLE", "HYPOTHETICAL"] : opts.certainty === "prob" ? ["CONFIRMED", "PROBABLE"] : ["CONFIRMED"];

  // 1) Dinero de hoy: cuentas en la moneda, sin inversiones ni tarjetas.
  const accounts = await db.account.findMany({ where: { workspaceId: ws, currency, active: true, type: { notIn: ["INVESTMENT", "CREDIT_CARD"] } }, select: { id: true } });
  const ids = new Set(accounts.map((a) => a.id));
  const balances = await accountBalances(db, ws);
  const cashNow = accounts.reduce((s, a) => s.plus(balances.get(a.id) ?? ZERO), ZERO);

  // 2) Lo que ya pasó este mes (para mostrar cuánto entró y salió). Las transferencias entre estas mismas cuentas no cuentan.
  const tx = await db.transaction.findMany({ where: { workspaceId: ws, accountId: { in: [...ids] }, effectiveDate: { gte: periodStart(p0), lte: periodEnd(p0) } }, select: { amount: true, direction: true, transferGroupId: true, accountId: true } });
  const groups = new Map<string, string[]>();
  if (tx.some((t) => t.transferGroupId)) {
    const legs = await db.transaction.findMany({ where: { workspaceId: ws, transferGroupId: { in: tx.map((t) => t.transferGroupId).filter(Boolean) as string[] } }, select: { transferGroupId: true, accountId: true } });
    for (const l of legs) groups.set(l.transferGroupId!, [...(groups.get(l.transferGroupId!) ?? []), l.accountId]);
  }
  let realizedIn = ZERO, realizedOut = ZERO;
  for (const t of tx) {
    if (t.transferGroupId && (groups.get(t.transferGroupId) ?? []).every((a) => ids.has(a))) continue;
    if (t.direction === "IN") realizedIn = realizedIn.plus(dec(t.amount));
    else realizedOut = realizedOut.plus(dec(t.amount));
  }

  // 3) Lo que viene: pendientes guardados, reglas recurrentes más allá de lo guardado y resúmenes de tarjeta estimados.
  const events: FlowEvent[] = [];
  const open = await db.obligation.findMany({ where: { workspaceId: ws, currency, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lte: horizon } }, include: { payments: true } });
  const drop = new Set(opts.adjust?.dropRuleIds ?? []);
  for (const o of open) {
    if (o.recurringRuleId && drop.has(o.recurringRuleId)) continue;
    if (o.direction === "RECEIVABLE" && !allowed.includes(o.certainty)) continue;
    const left = remaining(o);
    if (!left.gt(0)) continue;
    events.push({ date: o.dueDate < today ? today : o.dueDate, amount: o.direction === "RECEIVABLE" ? left : left.neg(), description: o.description, kind: "pending", certainty: o.certainty });
  }
  const matUntil = new Date(today.getTime() + MATERIALIZE_DAYS * 864e5);
  const rules = await db.recurringRule.findMany({ where: { workspaceId: ws, currency, pausedAt: null } });
  const existing = await db.obligation.findMany({ where: { workspaceId: ws, recurringRuleId: { in: rules.map((r) => r.id) } }, select: { recurringRuleId: true, occurrenceDate: true } });
  const seen = new Set(existing.map((e) => `${e.recurringRuleId}|${e.occurrenceDate?.getTime()}`));
  for (const r of rules) {
    if (drop.has(r.id)) continue;
    for (const d of occurrences(r, new Date(Math.max(r.startDate.getTime(), today.getTime())), horizon)) {
      if (d <= matUntil && seen.has(`${r.id}|${d.getTime()}`)) continue;
      if (seen.has(`${r.id}|${d.getTime()}`)) continue;
      const a = amountFor(r, d);
      events.push({ date: applyWeekend(d, r.weekendRule), amount: r.direction === "RECEIVABLE" ? a : a.neg(), description: r.description, kind: "recurring", certainty: "CONFIRMED" });
    }
  }
  for (const c of await projectedCardPayments(db, ws, today, horizon)) {
    if (c.currency === currency) events.push({ date: c.date, amount: c.amount.neg(), description: c.description, kind: "card", certainty: "CONFIRMED" });
  }
  for (const x of opts.adjust?.extra ?? []) events.push({ date: x.date < today ? today : x.date, amount: round2(x.amount), description: x.description, kind: "sim", certainty: "CONFIRMED" });
  if (opts.adjust?.expensePct) {
    const f = dec(1).plus(dec(opts.adjust.expensePct).dividedBy(100));
    for (const e of events) if (e.amount.lt(0) && e.kind !== "sim" && e.kind !== "card") e.amount = round2(e.amount.times(f));
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 4) Mes a mes, acumulando el saldo.
  const rows: ForecastRow[] = [];
  let running = cashNow;
  let start = cashNow.minus(realizedIn).plus(realizedOut);
  let idx = 0;
  for (let m = 0; m < months; m++) {
    const p = addMonths(p0, m), end = periodEnd(p);
    let pin = ZERO, pout = ZERO, min = m === 0 ? cashNow : start, minDate: Date | null = m === 0 ? today : null;
    while (idx < events.length && events[idx].date <= end) {
      const e = events[idx++];
      if (e.amount.gt(0)) pin = pin.plus(e.amount);
      else pout = pout.minus(e.amount);
      running = running.plus(e.amount);
      if (running.lt(min)) { min = running; minDate = e.date; }
    }
    const rIn = m === 0 ? realizedIn : ZERO, rOut = m === 0 ? realizedOut : ZERO;
    const endBal = start.plus(rIn).minus(rOut).plus(pin).minus(pout);
    rows.push({ period: p, start, realizedIn: rIn, realizedOut: rOut, pendingIn: pin, pendingOut: pout, end: endBal, result: endBal.minus(start), min, minDate });
    start = endBal;
  }
  return { cashNow, rows, events };
}

// "¿Puedo comprarlo en cuotas?": suma las cuotas a la proyección y mira el peor momento.
export async function canAfford(
  db: Db,
  ws: string,
  input: { currency: string; today: Date; price: MoneyValue; installments: number; financedTotal?: MoneyValue | null; firstDue: Date; cushion?: MoneyValue; inflow?: MoneyValue | null },
) {
  const n = Math.max(1, Math.min(48, input.installments));
  const total = round2(input.financedTotal ?? input.price);
  const cushion = round2(input.cushion ?? 0);
  // Préstamo: la plata entra ahora y después salen las cuotas.
  const inflow = round2(input.inflow ?? 0);
  const firstOffset = (input.firstDue.getUTCFullYear() - input.today.getUTCFullYear()) * 12 + input.firstDue.getUTCMonth() - input.today.getUTCMonth();
  const months = Math.min(60, Math.max(3, firstOffset + n + 2));
  const base = await forecast(db, ws, { currency: input.currency, today: input.today, months });
  const parts = allocate(total, n);
  const scenario = (cuotas: Decimal[], offset: number) => {
    let paid = ZERO;
    return base.rows.map((r, m) => {
      const k = m - offset;
      const thisMonth = k >= 0 && k < cuotas.length ? cuotas[k] : ZERO;
      const before = paid;
      paid = paid.plus(thisMonth);
      return { ...r, cuota: thisMonth, end: r.end.minus(paid).plus(inflow), min: r.min.minus(before).minus(thisMonth).plus(inflow) };
    });
  };
  const withPurchase = scenario(parts, firstOffset);
  const worst = withPurchase.reduce((w, r) => (r.min.lt(w.min) ? r : w), withPurchase[0]);
  const ok = worst.min.gte(cushion);
  const options = [1, 3, 6, 9, 12, 18, 24].map((k) => {
    const s = scenario(allocate(input.financedTotal ? total : round2(input.price), k), firstOffset);
    const w = s.reduce((a, r) => (r.min.lt(a) ? r.min : a), s[0].min);
    return { installments: k, cuota: allocate(input.financedTotal ? total : round2(input.price), k)[0], worst: w, ok: w.gte(cushion) };
  });
  return { ok, total, cuota: parts[0], installments: n, worst, cushion, rows: withPurchase, baseRows: base.rows, options, cashNow: base.cashNow };
}
