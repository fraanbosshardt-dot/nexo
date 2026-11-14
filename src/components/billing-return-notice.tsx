import Link from "next/link";
import { getDb } from "@/lib/db";
import { effectivePlan } from "@/server/plans";
import { BillingRefresh } from "./billing-refresh";

export async function BillingReturnNotice({ workspaceId }: { workspaceId: string }) {
  const db = getDb();
  const [sub, agreement] = await Promise.all([
    db.subscription.findUnique({ where: { workspaceId } }),
    db.billingAgreement.findFirst({ where: { workspaceId, providerRef: { not: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!agreement) return null;
  const invoice = await db.invoice.findFirst({ where: { workspaceId, agreementRef: agreement.providerRef }, orderBy: { createdAt: "desc" } });
  const paid = invoice?.status === "approved" && !!invoice.periodEnd && invoice.periodEnd > new Date() && Number(invoice.refundedAmount) < Number(invoice.amount) && effectivePlan(sub) === "PRO";
  const stopped = agreement.status === "cancelled";
  const failed = invoice && ["rejected", "cancelled", "refunded", "charged_back"].includes(invoice.status);
  const authorized = agreement.status === "authorized";
  const trial = sub?.trialEndsAt && sub.trialEndsAt > new Date();
  const scheduled = authorized && !paid && (!!trial || !!(agreement.startsAt && agreement.startsAt > new Date()));
  const waiting = !paid && !stopped && !failed && !scheduled;
  const title = paid ? "Pago confirmado. Ya tenés Pro." : stopped ? "La suscripción está cancelada" : failed ? "Revisá el estado del pago" : scheduled ? "Suscripción autorizada" : "Estamos esperando la confirmación de Mercado Pago";
  const detail = paid ? "El período pagado ya está asignado a este espacio. Podés seguir usando la app." : stopped ? "Conservás el acceso que ya tengas cubierto. Podés revisar las fechas en Tu plan." : failed ? "Ese pago no suma un nuevo período de Pro. Revisá el detalle en Tu plan; si ya pagaste, no repitas el cobro y escribinos desde Ayuda." : scheduled ? "Tu acceso actual sigue vigente y el nuevo ciclo comienza en la fecha programada, sin adelantar el cobro. Podés ver el detalle en Tu plan." : "Podés seguir usando la app mientras se actualiza el estado. Autorizar una suscripción no confirma por sí solo un pago. Si ya pagaste, no lo repitas.";
  return <div className={`notice ${paid ? "g" : failed ? "a" : "b"}`} role="status">
    <BillingRefresh waiting={waiting} />
    <div className="grow"><b>{title}</b><p style={{ margin: "4px 0 0" }}>{detail}</p></div>
    <Link className="btn sm" href="/app/configuracion?tab=plan">Ver mi plan</Link>
    <Link className="lnk" href="/app">Cerrar aviso</Link>
  </div>;
}
