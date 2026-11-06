import type { Metadata } from "next";
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

export default async function Reports() {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "informes"))) return <ProGate crumb="Análisis" title="Informes" text="Tus gastos por categoría mes a mes y la evolución de lo que entra y sale." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const cur = workspace.baseCurrency;
  const r = await categoryReport(getDb(), workspace.id, cur, period(todayIn(workspace.timezone)), 6);
  const max = r.totals.reduce((m, t) => (t.income.gt(m) ? t.income : t.expense.gt(m) ? t.expense : m), ZERO);
  const has = r.totals.some((t) => !t.income.isZero() || !t.expense.isZero());
  const W = 640, H = 200, L = 70, B = 26, T = 10, bw = (W - L - 8) / r.periods.length;
  const y = (v: number) => T + (1 - v / (max.toNumber() || 1)) * (H - T - B);
  return (
    <>
      <PageHead crumb="Análisis" title="Informes" desc={`Los últimos 6 meses, en ${cur}.`} />
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
