import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { budgetFor } from "@/server/planning";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { copyBudgetAction } from "@/app/actions/modules";
import { BudgetEditor } from "./budget-editor";
import { symbolOf } from "@/lib/countries";

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
  // Promedio gastado por categoría en los 3 meses anteriores (para sugerir el límite).
  const db = getDb();
  const prev = [addMonths(p, -1), addMonths(p, -2), addMonths(p, -3)];
  const [txs, allCats] = await Promise.all([
    db.transaction.groupBy({ by: ["categoryId", "direction"], where: { workspaceId: workspace.id, currency: cur, type: "EXPENSE", economicPeriod: { in: prev } }, _sum: { amount: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE" }, select: { id: true, parentId: true } }),
  ]);
  const parentOf = new Map(allCats.map((c) => [c.id, c.parentId ?? c.id]));
  const avg = new Map<string, number>();
  for (const t of txs) { const k = parentOf.get(t.categoryId ?? "") ?? ""; const v = Number(t._sum.amount ?? 0) * (t.direction === "OUT" ? 1 : -1); avg.set(k, (avg.get(k) ?? 0) + v / 3); }
  return (
    <>
      <PageHead crumb="Planificar" title="Presupuestos" desc="Cuánto querés gastar por categoría, contra lo gastado y lo que ya está comprometido en el mes."
        actions={<><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, -1)}`} aria-label="Mes anterior">‹</Link><span className="btn" style={{ minWidth: 150, justifyContent: "center" }}>{fmtPeriod(p)}</span><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente">›</Link></>} />
      {hasBudget ? (
        <>
          <div className="card bdg-stats"><Stat label="Presupuesto" value={fm(lim)} /><Stat label="Gastado" value={fm(spentLim)} /><Stat label="Comprometido" value={fm(commLim)} /><Stat label={left.isNegative() ? "Te pasaste" : "Te queda"} value={fm(left.abs())} tone={left.isNegative() ? "neg" : "pos"} /></div>
          {/* Una tarjeta por categoría con límite: cuánto queda, la barra y lo gastado */}
          <div className="bdg-grid">{limited.map((r) => {
            const pct = r.spent.dividedBy(r.limit!).times(100).toNumber();
            const comm = Math.max(0, Math.min(100 - pct, r.committed.dividedBy(r.limit!).times(100).toNumber()));
            const over = pct > 100, near = !over && pct >= 80;
            return (
              <div className={`bdg ${over ? "over" : near ? "near" : ""}`} key={r.id}>
                <div className="bdg-top">
                  <b className="bdg-name">{r.name}</b>
                  <div className="bdg-left"><b className={`num ${r.available!.isNegative() ? "neg" : ""}`}>{fm(r.available!.abs())}</b><span>{r.available!.isNegative() ? "de más" : "te quedan"}</span></div>
                </div>
                <div className="bdg-bar" role="img" aria-label={`Gastaste el ${Math.round(pct)}% del límite`}><i style={{ width: `${Math.min(100, pct)}%` }} /><i className="c" style={{ width: `${comm}%` }} /></div>
                <div className="bdg-foot">
                  <span>{fm(r.spent)} gastado de {fm(r.limit!)}{r.committed.gt(0) ? ` · ${fm(r.committed)} por pagar` : ""}</span>
                  <b>{Math.round(pct)}%</b>
                </div>
              </div>
            );
          })}</div>
          {b.rows.some((r) => !r.limit && r.spent.gt(0)) && (
            <div className="card">
              <div className="chead"><div><h3>Sin límite</h3><p className="sub">Lo que gastaste en categorías que no controlás. No descuenta del presupuesto.</p></div></div>
              <div className="list">{b.rows.filter((r) => !r.limit && r.spent.gt(0)).map((r) => (
                <div className="li" key={r.id}><div className="grow"><div className="t">{r.name}</div></div><span className="num">{fm(r.spent)}</span></div>
              ))}</div>
            </div>
          )}
        </>
      ) : (
        <div className="card hero"><div><div className="lbl">Sin presupuesto para {fmtPeriod(p).toLowerCase()}</div><p className="sub" style={{ maxWidth: "48ch", margin: "8px 0 12px" }}>Poné un límite a las categorías que quieras controlar. Lo que gastes y lo que tengas pendiente se descuenta solo.</p>
          <form action={copyBudgetAction}><input type="hidden" name="from" value={addMonths(p, -1)} /><input type="hidden" name="to" value={p} /><button className="btn" type="submit">Copiar el del mes anterior</button></form></div>
          <div className="hero-side"><div className="hrow"><span>Gastado este mes</span><b>{fm(b.totals.spent)}</b></div><div className="hrow"><span>Comprometido</span><b>{fm(b.totals.committed)}</b></div></div></div>
      )}
      <div className="card">
        <details className="more" open={!hasBudget}>
          <summary>{hasBudget ? "Editar límites" : "Armar el presupuesto"}</summary>
          <BudgetEditor period={p} symbol={symbolOf(cur)} hasBudget={hasBudget} cats={b.categories.map((c) => { const l = b.budget?.lines.find((x) => x.categoryId === c.id); return { id: c.id, name: c.name, avg: avg.get(c.id) ?? 0, limit: l ? Number(l.limitAmount) : null }; })} />
        </details>
      </div>
    </>
  );
}
