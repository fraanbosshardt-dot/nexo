// Inversiones, bienes, cotizaciones y patrimonio neto.
// Una valuación cambia el patrimonio, nunca la caja. Aportar o retirar sí mueve dinero.
import type { Db } from "./ledger";
import { accountBalances, UserError } from "./ledger";
import { debtDetail } from "./debts";
import { dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";
import type Decimal from "decimal.js";

// ---------- Cotizaciones ----------

// Última cotización conocida "1 from = X to". Usa la cargada por el espacio o la global (API).
export async function latestRates(db: Db, ws: string, base: string) {
  const rows = await db.exchangeRate.findMany({ where: { OR: [{ workspaceId: ws }, { workspaceId: null }], quote: base }, orderBy: { fetchedAt: "desc" } });
  const map = new Map<string, { rate: Decimal; at: Date; source: string; kind: string }>();
  // Primero las manuales del espacio (ganan siempre), después las automáticas.
  const sorted = [...rows].sort((x, y) => Number(y.workspaceId === ws) - Number(x.workspaceId === ws) || y.fetchedAt.getTime() - x.fetchedAt.getTime());
  for (const r of sorted) if (!map.has(r.base)) map.set(r.base, { rate: dec(r.sell), at: r.fetchedAt, source: r.source, kind: r.kind });
  // Cruzadas desde el dólar: 1 C = (USD→base) / (USD→C).
  const usd = await db.exchangeRate.findMany({ where: { workspaceId: null, base: "USD", kind: "api" }, orderBy: { fetchedAt: "desc" }, take: 60 });
  const latest = new Map<string, (typeof usd)[number]>();
  for (const r of usd) if (!latest.has(r.quote)) latest.set(r.quote, r);
  const toBase = base === "USD" ? null : latest.get(base);
  if (toBase && !map.has("USD")) map.set("USD", { rate: dec(toBase.sell), at: toBase.fetchedAt, source: toBase.source, kind: "api" });
  for (const [code, r] of latest) {
    if (code === base || map.has(code)) continue;
    if (base === "USD") map.set(code, { rate: dec(1).dividedBy(dec(r.sell)), at: r.fetchedAt, source: r.source, kind: "api" });
    else if (toBase) map.set(code, { rate: dec(toBase.sell).dividedBy(dec(r.sell)), at: r.fetchedAt, source: r.source, kind: "api" });
  }
  return map;
}

export async function saveManualRate(db: Db, ws: string, from: string, to: string, rate: MoneyValue) {
  const r = dec(rate);
  if (!r.gt(0)) throw new UserError("La cotización tiene que ser mayor a cero.");
  if (from === to) throw new UserError("Elegí dos monedas distintas.");
  return db.exchangeRate.create({ data: { workspaceId: ws, base: from, quote: to, kind: "manual", sell: r.toFixed(6), source: "manual", fetchedAt: new Date() } });
}

// ---------- Inversiones ----------

export async function createInvestment(db: Db, ws: string, input: { name: string; kind: string; currency: string }) {
  if (!input.name.trim()) throw new UserError("Poné un nombre a la inversión.");
  return db.investment.create({ data: { workspaceId: ws, name: input.name.trim(), kind: input.kind, currency: input.currency } });
}

// Aporte (sale dinero de una cuenta) o retiro (entra dinero). No es gasto ni ingreso: es un movimiento de inversión.
export async function investmentMove(db: Db, ws: string, input: { investmentId: string; kind: "CONTRIBUTION" | "WITHDRAWAL"; accountId: string; amount: MoneyValue; date: Date; userId?: string | null }) {
  const inv = await db.investment.findFirst({ where: { id: input.investmentId, workspaceId: ws } });
  if (!inv) throw new UserError("No encontramos esa inversión.");
  const acc = await db.account.findFirst({ where: { id: input.accountId, workspaceId: ws, active: true } });
  if (!acc || acc.type === "CREDIT_CARD") throw new UserError("Elegí una cuenta de dinero.");
  if (acc.currency !== inv.currency) throw new UserError(`Elegí una cuenta en ${inv.currency}.`);
  const a = round2(input.amount);
  if (!a.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
  return db.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: { workspaceId: ws, accountId: acc.id, type: "INVESTMENT", direction: input.kind === "CONTRIBUTION" ? "OUT" : "IN", amount: a.toFixed(2), currency: acc.currency, description: `${input.kind === "CONTRIBUTION" ? "Aporte a" : "Retiro de"} ${inv.name}`, effectiveDate: input.date, economicPeriod: period(input.date), createdById: input.userId ?? null },
    });
    return tx.investmentMovement.create({ data: { investmentId: inv.id, kind: input.kind, amount: a.toFixed(2), date: input.date, transactionId: t.id } });
  });
}

export async function addValuation(db: Db, ws: string, input: { investmentId?: string; assetId?: string; value: MoneyValue; date: Date }) {
  const v = round2(input.value);
  if (v.lt(0)) throw new UserError("La valuación no puede ser negativa.");
  if (input.investmentId) {
    const inv = await db.investment.findFirst({ where: { id: input.investmentId, workspaceId: ws } });
    if (!inv) throw new UserError("No encontramos esa inversión.");
    return db.valuation.create({ data: { investmentId: inv.id, value: v.toFixed(2), currency: inv.currency, date: input.date } });
  }
  const as = await db.asset.findFirst({ where: { id: input.assetId, workspaceId: ws } });
  if (!as) throw new UserError("No encontramos ese bien.");
  return db.valuation.create({ data: { assetId: as.id, value: v.toFixed(2), currency: as.currency, date: input.date } });
}

export async function investmentsOverview(db: Db, ws: string) {
  const invs = await db.investment.findMany({ where: { workspaceId: ws }, include: { movements: { orderBy: { date: "desc" } }, valuations: { orderBy: { date: "desc" } } }, orderBy: { createdAt: "asc" } });
  return invs.map((i) => {
    const invested = i.movements.reduce((s, m) => (m.kind === "CONTRIBUTION" ? s.plus(dec(m.amount)) : m.kind === "WITHDRAWAL" ? s.minus(dec(m.amount)) : s), ZERO);
    const last = i.valuations[0];
    const value = last ? dec(last.value) : invested;
    const gain = value.minus(invested);
    return { inv: i, invested, value, gain, pct: invested.gt(0) ? gain.dividedBy(invested).times(100).toNumber() : null, valuedAt: last?.date ?? null };
  });
}

// ---------- Bienes ----------

export async function createAsset(db: Db, ws: string, input: { name: string; kind: string; currency: string; value: MoneyValue; date: Date; notes?: string | null }) {
  if (!input.name.trim()) throw new UserError("Poné un nombre al bien.");
  return db.$transaction(async (tx) => {
    const a = await tx.asset.create({ data: { workspaceId: ws, name: input.name.trim(), kind: input.kind, currency: input.currency, notes: input.notes?.trim() || null } });
    await tx.valuation.create({ data: { assetId: a.id, value: round2(input.value).toFixed(2), currency: input.currency, date: input.date } });
    return a;
  });
}

export async function assetsOverview(db: Db, ws: string) {
  const assets = await db.asset.findMany({ where: { workspaceId: ws, archivedAt: null }, include: { valuations: { orderBy: { date: "desc" } } }, orderBy: { createdAt: "asc" } });
  return assets.map((a) => ({ asset: a, value: a.valuations[0] ? dec(a.valuations[0].value) : ZERO, valuedAt: a.valuations[0]?.date ?? null }));
}

// ---------- Patrimonio neto ----------

export async function netWorth(db: Db, ws: string, base: string) {
  const [accounts, balances, invs, assets, debts, rates, stock] = await Promise.all([
    db.account.findMany({ where: { workspaceId: ws, active: true } }),
    accountBalances(db, ws),
    investmentsOverview(db, ws),
    assetsOverview(db, ws),
    db.debt.findMany({ where: { workspaceId: ws, status: "ACTIVE" } }),
    latestRates(db, ws, base),
    db.grainStock.findMany({ where: { workspaceId: ws }, orderBy: { grain: "asc" } }),
  ]);
  type Line = { group: "Dinero" | "Inversiones" | "Bienes" | "Tarjetas" | "Deudas"; name: string; currency: string; amount: Decimal };
  const lines: Line[] = [];
  for (const a of accounts) {
    const b = balances.get(a.id) ?? ZERO;
    if (a.type === "CREDIT_CARD") { if (b.lt(0)) lines.push({ group: "Tarjetas", name: a.name, currency: a.currency, amount: b }); }
    else lines.push({ group: a.type === "INVESTMENT" ? "Inversiones" : "Dinero", name: a.name, currency: a.currency, amount: b });
  }
  for (const i of invs) lines.push({ group: "Inversiones", name: i.inv.name, currency: i.inv.currency, amount: i.value });
  for (const a of assets) lines.push({ group: "Bienes", name: a.asset.name, currency: a.asset.currency, amount: a.value });
  // Cereal sin vender, al precio de referencia que cargaste.
  for (const g of stock) {
    const v = round2(dec(g.tonnes).times(dec(g.pricePerTonne)));
    if (v.gt(0)) lines.push({ group: "Bienes", name: `${g.grain} en stock (${dec(g.tonnes).times(10).toDecimalPlaces(0).toNumber().toLocaleString("es-AR")} qq)`, currency: g.currency, amount: v });
  }
  for (const d of debts) {
    const det = await debtDetail(db, ws, d.id);
    if (det && det.remainingCapital.gt(0)) lines.push({ group: "Deudas", name: d.creditor, currency: d.currency, amount: det.remainingCapital.neg() });
  }
  // Solo se suma lo que está en la moneda principal o tiene cotización cargada.
  const toBase = (l: Line) => (l.currency === base ? l.amount : rates.get(l.currency) ? round2(l.amount.times(rates.get(l.currency)!.rate)) : null);
  const withBase = lines.map((l) => ({ ...l, inBase: toBase(l) }));
  const assetsTotal = withBase.filter((l) => l.amount.gt(0) && l.inBase).reduce((s, l) => s.plus(l.inBase!), ZERO);
  const liabTotal = withBase.filter((l) => l.amount.lt(0) && l.inBase).reduce((s, l) => s.minus(l.inBase!), ZERO);
  const missing = [...new Set(withBase.filter((l) => !l.inBase && !l.amount.isZero()).map((l) => l.currency))];
  return { lines: withBase, assets: assetsTotal, liabilities: liabTotal, net: assetsTotal.minus(liabTotal), missingRates: missing, rates };
}
