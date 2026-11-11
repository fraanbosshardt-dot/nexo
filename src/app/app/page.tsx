import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { isEstimatedGrain, loadSaleHref } from "@/server/grain";
import { getDb } from "@/lib/db";
import { dashboard, listMovements, openObligations } from "@/server/ledger";
import { insights } from "@/server/insights";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDayMonth, periodEnd, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { quickConfirmAction } from "@/app/actions/app";
import { InstallApp } from "@/components/pwa";
import { OnceButton } from "@/components/forms";
import { Help } from "@/components/help";
import { QuickButtons } from "@/components/quick-buttons";
import { categoryIcon, ICON_TONE } from "@/lib/category-icon";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = { title: "Inicio" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Home({ searchParams }: { searchParams: Promise<{ listo?: string; solomirar?: string; compartido?: string }> }) {
  const { listo, solomirar, compartido } = await searchParams;
  const { workspace, user, modules, plan } = await requireWorkspace();
  const grainOn = !!modules.cereal && (await canUse(plan, "cereal"));
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const cur = workspace.baseCurrency;
  // Lo principal primero (saldo y pendientes). El consejo y lo último cargado se muestran apenas estén, sin frenar el resto.
  const [d, open, incomeRules, expenseRules, expenses, grainSales] = await Promise.all([
    dashboard(db, workspace.id, cur, today), openObligations(db, workspace.id, today),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "RECEIVABLE" } }),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "PAYABLE" } }),
    db.transaction.count({ where: { workspaceId: workspace.id, type: "EXPENSE" } }),
    grainOn ? db.grainSale.count({ where: { workspaceId: workspace.id } }) : 0,
  ]);
  // Primeros pasos: se tachan solos y desaparecen cuando están todos.
  const steps: [boolean, string, string][] = [
    [true, "Cargá tu primera cuenta", "/app/cuentas"],
    // Para un productor, lo que cobra seguido es la venta de cereal.
    grainOn ? [incomeRules > 0 || grainSales > 0, "Cargá tu venta de cereal o estimá los meses", "/app/cereal"] : [incomeRules > 0, "Cargá tu sueldo o lo que cobrás seguido", "/app/recurrentes?nueva=1"],
    [expenseRules > 0, "Cargá tus gastos fijos (luz, expensas, alquiler)", "/app/recurrentes?nueva=1"],
    [expenses > 0, "Anotá un gasto del día", "/app/movimientos/nuevo"],
  ];
  const stepsLeft = steps.filter(([ok]) => !ok).length;
  const dayOfMonth = today.getUTCDate();
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);
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
  // Lo estimado (venta mensual de cereal sin cargar) no es plata segura: no entra en "te queda" ni en el fin de mes.
  const sure = base.filter((o) => !isEstimatedGrain(o));
  const estimatedIn = base.filter((o) => isEstimatedGrain(o) && o.dueDate <= periodEnd(period(today))).reduce((s, o) => s.plus(o.remaining), ZERO);
  // Próximo cobro: el siguiente después de hoy (lo de hoy se confirma en "Para confirmar").
  const nextIn = sure.find((o) => o.direction === "RECEIVABLE" && o.dueDate > today);
  const until = nextIn?.dueDate ?? periodEnd(period(today));
  const owed = base.filter((o) => o.direction === "PAYABLE" && (o.overdue || o.dueDate < until)).reduce((s, o) => s.plus(o.remaining), ZERO);
  const left = d.cash.minus(owed);
  const days = Math.max(1, Math.round((until.getTime() - today.getTime()) / 864e5));
  const perDay = left.gt(0) ? left.dividedBy(days).round() : ZERO;
  // Lo que viene: todo lo que hay por cobrar, y cómo terminás el mes con lo que entra y sale.
  const toCollect = base.filter((o) => o.direction === "RECEIVABLE");
  const toCollectTotal = toCollect.reduce((s, o) => s.plus(o.remaining), ZERO);
  const monthEnd = periodEnd(period(today));
  const endOfMonth = d.cash.plus(sure.filter((o) => o.direction === "RECEIVABLE" && o.dueDate <= monthEnd).reduce((s, o) => s.plus(o.remaining), ZERO)).minus(base.filter((o) => o.direction === "PAYABLE" && o.dueDate <= monthEnd).reduce((s, o) => s.plus(o.remaining), ZERO));
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const week = open.filter((o) => o.overdue || o.dueDate <= in7).slice(0, 5);
  // Lo que vence hoy o ya venció: primero los cobros. Se confirma con un toque o se cambia el monto y la fecha.
  const dueNow = open.filter((o) => o.dueDate <= today).sort((a, b) => (a.direction === b.direction ? 0 : a.direction === "RECEIVABLE" ? -1 : 1));
  const toConfirm = dueNow.slice(0, 3);

  return (
    <>
      <PageHead crumb={dateLine} title={`${hello}, ${first}`} />
      <div className="card hero">
        <div className="hero-main">
          <div className="lbl">{nextIn ? `Te queda hasta tu próximo cobro, el ${fmtDayMonth(nextIn.dueDate)}` : "Te queda hasta fin de mes"}</div>
          <div className={`big ${left.isNegative() ? "neg" : ""}`}>{fm(left)}</div>
          <p className="sub" style={{ maxWidth: "46ch" }}>{left.gt(0) ? `Unos ${fm(perDay)} por día durante ${days} ${days === 1 ? "día" : "días"}.` : "Lo que tenés no alcanza para lo que vence antes. Revisá Próximos pagos."}</p>
          <div className="mbar m-only" aria-hidden="true"><i style={{ width: `${monthPct}%` }} /></div>
          <span className="mbar-l m-only">Pasaron {dayOfMonth} de {daysInMonth} días del mes</span>
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
          {toCollect.length > 0 && <Link className="hrow" href="/app/proximos?ver=cobrar"><span>Por cobrar ({toCollect.length})</span><b className="pos">{formatMoney(toCollectTotal, cur, { sign: true })}</b></Link>}
          {toCollect.length > 0 && <div className="sub hero-help">Por cobrar todavía no está en tus cuentas <Help term="porcobrar" /></div>}
          <Link className="hrow" href="/app/flujo"><span>A fin de mes terminás con</span><b className={endOfMonth.isNegative() ? "neg" : ""}>{fm(endOfMonth)}</b></Link>
          {estimatedIn.gt(0) && <div className="sub hero-help">Si se cumple lo estimado del cereal, {fm(estimatedIn, { sign: true })} más</div>}
          {d.cardDebt.gt(0) && <Link className="hrow" href="/app/tarjetas"><span>Debés en tarjetas</span><b>{fm(d.cardDebt.neg())}</b></Link>}
          {d.others.map((o) => <div className="hrow" key={o.id}><span>{o.name}</span><b>{formatMoney(o.balance, o.currency)}</b></div>)}
        </div>
      </div>
      <QuickButtons cereal={!!modules.cereal} />
      {solomirar && <p className="notice a" role="status">En este espacio solo podés mirar: no se guardó ningún cambio. Si necesitás cargar, pedile a quien te invitó que te dé permiso.</p>}
      {compartido && <p className="notice g" role="status">Listo, ya estás en el espacio compartido. Para volver al tuyo, abrí el menú de tu cuenta.</p>}
      {listo && <p className="notice g" role="status">{listo === "cobro" ? "Listo, registramos el cobro." : "Listo, registramos el pago."}</p>}
      {toConfirm.length > 0 && (
        <div className="card cf-card">
          <div className="chead"><div><h3>Para confirmar</h3><p className="sub">Tocá cuando ya esté hecho</p></div><span className="pill b">{dueNow.length}</span></div>
          <div className="list">{toConfirm.map((o) => {
            const rec = o.direction === "RECEIVABLE";
            const isToday = o.dueDate.getTime() === today.getTime();
            if (grainOn && isEstimatedGrain(o)) return (
              <div className="li cf-li" key={o.id}>
                <span className="cf-ic in" aria-hidden="true"><Icon name="grain" /></span>
                <div className="grow">
                  <div className="t">{isToday ? "Hoy estimabas cobrar una venta de cereal" : "¿Ya vendiste el cereal de este mes?"}</div>
                  <div className="s">Estimabas {formatMoney(o.remaining, o.currency)}{isToday ? "" : ` · era el ${fmtDayMonth(o.dueDate)}`}</div>
                </div>
                <div className="cf-acts"><Link className="btn pri sm" href={loadSaleHref(o.dueDate)}>Cargar venta</Link></div>
              </div>
            );
            return (
              <div className="li cf-li" key={o.id}>
                <span className={`cf-ic ${rec ? "in" : "out"}`} aria-hidden="true"><Icon name={rec ? "plus" : "minus"} /></span>
                <div className="grow">
                  <div className="t">{rec ? (isToday ? `Hoy cobrás ${o.description}` : `¿Ya cobraste ${o.description}?`) : (isToday ? `Hoy vence ${o.description}` : `¿Ya pagaste ${o.description}?`)}</div>
                  <div className="s">{rec ? "Esperabas" : "Son"} {formatMoney(o.remaining, o.currency)}{isToday ? "" : ` · era el ${fmtDayMonth(o.dueDate)}`}</div>
                </div>
                <div className="cf-acts">
                  <form action={quickConfirmAction}><input type="hidden" name="obligationId" value={o.id} /><OnceButton>{rec ? "Sí, lo cobré" : "Sí, lo pagué"}</OnceButton></form>
                  <Link className="btn sm" href={`/app/proximos/${o.id}`}>Otro monto o fecha</Link>
                </div>
              </div>
            );
          })}</div>
          {dueNow.length > toConfirm.length && <div className="acts" style={{ justifyContent: "center", paddingTop: 10 }}><Link className="btn sm" href="/app/proximos">Ver {dueNow.length - toConfirm.length} más en Próximos pagos</Link></div>}
        </div>
      )}
      {stepsLeft > 0 && (
        <div className="card">
          <div className="chead"><div><h3>Primeros pasos</h3><p className="sub">Te faltan {stepsLeft}. Con esto Finan te muestra cuánto vas a tener cada mes.</p></div></div>
          <ol className="steps">{steps.map(([ok, label, href]) => <li key={label} className={ok ? "ok" : ""}>{ok ? <span>{label}</span> : <Link className="lnk" href={href}>{label}</Link>}</li>)}</ol>
        </div>
      )}
      <InstallApp />
      {modules.alertas && <Suspense fallback={null}><Tip ws={workspace.id} cur={cur} today={today} open={open} /></Suspense>}
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
          <Suspense fallback={<div className="sk-card" style={{ height: 160 }} />}><Recent ws={workspace.id} /></Suspense>
        </div>
      </div>
      <Suspense fallback={null}><Spending ws={workspace.id} cur={cur} today={today} /></Suspense>
    </>
  );
}

// Consejo del día: se calcula aparte y aparece apenas está listo.
async function Tip({ ws, cur, today, open }: { ws: string; cur: string; today: Date; open: Awaited<ReturnType<typeof openObligations>> }) {
  const tips = await insights(getDb(), ws, cur, today, { open });
  const tip = tips.find((t) => t.level === "urgent" || t.level === "warn") ?? tips[0];
  if (!tip) return null;
  return (
    <Link href={tip.href} className={`notice ${tip.level === "urgent" ? "r" : tip.level === "good" ? "g" : ""}`} style={{ color: "inherit" }}>
      <span><b>{tip.title}</b>{tip.detail ? ` · ${tip.detail}` : ""}</span>
    </Link>
  );
}

async function Recent({ ws }: { ws: string }) {
  const recent = await listMovements(getDb(), ws, { take: 4 });
  if (!recent.length) return <div className="empty">Todavía no cargaste nada. <Link className="lk" href="/app/movimientos/nuevo">+ Cargar un gasto</Link></div>;
  return (
    <div className="list">{recent.map((t) => (
      <div className="li" key={t.id}>
        <div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDayMonth(t.effectiveDate)} · {t.category?.name ?? t.account.name}</div></div>
        <b className={`num ${t.type === "TRANSFER" ? "" : t.direction === "IN" ? "pos" : "neg"}`}>{t.direction === "IN" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</b>
      </div>))}</div>
  );
}

// "En qué se fue la plata" este mes (solo en el celular): las 4 categorías con más gasto.
async function Spending({ ws, cur, today }: { ws: string; cur: string; today: Date }) {
  const db = getDb();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const rows = await db.transaction.groupBy({ by: ["categoryId"], where: { workspaceId: ws, type: "EXPENSE", currency: cur, direction: "OUT", effectiveDate: { gte: from }, reversalOfId: null, reversedBy: null }, _sum: { amount: true } });
  const ids = rows.map((r) => r.categoryId).filter(Boolean) as string[];
  const cats = await db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const named = rows.map((r) => ({ name: cats.find((c) => c.id === r.categoryId)?.name ?? "Sin categoría", total: Number(r._sum.amount ?? 0) })).sort((a, b) => b.total - a.total).slice(0, 4);
  if (!named.length) return null;
  const max = named[0].total || 1;
  return (
    <div className="card m-only spend">
      <div className="chead"><h3>En qué se fue la plata</h3><Link className="lk" href="/app/movimientos">Este mes</Link></div>
      {named.map((c) => {
        const icon = categoryIcon(c.name);
        return (
          <div className="spend-row" key={c.name}>
            <span className={`cat-ic t-${ICON_TONE[icon]}`}><Icon name={icon as IconName} /></span>
            <div className="grow">
              <div className="spend-top"><span>{c.name}</span><b>{formatMoney(String(c.total), cur)}</b></div>
              <div className="spend-bar"><i style={{ width: `${Math.max(4, Math.round((c.total / max) * 100))}%` }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
