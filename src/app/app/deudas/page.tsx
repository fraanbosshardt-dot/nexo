import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listDebts } from "@/server/debts";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createDebtAction } from "@/app/actions/modules";
import { DebtFormFields } from "./debt-form";

export const metadata: Metadata = { title: "Deudas y préstamos" };

export default async function Debts() {
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [all, accounts] = await Promise.all([listDebts(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true, name: true, currency: true } })]);
  const active = all.filter((d) => d.debt.status === "ACTIVE"), closed = all.filter((d) => d.debt.status !== "ACTIVE");
  const cur = workspace.baseCurrency;
  const total = active.filter((d) => d.debt.currency === cur).reduce((s, d) => s.plus(d.remainingCapital), ZERO);
  const thisMonth = active.flatMap((d) => d.open).filter((r) => period(r.dueDate) === period(today) || r.dueDate < today).reduce((s, r) => s.plus(r.total.toString()), ZERO);
  const lastDue = active.flatMap((d) => d.open).reduce<Date | null>((m, r) => (!m || r.dueDate > m ? r.dueDate : m), null);
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Deudas y préstamos" desc="Tocá una deuda para ver cuotas, tasas y cuánto ahorrás si la cancelás." />
      {active.length > 0 && <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}><Stat label="Total que debés" value={formatMoney(total, cur)} /><Stat label="Cuotas de este mes" value={formatMoney(thisMonth, cur)} /><Stat label="Terminás de pagar" value={lastDue ? fmtPeriod(period(lastDue)) : "—"} /></div>}
      {active.length > 0 && (
        <div className="grid g3">{active.map((d) => (
          <Link key={d.debt.id} href={`/app/deudas/${d.debt.id}`} className="card dcard" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="chead" style={{ marginBottom: 6 }}><div><h3>{d.debt.creditor}</h3><p className="sub">{d.debt.kind}</p></div>{d.overdue > 0 && <span className="pill r">Atrasada</span>}</div>
            <div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 600 }}>{formatMoney(d.remainingCapital, d.debt.currency)}</div><p className="sub">te falta devolver</p>
            {d.debt.installments ? (<><div className="bar" style={{ margin: "12px 0 6px" }}><i style={{ width: `${(d.settledCount / d.debt.installments) * 100}%`, background: "var(--ink)" }} /></div><div className="sub" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span>{d.settledCount} de {d.debt.installments} cuotas</span>{d.next && <span>Próxima: {fmtDate(d.next.dueDate)}</span>}</div></>) : <p className="sub" style={{ marginTop: 12 }}>Sin cuotas ni fecha pactada</p>}
          </Link>
        ))}</div>
      )}
      <div className="card">
        <details className="more" open={active.length === 0}>
          <summary>+ Nueva deuda o préstamo</summary>
          <ActionForm action={createDebtAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <DebtFormFields accounts={accounts} today={isoDate(today)} baseCurrency={cur} />
            <div><Submit>Guardar deuda</Submit></div>
          </ActionForm>
        </details>
        {closed.length > 0 && (
          <details className="more"><summary>Deudas terminadas ({closed.length})</summary>
            <div className="list" style={{ paddingTop: 6 }}>{closed.map((d) => <Link key={d.debt.id} className="li" href={`/app/deudas/${d.debt.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{d.debt.creditor}</div><div className="s">{d.debt.status === "CANCELLED" ? `Cancelada el ${d.debt.cancelledAt ? fmtDate(d.debt.cancelledAt) : ""}` : "Pagada por completo"}</div></div><span className="pill g">Cerrada</span></Link>)}</div>
          </details>
        )}
      </div>
    </>
  );
}
