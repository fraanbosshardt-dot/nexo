import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { budgetFor } from "@/server/planning";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { copyBudgetAction, saveBudgetAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function Budgets({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : period(todayIn(workspace.timezone));
  const cur = workspace.baseCurrency;
  const b = await budgetFor(getDb(), workspace.id, p, cur);
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  // "Te queda" mira solo las categorías con límite: lo que gastás en las demás no descuenta de un presupuesto que no pusiste.
  const limited = b.rows.filter((r) => r.limit);
  const sum = (f: (r: (typeof limited)[number]) => typeof b.totals.limit) => limited.reduce((s, r) => s.plus(f(r)), ZERO);
  const lim = sum((r) => r.limit!), spentLim = sum((r) => r.spent), commLim = sum((r) => r.committed);
  const left = lim.minus(spentLim).minus(commLim);
  const hasBudget = !!b.budget && lim.gt(0);
  return (
    <>
      <PageHead crumb="Planificar" title="Presupuestos" desc="Cuánto querés gastar por categoría, contra lo gastado y lo que ya está comprometido en el mes."
        actions={<><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, -1)}`} aria-label="Mes anterior">‹</Link><span className="btn" style={{ minWidth: 150, justifyContent: "center" }}>{fmtPeriod(p)}</span><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente">›</Link></>} />
      {hasBudget ? (
        <>
          <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}><Stat label="Presupuesto" value={fm(lim)} /><Stat label="Gastado" value={fm(spentLim)} /><Stat label="Comprometido" value={fm(commLim)} /><Stat label={left.isNegative() ? "Te pasaste" : "Te queda"} value={fm(left.abs())} tone={left.isNegative() ? "neg" : "pos"} /></div>
          <div className="card"><div className="list">{[...limited, ...b.rows.filter((r) => !r.limit)].map((r) => {
            const over = r.pct != null && r.pct > 100;
            return (
              <div className="li" key={r.id} style={{ flexWrap: "wrap" }}>
                <div className="grow"><div className="t">{r.name}</div><div className="s">{r.limit ? `${fm(r.spent)} gastado${r.committed.gt(0) ? ` · ${fm(r.committed)} comprometido` : ""}` : `${fm(r.spent)} gastado`}</div></div>
                {r.available ? <span style={{ textAlign: "right", flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end" }}><b className={`num ${r.available.isNegative() ? "neg" : ""}`}>{fm(r.available.abs())}</b><small className="sub" style={{ margin: 0 }}>{r.available.isNegative() ? "de más" : "quedan"}</small></span> : <span className="sub" style={{ flex: "none" }}>Sin límite</span>}
                <div style={{ flex: "1 1 100%" }}>{r.limit && <><div className="bar"><i style={{ width: `${Math.min(100, r.spent.dividedBy(r.limit).times(100).toNumber())}%`, background: over ? "var(--red)" : "var(--ink)" }} /><i style={{ width: `${Math.max(0, Math.min(100 - r.spent.dividedBy(r.limit).times(100).toNumber(), r.committed.dividedBy(r.limit).times(100).toNumber()))}%`, background: "var(--c5)" }} /></div><small className="sub">{Math.round(r.pct ?? 0)}% de {fm(r.limit)}</small></>}</div>
              </div>
            );
          })}</div></div>
        </>
      ) : (
        <div className="card hero"><div><div className="lbl">Sin presupuesto para {fmtPeriod(p).toLowerCase()}</div><p className="sub" style={{ maxWidth: "48ch", margin: "8px 0 12px" }}>Poné un límite a las categorías que quieras controlar. Lo que gastes y lo que tengas pendiente se descuenta solo.</p>
          <form action={copyBudgetAction}><input type="hidden" name="from" value={addMonths(p, -1)} /><input type="hidden" name="to" value={p} /><button className="btn" type="submit">Copiar el del mes anterior</button></form></div>
          <div className="hero-side"><div className="hrow"><span>Gastado este mes</span><b>{fm(b.totals.spent)}</b></div><div className="hrow"><span>Comprometido</span><b>{fm(b.totals.committed)}</b></div></div></div>
      )}
      <div className="card">
        <details className="more" open={!hasBudget}>
          <summary>{hasBudget ? "Editar límites" : "Armar el presupuesto"}</summary>
          <ActionForm action={saveBudgetAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
            <input type="hidden" name="period" value={p} />
            <div className="grid g3">{b.categories.map((c) => {
              const cur0 = b.budget?.lines.find((l) => l.categoryId === c.id);
              return <label className="field" key={c.id}>{c.name}<input name={`limit:${c.id}`} inputMode="decimal" placeholder="Sin límite" defaultValue={cur0 ? cur0.limitAmount.toFixed(0) : ""} /></label>;
            })}</div>
            <div><Submit>Guardar presupuesto</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
