import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { assetsOverview, netWorth } from "@/server/wealth";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createAssetAction, rateAction, valuationAction } from "@/app/actions/modules";
import { CURRENCIES } from "@/lib/countries";

export const metadata: Metadata = { title: "Patrimonio neto" };
const GROUPS = ["Dinero", "Inversiones", "Bienes", "Tarjetas", "Deudas"] as const;

export default async function NetWorth() {
  const { workspace, modules } = await requireWorkspace();
  const db = getDb();
  const cur = workspace.baseCurrency;
  const [nw, assets] = await Promise.all([netWorth(db, workspace.id, cur), assetsOverview(db, workspace.id)]);
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  return (
    <>
      <PageHead crumb="Patrimonio" title="Patrimonio neto" desc="Todo lo que tenés menos todo lo que debés. Las fechas de cobro y pago no lo cambian; las valuaciones sí." />
      <div className="card hero">
        <div><div className="lbl">Patrimonio neto</div><div className={`big ${nw.net.isNegative() ? "neg" : ""}`}>{fm(nw.net)}</div><p className="sub">En {cur}, con las cotizaciones que cargaste.</p></div>
        <div className="hero-side"><div className="hrow"><span>Lo que tenés</span><b>{fm(nw.assets)}</b></div><div className="hrow"><span>Lo que debés</span><b>{fm(nw.liabilities.neg())}</b></div></div>
      </div>
      {nw.missingRates.length > 0 && (
        <div className="card"><div className="notice"><div>Para sumar lo que tenés en <b>{nw.missingRates.join(", ")}</b>, cargá su cotización. Sin ella no lo mezclamos con tus {cur}.</div></div>
          <ActionForm action={rateAction} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
            <label className="field" style={{ flex: "0 1 140px" }}>Moneda<select name="from">{nw.missingRates.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field" style={{ flex: "1 1 180px" }}>1 unidad = ¿cuántos {cur}?<input name="rate" inputMode="decimal" placeholder="Ej.: 1.415" /></label>
            <Submit className="btn">Guardar cotización</Submit>
          </ActionForm></div>
      )}
      <div className="grid g2">{GROUPS.map((g) => {
        const lines = nw.lines.filter((l) => l.group === g && !l.amount.isZero());
        if (!lines.length) return null;
        return (
          <div className="card" key={g}><div className="chead"><h3>{g}</h3></div>
            <div className="list">{lines.map((l, i) => <div className="li" key={i}><div className="grow"><div className="t">{l.name}</div>{l.currency !== cur && <div className="s">{formatMoney(l.amount, l.currency)}{l.inBase ? "" : " · sin cotización"}</div>}</div><b className={`num ${l.amount.isNegative() ? "neg" : ""}`}>{l.inBase ? fm(l.inBase) : formatMoney(l.amount, l.currency)}</b></div>)}</div></div>
        );
      })}</div>
      {modules.activos && (
        <div className="card">
          <div className="chead"><h3>Bienes</h3><span className="sub">Inmuebles, vehículos y otros, con valuación manual</span></div>
          {assets.length > 0 && <div className="list">{assets.map((a) => (
            <div className="li" key={a.asset.id} style={{ flexWrap: "wrap" }}>
              <div className="grow" style={{ minWidth: 180 }}><div className="t">{a.asset.name}</div><div className="s">{a.asset.kind}{a.valuedAt ? ` · valuado el ${fmtDate(a.valuedAt)}` : ""}</div></div>
              <b className="num">{formatMoney(a.value, a.asset.currency)}</b>
              <details className="more" style={{ width: "100%" }}><summary>Actualizar valor</summary>
                <ActionForm action={valuationAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", paddingTop: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="assetId" value={a.asset.id} />
                  <label className="field" style={{ flex: "1 1 180px" }}>Valor de hoy<input name="value" inputMode="decimal" defaultValue={a.value.toFixed(0)} /></label>
                  <Submit className="btn">Guardar</Submit>
                </ActionForm>
                {a.asset.valuations.length > 1 && <div className="list">{a.asset.valuations.map((v) => <div className="li" key={v.id}><span className="grow s">{fmtDate(v.date)}</span><span className="num">{formatMoney(v.value, v.currency)}</span></div>)}</div>}
              </details>
            </div>
          ))}</div>}
          <details className="more" open={assets.length === 0}><summary>+ Nuevo bien</summary>
            <ActionForm action={createAssetAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
              <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Departamento" /></label><label className="field">Tipo<select name="kind">{["Inmueble", "Vehículo", "Negocio", "Otro"].map((k) => <option key={k}>{k}</option>)}</select></label></div>
              <div className="frow"><label className="field">¿Cuánto vale hoy?<input name="value" inputMode="decimal" /></label><label className="field">Moneda<select name="currency" defaultValue={cur}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label></div>
              <div><Submit>Guardar bien</Submit></div>
            </ActionForm>
          </details>
        </div>
      )}
    </>
  );
}
