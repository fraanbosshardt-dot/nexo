import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { cardOverview, cardStatus, closingFor, dueFor, prevClosing } from "@/server/cards";
import { canUse } from "@/lib/auth/session";
import { StatementForm } from "./statement-form";
import { allocate, formatMoney } from "@/lib/money";
import { fmtDate, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { cardPurchaseAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Tarjeta" };

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, plan } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const c = (await cardOverview(db, workspace.id, today)).find((x) => x.card.id === id);
  if (!c) notFound();
  const [cats, recent] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE", parentId: null }, orderBy: { name: "asc" } }),
    db.transaction.findMany({ where: { workspaceId: workspace.id, accountId: c.card.accountId!, type: "EXPENSE" }, orderBy: { effectiveDate: "desc" }, take: 20, include: { category: true } }),
  ]);
  const status = await cardStatus(db, workspace.id, c.card.id, today);
  const toPay = status.open[0] ?? null;
  const pdf = await canUse(plan, "pdf");
  const pdfUsed = pdf ? await db.auditLog.count({ where: { workspaceId: workspace.id, action: "card.pdf_read", createdAt: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) } } }) : 0;
  const pdfLeft = Math.max(0, (await (await import("@/server/settings")).pdfMonthlyLimit(getDb())) - pdfUsed);
  const lastClose = (() => { const x = closingFor(today, c.card.closingDay); return x > today ? prevClosing(x, c.card.closingDay) : x; })();
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, c.card.currency);
  return (
    <>
      <Link className="lk" href="/app/tarjetas">← Tarjetas</Link>
      <PageHead crumb={c.card.issuer || "Tarjeta"} title={c.card.name} desc={`Cierra el ${c.card.closingDay} y vence el ${c.card.dueDay} de cada mes`} />
      <div className="card tcard">
        <div className="ccard"><div className="row"><span>{c.card.issuer}</span></div><div className="chipg" /><div className="nm">•••• •••• •••• {c.card.last4 ?? "····"}</div><div className="row"><span>{c.card.name}</span><span>Cierra el {fmtDate(c.nextClosing)}</span></div></div>
        <div>
          <div className="sub" style={{ margin: 0 }}>{!toPay ? "No tenés resúmenes sin pagar" : status.overdue ? `Atrasado · venció el ${fmtDate(toPay.dueDate)}` : `A pagar · vence el ${fmtDate(toPay.dueDate)}`}</div>
          <div className="num" style={{ fontSize: 34, margin: "4px 0 10px" }}>{toPay ? <span className={status.overdue ? "neg" : ""}>{fm(status.owed)}</span> : <span className="pos">Al día</span>}</div>
          <div className="hrow"><span>Debés en total en la tarjeta</span><b>{fm(c.debt)}</b></div>
          <div className="hrow"><span>Disponible para compras</span><b>{fm(c.available)}</b></div>
          <div className="hrow"><span>Próximo resumen (estimado)</span><b>{fm(c.nextAmount)} <span className="mut" style={{ fontWeight: 400 }}>· vence {fmtDate(c.nextDue)}</span></b></div>
          <div className="hrow"><span>Cuotas que faltan</span><b>{fm(c.futureInstallments)}</b></div>
          <div className="acts" style={{ marginTop: 12 }}>{toPay && <Link className="btn pri" href={`/app/proximos/${toPay.id}`}>Pagar resumen</Link>}<a className="btn" href="#cargar-resumen">Cargar un resumen</a></div>
          {!c.card.statements.length && !toPay && <p className="sub" style={{ marginTop: 10 }}>¿Ya debías algo cuando creaste la tarjeta? Cargá tu último resumen y Finan queda al día con lo que debés y las cuotas que siguen.</p>}
        </div>
      </div>
      <div className="card" id="cargar-resumen">
        <details className="more" open={!c.card.statements.length}>
          <summary>Cargar un resumen{pdf ? " (a mano o desde el PDF)" : ""}</summary>
          <div style={{ paddingTop: 10, maxWidth: 760 }}><StatementForm cardId={c.card.id} closing={isoDate(lastClose)} due={isoDate(dueFor(lastClose, c.card.dueDay))} pdf={pdf} pdfLeft={pdfLeft} /></div>
        </details>
      </div>
      <div className="card">
        <details className="more" open={!!c.card.statements.length}>
          <summary>+ Registrar una compra</summary>
          <ActionForm action={cardPurchaseAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <input type="hidden" name="cardId" value={c.card.id} />
            <div className="frow"><label className="field">¿Qué compraste?<input name="description" placeholder="Ej.: Supermercado" /></label><label className="field">Precio<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
            <div className="frow"><label className="field">Cuotas<select name="installments" defaultValue="1">{[1, 2, 3, 6, 9, 12, 18, 24].map((n) => <option key={n} value={n}>{n === 1 ? "En un pago" : `${n} cuotas`}</option>)}</select></label><label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label></div>
            <div className="frow"><label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label className="field">Interés<select name="interest" defaultValue="sin"><option value="sin">Sin interés</option><option value="con">Con interés</option></select></label></div>
            <label className="field">Total financiado (solo si es con interés)<input name="financedTotal" inputMode="decimal" placeholder="0,00" /></label>
            <p className="sub">El gasto se registra una vez por el total; cada mes entra la cuota en el resumen.</p>
            <div><Submit>Guardar compra</Submit></div>
          </ActionForm>
        </details>
        {c.activePlans.length > 0 && (
          <details className="more"><summary>Compras en cuotas ({c.activePlans.length})</summary>
            <div className="list" style={{ paddingTop: 6 }}>{c.activePlans.map((p) => {
              const first = p.firstStatementDate ?? closingFor(p.purchaseDate, c.card.closingDay);
              const k = Math.max(0, (c.nextClosing.getUTCFullYear() - first.getUTCFullYear()) * 12 + c.nextClosing.getUTCMonth() - first.getUTCMonth());
              const parts = allocate(p.totalAmount, p.installments);
              return (
                <div className="li" key={p.id}><div className="grow"><div className="t">{p.description}</div><div className="s">{k} de {p.installments} cuotas · {p.interestFree ? "sin interés" : "con interés"}</div><div className="bar" style={{ marginTop: 6, maxWidth: 240 }}><i style={{ width: `${(k / p.installments) * 100}%`, background: "var(--ink)" }} /></div></div>
                  <div style={{ textAlign: "right" }}><b className="num">{fm(parts[Math.min(k, parts.length - 1)])}</b><div className="s">por mes</div></div></div>
              );
            })}</div>
          </details>
        )}
        <details className="more"><summary>Últimas compras</summary>
          {recent.length ? <div className="list" style={{ paddingTop: 6 }}>{recent.map((t) => <div className="li" key={t.id}><div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDate(t.effectiveDate)} · {t.category?.name ?? "Sin categoría"} · {period(t.effectiveDate)}</div></div><b className="num">{fm(t.amount.neg())}</b></div>)}</div> : <div className="empty">Todavía no hay compras.</div>}
        </details>
        <details className="more"><summary>Resúmenes anteriores</summary>
          {c.card.statements.length ? <div className="list" style={{ paddingTop: 6 }}>{c.card.statements.map((s) => <div className="li" key={s.id}><div className="grow"><div className="t">Cierre {fmtDate(s.closingDate)}</div><div className="s">Vence {fmtDate(s.dueDate)} · mínimo {fm(s.minimumAmount)}{!s.obligationId ? "" : status.open.some((o) => o.id === s.obligationId) ? " · sin pagar" : " · pagado"}</div></div><b className="num">{fm(s.totalAmount)}</b></div>)}</div> : <div className="empty">Todavía no cerró ningún resumen.</div>}
        </details>
      </div>
    </>
  );
}
