import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { deleteMovementAction, updateMovementAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata: Metadata = { title: "Movimiento" };

export default async function MovementDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const { error } = await searchParams;
  const db = getDb();
  const t = await db.transaction.findFirst({ where: { id, workspaceId: workspace.id }, include: { account: true, category: true, reversedBy: true, reversalOf: true, obligation: true } });
  if (!t) notFound();
  const kind = t.type === "INCOME" ? "INCOME" : "EXPENSE";
  const [cats, plan, legs, accounts] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false, kind }, orderBy: [{ parentId: "asc" }, { name: "asc" }] }),
    db.installmentPlan.findFirst({ where: { transactionId: t.id } }),
    t.transferGroupId ? db.transaction.findMany({ where: { workspaceId: workspace.id, transferGroupId: t.transferGroupId, id: { not: t.id } }, include: { account: { select: { name: true } } } }) : Promise.resolve([]),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: t.currency, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  const parents = cats.filter((c) => !c.parentId);
  const options = parents.flatMap((p) => [{ id: p.id, label: p.name }, ...cats.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  const reversed = !!(t.reversedBy || t.reversalOfId);
  const grain = t.obligation?.sourceType === "grain";
  // El importe se corrige salvo en cuotas, ventas de cereal, préstamos e inversiones (esas tienen su propia pantalla).
  const fixedAmount = !!plan || grain || t.type === "DEBT_DISBURSEMENT" || t.type === "INVESTMENT";
  // La cuenta se cambia en gastos e ingresos comunes (no en pagos de un pendiente, transferencias ni tarjetas).
  const canMove = (t.type === "INCOME" || t.type === "EXPENSE") && !t.obligationId && !t.transferGroupId && !plan && t.account.type !== "CREDIT_CARD";
  const isIn = t.direction === "IN";
  const transfer = t.type === "TRANSFER";
  const amountText = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(t.amount));
  const goneWith = [
    transfer ? "las dos partes de la transferencia" : null,
    plan ? "las cuotas que faltan de esta compra" : null,
    // Mismo criterio que el servidor: un pendiente cargado junto con este movimiento se va con él; si no, vuelve a quedar pendiente.
    t.obligation ? (!t.obligation.recurringRuleId && !t.obligation.sourceType && Math.abs(t.obligation.createdAt.getTime() - t.createdAt.getTime()) < 10_000 ? "lo que quedaba pendiente de él" : `el pago de “${t.obligation.description}”, que vuelve a quedar pendiente`) : null,
  ].filter(Boolean);
  const question = `¿Eliminar “${t.description}”? Se borra del todo${goneWith.length ? `, junto con ${goneWith.join(" y ")}` : ""}, y el saldo de la cuenta vuelve a como estaba. No se puede deshacer.`;
  return (
    <div className="narrow">
      <Link className="lk" href="/app/movimientos">← Movimientos</Link>
      <PageHead crumb="Mi dinero" title={t.description} desc={`${fmtDate(t.effectiveDate)} · ${t.account.name}${transfer && legs[0] ? ` → ${legs[0].account.name}` : ""}`} />
      {error && <p className="notice a" role="alert">{error}</p>}
      <div className="card">
        <div className="big" style={{ fontSize: 32 }}><span className={transfer ? "" : isIn ? "pos" : "neg"}>{transfer ? "" : isIn ? "+" : "−"}{formatMoney(t.amount, t.currency)}</span></div>
        {t.obligation && <p className="sub">Es un pago de “{t.obligation.description}”.</p>}
        {plan && <p className="sub">Compra en {plan.installments} cuotas con tarjeta.</p>}
        {reversed && <div className="notice" style={{ marginTop: 10 }}>{t.reversedBy ? "Este movimiento estaba anulado." : `Anulaba a “${t.reversalOf?.description}”.`} Si ya no lo necesitás, eliminalo: se borran los dos.</div>}
      </div>
      {!reversed && (
        <div className="card">
          <div className="chead"><h3>Corregir</h3></div>
          <ActionForm action={updateMovementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input type="hidden" name="id" value={t.id} />
            <div className="frow">
              <label className="field">Concepto<input name="description" defaultValue={t.description} maxLength={140} /></label>
              <label className="field">Importe{fixedAmount ? <input disabled value={formatMoney(t.amount, t.currency)} /> : <input name="amount" inputMode="decimal" defaultValue={amountText} />}</label>
            </div>
            {!transfer && (
              <div className="frow">
                <label className="field">Categoría<select name="categoryId" defaultValue={t.categoryId ?? ""}><option value="">Sin categoría</option>{options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
                {canMove && accounts.length > 1 && <label className="field">{isIn ? "Entró en" : "Salió de"}<select name="accountId" defaultValue={t.accountId}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
              </div>
            )}
            <div className="frow">
              <label className="field">Fecha<input name="effectiveDate" type="date" defaultValue={isoDate(t.effectiveDate)} /></label>
              <label className="field">Corresponde al mes<input name="economicPeriod" type="month" defaultValue={t.economicPeriod} /></label>
            </div>
            <label className="field">Notas<input name="notes" defaultValue={t.notes ?? ""} /></label>
            {fixedAmount && <p className="sub" style={{ margin: 0 }}>{grain ? "El importe de una venta de cereal se corrige desde Ventas de cereal." : plan ? "El importe de una compra en cuotas no se cambia acá: si está mal, eliminala y cargala de nuevo." : "Este importe se corrige desde su propia pantalla."}</p>}
            <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar cambios</Submit></div>
          </ActionForm>
        </div>
      )}
      <form action={deleteMovementAction} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={t.id} />
        <p className="sub" style={{ margin: 0, maxWidth: "52ch" }}>¿Lo cargaste por error? Eliminalo: se borra del todo y el saldo vuelve a como estaba.</p>
        <ConfirmSubmit className="btn danger" question={question} yes="Sí, eliminar">Eliminar movimiento</ConfirmSubmit>
      </form>
    </div>
  );
}
