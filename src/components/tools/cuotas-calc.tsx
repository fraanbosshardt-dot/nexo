"use client";
import { useState } from "react";
import { canAffordSimple, money, parseMoneyInput } from "@/lib/calc";

// Calculadora pública "¿Puedo comprarlo en cuotas?". No guarda nada.
export function CuotasCalc({ compact = false }: { compact?: boolean }) {
  const [v, setV] = useState({ now: "", free: "", price: "", n: "6", total: "", cushion: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const now = parseMoneyInput(v.now), free = parseMoneyInput(v.free), price = parseMoneyInput(v.price);
  const invalid = [v.now, v.free, v.price, v.total, v.cushion].some((x) => x.trim() && parseMoneyInput(x) == null);
  const r = !invalid && now != null && free != null && price ? canAffordSimple({ now, monthlyFree: free, price, installments: Number(v.n), total: parseMoneyInput(v.total), cushion: parseMoneyInput(v.cushion) ?? 0 }) : null;
  const max = r ? Math.max(1, ...r.rows.map((x) => Math.abs(x.end))) : 1;
  return (
    <form className="calc-card" onSubmit={(e) => e.preventDefault()} aria-label="¿Puedo comprarlo en cuotas?">
      {!compact && <h2>¿Puedo comprarlo en cuotas?</h2>}
      <div className="frow">
        <label className="field">Tengo hoy<input inputMode="decimal" placeholder="0" value={v.now} onChange={set("now")} /></label>
        <label className="field">Me sobra por mes<input inputMode="decimal" placeholder="Ingresos − gastos fijos" value={v.free} onChange={set("free")} /></label>
      </div>
      <div className="frow">
        <label className="field">Precio<input inputMode="decimal" placeholder="0" value={v.price} onChange={set("price")} /></label>
        <label className="field">Cuotas<select value={v.n} onChange={set("n")}>{[1, 3, 6, 9, 12, 18, 24].map((n) => <option key={n} value={n}>{n === 1 ? "Un pago" : `${n} cuotas`}</option>)}</select></label>
      </div>
      {!compact && (
        <div className="frow">
          <label className="field">Total con interés (si tiene)<input inputMode="decimal" placeholder="Vacío si es sin interés" value={v.total} onChange={set("total")} /></label>
          <label className="field">Plata que no querés tocar<input inputMode="decimal" placeholder="0" value={v.cushion} onChange={set("cushion")} /></label>
        </div>
      )}
      <div className={`calc-out ${r ? (r.ok ? "yes" : "no") : ""}`} aria-live="polite">
        {invalid && <p role="alert">Usá montos válidos, sin valores negativos. Si tus gastos superan tus ingresos, esta compra necesita otra fuente de dinero.</p>}
        {!r ? <span className="sub">Completá los tres primeros montos y te decimos si te alcanza y cómo queda tu dinero mes a mes.</span> : (
          <>
            <b className="calc-v">{r.ok ? "Sí, te alcanza" : "No te alcanza"}</b>
            <span>{Number(v.n) > 1 ? `${v.n} cuotas de ${money(r.cuota)}` : `Un pago de ${money(r.total)}`}{r.interest > 0 ? ` · pagás ${money(r.interest)} de interés` : ""}. {r.ok ? `Tu saldo más bajo sería ${money(r.min)}.` : `En el mes ${r.minMonth} quedarías en ${money(r.min)}.`}</span>
            <div className="mini" aria-hidden="true">{r.rows.map((x) => <i key={x.month} className={x.end < 0 ? "n" : ""} style={{ height: `${Math.max(4, (Math.abs(x.end) / max) * 100)}%` }} title={`Mes ${x.month}: ${money(x.end)}`} />)}</div>
            {!compact && (
              <div className="tw" style={{ marginTop: 8 }}><table><thead><tr><th>Mes</th><th className="n">Cuota</th><th className="n">Te queda</th></tr></thead>
                <tbody>{r.rows.map((x) => <tr key={x.month}><td>{x.month}</td><td className="n">{x.cuota ? money(-x.cuota) : "—"}</td><td className={`n ${x.end < 0 ? "neg" : ""}`}>{money(x.end)}</td></tr>)}</tbody></table></div>
            )}
          </>
        )}
      </div>
    </form>
  );
}
