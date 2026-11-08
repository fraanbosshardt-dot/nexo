import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { grainSales, monthlyGrainRules } from "@/server/grain";
import { nextOccurrence } from "@/server/recurring";
import { dec, formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { ProGate } from "@/components/pro";
import { grainSaleAction, monthlyGrainAction } from "@/app/actions/modules";
import { CURRENCIES } from "@/lib/countries";

export const metadata: Metadata = { title: "Ventas de cereal" };
const GRAINS = ["Soja", "Maíz", "Trigo", "Girasol", "Sorgo", "Cebada", "Otro"];

export default async function Grain({ searchParams }: { searchParams: Promise<{ u?: string; mensual?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) return <ProGate crumb="Mi dinero" title="Ventas de cereal" text="Para productores: cargá cada venta en quintales o toneladas, con precio por tonelada e impuesto al cheque. El neto se suma solo a tus ingresos." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const sp = await searchParams;
  const unit = sp.u === "t" ? "t" : "qq";
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [sales, accounts, monthly] = await Promise.all([grainSales(db, workspace.id), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } }), monthlyGrainRules(db, workspace.id, today)]);
  const plan0 = monthly[0];
  const nextPlanned = plan0 ? nextOccurrence(plan0, today) : null;
  const cur = workspace.baseCurrency;
  const qty = (t: unknown) => `${dec(t as string).times(unit === "qq" ? 10 : 1).toDecimalPlaces(2).toNumber().toLocaleString("es-AR")} ${unit}`;
  const sold = sales.reduce((s, x) => s.plus(x.sale.tonnes.toString()), ZERO);
  const collected = sales.filter((s) => s.status === "SETTLED").reduce((a, s) => a.plus(s.net), ZERO);
  const pending = sales.filter((s) => s.status !== "SETTLED").reduce((a, s) => a.plus(s.net), ZERO);
  return (
    <>
      <PageHead crumb="Mi dinero" title="Ventas de cereal" desc="El neto de cada venta se suma a tus ingresos."
        actions={<div className="seg"><Link className={`segl ${unit === "qq" ? "on" : ""}`} href="/app/cereal">Quintales</Link><Link className={`segl ${unit === "t" ? "on" : ""}`} href="/app/cereal?u=t">Toneladas</Link></div>} />
      {sp.mensual && <p className="notice g" role="status">Listo: la venta mensual ya se proyecta en Próximos pagos, el calendario y el flujo de caja.</p>}
      <div className="card">
        <div className="chead"><div><h3>Venta mensual</h3><p className="sub">Si vendés todos los meses, cargá un monto aproximado: así ves la plata que va a entrar en los meses que vienen.</p></div></div>
        {plan0 ? (
          <>
            <dl className="kv">
              <dt>Todos los meses, el día</dt><dd>{plan0.dayOfMonth}</dd>
              <dt>Monto aproximado</dt><dd>{formatMoney(plan0.amount, plan0.currency)}</dd>
              {nextPlanned && <><dt>Próxima</dt><dd>{fmtDate(nextPlanned)}</dd></>}
            </dl>
            <p className="sub" style={{ marginTop: 10 }}>Cuando cargás una venta real, reemplaza a la prevista de ese mes: no se cuenta dos veces. Para cambiar el monto o el día, entrá a <Link className="lnk" href="/app/recurrentes">Pagos que se repiten</Link>.</p>
          </>
        ) : (
          <ActionForm action={monthlyGrainAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "0 1 130px" }}>Día del mes<input name="day" inputMode="numeric" placeholder="Ej.: 15" /></label>
            <label className="field" style={{ flex: "1 1 180px" }}>Monto aproximado por mes<input name="amount" inputMode="decimal" placeholder="Lo que suele quedarte" /></label>
            <label className="field" style={{ flex: "1 1 180px" }}>Entra en<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
            <Submit>Proyectar venta mensual</Submit>
          </ActionForm>
        )}
      </div>
      {sales.length > 0 && <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}><Stat label="Vendido" value={qty(sold)} /><Stat label="Cobrado" value={formatMoney(collected, cur)} tone="pos" /><Stat label="Falta cobrar" value={formatMoney(pending, cur)} /></div>}
      {sales.length > 0 && (
        <div className="card"><div className="tw"><table>
          <thead><tr><th>Mes</th><th>Cereal</th><th className="n">{unit === "qq" ? "Quintales" : "Toneladas"}</th><th className="n">Precio por tonelada</th><th className="n">Precio por quintal</th><th className="n">Impuesto al cheque</th><th className="n">Neto</th><th>Estado</th></tr></thead>
          <tbody>{sales.map((s) => {
            const pt = dec(s.sale.pricePerTonne).times(s.sale.fxRate ? dec(s.sale.fxRate) : 1);
            return (
              <tr key={s.sale.id}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(period(s.sale.saleDate))}</td><td>{s.sale.grain}</td><td className="n">{qty(s.sale.tonnes)}</td><td className="n">{formatMoney(pt, cur)}</td><td className="n">{formatMoney(pt.dividedBy(10), cur)}</td><td className="n">{formatMoney(s.tax.neg(), cur)}</td><td className="n"><b>{formatMoney(s.net, cur)}</b></td>
                <td>{s.status === "SETTLED" ? <span className="pill g">Cobrada</span> : <Link className={`pill ${s.sale.collectDate < today ? "r" : ""}`} href={`/app/proximos/${s.sale.obligationId}`}>{s.sale.collectDate < today ? "Atrasada" : "Por cobrar"} · registrar</Link>}</td></tr>
            );
          })}
            <tr className="tot"><td>Total</td><td /><td className="n">{qty(sold)}</td><td /><td /><td className="n">{formatMoney(sales.reduce((a, s) => a.plus(s.tax), ZERO).neg(), cur)}</td><td className="n">{formatMoney(collected.plus(pending), cur)}</td><td /></tr>
          </tbody>
        </table></div></div>
      )}
      <div className="card">
        <details className="more" open={sales.length === 0}>
          <summary>+ Nueva venta</summary>
          <ActionForm action={grainSaleAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 680 }}>
            <div className="frow"><label className="field">Fecha de venta<input name="saleDate" type="date" defaultValue={isoDate(today)} /></label><label className="field">Cereal<select name="grain">{GRAINS.map((g) => <option key={g}>{g}</option>)}</select></label></div>
            <div className="frow"><label className="field">Cantidad<input name="quantity" inputMode="decimal" placeholder="0" /></label><label className="field">En<select name="unit" defaultValue={unit}><option value="qq">Quintales</option><option value="t">Toneladas</option></select></label></div>
            <div className="frow"><label className="field">Precio por tonelada<input name="price" inputMode="decimal" placeholder="0,00" /></label><label className="field">Moneda del precio<select name="priceCurrency" defaultValue={cur}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label></div>
            <div className="frow"><label className="field">Impuesto al cheque (%)<input name="taxPct" inputMode="decimal" defaultValue="1,2" /></label><label className="field">Otros descuentos (opcional)<input name="other" inputMode="decimal" placeholder="Comisión, flete, secada…" /></label></div>
            <label className="field">Cotización (solo si el precio está en otra moneda)<input name="fxRate" inputMode="decimal" placeholder={`¿Cuántos ${cur} por unidad?`} /></label>
            <div className="frow"><label className="field">Se cobra el<input name="collectDate" type="date" defaultValue={isoDate(today)} /></label><label className="field">Entra en<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label></div>
            <label className="simtg"><input type="checkbox" name="collected" /><span>Ya la cobré</span></label>
            {plan0 ? <label className="simtg"><input type="checkbox" name="replacePlanned" defaultChecked /><span>Reemplaza a la venta prevista de ese mes (recomendado, para no contarla dos veces)</span></label> : <input type="hidden" name="replacePlanned" value="on" />}
            <p className="sub">1 tonelada = 10 quintales. El impuesto se calcula sobre el total bruto.</p>
            <div><Submit>Guardar venta</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
