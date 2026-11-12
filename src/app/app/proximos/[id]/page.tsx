import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { matchingPaid, paidSoFar, remaining } from "@/server/ledger";
import { isEstimatedGrain, loadSaleHref } from "@/server/grain";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { deleteObligationAction, linkToPendingAction, payObligationAction, updateObligationAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Help } from "@/components/help";
import { PayChoice } from "./pay-choice";
import { symbolOf } from "@/lib/countries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const ob = await getDb().obligation.findFirst({ where: { id, workspaceId: workspace.id }, select: { direction: true } });
  return { title: ob?.direction === "RECEIVABLE" ? "Registrar cobro" : "Registrar pago" };
}

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ corregir?: string }> }) {
  const { id } = await params;
  const { corregir } = await searchParams;
  const { workspace, modules, plan } = await requireWorkspace();
  const db = getDb();
  const ob = await db.obligation.findFirst({ where: { id, workspaceId: workspace.id }, include: { payments: true, category: { select: { name: true } } } });
  if (!ob || ob.status === "SETTLED" || ob.status === "CANCELLED") notFound();
  // Una venta de cereal estimada se completa cargando la venta (quintales y precio), no con un cobro suelto.
  if (modules.cereal && isEstimatedGrain({ ...ob, category: ob.category?.name, paid: paidSoFar(ob) }) && (await canUse(plan, "cereal"))) redirect(loadSaleHref(ob.dueDate));
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const left = remaining(ob);
  const inc = ob.direction === "RECEIVABLE";
  // Cuenta propuesta: la del pago que se repite o la de pago de la tarjeta; si no, la primera.
  const rule = ob.recurringRuleId ? await db.recurringRule.findFirst({ where: { id: ob.recurringRuleId, workspaceId: workspace.id }, select: { accountId: true } }) : null;
  const card = ob.sourceType === "card" && ob.sourceId ? await db.creditCard.findFirst({ where: { id: ob.sourceId, workspaceId: workspace.id }, select: { payAccountId: true } }) : null;
  const preferred = [rule?.accountId, card?.payAccountId].find((id) => id && accounts.some((a) => a.id === id)) ?? undefined;
  const amountText = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(left.toNumber());
  const today = todayIn(workspace.timezone);
  // Ingresos y gastos que se repiten cambian de monto: por defecto, lo que se carga es el total de esta vez.
  const recurring = !!ob.recurringRuleId;
  // Resumen de tarjeta: pagar menos que el total es posible; lo que falta pasa al próximo resumen.
  const stmt = ob.sourceType === "card" ? await db.cardStatement.findUnique({ where: { obligationId: ob.id }, include: { card: { select: { financeRate: true } } } }) : null;
  const settleDefault = (inc || recurring) && !stmt;
  // ¿Ya lo cargaste a mano en Movimientos? Así no se registra dos veces.
  const already = !ob.sourceType && ob.payments.length === 0 ? await matchingPaid(db, workspace.id, ob) : null;
  // Corregir o eliminar: la tarjeta y el cereal se manejan desde su pantalla.
  const editable = ob.sourceType !== "card" && ob.sourceType !== "grain";
  const deletable = editable && ob.sourceType !== "debt" && ob.payments.length === 0;
  const cats = editable ? await db.category.findMany({ where: { workspaceId: workspace.id, archived: false, kind: inc ? "INCOME" : "EXPENSE" }, orderBy: [{ parentId: "asc" }, { name: "asc" }] }) : [];
  const options = cats.filter((c) => !c.parentId).flatMap((p) => [{ id: p.id, label: p.name }, ...cats.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  const totalText = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(ob.amount));
  const fix = editable ? (
        <details className="card" id="corregir" open={!!corregir} style={{ margin: corregir ? "0 0 12px" : "12px 0 0" }}>
          <summary style={{ cursor: "pointer", fontWeight: 500 }}>Corregir</summary>
          <ActionForm action={updateObligationAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
            <input type="hidden" name="id" value={ob.id} />
            <label className="field">Concepto<input name="description" defaultValue={ob.description} /></label>
            <div className="frow">
              <label className="field">Importe total<input name="amount" inputMode="decimal" defaultValue={totalText} /></label>
              <label className="field">{inc ? "Fecha de cobro" : "Vence el"}<input name="dueDate" type="date" defaultValue={isoDate(ob.dueDate)} /></label>
            </div>
            <label className="field">Categoría<select name="categoryId" defaultValue={ob.categoryId ?? ""}><option value="">Sin categoría</option>{options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="field">Notas<input name="notes" defaultValue={ob.notes ?? ""} /></label>
            {recurring && <p className="sub" style={{ margin: 0 }}>Se repite: el cambio es solo para esta vez. Para cambiar todos los meses, andá a Pagos que se repiten.</p>}
            {ob.sourceType === "debt" && <p className="sub" style={{ margin: 0 }}>Es una cuota de préstamo: el cronograma muestra el monto y la fecha nuevos.</p>}
            <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar cambios</Submit></div>
          </ActionForm>
          {deletable && (
            <ActionForm action={deleteObligationAction} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
              <input type="hidden" name="id" value={ob.id} />
              <span className="sub">{recurring ? "¿Esta vez no va? Se saca solo esta vez." : "¿Lo cargaste por error? Se borra del todo."}</span>
              <ConfirmSubmit className="btn danger" question={`¿Eliminar ${ob.description}${recurring ? " (solo esta vez)" : ""}?`} yes="Sí, eliminar">Eliminar</ConfirmSubmit>
            </ActionForm>
          )}
        </details>
  ) : null;
  return (
    <div className="narrow">
      <Link className="lk" href="/app/proximos">← Próximos pagos</Link>
      <PageHead crumb="Pagos y deudas" title={corregir ? "Corregir" : inc ? "Registrar cobro" : "Registrar pago"} desc={`${ob.description} · ${ob.dueDate < today ? "venció" : "vence"} el ${fmtDate(ob.dueDate)}`} />
      {!corregir && already && (
        <form action={linkToPendingAction} className="notice" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <input type="hidden" name="obligationId" value={ob.id} /><input type="hidden" name="transactionId" value={already.id} />
          <span>Ya cargaste <b style={{ fontWeight: 500 }}>{already.description}</b> el {fmtDate(already.effectiveDate)} por {formatMoney(already.amount, already.currency)} en Movimientos. Si es el mismo, no lo registres de nuevo.</span>
          <button className="btn sm pri" type="submit" style={{ marginLeft: "auto" }}>Es el mismo</button>
        </form>
      )}
      {corregir && fix}
      <div className="card">
        <dl className="kv" style={{ marginBottom: 14 }}>
          <dt>Total</dt><dd>{formatMoney(ob.amount, ob.currency)}</dd>
          <dt>{inc ? "Falta cobrar" : "Falta pagar"}</dt><dd><b>{formatMoney(left, ob.currency)}</b></dd>
          {stmt && <><dt>Pago mínimo</dt><dd>{formatMoney(stmt.minimumAmount, ob.currency)}</dd></>}
        </dl>
        {accounts.length ? (
          <ActionForm action={payObligationAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="hidden" name="obligationId" value={ob.id} /><input type="hidden" name="kind" value={inc ? "cobro" : "pago"} />
            {stmt && <PayChoice total={amountText} minimum={new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.min(Number(stmt.minimumAmount), left.toNumber()))} symbol={symbolOf(ob.currency)} interest={stmt.card.financeRate ? `TNA ${Number(stmt.card.financeRate).toString().replace(".", ",")}%` : null} />}
            <div className="frow">
              {!stmt && <label className="field">{inc ? "¿Cuánto cobraste?" : "¿Cuánto pagaste?"}<input name="amount" inputMode="decimal" defaultValue={amountText} /></label>}
              <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
            </div>
            <label className="field">{inc ? "Entra en" : "Sale de"}<select name="accountId" defaultValue={preferred}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            {!stmt && <><label className="simtg"><input type="checkbox" name="settle" defaultChecked={settleDefault} /><span><b style={{ fontWeight: 500 }}>Fue el total</b><br /><span className="sub">{inc ? "Si cobraste otro monto (más o menos), queda registrado así y no queda nada pendiente." : "Si la factura vino por otro monto, queda así y no queda nada pendiente."} Destildalo si fue una parte y falta el resto.</span></span></label>
            <div className="sub help-line">¿Qué es “Fue el total”? <Help term="total" /></div></>}
            {recurring && <label className="simtg"><input type="checkbox" name="updateFuture" /><span>Usar este monto para los próximos meses</span></label>}
            <div className="acts" style={{ justifyContent: "flex-end" }}><Link className="btn" href="/app/proximos">Cancelar</Link><Submit>{inc ? "Registrar cobro" : "Registrar pago"}</Submit></div>
          </ActionForm>
        ) : <div className="empty">Necesitás una cuenta activa en {ob.currency}. <Link className="lk" href="/app/cuentas?nueva=1">Crear cuenta</Link></div>}
      </div>
      {!corregir && fix}
    </div>
  );
}
