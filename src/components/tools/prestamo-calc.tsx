"use client";
import { useState } from "react";
import { loanSchedule, money, parseMoneyInput, teaFromTna } from "@/lib/calc";

const SYS = { frances: "Francés: cuota fija", aleman: "Alemán: cuota que baja", americano: "Americano: capital al final" } as const;

// Calculadora pública de cuotas de un préstamo.
export function PrestamoCalc() {
  const [v, setV] = useState({ amount: "", n: "12", tna: "", sys: "frances" as keyof typeof SYS });
  const amount = parseMoneyInput(v.amount), n = Math.min(360, Math.max(1, parseInt(v.n, 10) || 0)), tna = Number(String(v.tna).replace(",", ".")) || 0;
  const rows = amount && n ? loanSchedule(amount, n, tna, v.sys) : null;
  const total = rows?.reduce((s, r) => s + r.payment, 0) ?? 0;
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="Calculadora de préstamos">
      <div className="frow">
        <label className="field">Monto del préstamo<input inputMode="decimal" placeholder="0" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
        <label className="field">Cantidad de cuotas<input inputMode="numeric" value={v.n} onChange={(e) => setV({ ...v, n: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
      </div>
      <div className="frow">
        <label className="field">TNA %<input inputMode="decimal" placeholder="Ej.: 60" value={v.tna} onChange={(e) => setV({ ...v, tna: e.target.value })} /></label>
        <label className="field">Sistema<select value={v.sys} onChange={(e) => setV({ ...v, sys: e.target.value as keyof typeof SYS })}>{Object.entries(SYS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="calc-out" aria-live="polite">
        {!rows ? <span className="sub">Escribí el monto y las cuotas. Sin TNA se calcula sin interés.</span> : (
          <>
            <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
              <div><small>{v.sys === "frances" ? "Cuota fija" : "Primera cuota"}</small><b>{money(rows[0].payment)}</b></div>
              <div><small>Total a pagar</small><b>{money(total)}</b></div>
              <div><small>Intereses</small><b className={total > amount! ? "neg" : ""}>{money(total - amount!)}</b></div>
              {tna > 0 && <div><small>TEA equivalente</small><b>{teaFromTna(tna).toFixed(1).replace(".", ",")}%</b></div>}
            </div>
            <div className="tw" style={{ marginTop: 10, maxHeight: 360, overflowY: "auto" }}><table><thead><tr><th>Cuota</th><th className="n">Capital</th><th className="n">Interés</th><th className="n">Total</th><th className="n">Queda</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.n}><td>{r.n}</td><td className="n">{money(r.capital)}</td><td className="n">{money(r.interest)}</td><td className="n"><b>{money(r.payment)}</b></td><td className="n">{money(r.balance)}</td></tr>)}</tbody></table></div>
          </>
        )}
      </div>
    </form>
  );
}
