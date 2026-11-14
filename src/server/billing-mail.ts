import type { Db } from "./ledger";
import type { Prisma } from "@/generated/prisma/client";
import type { EmailPurpose } from "@/lib/email-template";

type MailDb = Pick<Prisma.TransactionClient, "emailOutbox" | "membership">;

// La cola se escribe junto al cambio de negocio. Un fallo del correo no deshace una baja.
export async function queueBillingNotice(db: MailDb, ws: string, event: string, subject: string, body: string) {
  const owner = await db.membership.findFirst({ where: { workspaceId: ws, role: "OWNER", user: { deletedAt: null, suspendedAt: null } }, include: { user: true } });
  if (!owner) return;
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const dedupeKey = `billing/${ws}/${event}`;
  await db.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, workspaceId: ws, purpose: "billing", to: owner.user.email, subject,
    text: `Hola ${owner.user.name.split(" ")[0]}:\n\n${body}\n\nRevisá tu plan en ${base}/app/configuracion?tab=plan\n\nEste aviso informa el estado de tu suscripción.\n\nsomosguafra` } });
}

export async function drainEmailOutbox(db: Db, limit = 20) {
  if (!process.env.RESEND_API_KEY) return 0;
  const rows = await db.emailOutbox.findMany({ where: { sentAt: null, nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit });
  let delivered = 0;
  const { sendEmail } = await import("@/lib/email");
  for (const row of rows) {
    const now = new Date();
    const lease = await db.emailOutbox.updateMany({ where: { id: row.id, sentAt: null, nextAttemptAt: { lte: now } }, data: { nextAttemptAt: new Date(now.getTime() + 60_000), attempts: { increment: 1 } } });
    if (!lease.count) continue;
    const result = await sendEmail({ purpose: row.purpose as EmailPurpose, to: row.to, subject: row.subject, text: row.text, idempotencyKey: row.dedupeKey });
    if (result.sent) {
      await db.emailOutbox.update({ where: { id: row.id }, data: { sentAt: new Date(), providerId: result.id ?? null, lastError: null } });
      delivered++;
    } else {
      await db.emailOutbox.update({ where: { id: row.id }, data: { lastError: result.reason, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(row.attempts, 6))) } });
    }
  }
  return delivered;
}

export async function sendBillingNotice(db: Db, ws: string, event: string, subject: string, body: string) {
  await queueBillingNotice(db, ws, event, subject, body);
  await drainEmailOutbox(db).catch((e) => console.error("[email outbox]", e));
}
