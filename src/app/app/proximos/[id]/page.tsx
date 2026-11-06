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

export const metadata: Metadata = { title: "Registrar pago" };

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
  return (
    <>
      <Link className="lk" href="/app/proximos">← Próximos pagos</Link>
      <PageHead crumb="Pagos y deudas" title={inc ? "Registrar cobro" : "Registrar pago"} desc={`${ob.description} · ${ob.dueDate < today ? "venció" : "vence"} el ${fmtDate(ob.dueDate)}`} />
      <div className="card" style={{ maxWidth: 560 }}>
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
            <p className="sub">Si es menos de lo que falta, el resto queda pendiente con la misma fecha.</p>
            <div className="acts" style={{ justifyContent: "flex-end" }}><Link className="btn" href="/app/proximos">Cancelar</Link><Submit>{inc ? "Registrar cobro" : "Registrar pago"}</Submit></div>
          </ActionForm>
        ) : <div className="empty">Necesitás una cuenta activa en {ob.currency}. <Link className="lk" href="/app/cuentas?nueva=1">Crear cuenta</Link></div>}
      </div>
    </>
  );
}
