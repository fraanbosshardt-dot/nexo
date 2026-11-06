import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dashboard, listMovements } from "@/server/ledger";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDayMonth, fmtPeriod, period, todayIn } from "@/lib/dates";
import { Empty, PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Inicio" };

export default async function Home() {
  const { workspace, user } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const cur = workspace.baseCurrency;
  const [d, recent] = await Promise.all([dashboard(db, workspace.id, cur, today), listMovements(db, workspace.id, { take: 6 })]);
  const m = d.summary;
  const next = m.open.slice(0, 6);
  const fm = (v: Parameters<typeof formatMoney>[0], opts?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, opts);
  const hello = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date());

  if (!d.accounts.length) {
    return (
      <>
        <PageHead crumb={hello} title={`Hola, ${user.name.split(" ")[0]}`} />
        <div className="card hero"><div><div className="lbl">Primer paso</div><h2 style={{ fontFamily: "var(--f-display)", fontSize: 28, margin: "6px 0 8px" }}>Cargá tu primera cuenta</h2>
          <p className="sub">Puede ser tu caja de ahorro, una billetera virtual o el efectivo. Con eso ya ves cuánto tenés.</p>
          <div className="acts" style={{ marginTop: 14 }}><Link className="btn pri" href="/app/cuentas?nueva=1">+ Nueva cuenta</Link></div></div>
          <div className="hero-side"><div className="hrow"><span>1. Cargá tus cuentas</span><b>→</b></div><div className="hrow"><span>2. Registrá lo que pagás y cobrás</span><b>→</b></div><div className="hrow"><span>3. Mirá cuánto te queda</span><b>✓</b></div></div></div>
      </>
    );
  }

  return (
    <>
      <PageHead crumb={hello} title="Buen día" actions={<Link className="btn pri" href="/app/movimientos/nuevo">+ Nuevo movimiento</Link>} />
      <div className="card hero">
        <div>
          <div className="lbl">Disponible para usar</div>
          <div className={`big ${d.available.isNegative() ? "neg" : ""}`}>{fm(d.available)}</div>
          <p className="sub" style={{ maxWidth: "44ch" }}>Lo que tenés en tus cuentas en {cur === "ARS" ? "pesos" : cur}, menos todo lo que te falta pagar este mes.</p>
          <p className="sub" style={{ marginTop: 14 }}>A fin de {fmtPeriod(period(today)).split(" ")[0].toLowerCase()} deberías tener <b style={{ color: "var(--fg)" }}>{fm(d.projectedEndOfMonth)}</b>.</p>
        </div>
        <div className="hero-side">
          <Link className="hrow" href="/app/cuentas"><span>En tus cuentas</span><b>{fm(d.cash)}</b></Link>
          <Link className="hrow" href="/app/proximos"><span>Te falta cobrar este mes</span><b className="pos">{fm(m.pendingIn, { sign: true })}</b></Link>
          <Link className="hrow" href="/app/proximos"><span>Te falta pagar este mes</span><b>{fm(m.pendingOut.neg())}</b></Link>
          {m.overdue.length > 0 && <Link className="hrow" href="/app/proximos"><span>Atrasado</span><b className="neg">{m.overdue.length} {m.overdue.length === 1 ? "pendiente" : "pendientes"}</b></Link>}
          {d.invested.gt(0) && <div className="hrow"><span>Invertido (no disponible)</span><b>{fm(d.invested)}</b></div>}
          {d.others.map((o) => <div className="hrow" key={o.id}><span>{o.name}</span><b>{formatMoney(o.balance, o.currency)}</b></div>)}
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="chead"><div><h3>Lo que viene</h3><p className="sub">Pagos y cobros pendientes de este mes</p></div><Link className="lk" href="/app/proximos">Ver todo →</Link></div>
          {next.length ? (
            <div className="list">{next.map((o) => (
              <div className="li" key={o.id}>
                <div className="dchip"><b>{o.dueDate.getUTCDate()}</b><span>{fmtDayMonth(o.dueDate).split(" ")[1]}</span></div>
                <div className="grow"><div className="t">{o.description}</div><div className="s">{o.overdue ? <span className="neg">Atrasado</span> : o.category ?? (o.direction === "RECEIVABLE" ? "Cobro" : "Pago")}</div></div>
                <b className={`num ${o.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(o.direction === "RECEIVABLE" ? o.remaining : o.remaining.neg(), o.currency, { sign: true })}</b>
              </div>))}</div>
          ) : <Empty>No tenés pagos ni cobros pendientes este mes.</Empty>}
        </div>
        <div className="card">
          <div className="chead"><div><h3>{fmtPeriod(period(today))}</h3><p className="sub">Lo que ya pasó en el mes</p></div><Link className="lk" href="/app/movimientos">Movimientos →</Link></div>
          <div className="hrow"><span>Entró</span><b className="pos">{fm(m.income)}</b></div>
          <div className="hrow"><span>Salió</span><b>{fm(m.expense.neg())}</b></div>
          <div className="hrow"><span>Resultado hasta hoy</span><b className={m.income.minus(m.expense).isNegative() ? "neg" : "pos"}>{fm(m.income.minus(m.expense), { sign: true })}</b></div>
          <div style={{ paddingTop: 12 }}>
            <div className="sub" style={{ margin: "0 0 6px" }}>Últimos movimientos</div>
            {recent.length ? <div className="list">{recent.map((t) => (
              <div className="li" key={t.id} style={{ padding: "8px 0" }}>
                <div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDate(t.effectiveDate)} · {t.account.name}</div></div>
                <b className={`num ${t.direction === "IN" && t.type !== "TRANSFER" ? "pos" : ""}`}>{formatMoney(t.direction === "IN" ? t.amount : t.amount.neg(), t.currency, { sign: true })}</b>
              </div>))}</div> : <Empty>Todavía no registraste movimientos.</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
