"use client";
// Calculadoras públicas: plazo fijo, conversor de monedas, fondo de emergencia y presupuesto 50/30/20.
// Todo se calcula en el navegador; no se guarda nada. Los montos van en centavos (como el resto de las calculadoras).
import { useState } from "react";
import { money, parseMoneyInput } from "@/lib/calc";

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

// ---------- Plazo fijo / interés compuesto ----------

// Interés simple por el plazo (como lo paga el banco) y, si se renueva, interés compuesto mes a mes.
export function plazoFijo(capital: number, tna: number, dias: number, renovaciones: number) {
  const interes = Math.round(capital * (tna / 100) * (dias / 365));
  let total = capital;
  for (let i = 0; i <= renovaciones; i++) total += Math.round(total * (tna / 100) * (dias / 365));
  const tea = (Math.pow(1 + (tna / 100) * (dias / 365), 365 / dias) - 1) * 100;
  return { interes, alVencer: capital + interes, renovado: total, tea };
}

export function PlazoFijoCalc() {
  const [v, setV] = useState({ capital: "", tna: "", dias: "30", ren: "0" });
  const capital = parseMoneyInput(v.capital), tna = num(v.tna), dias = Math.max(1, parseInt(v.dias, 10) || 0), ren = Math.min(120, Math.max(0, parseInt(v.ren, 10) || 0));
  const r = capital && tna > 0 ? plazoFijo(capital, tna, dias, ren) : null;
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="Calculadora de plazo fijo">
      <div className="frow">
        <label className="field">Monto que invertís<input inputMode="decimal" placeholder="0" value={v.capital} onChange={(e) => setV({ ...v, capital: e.target.value })} /></label>
        <label className="field">TNA %<input inputMode="decimal" placeholder="Ej.: 35" value={v.tna} onChange={(e) => setV({ ...v, tna: e.target.value })} /></label>
      </div>
      <div className="frow">
        <label className="field">Plazo en días<input inputMode="numeric" value={v.dias} onChange={(e) => setV({ ...v, dias: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
        <label className="field">Veces que lo renovás<input inputMode="numeric" value={v.ren} onChange={(e) => setV({ ...v, ren: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
      </div>
      <div className="calc-out" aria-live="polite">
        {!r ? <span className="sub">Escribí el monto y la TNA que te ofrece el banco.</span> : (
          <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
            <div><small>Ganás en {dias} días</small><b className="pos">{money(r.interes)}</b></div>
            <div><small>Al vencer cobrás</small><b>{money(r.alVencer)}</b></div>
            {ren > 0 && <div><small>Renovando {ren} {ren === 1 ? "vez" : "veces"}</small><b>{money(r.renovado)}</b></div>}
            <div><small>TEA (renovando siempre)</small><b>{pct(r.tea)}</b></div>
          </div>
        )}
      </div>
    </form>
  );
}

// ---------- Conversor de monedas ----------

// rates: cuántas unidades de cada moneda vale 1 USD (cotización oficial).
export function convert(amount: number, from: string, to: string, rates: Record<string, number>) {
  const r = (c: string) => (c === "USD" ? 1 : rates[c]);
  if (!r(from) || !r(to)) return null;
  return (amount / r(from)) * r(to);
}

export function ConversorCalc({ rates, updated, currencies }: { rates: Record<string, number>; updated: string | null; currencies: { code: string; name: string }[] }) {
  const [v, setV] = useState({ amount: "100", from: "USD", to: currencies.find((c) => c.code !== "USD")?.code ?? "EUR" });
  const amount = num(v.amount.replace(/\./g, "").replace(",", "."));
  const out = convert(amount, v.from, v.to, rates);
  const unit = convert(1, v.from, v.to, rates);
  const fmt = (n: number, c: string) => `${new Intl.NumberFormat("es", { maximumFractionDigits: n < 1 ? 4 : 2 }).format(n)} ${c}`;
  const opts = currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>);
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="Conversor de monedas">
      <div className="frow">
        <label className="field">Monto<input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
        <label className="field">De<select value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })}>{opts}</select></label>
        <label className="field">A<select value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })}>{opts}</select></label>
      </div>
      <div className="acts"><button type="button" className="btn sm" onClick={() => setV({ ...v, from: v.to, to: v.from })}>⇄ Invertir</button></div>
      <div className="calc-out" aria-live="polite">
        {out == null ? <span className="sub">Todavía no tenemos la cotización de esa moneda.</span> : (
          <>
            <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
              <div><small>{fmt(amount, v.from)} son</small><b>{fmt(out, v.to)}</b></div>
              {unit != null && <div><small>1 {v.from} =</small><b>{fmt(unit, v.to)}</b></div>}
            </div>
            <p className="sub" style={{ marginTop: 8 }}>Cotización oficial de referencia{updated ? `, actualizada el ${updated}` : ""}. El precio de compra y venta en bancos y casas de cambio puede ser distinto.</p>
          </>
        )}
      </div>
    </form>
  );
}

// ---------- Fondo de emergencia ----------

export function fondoEmergencia(gastos: number, meses: number, tengo: number, ahorroMensual: number) {
  const meta = gastos * meses;
  const falta = Math.max(0, meta - tengo);
  const mesesParaLlegar = falta === 0 ? 0 : ahorroMensual > 0 ? Math.ceil(falta / ahorroMensual) : null;
  return { meta, falta, mesesParaLlegar, cubre: gastos > 0 ? tengo / gastos : 0 };
}

export function FondoCalc() {
  const [v, setV] = useState({ gastos: "", meses: "6", tengo: "", ahorro: "" });
  const gastos = parseMoneyInput(v.gastos), meses = Math.min(24, Math.max(1, parseInt(v.meses, 10) || 0));
  const r = gastos ? fondoEmergencia(gastos, meses, parseMoneyInput(v.tengo) ?? 0, parseMoneyInput(v.ahorro) ?? 0) : null;
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="Calculadora de fondo de emergencia">
      <div className="frow">
        <label className="field">Tus gastos fijos por mes<input inputMode="decimal" placeholder="Alquiler, servicios, comida…" value={v.gastos} onChange={(e) => setV({ ...v, gastos: e.target.value })} /></label>
        <label className="field">Meses a cubrir<select value={v.meses} onChange={(e) => setV({ ...v, meses: e.target.value })}>{[3, 4, 6, 9, 12].map((m) => <option key={m} value={m}>{m} meses</option>)}</select></label>
      </div>
      <div className="frow">
        <label className="field">Lo que ya tenés ahorrado<input inputMode="decimal" placeholder="0" value={v.tengo} onChange={(e) => setV({ ...v, tengo: e.target.value })} /></label>
        <label className="field">Cuánto podés apartar por mes<input inputMode="decimal" placeholder="0" value={v.ahorro} onChange={(e) => setV({ ...v, ahorro: e.target.value })} /></label>
      </div>
      <div className="calc-out" aria-live="polite">
        {!r ? <span className="sub">Escribí tus gastos fijos de un mes.</span> : (
          <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
            <div><small>Tu meta</small><b>{money(r.meta)}</b></div>
            <div><small>Hoy cubrís</small><b>{r.cubre.toFixed(1).replace(".", ",")} meses</b></div>
            <div><small>Te falta</small><b className={r.falta ? "" : "pos"}>{r.falta ? money(r.falta) : "¡Nada!"}</b></div>
            {r.falta > 0 && <div><small>Llegás en</small><b>{r.mesesParaLlegar == null ? "Poné cuánto apartás" : `${r.mesesParaLlegar} ${r.mesesParaLlegar === 1 ? "mes" : "meses"}`}</b></div>}
          </div>
        )}
      </div>
    </form>
  );
}

// ---------- Presupuesto 50/30/20 ----------

export function presupuesto503020(ingreso: number) {
  const necesidades = Math.round(ingreso * 0.5), deseos = Math.round(ingreso * 0.3);
  return { necesidades, deseos, ahorro: ingreso - necesidades - deseos };
}

export function PresupuestoCalc() {
  const [v, setV] = useState({ ingreso: "", fijos: "", gustos: "" });
  const ingreso = parseMoneyInput(v.ingreso);
  const r = ingreso ? presupuesto503020(ingreso) : null;
  const fijos = parseMoneyInput(v.fijos), gustos = parseMoneyInput(v.gustos);
  // En necesidades y gustos, pasarse es malo; en ahorro, pasarse es bueno.
  const row = (label: string, ideal: number, real: number | null, hint: string, moreIsGood = false) => (
    <tr><td>{label}<div className="sub">{hint}</div></td><td className="n"><b>{money(ideal)}</b></td><td className="n">{real == null ? "—" : <span className={(real > ideal) !== moreIsGood ? "neg" : "pos"}>{money(real)}</span>}</td></tr>
  );
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="Presupuesto 50/30/20">
      <label className="field">Lo que cobrás por mes (en mano)<input inputMode="decimal" placeholder="0" value={v.ingreso} onChange={(e) => setV({ ...v, ingreso: e.target.value })} /></label>
      <div className="frow">
        <label className="field">Lo que gastás hoy en lo necesario (opcional)<input inputMode="decimal" placeholder="Alquiler, servicios, comida" value={v.fijos} onChange={(e) => setV({ ...v, fijos: e.target.value })} /></label>
        <label className="field">Lo que gastás en gustos (opcional)<input inputMode="decimal" placeholder="Salidas, ropa, suscripciones" value={v.gustos} onChange={(e) => setV({ ...v, gustos: e.target.value })} /></label>
      </div>
      <div className="calc-out" aria-live="polite">
        {!r ? <span className="sub">Escribí cuánto cobrás por mes.</span> : (
          <div className="tw"><table>
            <thead><tr><th>Parte</th><th className="n">Ideal</th><th className="n">Hoy</th></tr></thead>
            <tbody>
              {row("50% necesidades", r.necesidades, fijos, "Vivienda, servicios, comida, transporte, deudas")}
              {row("30% gustos", r.deseos, gustos, "Salidas, compras, viajes, suscripciones")}
              {row("20% ahorro", r.ahorro, fijos != null && gustos != null ? ingreso! - fijos - gustos : null, "Fondo de emergencia, objetivos, inversiones", true)}
            </tbody>
          </table></div>
        )}
      </div>
    </form>
  );
}
