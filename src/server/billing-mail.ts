import type { Db } from "./ledger";

// Los avisos son sobre la suscripción de la empresa, nunca sobre las finanzas personales.
// Resend evita duplicados concurrentes; AuditLog conserva la deduplicación a largo plazo.
export async function sendBillingNotice(db: Db, ws: string, event: string, subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) return;
  if (await db.auditLog.findFirst({ where: { action: "billing.email_sent", workspaceId: ws, entityId: event } })) return;
  const owner = await db.membership.findFirst({ where: { workspaceId: ws, role: "OWNER", user: { deletedAt: null, suspendedAt: null } }, include: { user: true } });
  if (!owner) return;
  const { sendEmail, appUrl } = await import("@/lib/email");
  const result = await sendEmail({ purpose: "billing", idempotencyKey: `billing/${event}`, to: owner.user.email, subject,
    text: `Hola ${owner.user.name.split(" ")[0]}:\n\n${body}\n\nRevisá tu plan en ${appUrl()}/app/configuracion?tab=plan\n\nEste aviso informa el estado de tu suscripción; el comprobante de pago lo emite Mercado Pago.\n\nSomos Guafra` });
  // El webhook devuelve 500 ante un error de envío para que Mercado Pago reintente.
  if (!result.sent) throw new Error(`No se pudo enviar el aviso de suscripción: ${result.reason}`);
  await db.auditLog.create({ data: { action: "billing.email_sent", workspaceId: ws, entity: "subscription", entityId: event } });
}
