import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { remaining } from "@/server/ledger";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { payObligationAction } from "@/app/actions/app";
import { Help } from "@/components/help";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const ob = await getDb().obligation.findFirst({ where: { id, workspaceId: workspace.id }, select: { direction: true } });
  return { title: ob?.direction === "RECEIVABLE" ? "Registrar cobro" : "Registrar pago" };
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const ob = await db.obligation.findFirst({ where: { id, workspaceId: workspace.id }, include: { payments: true } });
  if (!ob || ob.status === "SETTLED" || ob.status === "CANCELLED") notFound();
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: { createdAt: "asc" } });
  const left = remaining(ob);
  const inc = ob.direction === "RECEIVABLE";
  const today = todayIn(workspace.timezone);
  // Ingresos y gastos que se repiten cambian de monto: por defecto, lo que se carga es el total de esta vez.
  const recurring = !!ob.recurringRuleId;
  const settleDefault = inc || recurring;
  return (
    <div className="narrow">
      <Link className="lk" href="/app/proximos">← Próximos pagos</Link>
      <PageHead crumb="Pagos y deudas" title={inc ? "Registrar cobro" : "Registrar pago"} desc={`${ob.description} · ${ob.dueDate < today ? "venció" : "vence"} el ${fmtDate(ob.dueDate)}`} />
      <div className="card">
        <dl className="kv" style={{ marginBottom: 14 }}>
          <dt>Total</dt><dd>{formatMoney(ob.amount, ob.currency)}</dd>
          <dt>{inc ? "Falta cobrar" : "Falta pagar"}</dt><dd><b>{formatMoney(left, ob.currency)}</b></dd>
        </dl>
        {accounts.length ? (
          <ActionForm action={payObligationAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="hidden" name="obligationId" value={ob.id} />
            <div className="frow">
              <label className="field">{inc ? "¿Cuánto cobraste?" : "¿Cuánto pagaste?"}<input name="amount" inputMode="decimal" defaultValue={left.toFixed(2).replace(".", ",")} /></label>
              <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
            </div>
            <label className="field">{inc ? "Entra en" : "Sale de"}<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label className="simtg"><input type="checkbox" name="settle" defaultChecked={settleDefault} /><span><b style={{ fontWeight: 500 }}>Fue el total</b><br /><span className="sub">{inc ? "Si cobraste otro monto (más o menos), queda registrado así y no queda nada pendiente." : "Si la factura vino por otro monto, queda así y no queda nada pendiente."} Destildalo si fue una parte y falta el resto.</span></span></label>
            <div className="sub help-line">¿Qué es “Fue el total”? <Help term="total" /></div>
            {recurring && <label className="simtg"><input type="checkbox" name="updateFuture" /><span>Usar este monto para los próximos meses</span></label>}
            <div className="acts" style={{ justifyContent: "flex-end" }}><Link className="btn" href="/app/proximos">Cancelar</Link><Submit>{inc ? "Registrar cobro" : "Registrar pago"}</Submit></div>
          </ActionForm>
        ) : <div className="empty">Necesitás una cuenta activa en {ob.currency}. <Link className="lk" href="/app/cuentas?nueva=1">Crear cuenta</Link></div>}
      </div>
    </div>
  );
}
