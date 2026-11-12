"use client";
// Armar el presupuesto sin una lista larga de "Sin límite": se ven solo las categorías con límite,
// se agregan de a una y Guafra sugiere el monto con lo que gastaste los últimos meses.
import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { saveBudgetAction } from "@/app/actions/modules";

type Cat = { id: string; name: string; avg: number; limit: number | null };
const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
const num = (s: string) => { const t = s.replace(/\$|\s/g, ""); return Number(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\./g, "")) || 0; };
// Redondeo amigable de la sugerencia (ej.: 47.320 → 48.000).
const nice = (n: number) => { const step = n >= 100000 ? 5000 : n >= 10000 ? 1000 : 100; return Math.ceil(n / step) * step; };

export function BudgetEditor({ period, cats, symbol, hasBudget }: { period: string; cats: Cat[]; symbol: string; hasBudget: boolean }) {
  // Sin presupuesto: arranca con las categorías en las que más gastás (hasta 5), con la sugerencia puesta.
  const start = hasBudget ? cats.filter((c) => c.limit) : [...cats].filter((c) => c.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5);
  const [rows, setRows] = useState(start.map((c) => ({ id: c.id, value: c.limit ? fmt(c.limit) : fmt(nice(c.avg)) })));
  const [pick, setPick] = useState("");
  const byId = new Map(cats.map((c) => [c.id, c]));
  const free = cats.filter((c) => !rows.some((r) => r.id === c.id)).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
  const total = rows.reduce((s, r) => s + num(r.value), 0);
  const add = (id: string) => { const c = byId.get(id); if (!c) return; setRows((r) => [...r, { id, value: c.avg > 0 ? fmt(nice(c.avg)) : "" }]); setPick(""); };

  return (
    <ActionForm action={saveBudgetAction} style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
      <input type="hidden" name="period" value={period} />
      {!hasBudget && rows.length > 0 && <p className="sub" style={{ margin: 0 }}>Te propusimos las categorías en las que más gastás, con lo que gastás en promedio. Ajustá los montos o sacá las que no quieras controlar.</p>}
      {rows.length > 0 ? (
        <div className="bud-rows">
          {rows.map((r, i) => {
            const c = byId.get(r.id)!;
            return (
              <div className="bud-row" key={r.id}>
                <div className="bud-name"><b>{c.name}</b>{c.avg > 0 && <span className="sub">Gastás ~{symbol} {fmt(c.avg)} por mes</span>}</div>
                <label className="bud-amt"><span className="sr-only">Límite para {c.name}</span><em>{symbol}</em><input name={`limit:${r.id}`} inputMode="decimal" value={r.value} placeholder="0" onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} /></label>
                <button type="button" className="dots" aria-label={`Quitar ${c.name}`} title="Quitar" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
              </div>
            );
          })}
          <div className="bud-total"><span>Total del presupuesto</span><b className="num">{symbol} {fmt(total)}</b></div>
        </div>
      ) : <p className="sub" style={{ margin: 0 }}>Elegí las categorías que querés controlar. Las demás no cuentan en el presupuesto.</p>}
      {free.length > 0 && (
        <div className="bud-add">
          <select aria-label="Agregar una categoría" value={pick} onChange={(e) => add(e.target.value)}>
            <option value="">+ Agregar una categoría…</option>
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}{c.avg > 0 ? ` (gastás ~${symbol} ${fmt(c.avg)})` : ""}</option>)}
          </select>
        </div>
      )}
      <div className="stm-foot"><p className="sub">Lo que gastes en las categorías sin límite no descuenta de este presupuesto.</p><Submit>Guardar presupuesto</Submit></div>
    </ActionForm>
  );
}
