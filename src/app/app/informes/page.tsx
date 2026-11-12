import Link from "next/link";
import type { Metadata } from "next";
import Decimal from "decimal.js";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { categoryReport } from "@/server/io";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtPeriod, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ProGate } from "@/components/pro";

export const metadata: Metadata = { title: "Informes" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const short = (p: string) => MES[Number(p.slice(5, 7)) - 1];

export default async function Reports({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "informes"))) return <ProGate crumb="Análisis" title="Informes" text="Tus gastos por categoría mes a mes y la evolución de lo que entra y sale." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const cur = workspace.baseCurrency;
  const full = await categoryReport(getDb(), workspace.id, cur, period(todayIn(workspace.timezone)), 6);
  // Arranca en el primer mes con movimientos (sin columnas vacías al principio para quien recién empieza).
  const first = Math.max(0, full.totals.findIndex((t) => !t.income.isZero() || !t.expense.isZero()));
  const r = { ...full, periods: full.periods.slice(first), totals: full.totals.slice(first), rows: full.rows.map((row) => ({ ...row, values: row.values.slice(first) })) };
  const max = r.totals.reduce((m, t) => Decimal.max(m, t.income, t.expense), ZERO);
  const has = r.totals.some((t) => !t.income.isZero() || !t.expense.isZero());
  // Comparar dos meses: por defecto, el anterior contra el actual.
  const sp = await searchParams;
  const ia = Math.max(0, r.periods.indexOf(sp.a ?? "") >= 0 ? r.periods.indexOf(sp.a!) : r.periods.length - 2);
  const ib = r.periods.indexOf(sp.b ?? "") >= 0 ? r.periods.indexOf(sp.b!) : r.periods.length - 1;
  const cmp = r.rows.map((row) => ({ name: row.name, a: row.values[ia] ?? ZERO, b: row.values[ib] ?? ZERO })).map((x) => ({ ...x, d: x.b.minus(x.a) })).filter((x) => !x.a.isZero() || !x.b.isZero()).sort((x, y) => y.d.abs().comparedTo(x.d.abs()));
  const W = 640, H = 200, L = 70, B = 26, T = 10, bw = (W - L - 8) / r.periods.length;
  const y = (v: number) => T + (1 - v / (max.toNumber() || 1)) * (H - T - B);
  return (
    <>
      <PageHead crumb="Análisis" title="Informes" desc={r.periods.length < 6 ? `Desde ${fmtPeriod(r.periods[0]).toLowerCase()}, en ${cur}.` : `Los últimos 6 meses, en ${cur}.`} actions={<><a className="btn" href="/app/exportar/excel" download>Excel</a><Link className="btn" href="/reporte">Reporte en PDF</Link></>} />
      {!has ? (
        <div className="empty">Todavía no hay movimientos para mostrar. Cuando cargues ingresos y gastos, ves acá cómo cambian mes a mes.</div>
      ) : (
        <>
          <div className="card">
            <div className="chead"><h3>Entró y salió</h3><div className="legend"><span><i style={{ background: "var(--green)" }} />Entró</span><span><i style={{ background: "var(--red)" }} />Salió</span></div></div>
            <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y gastos por mes">
              {[1, 0.5, 0].map((f) => <g key={f}><line className="grid" x1={L} x2={W} y1={y(max.toNumber() * f)} y2={y(max.toNumber() * f)} /><text className="ax" x={L - 8} y={y(max.toNumber() * f) + 4} textAnchor="end">{formatMoney(max.times(f).round(), cur)}</text></g>)}
              {r.totals.map((t, i) => {
                const x = L + i * bw + bw * 0.16, w = bw * 0.32;
                return (
                  <g key={i}>
                    <rect x={x} y={y(t.income.toNumber())} width={w} height={Math.max(0, H - B - y(t.income.toNumber()))} rx={2} fill="var(--green)"><title>{`Entró ${formatMoney(t.income, cur)}`}</title></rect>
                    <rect x={x + w + 2} y={y(t.expense.toNumber())} width={w} height={Math.max(0, H - B - y(t.expense.toNumber()))} rx={2} fill="var(--red)"><title>{`Salió ${formatMoney(t.expense, cur)}`}</title></rect>
                    <text className="ax" x={x + w} y={H - 8} textAnchor="middle">{short(r.periods[i])}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {r.periods.length > 1 && (
            <div className="card">
              <div className="chead"><h3>Comparar dos meses</h3>
                <form className="cmp-pick">
                  <select name="a" defaultValue={r.periods[ia]} aria-label="Primer mes">{r.periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}</select>
                  <span className="sub">contra</span>
                  <select name="b" defaultValue={r.periods[ib]} aria-label="Segundo mes">{r.periods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}</select>
                  <button className="btn sm" type="submit">Comparar</button>
                </form>
              </div>
              <div className="tw"><table>
                <thead><tr><th>Categoría</th><th className="n">{short(r.periods[ia])}</th><th className="n">{short(r.periods[ib])}</th><th className="n">Diferencia</th></tr></thead>
                <tbody>
                  {cmp.map((x) => <tr key={x.name}><td>{x.name}</td><td className="n">{formatMoney(x.a, cur)}</td><td className="n">{formatMoney(x.b, cur)}</td><td className={`n ${x.d.gt(0) ? "neg" : x.d.lt(0) ? "pos" : ""}`}>{x.d.isZero() ? "—" : `${x.d.gt(0) ? "↑ " : "↓ "}${formatMoney(x.d.abs(), cur)}${x.a.gt(0) ? ` (${Math.round(x.d.dividedBy(x.a).times(100).toNumber())}%)` : ""}`}</td></tr>)}
                  <tr className="tot"><td>Total gastado</td><td className="n">{formatMoney(r.totals[ia].expense, cur)}</td><td className="n">{formatMoney(r.totals[ib].expense, cur)}</td><td className="n">{formatMoney(r.totals[ib].expense.minus(r.totals[ia].expense), cur, { sign: true })}</td></tr>
                </tbody>
              </table></div>
              <p className="sub" style={{ margin: "8px 0 0" }}>Ordenado por lo que más cambió. ↑ gastaste más, ↓ gastaste menos.</p>
            </div>
          )}
          <div className="card">
            <div className="chead"><h3>Gastos por categoría</h3></div>
            <div className="tw"><table>
              <thead><tr><th>Categoría</th>{r.periods.map((p) => <th className="n" key={p} title={fmtPeriod(p)}>{short(p)}</th>)}<th className="n">Total</th></tr></thead>
              <tbody>
                {r.rows.map((row) => <tr key={row.name}><td>{row.name}</td>{row.values.map((v, i) => <td className="n" key={i}>{v.isZero() ? "—" : formatMoney(v, cur)}</td>)}<td className="n"><b>{formatMoney(row.values.reduce((s, v) => s.plus(v), ZERO), cur)}</b></td></tr>)}
                <tr className="tot"><td>Total gastado</td>{r.totals.map((t, i) => <td className="n" key={i}>{formatMoney(t.expense, cur)}</td>)}<td className="n">{formatMoney(r.totals.reduce((s, t) => s.plus(t.expense), ZERO), cur)}</td></tr>
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}
