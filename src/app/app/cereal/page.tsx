import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { coverOlderSales, grainSales, monthlyGrainRules } from "@/server/grain";
import { occurrences } from "@/server/recurring";
import { dec, formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { ProGate } from "@/components/pro";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { changeMonthlyGrainAction, deleteGrainSaleAction, grainSaleAction, monthlyGrainAction, stopMonthlyGrainAction } from "@/app/actions/modules";
import { GrainForm } from "./grain-form";

export const metadata: Metadata = { title: "Ventas de cereal" };

const LISTO: Record<string, string> = {
  editada: "Listo, la venta quedó actualizada.",
  borrada: "Listo, borramos la venta. Ya no cuenta en Próximos pagos ni en el flujo.",
  "borrada-cobrada": "Listo, borramos la venta y anulamos su cobro: el saldo de la cuenta volvió a como estaba.",
  "mensual-cambiada": "Listo, la venta mensual cambió desde hoy.",
  "mensual-terminada": "Listo, la venta mensual dejó de proyectarse. Tus ventas reales quedan como estaban.",
};

export default async function Grain({ searchParams }: { searchParams: Promise<{ u?: string; mensual?: string; listo?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) return <ProGate crumb="Mi dinero" title="Ventas de cereal" text="Para productores: cargá cada venta en quintales o toneladas, con precio por tonelada e impuesto al cheque. El neto se suma solo a tus ingresos." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const sp = await searchParams;
  const unit = sp.u === "t" ? "t" : "qq";
  const db = getDb();
  const today = todayIn(workspace.timezone);
  // Ventas cargadas antes de la venta mensual: su mes no se cuenta dos veces.
  await coverOlderSales(db, workspace.id, today);
  const [sales, accounts, monthly] = await Promise.all([grainSales(db, workspace.id), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } }), monthlyGrainRules(db, workspace.id, today)]);
  const plan0 = monthly[0];
  const cur = workspace.baseCurrency;
  const qty = (t: unknown) => `${dec(t as string).times(unit === "qq" ? 10 : 1).toDecimalPlaces(2).toNumber().toLocaleString("es-AR")} ${unit}`;
  const sold = sales.reduce((s, x) => s.plus(x.sale.tonnes.toString()), ZERO);
  const collected = sales.reduce((a, s) => a.plus(s.status === "SETTLED" ? s.net : s.paid), ZERO);
  const pending = sales.reduce((a, s) => a.plus(s.status === "SETTLED" ? ZERO : s.net.minus(s.paid)), ZERO);
  // Próxima venta prevista: se saltean los meses que ya tienen una venta real.
  const realMonths = new Set(sales.map((s) => period(s.sale.collectDate)));
  const nextPlanned = plan0 ? occurrences(plan0, today, new Date(today.getTime() + 400 * 864e5)).find((o) => !realMonths.has(period(o))) ?? null : null;
  const accOpts = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  const stateOf = (s: (typeof sales)[number]) => s.status === "SETTLED" ? <span className="pill g">Cobrada</span>
    : <Link className={`pill ${s.sale.collectDate < today ? "r" : ""}`} href={`/app/proximos/${s.sale.obligationId}`}>{s.status === "PARTIAL" ? "Cobrada en parte" : s.sale.collectDate < today ? "Atrasada" : "Por cobrar"} · registrar</Link>;
  const actions = (s: (typeof sales)[number]) => {
    const cobrado = s.status === "SETTLED" ? s.net : s.paid;
    const q = cobrado.gt(0)
      ? `¿Borrar la venta de ${s.sale.grain.toLowerCase()}? Se anula el cobro de ${formatMoney(cobrado, cur)} y el saldo de la cuenta baja.`
      : `¿Borrar la venta de ${s.sale.grain.toLowerCase()}? Deja de contar en Próximos pagos y en el flujo.`;
    return (
      <div className="gr-acts">
        <Link className="btn sm" href={`/app/cereal/${s.sale.id}`}>Editar</Link>
        <form action={deleteGrainSaleAction}><input type="hidden" name="id" value={s.sale.id} /><ConfirmSubmit className="btn sm ghost" question={q} yes="Sí, borrar" ariaLabel={`Borrar la venta de ${s.sale.grain} de ${fmtDate(s.sale.saleDate)}`}>Borrar</ConfirmSubmit></form>
      </div>
    );
  };

  return (
    <>
      <PageHead crumb="Mi dinero" title="Ventas de cereal" desc="El neto de cada venta se suma a tus ingresos."
        actions={<div className="seg"><Link className={`segl ${unit === "qq" ? "on" : ""}`} href="/app/cereal">Quintales</Link><Link className={`segl ${unit === "t" ? "on" : ""}`} href="/app/cereal?u=t">Toneladas</Link></div>} />
      {sp.mensual && <p className="notice g" role="status">Listo: la venta mensual ya se proyecta en Próximos pagos, el calendario y el flujo de caja.</p>}
      {sp.listo && LISTO[sp.listo] && <p className="notice g" role="status">{LISTO[sp.listo]}</p>}

      <div className="card">
        <div className="chead"><div><h3>Venta mensual</h3><p className="sub">Si vendés todos los meses, cargá un monto aproximado: así ves la plata que va a entrar en los meses que vienen.</p></div></div>
        {plan0 ? (
          <>
            <dl className="kv">
              <dt>Todos los meses, el día</dt><dd>{plan0.dayOfMonth}</dd>
              <dt>Monto aproximado</dt><dd>{formatMoney(plan0.amount, plan0.currency)}</dd>
              {nextPlanned && <><dt>Próxima</dt><dd>{fmtDate(nextPlanned)}</dd></>}
            </dl>
            <p className="sub" style={{ marginTop: 10 }}>Cuando cargás una venta real, reemplaza a la prevista de ese mes: no se cuenta dos veces.</p>
            <div className="gr-month-acts">
              <details className="more">
                <summary>Cambiar monto, día o cuenta</summary>
                <ActionForm action={changeMonthlyGrainAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end", paddingTop: 10 }}>
                  <input type="hidden" name="ruleId" value={plan0.id} />
                  <label className="field" style={{ flex: "0 1 130px" }}>Día del mes<input name="day" inputMode="numeric" defaultValue={plan0.dayOfMonth ?? ""} /></label>
                  <label className="field" style={{ flex: "1 1 180px" }}>Monto aproximado por mes<input name="amount" inputMode="decimal" defaultValue={dec(plan0.amount).toFixed(2).replace(".", ",")} /></label>
                  <label className="field" style={{ flex: "1 1 180px" }}>Entra en<select name="accountId" defaultValue={plan0.accountId ?? undefined}>{accounts.filter((a) => a.currency === plan0.currency).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
                  <Submit>Guardar desde hoy</Submit>
                </ActionForm>
              </details>
              <form action={stopMonthlyGrainAction}><input type="hidden" name="ruleId" value={plan0.id} /><ConfirmSubmit className="btn sm ghost" question="¿Dejar de proyectar la venta mensual? Tus ventas reales quedan como están." yes="Sí, dejar de proyectar">Dejar de proyectar</ConfirmSubmit></form>
            </div>
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
        <div className="card">
          {/* Compu: tabla. Celular: una tarjeta por venta. */}
          <div className="tw gr-table"><table>
            <thead><tr><th>Mes</th><th>Cereal</th><th className="n">{unit === "qq" ? "Quintales" : "Toneladas"}</th><th className="n">Precio por tonelada</th><th className="n pq">Precio por quintal</th><th className="n">Impuesto al cheque</th><th className="n">Neto</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{sales.map((s) => {
              const pt = dec(s.sale.pricePerTonne).times(s.sale.fxRate ? dec(s.sale.fxRate) : 1);
              return (
                <tr key={s.sale.id}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(period(s.sale.saleDate))}</td><td>{s.sale.grain}</td><td className="n">{qty(s.sale.tonnes)}</td><td className="n">{formatMoney(pt, cur)}</td><td className="n pq">{formatMoney(pt.dividedBy(10), cur)}</td><td className="n">{formatMoney(s.tax.neg(), cur)}</td><td className="n"><b>{formatMoney(s.net, cur)}</b></td>
                  <td>{stateOf(s)}</td><td>{actions(s)}</td></tr>
              );
            })}
              <tr className="tot"><td>Total</td><td /><td className="n">{qty(sold)}</td><td /><td className="pq" /><td className="n">{formatMoney(sales.reduce((a, s) => a.plus(s.tax), ZERO).neg(), cur)}</td><td className="n">{formatMoney(collected.plus(pending), cur)}</td><td /><td /></tr>
            </tbody>
          </table></div>
          <div className="list gr-cards">{sales.map((s) => (
            <div className="gr-card" key={s.sale.id}>
              <div className="gr-card-top">
                <div><b>{s.sale.grain} · {qty(s.sale.tonnes)}</b><small>Vendida en {fmtPeriod(period(s.sale.saleDate))} · se cobra el {fmtDate(s.sale.collectDate)}</small></div>
                <b className="num pos">{formatMoney(s.net, cur)}</b>
              </div>
              <div className="gr-card-bot">{stateOf(s)}{actions(s)}</div>
            </div>
          ))}</div>
        </div>
      )}

      <div className="card">
        <details className="more" open={sales.length === 0}>
          <summary>+ Nueva venta</summary>
          <GrainForm action={grainSaleAction} mode="new" accounts={accOpts} cur={cur} showReplace={!!plan0} submit="Guardar venta"
            d={{ saleDate: isoDate(today), grain: "Soja", quantity: "", unit, price: "", priceCurrency: cur, taxPct: "1,2", other: "", fxRate: "", collectDate: isoDate(today) }} />
        </details>
      </div>
    </>
  );
}
