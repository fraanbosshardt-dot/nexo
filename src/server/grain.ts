// Ventas de cereal. Se guarda en toneladas y precio por tonelada; 1 t = 10 quintales.
// Cada venta crea su cobro: si ya se cobró, un ingreso; si no, un pendiente que entra en el flujo de caja.
import type { Db } from "./ledger";
import { paidSoFar, payObligation, recordMovement, reverseTransaction, UserError } from "./ledger";
import { dec, round2, ZERO, type Money, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";
import { changeRuleFrom, createRule, endRule, materializeOccurrence, occurrences, projectedItems } from "./recurring";

export function grainNet(s: { tonnes: MoneyValue; pricePerTonne: MoneyValue; fxRate?: MoneyValue | null; taxPct: MoneyValue; otherDeductions: MoneyValue }) {
  const gross = round2(dec(s.tonnes).times(dec(s.pricePerTonne)).times(s.fxRate ? dec(s.fxRate) : 1));
  const tax = round2(gross.times(dec(s.taxPct)).dividedBy(100));
  const other = round2(s.otherDeductions);
  return { gross, tax, other, net: gross.minus(tax).minus(other) };
}

export type GrainInput = { saleDate: Date; grain: string; tonnes: MoneyValue; pricePerTonne: MoneyValue; priceCurrency: string; fxRate?: MoneyValue | null; taxPct: MoneyValue; otherDeductions?: MoneyValue; collectDate: Date; accountId: string; collected: boolean; userId?: string | null };

const describe = (grain: string, tonnes: MoneyValue) => `Venta de ${grain.toLowerCase()} — ${dec(tonnes).times(10).toDecimalPlaces(2).toString().replace(".", ",")} qq`;
const monthOf = (d: Date) => ({ from: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), to: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)) });
const REPLACED = "Reemplazada por la venta real de cereal";

// Revisa los datos y calcula el neto (lo mismo al crear y al editar).
async function prepare(db: Db, ws: string, input: GrainInput) {
  if (!dec(input.tonnes).gt(0)) throw new UserError("Ingresá la cantidad vendida.");
  if (!dec(input.pricePerTonne).gt(0)) throw new UserError("Ingresá el precio por tonelada.");
  const tax = dec(input.taxPct);
  if (tax.lt(0) || tax.gt(100)) throw new UserError("El impuesto tiene que estar entre 0% y 100%.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc) throw new UserError("Elegí la cuenta donde entra el dinero.");
  if (input.priceCurrency !== acc.currency && !input.fxRate) throw new UserError(`El precio está en ${input.priceCurrency} y la cuenta en ${acc.currency}: cargá la cotización.`);
  const fx = input.priceCurrency === acc.currency ? null : input.fxRate ?? null;
  const n = grainNet({ tonnes: input.tonnes, pricePerTonne: input.pricePerTonne, fxRate: fx, taxPct: input.taxPct, otherDeductions: input.otherDeductions ?? 0 });
  if (!n.net.gt(0)) throw new UserError("Con esos descuentos el neto queda en cero o menos.");
  return { acc, fx, n, tax };
}
const saleData = (input: GrainInput, fx: MoneyValue | null, tax: MoneyValue) => ({
  saleDate: input.saleDate, grain: input.grain, tonnes: dec(input.tonnes).toFixed(3), pricePerTonne: round2(input.pricePerTonne).toFixed(2), priceCurrency: input.priceCurrency,
  fxRate: fx ? dec(fx).toFixed(6) : null, taxPct: dec(tax).toFixed(3), otherDeductions: round2(input.otherDeductions ?? 0).toFixed(2), collectDate: input.collectDate,
});

export async function createGrainSale(db: Db, ws: string, input: GrainInput & { replacePlanned?: boolean }) {
  const { acc, fx, n, tax } = await prepare(db, ws, input);
  const cat = await grainCategory(db, ws);
  const description = describe(input.grain, input.tonnes);
  const r = await recordMovement(db, ws, {
    kind: "INCOME", description, amount: n.net, accountId: acc.id, categoryId: cat?.id ?? null,
    status: input.collected ? "PAID" : "PENDING", effectiveDate: input.collected ? input.collectDate : undefined, dueDate: input.collected ? undefined : input.collectDate,
    economicPeriod: period(input.saleDate), userId: input.userId,
  });
  let obligationId = r.obligationId;
  if (!obligationId && r.transactionId) {
    // Cobrada en el momento: se guarda igual la obligación saldada para poder seguir la venta.
    const ob = await db.obligation.create({ data: { workspaceId: ws, direction: "RECEIVABLE", description, amount: n.net.toFixed(2), currency: acc.currency, categoryId: cat?.id ?? null, dueDate: input.collectDate, economicPeriod: period(input.saleDate), status: "SETTLED", sourceType: "grain" } });
    await db.transaction.update({ where: { id: r.transactionId }, data: { obligationId: ob.id } });
    obligationId = ob.id;
  } else if (obligationId) {
    await db.obligation.update({ where: { id: obligationId }, data: { sourceType: "grain" } });
  }
  const sale = await db.grainSale.create({ data: { workspaceId: ws, ...saleData(input, fx, tax), obligationId } });
  if (obligationId) await db.obligation.update({ where: { id: obligationId }, data: { sourceId: sale.id } });
  if (input.replacePlanned !== false) await replacePlannedGrain(db, ws, input.collectDate);
  return sale;
}

async function saleWithCollection(db: Db, ws: string, id: string) {
  const sale = await db.grainSale.findFirst({ where: { id, workspaceId: ws } });
  if (!sale) throw new UserError("No encontramos esa venta.");
  const ob = sale.obligationId ? await db.obligation.findFirst({ where: { id: sale.obligationId, workspaceId: ws }, include: { payments: { include: { reversedBy: true } } } }) : null;
  // Cobros que siguen valiendo (sin anular).
  const live = ob ? ob.payments.filter((p) => !p.reversalOfId && !p.reversedBy) : [];
  return { sale, ob, live, paid: ob ? paidSoFar(ob) : ZERO };
}

// Editar una venta. Si está por cobrar, se actualiza el cobro esperado. Si ya se cobró de una vez, se corrige
// también ese ingreso (monto, fecha y cuenta), así el saldo queda bien. Si se cobró en parte, el neto no puede
// quedar por debajo de lo ya cobrado.
export async function updateGrainSale(db: Db, ws: string, id: string, input: GrainInput) {
  const { sale, ob, live, paid } = await saleWithCollection(db, ws, id);
  const { acc, fx, n, tax } = await prepare(db, ws, input);
  const description = describe(input.grain, input.tonnes);
  const net = n.net.toFixed(2);
  const econ = period(input.saleDate);
  await db.$transaction(async (tx) => {
    if (ob && ob.status !== "CANCELLED") {
      if (ob.status === "SETTLED" && live.length === 1) {
        await tx.transaction.update({ where: { id: live[0].id }, data: { amount: net, currency: acc.currency, accountId: acc.id, effectiveDate: input.collectDate, economicPeriod: econ, description } });
        await tx.obligation.update({ where: { id: ob.id }, data: { amount: net, currency: acc.currency, description, dueDate: input.collectDate, economicPeriod: econ } });
      } else {
        if (paid.gt(n.net)) throw new UserError(`Ya cobraste ${paid.toFixed(2)} de esta venta: el neto no puede quedar por debajo.`);
        if (paid.gt(0) && acc.currency !== ob.currency) throw new UserError(`Ya hay cobros en ${ob.currency}: elegí una cuenta en esa moneda.`);
        const status = paid.gte(n.net) ? "SETTLED" : paid.gt(0) ? "PARTIAL" : "PENDING";
        await tx.obligation.update({ where: { id: ob.id }, data: { amount: net, currency: acc.currency, description, dueDate: input.collectDate, economicPeriod: econ, status } });
      }
    }
    await tx.grainSale.update({ where: { id: sale.id }, data: saleData(input, fx, tax) });
  });
  // "Ya la cobré" en una venta que seguía pendiente: se registra el cobro de lo que falta.
  if (input.collected && ob && ob.status !== "CANCELLED") {
    const fresh = await db.obligation.findUniqueOrThrow({ where: { id: ob.id }, include: { payments: true } });
    const left = dec(fresh.amount).minus(paidSoFar(fresh));
    if (fresh.status !== "SETTLED" && left.gt(0)) await payObligation(db, ws, { obligationId: ob.id, accountId: acc.id, amount: left, date: input.collectDate, userId: input.userId });
  }
  // Si cambió el mes de cobro, la venta prevista vuelve al mes viejo y se reemplaza en el nuevo.
  await restorePlannedGrain(db, ws, sale.collectDate);
  await replacePlannedGrain(db, ws, input.collectDate);
  return db.grainSale.findUniqueOrThrow({ where: { id: sale.id } });
}

// Borrar una venta: se anula lo que ya se haya cobrado (el saldo de la cuenta vuelve a como estaba), el cobro
// pendiente deja de contar y, si esa venta reemplazaba a la prevista del mes, la prevista vuelve.
export async function deleteGrainSale(db: Db, ws: string, id: string, userId?: string | null) {
  const { sale, ob, live } = await saleWithCollection(db, ws, id);
  const reversed = live.reduce((a, p) => a.plus(p.direction === "IN" ? dec(p.amount) : dec(p.amount).neg()), ZERO);
  for (const p of live) await reverseTransaction(db, ws, p.id, userId);
  await db.$transaction(async (tx) => {
    if (ob) await tx.obligation.update({ where: { id: ob.id }, data: { status: "CANCELLED", notes: "Venta de cereal borrada" } });
    await tx.grainSale.delete({ where: { id: sale.id } });
  });
  await restorePlannedGrain(db, ws, sale.collectDate);
  return { reversed };
}

export async function grainSales(db: Db, ws: string) {
  const sales = await db.grainSale.findMany({ where: { workspaceId: ws }, orderBy: { saleDate: "asc" } });
  const obs = await db.obligation.findMany({ where: { id: { in: sales.map((s) => s.obligationId).filter(Boolean) as string[] } }, include: { payments: true } });
  const byId = new Map(obs.map((o) => [o.id, o]));
  return sales.map((s) => {
    const o = s.obligationId ? byId.get(s.obligationId) : undefined;
    return { sale: s, ...grainNet(s), status: o?.status ?? "PENDING", paid: o ? paidSoFar(o) : ZERO };
  });
}

// ---------- Una sola lista por mes ----------
// Para el productor hay "ventas": las cargadas, las estimadas (meses sin venta, de la venta mensual) y los cobros de
// una estimada que se registraron sin cargar la venta (sin quintales ni precio).

type Sale = Awaited<ReturnType<typeof grainSales>>[number];
export type GrainRow =
  | { kind: "sale"; date: Date; s: Sale }
  | { kind: "estimated"; date: Date; amount: Money; currency: string }
  | { kind: "noDetail"; date: Date; amount: Money; paid: Money; currency: string; obligationId: string; settled: boolean };

export async function grainTimeline(db: Db, ws: string, today: Date, monthsAhead = 6) {
  const sales = await grainSales(db, ws);
  const rows: GrainRow[] = sales.map((s) => ({ kind: "sale", date: s.sale.collectDate, s }));
  const cat = await db.category.findFirst({ where: { workspaceId: ws, kind: "INCOME", name: GRAIN_CATEGORY, parentId: null } });
  const ruleIds = cat ? (await db.recurringRule.findMany({ where: { workspaceId: ws, direction: "RECEIVABLE", categoryId: cat.id }, select: { id: true } })).map((r) => r.id) : [];
  if (ruleIds.length) {
    const taken = new Set(sales.map((s) => period(s.sale.collectDate)));
    const obs = await db.obligation.findMany({ where: { workspaceId: ws, recurringRuleId: { in: ruleIds }, status: { not: "CANCELLED" } }, include: { payments: true }, orderBy: { dueDate: "asc" } });
    for (const o of obs) {
      const paid = paidSoFar(o);
      if (paid.gt(0)) rows.push({ kind: "noDetail", date: o.dueDate, amount: dec(o.amount), paid, currency: o.currency, obligationId: o.id, settled: o.status === "SETTLED" });
      else if (!taken.has(period(o.dueDate))) { rows.push({ kind: "estimated", date: o.dueDate, amount: dec(o.amount), currency: o.currency }); taken.add(period(o.dueDate)); }
    }
    const from = monthOf(today).from;
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthsAhead + 1, 0));
    for (const p of await projectedItems(db, ws, from, to)) {
      if (!ruleIds.includes(p.ruleId) || taken.has(period(p.dueDate))) continue;
      rows.push({ kind: "estimated", date: p.dueDate, amount: p.amount, currency: p.currency });
      taken.add(period(p.dueDate));
    }
  }
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { sales, rows };
}

// Un cobro pendiente que sale de la venta mensual (todavía sin tocar): se completa cargando la venta, no con un cobro suelto.
export function isEstimatedGrain(o: { direction: string; status: string; recurringRuleId?: string | null; category?: string | null; paid?: MoneyValue }) {
  return o.direction === "RECEIVABLE" && o.status === "PENDING" && !!o.recurringRuleId && o.category === GRAIN_CATEGORY && !(o.paid && dec(o.paid).gt(0));
}
export const loadSaleHref = (d: Date) => `/app/cereal?cargar=${d.toISOString().slice(0, 10)}#cargar`;

// ---------- Venta mensual prevista ----------
// Quien vende cereal todos los meses carga una "venta prevista" mensual (monto aproximado). Se proyecta como
// cobro que se repite; cuando carga la venta real, reemplaza a la prevista de ese mes para no contarla dos veces.

export const GRAIN_CATEGORY = "Venta de cereal";

async function grainCategory(db: Db, ws: string) {
  return (await db.category.findFirst({ where: { workspaceId: ws, kind: "INCOME", name: GRAIN_CATEGORY, parentId: null } }))
    ?? (await db.category.create({ data: { workspaceId: ws, kind: "INCOME", name: GRAIN_CATEGORY } }));
}

// Ventas mensuales vigentes después de "today". Si se terminó hoy ("Dejar de proyectar"), ya no cuenta.
export async function monthlyGrainRules(db: Db, ws: string, today: Date) {
  const cat = await db.category.findFirst({ where: { workspaceId: ws, kind: "INCOME", name: "Venta de cereal", parentId: null } });
  if (!cat) return [];
  return db.recurringRule.findMany({ where: { workspaceId: ws, direction: "RECEIVABLE", categoryId: cat.id, OR: [{ endDate: null }, { endDate: { gt: today } }] }, orderBy: { createdAt: "asc" } });
}

export async function setupMonthlyGrain(db: Db, ws: string, input: { day: number; amount: MoneyValue; accountId: string; today: Date }) {
  if (!(input.day >= 1 && input.day <= 31)) throw new UserError("El día del mes va del 1 al 31.");
  if (!dec(input.amount).gt(0)) throw new UserError("Poné un monto aproximado por mes.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc) throw new UserError("Elegí la cuenta donde entra el dinero.");
  if ((await monthlyGrainRules(db, ws, input.today)).length) throw new UserError("Ya tenés una venta mensual prevista. Cambiala desde acá mismo.");
  const cat = await grainCategory(db, ws);
  const y = input.today.getUTCFullYear(), m = input.today.getUTCMonth();
  const at = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, Math.min(input.day, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())));
  const first = at(y, m) >= input.today ? at(y, m) : at(y, m + 1);
  const rule = await createRule(db, ws, { direction: "RECEIVABLE", description: "Venta de cereal (prevista)", amount: input.amount, currency: acc.currency, categoryId: cat.id, accountId: acc.id, frequency: "MONTHLY", dayOfMonth: input.day, startDate: first, variableAmount: true });
  // Las ventas que ya estaban cargadas (por cobrar o cobradas) ocupan su mes: ahí no se suma la prevista.
  await coverMonthsWithSales(db, ws, input.today);
  return rule;
}

// Cambiar la venta mensual desde hoy (monto, día y cuenta). Lo pasado no cambia.
export async function changeMonthlyGrain(db: Db, ws: string, ruleId: string, input: { day: number; amount: MoneyValue; accountId: string; today: Date }) {
  if (!(input.day >= 1 && input.day <= 31)) throw new UserError("El día del mes va del 1 al 31.");
  if (!dec(input.amount).gt(0)) throw new UserError("Poné un monto aproximado por mes.");
  const rule = (await monthlyGrainRules(db, ws, input.today)).find((r) => r.id === ruleId);
  if (!rule) throw new UserError("No encontramos la venta mensual.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc) throw new UserError("Elegí la cuenta donde entra el dinero.");
  if (acc.currency !== rule.currency) throw new UserError(`Elegí una cuenta en ${rule.currency}.`);
  const next = await changeRuleFrom(db, ws, rule.id, input.today, { amount: input.amount, dayOfMonth: input.day });
  await db.recurringRule.update({ where: { id: next.id }, data: { accountId: acc.id } });
  await coverMonthsWithSales(db, ws, input.today);
  return next;
}

// Dejar de proyectar: la venta mensual termina hoy. Las ventas reales quedan como están.
export async function stopMonthlyGrain(db: Db, ws: string, ruleId: string, today: Date) {
  const rule = (await monthlyGrainRules(db, ws, today)).find((r) => r.id === ruleId);
  if (!rule) throw new UserError("No encontramos la venta mensual.");
  return endRule(db, ws, rule.id, today);
}

// En cada mes (desde este) que ya tiene una venta real, la prevista no se suma.
async function coverMonthsWithSales(db: Db, ws: string, today: Date) {
  const sales = await db.grainSale.findMany({ where: { workspaceId: ws, collectDate: { gte: monthOf(today).from } }, select: { collectDate: true } });
  const months = [...new Map(sales.map((s) => [period(s.collectDate), s.collectDate])).values()];
  for (const d of months) await replacePlannedGrain(db, ws, d);
}

// La venta real reemplaza a la prevista del mes en que se cobra (si todavía no se cobró ni se tocó).
export async function replacePlannedGrain(db: Db, ws: string, collectDate: Date) {
  const { from, to } = monthOf(collectDate);
  const rules = await monthlyGrainRules(db, ws, from);
  let replaced = 0;
  for (const r of rules) {
    const occ = occurrences(r, from, to)[0];
    if (!occ) continue;
    const id = await materializeOccurrence(db, ws, r.id, occ);
    const ob = await db.obligation.findFirst({ where: { id, workspaceId: ws }, include: { payments: true } });
    if (!ob || ob.status !== "PENDING" || ob.payments.length) continue; // ya cobrada o tocada: no se cambia
    await db.obligation.update({ where: { id }, data: { status: "CANCELLED", notes: REPLACED } });
    replaced++;
  }
  return replaced;
}

// Si en ese mes ya no queda ninguna venta real, la prevista que se había reemplazado vuelve a contar.
export async function restorePlannedGrain(db: Db, ws: string, collectDate: Date) {
  const { from, to } = monthOf(collectDate);
  if (await db.grainSale.count({ where: { workspaceId: ws, collectDate: { gte: from, lte: to } } })) return 0;
  const rules = await monthlyGrainRules(db, ws, from);
  if (!rules.length) return 0;
  const r = await db.obligation.updateMany({
    where: { workspaceId: ws, recurringRuleId: { in: rules.map((x) => x.id) }, status: "CANCELLED", notes: REPLACED, dueDate: { gte: from, lte: to } },
    data: { status: "PENDING", notes: null },
  });
  return r.count;
}

// Ventas cargadas antes de crear la venta mensual: nunca tuvieron la opción de reemplazarla, así que su mes se
// contaba dos veces. Se corrige una sola vez (es idempotente: si ya está reemplazada, no hace nada).
export async function coverOlderSales(db: Db, ws: string, today: Date) {
  const rules = await monthlyGrainRules(db, ws, monthOf(today).from);
  if (!rules.length) return 0;
  // Desde la primera vez que se creó (aunque después se haya cambiado y haya versiones nuevas).
  const first = await db.recurringRule.findFirst({ where: { workspaceId: ws, direction: "RECEIVABLE", categoryId: rules[0].categoryId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const since = first?.createdAt ?? rules[0].createdAt;
  const sales = await db.grainSale.findMany({ where: { workspaceId: ws, createdAt: { lt: since }, collectDate: { gte: monthOf(today).from } }, select: { collectDate: true } });
  let n = 0;
  for (const s of sales) n += await replacePlannedGrain(db, ws, s.collectDate);
  return n;
}
