// Alertas y consejos con reglas fijas sobre los datos del usuario (sin IA externa).
import type { Db } from "./ledger";
import { accountBalances, openObligations } from "./ledger";
import { forecast } from "./forecast";
import { isEstimatedGrain, loadSaleHref } from "./grain";
import { budgetFor, goalsOverview } from "./planning";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtPeriod, period } from "@/lib/dates";

export type Insight = { level: "urgent" | "warn" | "info" | "good"; title: string; detail: string; href: string; kind?: "late" };

export async function insights(db: Db, ws: string, currency: string, today: Date, pre?: { open?: Awaited<ReturnType<typeof openObligations>> }): Promise<Insight[]> {
  const out: Insight[] = [];
  const f = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, currency);
  const open = pre?.open ?? (await openObligations(db, ws, today));
  const late = open.filter((o) => o.overdue && o.direction === "PAYABLE");
  if (late.length) out.push({ level: "urgent", title: `${late.length} ${late.length === 1 ? "pago atrasado" : "pagos atrasados"} por ${f(late.reduce((s, o) => s.plus(o.remaining), ZERO))}`, detail: late.slice(0, 3).map((o) => o.description).join(" · "), href: "/app/proximos", kind: "late" });
  // Una venta de cereal estimada que pasó no es un cobro atrasado: falta cargar la venta.
  const lateGrain = open.filter((o) => o.overdue && isEstimatedGrain(o));
  if (lateGrain.length) out.push({ level: "info", title: lateGrain.length === 1 ? "Falta cargar la venta de cereal estimada" : `Faltan cargar ${lateGrain.length} ventas de cereal estimadas`, detail: "Cargala con quintales y precio para que quede el cobro real.", href: loadSaleHref(lateGrain[0].dueDate) });
  const lateIn = open.filter((o) => o.overdue && o.direction === "RECEIVABLE" && !isEstimatedGrain(o));
  if (lateIn.length) out.push({ level: "warn", title: `${lateIn.length} ${lateIn.length === 1 ? "cobro atrasado" : "cobros atrasados"}`, detail: lateIn.slice(0, 3).map((o) => o.description).join(" · "), href: "/app/proximos", kind: "late" });

  const { rows } = await forecast(db, ws, { currency, today, months: 6 });
  const red = rows.filter((r) => r.min.lt(0));
  if (red.length) out.push({ level: "urgent", title: `Tu saldo baja de cero en ${fmtPeriod(red[0].period).toLowerCase()}`, detail: `El punto más bajo es ${f(red[0].min)}. Revisá los pagos de ese mes o mové algún gasto.`, href: "/app/flujo" });
  const neg = rows.filter((r) => r.result.lt(0));
  if (neg.length >= 2) out.push({ level: "warn", title: `${neg.length} de los próximos 6 meses terminan con menos plata`, detail: neg.map((r) => fmtPeriod(r.period)).join(", "), href: "/app/flujo" });

  // ¿Alcanza la plata para lo que vence en los próximos 10 días? (cuentas de dinero en la moneda principal)
  {
    const in10 = new Date(today.getTime() + 10 * 864e5);
    const due = open.filter((o) => o.direction === "PAYABLE" && o.currency === currency && o.dueDate <= in10);
    const need = due.reduce((s, o) => s.plus(o.remaining), ZERO);
    if (need.gt(0)) {
      const [accs, bal] = await Promise.all([db.account.findMany({ where: { workspaceId: ws, active: true, currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true } }), accountBalances(db, ws)]);
      const cash = accs.reduce((s, a) => s.plus(bal.get(a.id) ?? ZERO), ZERO);
      const heavy = due.filter((o) => o.source === "card" || o.source === "debt");
      if (cash.lt(need)) out.push({ level: "urgent", title: `No te alcanza para lo que vence en 10 días: faltan ${f(need.minus(cash))}`, detail: `Vencen ${f(need)}${heavy.length ? ` (incluye ${heavy.map((o) => o.description).slice(0, 2).join(" y ")})` : ""} y en tus cuentas hay ${f(cash)}. Mirá qué podés mover o pagar en parte.`, href: "/app/proximos" });
    }
  }

  const week = new Date(today.getTime() + 7 * 864e5);
  const soon = open.filter((o) => !o.overdue && o.direction === "PAYABLE" && o.dueDate <= week);
  if (soon.length >= 3) out.push({ level: "info", title: `${soon.length} vencimientos en los próximos 7 días`, detail: `Suman ${f(soon.reduce((s, o) => s.plus(o.remaining), ZERO))}.`, href: "/app/proximos" });

  const debts = await db.debt.findMany({ where: { workspaceId: ws, status: "ACTIVE", cft: { not: null } }, orderBy: { cft: "desc" } });
  if (debts[0] && Number(debts[0].cft) > 100) out.push({ level: "warn", title: "Tenés una deuda cara", detail: `${debts[0].creditor} tiene un CFT de ${Number(debts[0].cft).toFixed(1).replace(".", ",")}%. Si podés, conviene pagarla primero.`, href: "/app/deudas" });

  // Tarjetas con aviso de uso del límite.
  if (await db.creditCard.count({ where: { workspaceId: ws, active: true, parentId: null, alertPct: { not: null } } })) {
    const { cardGroups } = await import("./cards");
    for (const g of (await cardGroups(db, ws, today)).filter((x) => x.card.active && x.overAlert)) out.push({ level: "warn", title: `${g.card.name}: usás el ${g.usagePct}% del límite`, detail: `Tu aviso es ${g.card.alertPct}%. Disponible: ${formatMoney(g.available, g.card.currency)}.`, href: `/app/tarjetas/${g.card.id}` });
  }

  const b = await budgetFor(db, ws, period(today), currency);
  const over = b.rows.filter((r) => r.pct != null && r.pct > 100);
  if (over.length) out.push({ level: "warn", title: "Te pasaste del presupuesto", detail: over.map((r) => `${r.name} ${Math.round(r.pct!)}%`).join(" · "), href: "/app/presupuestos" });

  const goals = (await goalsOverview(db, ws, today)).filter((g) => g.onTrack === false);
  if (goals.length) out.push({ level: "info", title: "Objetivos que no llegan a la fecha", detail: goals.map((g) => `${g.goal.name}: necesitás ${formatMoney(g.needed, g.goal.currency)} por mes`).join(" · "), href: "/app/objetivos" });

  if (!out.length) out.push({ level: "good", title: "Todo en orden", detail: "No hay atrasos ni meses en rojo en los próximos 6 meses.", href: "/app/flujo" });
  const surplus = rows.slice(1, 4).reduce((s, r) => s.plus(r.result), ZERO).dividedBy(3);
  if (surplus.gt(0)) out.push({ level: "good", title: "Capacidad de ahorro", detail: `En promedio te quedan ${f(surplus)} por mes en los próximos meses.`, href: "/app/objetivos" });
  return out;
}
