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

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Línea simple del saldo (sin librerías): un punto por mes y el valor del último.
function BalanceLine({ data, currency }: { data: { label: string; value: number }[]; currency: string }) {
  if (data.length < 2) return null;
  const W = 600, H = 120, pad = 10;
  const vals = data.map((d) => d.value), min = Math.min(0, ...vals), max = Math.max(...vals, 1);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (data.length - 1);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  return (
    <figure className="bal-line" aria-label={`Saldo de los últimos meses: ${data.map((d) => `${d.label} ${formatMoney(d.value, currency)}`).join(", ")}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
        {min < 0 && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="bal-zero" />}
        <polyline points={pts} className="bal-path" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 5 : 3} className={d.value < 0 ? "bal-dot neg" : "bal-dot"} />)}
      </svg>
      <figcaption className="bal-labels">{data.map((d, i) => <span key={i}>{d.label}</span>)}</figcaption>
    </figure>
  );
}

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
  // Cómo fue el saldo: al cierre de cada uno de los últimos 6 meses (y hoy). Saldo de hoy menos lo que se movió después.
  const today = todayIn(workspace.timezone);
  const ends = Array.from({ length: 6 }, (_, k) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + k, 0)));
  const after = await db.transaction.findMany({ where: { workspaceId: workspace.id, accountId: a.id, effectiveDate: { gt: ends[0], lte: today } }, select: { effectiveDate: true, direction: true, amount: true } });
  const hist = [...ends.map((e) => ({ label: MES[e.getUTCMonth()], value: after.filter((t) => t.effectiveDate > e).reduce((s, t) => (t.direction === "IN" ? s.minus(t.amount.toString()) : s.plus(t.amount.toString())), bal).toNumber() })), { label: "hoy", value: bal.toNumber() }]
    .filter((h, i, arr) => i === arr.length - 1 || ends[i] >= new Date(Date.UTC(a.initialDate.getUTCFullYear(), a.initialDate.getUTCMonth(), 0)));
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
      {hist.length > 2 && (
        <div className="card">
          <div className="chead"><h3>Cómo fue el saldo</h3><span className="sub">Al cierre de cada mes</span></div>
          <BalanceLine data={hist} currency={a.currency} />
        </div>
      )}
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
