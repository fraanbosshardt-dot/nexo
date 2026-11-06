import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { debtDetail } from "@/server/debts";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { cancelDebtAction, payDebtOnAccountAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Deuda" };
const SYS: Record<string, string> = { FRENCH: "Francés", GERMAN: "Alemán", AMERICAN: "Americano", NO_INTEREST: "Sin interés", MANUAL: "Manual", NONE: "Sin cronograma" };
const pct = (v: unknown) => (v == null ? "No informada" : `${Number(v).toFixed(2).replace(".", ",")}%`);

export default async function DebtPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelada?: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const det = await debtDetail(db, workspace.id, id);
  if (!det) notFound();
  const { debt } = det;
  const today = todayIn(workspace.timezone);
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: debt.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } });
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, debt.currency);
  const active = debt.status === "ACTIVE";
  const lastDue = det.open.at(-1)?.dueDate;
  return (
    <>
      <Link className="lk" href="/app/deudas">← Deudas y préstamos</Link>
      <PageHead crumb={debt.kind} title={debt.creditor} actions={active && det.next ? <Link className="btn pri" href={`/app/proximos/${det.next.obligationId}`}>Pagar cuota {det.next.number}</Link> : undefined} />
      {(await searchParams).cancelada && <div className="notice g"><div>Deuda cancelada. Las cuotas que faltaban se cerraron y ya no aparecen en tus pagos.</div></div>}
      <div className="card hero">
        <div><div className="lbl">{active ? "Te falta devolver" : debt.status === "CANCELLED" ? "Cancelada" : "Pagada"}</div><div className="big">{active ? fm(det.remainingCapital) : <span className="pos">✓</span>}</div>
          {debt.installments ? <><div className="bar" style={{ margin: "10px 0 6px", height: 10 }}><i style={{ width: `${(det.settledCount / debt.installments) * 100}%`, background: "var(--ink)" }} /></div><p className="sub">{det.settledCount} de {debt.installments} cuotas pagadas</p></> : <p className="sub">Sin cuotas ni fecha pactada.</p>}</div>
        <div className="hero-side">
          {det.next && <div className="hrow"><span>Próxima cuota</span><b>{fm(det.next.total)} <span className="mut" style={{ fontWeight: 400 }}>· {fmtDate(det.next.dueDate)}</span></b></div>}
          {lastDue && <div className="hrow"><span>Terminás de pagar</span><b>{fmtPeriod(period(lastDue))}</b></div>}
          {det.futureSum.gt(0) && <div className="hrow"><span>Si pagás todas las cuotas</span><b>{fm(det.futureSum)}</b></div>}
          <div className="hrow"><span>Te prestaron</span><b>{fm(debt.principal)}</b></div>
        </div>
      </div>
      {active && det.futureSum.gt(det.remainingCapital) && <div className="notice g"><div>Si la cancelás hoy pagando el capital que falta, te ahorrás <b>{fm(det.futureSum.minus(det.remainingCapital))}</b> en intereses (sin contar comisiones).</div></div>}
      <div className="card">
        {active && (det.rows.length ? (
          <details className="more"><summary>Cancelar total</summary>
            <ActionForm action={cancelDebtAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, maxWidth: 560 }}>
              <input type="hidden" name="debtId" value={debt.id} />
              <p className="sub">Pedile al acreedor el saldo para cancelar (capital, interés del período y comisión, si hay). Si no la tenés, usamos el capital que falta.</p>
              <div className="frow"><label className="field">Importe a pagar hoy<input name="amount" inputMode="decimal" defaultValue={det.remainingCapital.toFixed(2).replace(".", ",")} /></label><label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label></div>
              <label className="field">Sale de<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <div><Submit>Confirmar cancelación</Submit></div>
            </ActionForm>
          </details>
        ) : (
          <details className="more" open><summary>Registrar un pago a cuenta</summary>
            <ActionForm action={payDebtOnAccountAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, maxWidth: 560 }}>
              <input type="hidden" name="debtId" value={debt.id} />
              <div className="frow"><label className="field">Importe<input name="amount" inputMode="decimal" /></label><label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label></div>
              <label className="field">Sale de<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <div><Submit>Registrar pago</Submit></div>
            </ActionForm>
          </details>
        ))}
        {det.rows.length > 0 && (
          <details className="more"><summary>Cronograma de cuotas</summary>
            <div className="tw" style={{ marginTop: 8, maxHeight: 380, overflow: "auto" }}><table>
              <thead><tr><th>Cuota</th><th>Vence</th><th className="n">Capital</th><th className="n">Interés</th><th className="n">Cuota</th><th>Estado</th></tr></thead>
              <tbody>{det.rows.map((r) => <tr key={r.id}><td>{r.number}/{debt.installments}</td><td className="num">{fmtDate(r.dueDate)}</td><td className="n">{fm(r.capital)}</td><td className="n">{fm(r.interest)}</td><td className="n"><b>{fm(r.total)}</b></td>
                <td>{r.status === "SETTLED" || r.status === "PAID_BEFORE" ? <span className="pill g">Pagada</span> : r.status === "CANCELLED" ? <span className="pill">Cancelada</span> : r.dueDate < today ? <span className="pill r">Atrasada</span> : r.status === "PARTIAL" ? <span className="pill">En parte</span> : <span className="pill">Pendiente</span>}</td></tr>)}</tbody>
            </table></div>
          </details>
        )}
        <details className="more"><summary>Condiciones</summary>
          <dl className="kv" style={{ paddingTop: 8 }}><dt>Sistema</dt><dd>{SYS[debt.system]}</dd><dt>Desde</dt><dd>{fmtDate(debt.startDate)}</dd><dt>TNA</dt><dd>{pct(debt.tna)}</dd><dt>TEA</dt><dd>{pct(debt.tea)}</dd><dt>CFT</dt><dd>{pct(debt.cft)}</dd>{debt.notes && <><dt>Notas</dt><dd>{debt.notes}</dd></>}</dl>
        </details>
      </div>
    </>
  );
}
