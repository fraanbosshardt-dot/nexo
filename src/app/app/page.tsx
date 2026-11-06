import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dashboard, listMovements, openObligations } from "@/server/ledger";
import { insights } from "@/server/insights";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDayMonth, periodEnd, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Inicio" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Home() {
  const { workspace, user, modules } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const cur = workspace.baseCurrency;
  const [d, recent, open, tips] = await Promise.all([
    dashboard(db, workspace.id, cur, today),
    listMovements(db, workspace.id, { take: 4 }),
    openObligations(db, workspace.id, today),
    modules.alertas ? insights(db, workspace.id, cur, today) : Promise.resolve([]),
  ]);
  const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: workspace.timezone, hour: "numeric", hour12: false }).format(new Date()));
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const dateLine = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const first = user.name.split(" ")[0];

  if (!d.accounts.length) {
    return (
      <>
        <PageHead crumb={dateLine} title={`${hello}, ${first}`} />
        <div className="card hero"><div><div className="lbl">Primer paso</div><h2 style={{ fontSize: 26, margin: "6px 0 8px" }}>Cargá tu primera cuenta</h2>
          <p className="sub">Tu banco, una billetera virtual o el efectivo, con lo que tenés hoy. Con eso ya ves cuánto podés gastar.</p>
          <div className="acts" style={{ marginTop: 14 }}><Link className="btn pri" href="/app/cuentas?nueva=1">+ Agregar una cuenta</Link></div></div>
          <div className="hero-side"><div className="hrow"><span>1. Cargá tus cuentas</span></div><div className="hrow"><span>2. Anotá lo que pagás y cobrás</span></div><div className="hrow"><span>3. Mirá cuánto te queda</span></div></div></div>
      </>
    );
  }

  // ¿Cuánto puedo gastar? Lo que tenés menos lo que tenés que pagar antes de tu próximo cobro.
  const base = open.filter((o) => o.currency === cur);
  const nextIn = base.find((o) => o.direction === "RECEIVABLE" && !o.overdue);
  const until = nextIn?.dueDate ?? periodEnd(period(today));
  const owed = base.filter((o) => o.direction === "PAYABLE" && (o.overdue || o.dueDate < until)).reduce((s, o) => s.plus(o.remaining), ZERO);
  const left = d.cash.minus(owed);
  const days = Math.max(1, Math.round((until.getTime() - today.getTime()) / 864e5));
  const perDay = left.gt(0) ? left.dividedBy(days).round() : ZERO;
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const week = open.filter((o) => o.overdue || o.dueDate <= in7).slice(0, 5);
  const tip = tips.find((t) => t.level === "urgent" || t.level === "warn") ?? tips[0];

  return (
    <>
      <PageHead crumb={dateLine} title={`${hello}, ${first}`} />
      <div className="card hero">
        <div>
          <div className="lbl">{nextIn ? `Te queda hasta tu próximo cobro, el ${fmtDayMonth(nextIn.dueDate)}` : "Te queda hasta fin de mes"}</div>
          <div className={`big ${left.isNegative() ? "neg" : ""}`}>{fm(left)}</div>
          <p className="sub" style={{ maxWidth: "46ch" }}>{left.gt(0) ? `Unos ${fm(perDay)} por día durante ${days} ${days === 1 ? "día" : "días"}.` : "Lo que tenés no alcanza para lo que vence antes. Revisá Próximos pagos."}</p>
          <div className="acts" style={{ marginTop: 16 }}>
            <Link className="btn pri" href="/app/movimientos/nuevo">+ Gasto</Link>
            <Link className="btn" href="/app/movimientos/nuevo?tipo=INCOME">+ Ingreso</Link>
            <Link className="btn" href="/app/movimientos/nuevo?tipo=TRANSFER">Transferir</Link>
          </div>
        </div>
        <div className="hero-side">
          <Link className="hrow" href="/app/cuentas"><span>En tus cuentas</span><b>{fm(d.cash)}</b></Link>
          <Link className="hrow" href="/app/proximos"><span>A pagar antes de esa fecha</span><b>{fm(owed.neg())}</b></Link>
          {nextIn && <Link className="hrow" href="/app/proximos"><span>{nextIn.description}</span><b className="pos">{formatMoney(nextIn.remaining, nextIn.currency, { sign: true })}</b></Link>}
          {d.cardDebt.gt(0) && <Link className="hrow" href="/app/tarjetas"><span>Debés en tarjetas</span><b>{fm(d.cardDebt.neg())}</b></Link>}
          {d.others.map((o) => <div className="hrow" key={o.id}><span>{o.name}</span><b>{formatMoney(o.balance, o.currency)}</b></div>)}
        </div>
      </div>
      {tip && (
        <Link href={tip.href} className={`notice ${tip.level === "urgent" ? "r" : tip.level === "good" ? "g" : ""}`} style={{ color: "inherit" }}>
          <span><b>{tip.title}</b>{tip.detail ? ` · ${tip.detail}` : ""}</span>
        </Link>
      )}
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Esta semana</h3><Link className="lk" href="/app/proximos">Ver todo</Link></div>
          {week.length ? (
            <div className="list">{week.map((o) => (
              <Link className="li" key={o.id} href={`/app/proximos/${o.id}`} style={{ color: "inherit" }}>
                <div className="dchip"><b className={o.overdue ? "neg" : ""}>{o.dueDate.getUTCDate()}</b><span>{MES[o.dueDate.getUTCMonth()]}</span></div>
                <div className="grow"><div className="t">{o.description}</div><div className="s">{o.overdue ? <span className="neg">Atrasado</span> : o.direction === "RECEIVABLE" ? "A cobrar" : "A pagar"}</div></div>
                <b className={`num ${o.direction === "RECEIVABLE" ? "pos" : "neg"}`}>{o.direction === "RECEIVABLE" ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
              </Link>))}</div>
          ) : <div className="empty">No tenés nada por pagar ni cobrar esta semana. <Link className="lk" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago</Link></div>}
        </div>
        <div className="card">
          <div className="chead"><h3>Lo último que cargaste</h3><Link className="lk" href="/app/movimientos">Movimientos</Link></div>
          {recent.length ? <div className="list">{recent.map((t) => (
            <div className="li" key={t.id}>
              <div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDayMonth(t.effectiveDate)} · {t.category?.name ?? t.account.name}</div></div>
              <b className={`num ${t.type === "TRANSFER" ? "" : t.direction === "IN" ? "pos" : "neg"}`}>{t.direction === "IN" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</b>
            </div>))}</div> : <div className="empty">Todavía no cargaste nada. <Link className="lk" href="/app/movimientos/nuevo">+ Cargar un gasto</Link></div>}
        </div>
      </div>
    </>
  );
}
