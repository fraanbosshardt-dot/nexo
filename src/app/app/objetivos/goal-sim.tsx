"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { updateGoalPlanAction } from "@/app/actions/modules";

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Simula el aporte mensual: muestra cuándo llegarías y permite guardarlo.
export function GoalSim({ goalId, left, planned, currency, today }: { goalId: string; left: number; planned: number; currency: string; today: string }) {
  const [v, setV] = useState(Math.ceil(planned));
  const max = Math.max(Math.round(planned * 3), Math.round(left / 2), 1000);
  const months = v > 0 ? Math.ceil(left / v) : null;
  const [y, m] = today.split("-").map(Number);
  const when = months != null ? new Date(Date.UTC(y, m - 1 + months, 1)) : null;
  return (
    <form action={updateGoalPlanAction} className="goal-sim">
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="monthly" value={String(v)} />
      <span>Si aportás <b className="num" style={{ color: "var(--fg)" }}>{formatMoney(v, currency)}</b> por mes, llegás en <b style={{ color: "var(--fg)" }}>{when ? `${MES[when.getUTCMonth()]} ${when.getUTCFullYear()}` : "nunca"}</b>.</span>
      <input type="range" min={0} max={max} step={1} value={v} onChange={(e) => setV(Number(e.target.value))} aria-label="Aporte mensual" />
      <div className="goal-sim-row"><label className="field">Aporte mensual<input type="number" min="0" max={max} step="1" value={v} onChange={(e) => setV(Math.min(max, Math.max(0, Number(e.target.value) || 0)))} /></label><button className="btn sm" type="submit" disabled={Math.ceil(planned) === v}>Guardar este aporte</button></div>
    </form>
  );
}
