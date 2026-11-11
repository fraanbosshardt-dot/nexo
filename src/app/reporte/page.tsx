import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dec, formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtDateNum, fmtPeriod, period, periodEnd, periodStart, todayIn } from "@/lib/dates";
import { BRAND } from "@/lib/brand";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Reporte del mes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Reporte de un mes para imprimir o guardar como PDF (Pro): totales, gastos por categoría y todos los movimientos.
export default async function Report({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const p0 = period(todayIn(workspace.timezone));
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") && sp.mes! <= p0 ? sp.mes! : p0;
  if (!(await canUse(plan, "informes"))) {
    return <main className="report"><h1>Reporte en PDF</h1><p>Guardar el reporte del mes en PDF es parte de Pro. <Link className="lnk" href="/app/configuracion?tab=plan">Ver Pro</Link></p></main>;
  }
  const cur = workspace.baseCurrency;
  const tx = await getDb().transaction.findMany({
    where: { workspaceId: workspace.id, effectiveDate: { gte: periodStart(p), lte: periodEnd(p) }, reversalOfId: null, reversedBy: null, NOT: { type: "TRANSFER", direction: "IN" } },
    include: { account: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });
  const inBase = tx.filter((t) => t.currency === cur);
  const spent = inBase.filter((t) => t.type === "EXPENSE" || t.type === "DEBT_PAYMENT");
  const income = inBase.filter((t) => t.type === "INCOME").reduce((s, t) => s.plus(dec(t.amount)), ZERO);
  const expense = spent.reduce((s, t) => s.plus(dec(t.amount)), ZERO);
  const byCat = new Map<string, typeof ZERO>();
  for (const t of spent) { const k = t.category?.name ?? "Sin categoría"; byCat.set(k, (byCat.get(k) ?? ZERO).plus(dec(t.amount))); }
  const cats = [...byCat.entries()].sort((a, b) => b[1].comparedTo(a[1]));
  const f = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  return (
    <main className="report">
      <div className="report-bar no-print">
        <Link className="btn" href="/app/informes">← Volver</Link>
        <div className="acts">
          <Link className="btn sm" href={`/reporte?mes=${addMonths(p, -1)}`} aria-label="Mes anterior">‹</Link>
          <b>{fmtPeriod(p)}</b>
          {p < p0 && <Link className="btn sm" href={`/reporte?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente">›</Link>}
        </div>
        <PrintButton />
      </div>
      <header className="report-h">
        <b className="report-brand">{BRAND.name}</b>
        <h1>Reporte de {fmtPeriod(p).toLowerCase()}</h1>
        <p>{workspace.name} · en {cur} · generado el {fmtDateNum(new Date())}</p>
      </header>
      <section className="report-kpis">
        <div><small>Entró</small><b>{f(income)}</b></div>
        <div><small>Salió</small><b>{f(expense)}</b></div>
        <div><small>Resultado</small><b>{formatMoney(income.minus(expense), cur, { sign: true })}</b></div>
      </section>
      {cats.length > 0 && (
        <section>
          <h2>Gastos por categoría</h2>
          <table>
            <thead><tr><th>Categoría</th><th className="n">Monto</th><th className="n">%</th></tr></thead>
            <tbody>{cats.map(([n, v]) => <tr key={n}><td>{n}</td><td className="n">{f(v)}</td><td className="n">{expense.isZero() ? "—" : `${v.dividedBy(expense).times(100).toFixed(1).replace(".", ",")}%`}</td></tr>)}</tbody>
          </table>
        </section>
      )}
      <section>
        <h2>Movimientos ({tx.length})</h2>
        {tx.length ? (
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th className="n">Importe</th></tr></thead>
            <tbody>{tx.map((t) => <tr key={t.id}><td>{fmtDateNum(t.effectiveDate)}</td><td>{t.description}</td><td>{t.category?.name ?? (t.type === "TRANSFER" ? "Transferencia" : "")}</td><td>{t.account.name}</td><td className="n">{t.direction === "IN" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</td></tr>)}</tbody>
          </table>
        ) : <p>No hay movimientos en este mes.</p>}
      </section>
      <footer className="report-f">Para uso personal. {BRAND.name} no es asesoramiento financiero.</footer>
    </main>
  );
}
