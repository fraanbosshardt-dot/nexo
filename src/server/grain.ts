// Ventas de cereal. Se guarda en toneladas y precio por tonelada; 1 t = 10 quintales.
// Cada venta crea su cobro: si ya se cobró, un ingreso; si no, un pendiente que entra en el flujo de caja.
import type { Db } from "./ledger";
import { recordMovement, UserError } from "./ledger";
import { dec, round2, type MoneyValue } from "@/lib/money";
import { period } from "@/lib/dates";

export function grainNet(s: { tonnes: MoneyValue; pricePerTonne: MoneyValue; fxRate?: MoneyValue | null; taxPct: MoneyValue; otherDeductions: MoneyValue }) {
  const gross = round2(dec(s.tonnes).times(dec(s.pricePerTonne)).times(s.fxRate ? dec(s.fxRate) : 1));
  const tax = round2(gross.times(dec(s.taxPct)).dividedBy(100));
  const other = round2(s.otherDeductions);
  return { gross, tax, other, net: gross.minus(tax).minus(other) };
}

export async function createGrainSale(
  db: Db,
  ws: string,
  input: { saleDate: Date; grain: string; tonnes: MoneyValue; pricePerTonne: MoneyValue; priceCurrency: string; fxRate?: MoneyValue | null; taxPct: MoneyValue; otherDeductions?: MoneyValue; collectDate: Date; accountId: string; collected: boolean; userId?: string | null },
) {
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
  const cat = await db.category.findFirst({ where: { workspaceId: ws, kind: "INCOME", name: "Venta de cereal", parentId: null } });
  const description = `Venta de ${input.grain.toLowerCase()} — ${dec(input.tonnes).times(10).toDecimalPlaces(2).toString().replace(".", ",")} qq`;
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
  const sale = await db.grainSale.create({
    data: { workspaceId: ws, saleDate: input.saleDate, grain: input.grain, tonnes: dec(input.tonnes).toFixed(3), pricePerTonne: round2(input.pricePerTonne).toFixed(2), priceCurrency: input.priceCurrency, fxRate: fx ? dec(fx).toFixed(6) : null, taxPct: tax.toFixed(3), otherDeductions: round2(input.otherDeductions ?? 0).toFixed(2), collectDate: input.collectDate, obligationId },
  });
  if (obligationId) await db.obligation.update({ where: { id: obligationId }, data: { sourceId: sale.id } });
  return sale;
}

export async function grainSales(db: Db, ws: string) {
  const sales = await db.grainSale.findMany({ where: { workspaceId: ws }, orderBy: { saleDate: "asc" } });
  const obs = await db.obligation.findMany({ where: { id: { in: sales.map((s) => s.obligationId).filter(Boolean) as string[] } } });
  const st = new Map(obs.map((o) => [o.id, o.status]));
  return sales.map((s) => ({ sale: s, ...grainNet(s), status: s.obligationId ? st.get(s.obligationId) ?? "PENDING" : "PENDING" }));
}
