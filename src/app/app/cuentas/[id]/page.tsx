import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { accountBalances, listMovements } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtDayMonth, period, todayIn } from "@/lib/dates";
import { Empty, PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { reconcileAction, toggleAccountAction, updateAccountAction } from "@/app/actions/app";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Cuenta" };

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const a = await db.account.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!a) notFound();
  const [balances, mv] = await Promise.all([accountBalances(db, workspace.id, todayIn(workspace.timezone)), listMovements(db, workspace.id, { accountId: a.id, take: 100 })]);
  const bal = balances.get(a.id) ?? ZERO;
  const p = period(todayIn(workspace.timezone));
  const mes = mv.filter((t) => period(t.effectiveDate) === p);
  const ent = mes.filter((t) => t.direction === "IN").reduce((s, t) => s.plus(t.amount.toString()), ZERO);
  const sal = mes.filter((t) => t.direction === "OUT").reduce((s, t) => s.plus(t.amount.toString()), ZERO);
  return (
    <>
      <Link className="lk" href="/app/cuentas">← Cuentas</Link>
      <PageHead crumb={a.institution || ACCOUNT_TYPE_LABEL[a.type]} title={a.name} desc={`${ACCOUNT_TYPE_LABEL[a.type]} · ${a.currency}${a.active ? "" : " · Desactivada"}`}
        actions={a.active && <><Link className="btn" href={`/app/movimientos/nuevo?tipo=TRANSFER&cuenta=${a.id}`}>Transferir</Link><Link className="btn pri" href={`/app/movimientos/nuevo?cuenta=${a.id}`}>+ Movimiento</Link></>} />
      <div className="card hero">
        <div><div className="lbl">Saldo actual</div><div className={`big ${bal.isNegative() ? "neg" : ""}`}>{formatMoney(bal, a.currency)}</div>
          <p className="sub">{a.type === "INVESTMENT" ? "Está invertido: no cuenta como dinero disponible." : "Disponible para usar."}</p></div>
        <div className="hero-side">
          <div className="hrow"><span>Entró este mes</span><b className="pos">{formatMoney(ent, a.currency, { sign: true })}</b></div>
          <div className="hrow"><span>Salió este mes</span><b>{formatMoney(sal.neg(), a.currency)}</b></div>
          <div className="hrow"><span>Saldo inicial</span><b>{formatMoney(a.initialBalance, a.currency)} <span className="mut" style={{ fontWeight: 400 }}>· {fmtDate(a.initialDate)}</span></b></div>
        </div>
      </div>
      <div className="card">
        <div className="chead"><h3>Movimientos</h3><span className="sub">{mv.length} {mv.length === 1 ? "movimiento" : "movimientos"}</span></div>
        {mv.length ? <div className="list">{mv.map((t) => (
          <Link className="li" key={t.id} href={`/app/movimientos/${t.id}`} style={{ color: "inherit", ...(t.reversedBy || t.reversalOfId ? { opacity: 0.6 } : {}) }}>
            <div className="dchip"><b>{t.effectiveDate.getUTCDate()}</b><span>{fmtDayMonth(t.effectiveDate).split(" ")[1]}</span></div>
            <div className="grow"><div className="t">{t.description}</div><div className="s">{t.category?.name ?? (t.type === "TRANSFER" ? "Entre tus cuentas" : t.type === "ADJUSTMENT" ? "Corrección de saldo" : "Sin categoría")}</div></div>
            <b className={`num ${t.direction === "IN" ? "pos" : ""}`}>{formatMoney(t.direction === "IN" ? t.amount : t.amount.neg(), a.currency, { sign: true })}</b>
          </Link>))}</div> : <Empty>Todavía no hay movimientos en esta cuenta.</Empty>}
      </div>
      <div className="card">
        <details className="more" open={bal.isNegative() && a.type !== "INVESTMENT"}><summary>¿No coincide con tu banco? Corregir el saldo</summary>
          <ActionForm action={reconcileAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, maxWidth: 520 }}>
            <p className="sub">Escribí el saldo que ves en tu banco. Si es distinto, agregamos una "corrección de saldo" por la diferencia. Tus movimientos anteriores no cambian.</p>
            <input type="hidden" name="accountId" value={a.id} />
            <label className="field">Saldo según el banco<input name="target" inputMode="decimal" defaultValue={bal.toFixed(2).replace(".", ",")} /></label>
            {a.lastReconciledAt && <p className="sub">Última vez que lo corregiste: {fmtDate(a.lastReconciledAt)}</p>}
            <div><Submit className="btn">Corregir el saldo</Submit></div>
          </ActionForm>
        </details>
        <details className="more"><summary>Editar cuenta</summary>
          <ActionForm action={updateAccountAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, maxWidth: 620 }}>
            <input type="hidden" name="id" value={a.id} />
            <div className="frow"><label className="field">Nombre<input name="name" defaultValue={a.name} /></label><label className="field">Banco o institución<input name="institution" defaultValue={a.institution ?? ""} /></label></div>
            <label className="field">Notas<input name="notes" defaultValue={a.notes ?? ""} /></label>
            <div><Submit className="btn">Guardar cambios</Submit></div>
          </ActionForm>
          <form action={toggleAccountAction} style={{ marginTop: 10 }}><input type="hidden" name="id" value={a.id} />{a.active ? <ConfirmSubmit className="btn ghost" question={`¿Desactivar ${a.name}? Deja de aparecer para cargar movimientos y no suma en tus saldos. Sus movimientos quedan y la podés reactivar cuando quieras.`} yes="Sí, desactivar">Desactivar cuenta</ConfirmSubmit> : <button className="btn" type="submit">Reactivar cuenta</button>}</form>
        </details>
      </div>
    </>
  );
}
