import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { goalsOverview } from "@/server/planning";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtPeriod, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { contributeAction, createGoalAction, deleteGoalAction } from "@/app/actions/modules";
import { FREE_LIMITS } from "@/server/plans";
import { CURRENCIES } from "@/lib/countries";
import { GoalSim } from "./goal-sim";

export const metadata: Metadata = { title: "Objetivos" };

export default async function Goals() {
  const { workspace, plan } = await requireWorkspace();
  const today = todayIn(workspace.timezone);
  const goals = await goalsOverview(getDb(), workspace.id, today);
  const limited = !(await canUse(plan, "ilimitado")) && goals.length >= FREE_LIMITS.goals;
  return (
    <>
      <PageHead crumb="Planificar" title="Objetivos de ahorro" desc="Cuánto separar por mes para llegar a cada meta, y qué pasa si cambiás el aporte." />
      {goals.length > 0 && (
        <div className="grid g2">{goals.map((g) => {
          const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, g.goal.currency);
          return (
            <div className="card" key={g.goal.id}>
              <div className="chead"><div><h3>{g.goal.name}</h3><p className="sub">Meta {fm(g.goal.targetAmount)}{g.goal.targetDate ? ` · para ${fmtDate(g.goal.targetDate)}` : ""}</p></div>{g.done ? <span className="pill g">Cumplido</span> : g.onTrack === false ? <span className="pill">Atrasado</span> : g.onTrack ? <span className="pill g">En camino</span> : null}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><b className="num">{fm(g.saved)}</b><span className="mut num">{Math.round(g.pct)}%</span></div>
              <div className="bar" style={{ margin: "6px 0 12px", height: 10 }}><i style={{ width: `${g.pct}%`, background: "var(--ink)" }} /></div>
              {!g.done && <dl className="kv"><dt>Te falta</dt><dd>{fm(g.left)}</dd>{g.monthsLeft && <><dt>Necesitás por mes</dt><dd><b>{fm(g.needed)}</b> durante {g.monthsLeft} meses</dd></>}{g.eta && <><dt>Con tu aporte llegás en</dt><dd>{fmtPeriod(g.eta)}</dd></>}</dl>}
              {!g.done && <GoalSim goalId={g.goal.id} left={g.left.toNumber()} planned={g.planned?.toNumber() ?? Math.max(1, g.needed.toNumber())} currency={g.goal.currency} today={today.toISOString().slice(0, 7)} />}
              <details className="more"><summary>Sumar un aporte</summary>
                <ActionForm action={contributeAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", paddingTop: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="goalId" value={g.goal.id} />
                  <label className="field" style={{ flex: "1 1 160px" }}>Importe<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
                  <Submit className="btn">Sumar</Submit>
                </ActionForm>
                <form action={deleteGoalAction} style={{ marginTop: 8 }}><input type="hidden" name="goalId" value={g.goal.id} /><button className="btn sm ghost" style={{ color: "var(--red)" }} type="submit">Eliminar objetivo</button></form>
              </details>
            </div>
          );
        })}</div>
      )}
      <div className="card">
        <details className="more" open={goals.length === 0}>
          <summary>+ Nuevo objetivo</summary>
          {limited ? <p className="sub" style={{ paddingTop: 8 }}>El plan Gratis incluye {FREE_LIMITS.goals} objetivos. Con Pro no hay límite.</p> : (
            <ActionForm action={createGoalAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
              <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Fondo de emergencia" /></label><label className="field">Meta<input name="target" inputMode="decimal" placeholder="0,00" /></label></div>
              <div className="frow"><label className="field">Moneda<select name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label><label className="field">Para cuándo (opcional)<input name="targetDate" type="date" /></label></div>
              <div className="frow"><label className="field">Ya tengo (opcional)<input name="saved" inputMode="decimal" placeholder="0,00" /></label><label className="field">Puedo aportar por mes (opcional)<input name="monthly" inputMode="decimal" placeholder="0,00" /></label></div>
              <div><Submit>Crear objetivo</Submit></div>
            </ActionForm>
          )}
        </details>
      </div>
    </>
  );
}
