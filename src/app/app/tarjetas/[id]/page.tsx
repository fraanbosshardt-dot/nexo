import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace, canUse } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { calendar, cardGroups } from "@/server/cards";
import { StatementForm } from "./statement-form";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { addSubscriptionAction, advancePlanAction, cardPurchaseAction, cardRefundAction, deleteCardAction, endSubscriptionAction, setCycleAction, updateCardAction } from "@/app/actions/modules";
import { CardFields } from "../card-fields";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = { title: "Tarjeta" };

const PANELS: Record<string, [string]> = {
  resumen: ["Cargar un resumen"], compra: ["Registrar una compra"], devolucion: ["Devolución o reintegro"], suscripciones: ["Suscripciones"],
  cuotas: ["Compras en cuotas"], gastos: ["En qué se fue el resumen"], compras: ["Últimas compras"], resumenes: ["Resúmenes anteriores"],
  fechas: ["Fechas de este mes"], editar: ["Editar tarjeta"],
};
const OPTIONS: [string, IconName, string][] = [
  ["suscripciones", "repeat", "Netflix, gimnasio: se cargan solas"],
  ["cuotas", "cal", "Ver, corregir o adelantar"],
  ["devolucion", "minus", "Lo que te devolvieron"],
  ["gastos", "pie", "Por categoría y por persona"],
  ["compras", "list", "Las últimas que cargaste"],
  ["resumenes", "file", "Los que ya cerraron"],
  ["fechas", "clock", "Si este mes cierra en otra fecha"],
  ["editar", "gear", "Datos, monedas, límite y más"],
];

const NOTICE: Record<string, string> = {
  editada: "Listo, guardamos los cambios de la tarjeta.",
  fechas: "Listo, este mes la tarjeta cierra y vence en las fechas nuevas.",
  devolucion: "Listo, la devolución baja el próximo resumen.",
  adelantada: "Listo, las cuotas que faltaban entran en el próximo resumen.",
  suscripcion: "Listo, la suscripción se carga sola cada mes.",
  guardado: "Listo, quedó guardado.",
};

export default async function CardDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, plan } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const groups = await cardGroups(db, workspace.id, today);
  const g = groups.find((x) => x.card.id === id);
  if (!g) {
    const child = await db.creditCard.findFirst({ where: { id, workspaceId: workspace.id }, select: { parentId: true } });
    if (child?.parentId) redirect(`/app/tarjetas/${child.parentId}`);
    notFound();
  }
  const card = g.card, ch = g.child;
  const parts = [g, ...(ch ? [ch] : [])];
  const accIds = parts.map((p) => p.card.accountId!).filter(Boolean);
  const [cats, recent, accounts] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE", parentId: null }, orderBy: { name: "asc" } }),
    db.transaction.findMany({ where: { workspaceId: workspace.id, accountId: { in: accIds }, type: "EXPENSE" }, orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }], take: 25, include: { category: true } }),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const pdf = await canUse(plan, "pdf");
  const pdfUsed = pdf ? await db.auditLog.count({ where: { workspaceId: workspace.id, action: "card.pdf_read", createdAt: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) } } }) : 0;
  const pdfLeft = Math.max(0, (await (await import("@/server/settings")).pdfMonthlyLimit(getDb())) - pdfUsed);
  const cal = calendar(card);
  const lastClose = (() => { const x = cal.closingFor(today); return x > today ? cal.prev(x) : x; })();
  const fm = (v: Parameters<typeof formatMoney>[0], cur = card.currency) => formatMoney(v, cur);
  const curOf = new Map(parts.map((p) => [p.card.accountId, p.card.currency]));
  const holders = card.holders;
  const currencies = parts.map((p) => p.card.currency);
  const plans = parts.flatMap((p) => p.activePlans.map((x) => ({ ...x, currency: p.card.currency })));
  const subs = parts.flatMap((p) => p.subscriptions.map((x) => ({ ...x, currency: p.card.currency })));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  // Recién creada: el primer paso es cargar el resumen.
  const sel = sp.ver ?? (!card.statements.length && !g.status.open.length ? "resumen" : "");
  const resumenCard = parts.find((p) => p.card.currency === sp.moneda) ?? g;
  const resumenClose = (() => { const pc = calendar(resumenCard.card); const x = pc.closingFor(today); return x > today ? pc.prev(x) : x; })();
  const pickCurrency = currencies.length > 1 && <label className="field">Moneda<select name="currency" defaultValue={card.currency}>{currencies.map((c) => <option key={c}>{c}</option>)}</select></label>;
  const pickHolder = holders.length > 0 && <label className="field">¿Quién la hizo?<select name="holder" defaultValue=""><option value="">Titular</option>{holders.map((h) => <option key={h}>{h}</option>)}</select></label>;
  const spent = (rows: { name: string; amount: typeof ZERO }[], cur: string) => {
    const tot = rows.reduce((s, r) => s.plus(r.amount), ZERO);
    return rows.length ? <div className="list">{rows.map((r) => <div className="li" key={r.name}><div className="grow"><div className="t">{r.name}</div><div className="bar" style={{ marginTop: 6, maxWidth: 260 }}><i style={{ width: `${tot.gt(0) ? Math.max(2, r.amount.dividedBy(tot).times(100).toNumber()) : 0}%`, background: "var(--ink)" }} /></div></div><b className="num">{formatMoney(r.amount, cur)}</b></div>)}</div> : <div className="empty">Todavía no hay compras en este resumen.</div>;
  };
  return (
    <>
      <Link className="lk" href="/app/tarjetas">← Tarjetas</Link>
      <PageHead crumb={card.issuer || "Tarjeta"} title={card.name} desc={`Cierra el ${card.closingDay} y vence el ${card.dueDay} de cada mes${ch ? ` · consumos en ${card.currency} y ${ch.card.currency}` : ""}${card.active ? "" : " · dada de baja"}`} />
      {Object.entries(NOTICE).map(([k, t]) => sp[k] && <p key={k} className="notice g" role="status">{t}</p>)}
      {g.overAlert && <p className="notice r" role="status">Estás usando el {g.usagePct}% del límite (tu aviso es {card.alertPct}%).</p>}
      {/* Lo principal: cuánto pagás, cuándo, y las dos acciones de siempre. */}
      <div className="card tcard">
        <div className="ccard"><div className="row"><span>{card.issuer}</span></div><div className="chipg" /><div className="nm">•••• •••• •••• {card.last4 ?? "····"}</div><div className="row"><span>{card.name}</span><span>Cierra el {fmtDate(g.nextClosing)}</span></div></div>
        <div className="tsum">
          <div className="tsum-pay">
            {parts.every((p) => !p.status.open.length) ? (
              <div className="tsum-cur"><div className="sub" style={{ margin: 0 }}>No tenés resúmenes sin pagar</div><div className="num tsum-amt pos">Al día</div></div>
            ) : parts.filter((p) => p.status.open.length).map((p) => {
              const toPay = p.status.open[0];
              return (
                <div key={p.card.id} className="tsum-cur">
                  <div className="sub" style={{ margin: 0 }}>{p.status.overdue ? `Atrasado · venció el ${fmtDate(toPay.dueDate)}` : `A pagar · vence el ${fmtDate(toPay.dueDate)}`}</div>
                  <div className={`num tsum-amt ${p.status.overdue ? "neg" : ""}`}>{fm(p.status.owed, p.card.currency)}</div>
                  {toPay.partial && <div className="sub" style={{ margin: 0 }}>Pagaste una parte: lo que falta pasa al próximo resumen.</div>}
                  <Link className="btn pri sm" href={`/app/proximos/${toPay.id}`}>Pagar{ch ? ` en ${p.card.currency}` : ""}</Link>
                </div>
              );
            })}
          </div>
          <table className="tsum-t">
            {ch && <thead><tr><th /><th className="n">{card.currency}</th><th className="n">{ch.card.currency}</th></tr></thead>}
            <tbody>
              <tr><th>Próximo resumen<span className="mut tsum-when">Cierra {fmtDate(g.nextClosing)} · vence {fmtDate(g.nextDue)}</span></th>{parts.map((p) => <td key={p.card.id} className="n">{fm(p.nextAmount, p.card.currency)}</td>)}</tr>
              <tr><th>Debés en total</th>{parts.map((p) => <td key={p.card.id} className="n">{fm(p.debt, p.card.currency)}</td>)}</tr>
              <tr><th>Cuotas que faltan</th>{parts.map((p) => <td key={p.card.id} className="n">{fm(p.futureInstallments, p.card.currency)}</td>)}</tr>
            </tbody>
          </table>
          {g.usagePct != null && (
            <div>
              <div className="bar"><i style={{ width: `${Math.min(100, g.usagePct)}%`, background: g.overAlert ? "var(--red)" : "var(--ink)" }} /></div>
              <div className="hrow" style={{ borderBottom: 0 }}><span className="mut">Usás el {g.usagePct}% del límite</span><b>Disponible {fm(g.available)}</b></div>
            </div>
          )}
          {g.nextMoved && <p className="sub" style={{ margin: 0 }}>Este mes las fechas son distintas a las de siempre.</p>}
          <div className="acts">
            <Link className={`btn ${sel === "resumen" ? "pri" : ""}`} href={`?ver=resumen#panel`}>Cargar resumen</Link>
            <Link className={`btn ${sel === "compra" ? "pri" : ""}`} href={`?ver=compra#panel`}>+ Registrar compra</Link>
          </div>
        </div>
      </div>

      {!card.statements.length && !g.status.open.length && (
        <div className="card steps3">
          <div><b>1</b><span><b style={{ fontWeight: 500 }}>Cargá el resumen</b><br /><span className="sub">A mano o subiendo el PDF.</span></span></div>
          <div><b>2</b><span><b style={{ fontWeight: 500 }}>Aparece en Próximos pagos</b><br /><span className="sub">Con su vencimiento.</span></span></div>
          <div><b>3</b><span><b style={{ fontWeight: 500 }}>Lo pagás</b><br /><span className="sub">El total, el mínimo u otro monto.</span></span></div>
        </div>
      )}

      {sel && PANELS[sel] && (
        <div className="card" id="panel">
          <div className="chead"><h3>{PANELS[sel][0]}</h3><Link className="btn ghost sm" href="?#opciones">Cerrar</Link></div>
          {sel === "resumen" && (
            <>
              {ch && <div className="seg" style={{ marginBottom: 12 }}>{parts.map((p) => <Link key={p.card.id} className={`segl ${resumenCard.card.id === p.card.id ? "on" : ""}`} href={`?ver=resumen&moneda=${p.card.currency}#panel`}>Resumen en {p.card.currency}</Link>)}</div>}
              <div style={{ maxWidth: 760 }}><StatementForm key={resumenCard.card.id} cardId={resumenCard.card.id} closing={isoDate(resumenClose)} due={isoDate(calendar(resumenCard.card).due(resumenClose))} pdf={pdf} pdfLeft={pdfLeft} /></div>
            </>
          )}
          {sel === "compra" && <ActionForm action={cardPurchaseAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <input type="hidden" name="cardId" value={card.id} />
            <div className="frow"><label className="field">¿Qué compraste?<input name="description" placeholder="Ej.: Supermercado" /></label><label className="field">Precio<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
            <div className="frow"><label className="field">Cuotas<select name="installments" defaultValue="1">{[1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24].map((n) => <option key={n} value={n}>{n === 1 ? "En un pago" : `${n} cuotas`}</option>)}</select></label><label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label></div>
            <div className="frow"><label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{pickCurrency || pickHolder}</div>
            {pickCurrency && pickHolder && <div className="frow">{pickHolder}</div>}
            <details className="more"><summary>Con interés</summary>
              <div className="frow" style={{ paddingTop: 8 }}><label className="field">Interés<select name="interest" defaultValue="sin"><option value="sin">Sin interés</option><option value="con">Con interés</option></select></label><label className="field">Total financiado<input name="financedTotal" inputMode="decimal" placeholder="0,00" /></label></div>
            </details>
            <p className="sub" style={{ margin: 0 }}>El gasto se registra una vez por el total; cada mes entra la cuota en el resumen.</p>
            <div><Submit>Guardar compra</Submit></div>
          </ActionForm>}
          {sel === "devolucion" && <ActionForm action={cardRefundAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <input type="hidden" name="cardId" value={card.id} />
            <div className="frow"><label className="field">¿Qué te devolvieron?<input name="description" placeholder="Ej.: Reintegro 20% supermercado" /></label><label className="field">Importe<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
            <div className="frow"><label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label><label className="field">Categoría (la de la compra)<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
            {(pickCurrency || pickHolder) && <div className="frow">{pickCurrency}{pickHolder}</div>}
            <p className="sub" style={{ margin: 0 }}>Baja el resumen y descuenta el gasto de esa categoría.</p>
            <div><Submit>Guardar devolución</Submit></div>
          </ActionForm>}
          {sel === "suscripciones" && <div style={{ paddingTop: 6 }}>
            {subs.length > 0 && <div className="list">{subs.map((s) => (
              <div className="li" key={s.id}><div className="grow"><div className="t">{s.description}</div><div className="s">Todos los {s.dayOfMonth} · {(s.categoryId && catName.get(s.categoryId)) || "Sin categoría"}{s.holder ? ` · ${s.holder}` : ""}</div></div>
                <b className="num">{fm(s.amount, s.currency)}</b>
                <form action={endSubscriptionAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="cardId" value={card.id} /><ConfirmSubmit className="dots" ariaLabel={`Dar de baja ${s.description}`} title="Dar de baja" question={`¿Dar de baja ${s.description}? Deja de cargarse desde hoy.`} yes="Sí, dar de baja">×</ConfirmSubmit></form></div>
            ))}</div>}
            <ActionForm action={addSubscriptionAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
              <input type="hidden" name="cardId" value={card.id} />
              <div className="frow"><label className="field">¿Qué es?<input name="description" placeholder="Ej.: Netflix, gimnasio" /></label><label className="field">Importe por mes<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
              <div className="frow"><label className="field">Día que se cobra<input name="dayOfMonth" inputMode="numeric" placeholder="1 a 31" /></label><label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
              {(pickCurrency || pickHolder) && <div className="frow">{pickCurrency}{pickHolder}</div>}
              <p className="sub" style={{ margin: 0 }}>Se carga sola en la tarjeta cada mes y ya la ves en el próximo resumen.</p>
              <div><Submit>Agregar suscripción</Submit></div>
            </ActionForm>
          </div>}
          {sel === "cuotas" && (plans.length ? <><div className="list" style={{ paddingTop: 6 }}>{plans.map((p) => (
              <div className="li" key={p.id}><div className="grow"><div className="t">{p.transactionId ? <Link className="tlink" href={`/app/movimientos/${p.transactionId}`}>{p.description}</Link> : p.description}</div><div className="s">{p.paid} de {p.installments} cuotas · {p.interestFree ? "sin interés" : "con interés"} · faltan {fm(p.left, p.currency)}</div><div className="bar" style={{ marginTop: 6, maxWidth: 240 }}><i style={{ width: `${(p.paid / p.installments) * 100}%`, background: "var(--ink)" }} /></div></div>
                <div style={{ textAlign: "right" }}><b className="num">{fm(p.perMonth, p.currency)}</b><div className="s">por mes</div>
                  <form action={advancePlanAction}><input type="hidden" name="planId" value={p.id} /><input type="hidden" name="cardId" value={card.id} /><ConfirmSubmit className="btn sm" question={`¿Adelantar las cuotas de ${p.description}? Entran todas (${fm(p.left, p.currency)}) en el próximo resumen.`} yes="Sí, adelantar">Adelantar</ConfirmSubmit></form></div></div>
            ))}</div>
            <p className="sub">Para corregir o borrar una compra, tocá su nombre.</p></> : <div className="empty">No tenés compras en cuotas.</div>)}
          {sel === "gastos" && <div style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            {parts.map((p) => (
              <div key={p.card.id} className="grid g2" style={{ gap: 14 }}>
                <div><h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Resumen que cierra el {fmtDate(p.nextClosing)}{ch ? ` (${p.card.currency})` : ""}</h3>{spent(p.spentNow.byCategory, p.card.currency)}</div>
                <div><h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Resumen anterior ({fmtDate(p.lastClosed)})</h3>{spent(p.spentLast.byCategory, p.card.currency)}</div>
              </div>
            ))}
            {holders.length > 0 && <div><h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Por persona (resumen que cierra el {fmtDate(g.nextClosing)})</h3>{spent(g.spentNow.byHolder, card.currency)}</div>}
          </div>}
          {sel === "compras" && (recent.length ? <div className="list" style={{ paddingTop: 6 }}>{recent.map((t) => <Link className="li" key={t.id} href={`/app/movimientos/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}><div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDate(t.effectiveDate)} · {t.category?.name ?? "Sin categoría"} · {period(t.effectiveDate)}{t.cardHolder ? ` · ${t.cardHolder}` : ""}{t.direction === "IN" ? " · devolución" : ""}</div></div><b className={`num ${t.direction === "IN" ? "pos" : ""}`}>{fm(t.direction === "IN" ? t.amount : t.amount.neg(), curOf.get(t.accountId) ?? card.currency)}</b></Link>)}</div> : <div className="empty">Todavía no hay compras.</div>)}
          {sel === "resumenes" && (parts.some((p) => p.card.statements.length) ? <div className="list" style={{ paddingTop: 6 }}>{parts.flatMap((p) => p.card.statements.map((s) => ({ s, p }))).sort((a, b) => b.s.closingDate.getTime() - a.s.closingDate.getTime()).map(({ s, p }) => <div className="li" key={s.id}><div className="grow"><div className="t">Cierre {fmtDate(s.closingDate)}{ch ? ` · ${p.card.currency}` : ""}</div><div className="s">Vence {fmtDate(s.dueDate)} · mínimo {fm(s.minimumAmount, p.card.currency)}{Number(s.carriedAmount) > 0 ? ` · incluye ${fm(s.carriedAmount, p.card.currency)} que faltó pagar` : ""}{!s.obligationId ? "" : p.status.open.some((o) => o.id === s.obligationId) ? " · sin pagar" : " · pagado"}</div></div><b className="num">{fm(s.totalAmount, p.card.currency)}</b></div>)}</div> : <div className="empty">Todavía no cerró ningún resumen.</div>)}
          {sel === "fechas" && <ActionForm action={setCycleAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <input type="hidden" name="cardId" value={card.id} /><input type="hidden" name="usualClosing" value={isoDate(g.nextUsual.closing)} />
            <div className="frow"><label className="field">Cierra el<input name="closingDate" type="date" defaultValue={isoDate(g.nextClosing)} /></label><label className="field">Vence el<input name="dueDate" type="date" defaultValue={isoDate(g.nextDue)} /></label></div>
            <p className="sub" style={{ margin: 0 }}>Solo para el resumen que cierra cerca del {fmtDate(g.nextUsual.closing)}. Los demás meses siguen con el {card.closingDay} y el {card.dueDay}. Para volver a lo habitual, poné esas fechas.</p>
            <div><Submit>Guardar fechas</Submit></div>
          </ActionForm>}
          {sel === "editar" && <><ActionForm action={updateCardAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <input type="hidden" name="cardId" value={card.id} />
            <CardFields edit accounts={accounts} base={workspace.baseCurrency} d={{ name: card.name, issuer: card.issuer, last4: card.last4 ?? "", limit: Number(card.limitAmount).toString().replace(".", ","), closingDay: String(card.closingDay), dueDay: String(card.dueDay), currency: card.currency, payAccountId: card.payAccountId ?? undefined, currency2: ch?.card.currency ?? null, financeRate: card.financeRate ? Number(card.financeRate).toString().replace(".", ",") : "", monthlyFee: card.monthlyFee ? Number(card.monthlyFee).toString().replace(".", ",") : "", alertPct: card.alertPct ? String(card.alertPct) : "", holders: holders.join(", ") }} />
            <label className="field">Estado<select name="active" defaultValue={card.active ? "on" : "off"}><option value="on">Activa</option><option value="off">Dada de baja (deja de sumar resúmenes)</option></select></label>
            <div><Submit>Guardar cambios</Submit></div>
          </ActionForm><div style={{ marginTop: 18 }}><form action={deleteCardAction} className="dz" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="cardId" value={card.id} />
        <p className="sub" style={{ margin: 0, maxWidth: "52ch" }}>¿La cargaste por error? Eliminala: se borran sus compras, cuotas, resúmenes y los pagos que registraste. Si solo ya no la usás, mejor dala de baja en "Editar tarjeta".</p>
        <ConfirmSubmit className="btn danger" question={`¿Eliminar ${card.name}? Se borran sus compras, cuotas, resúmenes y pagos (el saldo de tus cuentas vuelve a como estaba). No se puede deshacer.`} yes="Sí, eliminar">Eliminar tarjeta</ConfirmSubmit>
      </form></div></>}
        </div>
      )}

      <div className="card" id="opciones">
        <div className="chead"><h3>Más opciones</h3></div>
        <div className="tiles">{OPTIONS.map(([k, icon, sub]) => (
          <Link key={k} href={`?ver=${k}#panel`} className={`tile ${sel === k ? "on" : ""}`}><span className="tile-ic"><Icon name={icon} /></span><span><b>{PANELS[k][0]}{k === "suscripciones" && subs.length ? ` (${subs.length})` : k === "cuotas" && plans.length ? ` (${plans.length})` : ""}</b><span className="sub">{sub}</span></span></Link>
        ))}</div>
      </div>
    </>
  );
}
