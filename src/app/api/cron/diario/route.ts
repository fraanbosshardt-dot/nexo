import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { todayIn } from "@/lib/dates";
import { refreshRates } from "@/server/fx";
import { pushConfig, pushToUser } from "@/server/push";

// Tarea diaria (Vercel Cron la llama una vez por día con CRON_SECRET):
// Actualiza cotizaciones, avisos push y mantenimiento de cuentas. Sin recordatorios financieros por correo.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("No autorizado", { status: 401 });
  const db = getDb();
  try {
    return await run(db);
  } catch (e) {
    await db.auditLog.create({ data: { action: "cron.failed", meta: { error: String(e).slice(0, 300) } } }).catch(() => {});
    throw e;
  }
}

async function run(db: ReturnType<typeof getDb>) {
  const fx = await refreshRates(db).catch(() => 0);
  const sent = 0, skipped = 0; // No se envían recordatorios de finanzas personales por correo.
  const pushes = await pushDueTomorrow(db);
  const unverified = await cleanUnverified(db);
  await db.auditLog.create({ data: { action: "cron.diario", meta: { rates: fx, emails: sent, notSent: skipped, pushes, ...unverified } } });
  return Response.json({ ok: true, rates: fx, emails: sent, notSent: skipped, pushes, ...unverified });
}

// Personas con avisos en el celular y algo que vence mañana en alguno de sus espacios.
async function pushDueTomorrow(db: ReturnType<typeof getDb>) {
  if (!pushConfig().enabled) return 0;
  const users = await db.user.findMany({ where: { pushSubs: { some: {} }, suspendedAt: null, deletedAt: null }, select: { id: true, memberships: { select: { workspace: { select: { id: true, timezone: true } } } } } });
  let n = 0;
  for (const u of users) {
    let due = 0;
    for (const m of u.memberships) {
      const tomorrow = new Date(todayIn(m.workspace.timezone).getTime() + 864e5);
      due += await db.obligation.count({ where: { workspaceId: m.workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: tomorrow } });
    }
    if (due) n += await pushToUser(db, u.id);
  }
  return n;
}

// Cuentas creadas con correo que nunca se confirmaron ni se usaron: a los 23 días se avisa por correo (una vez) y a los
// 30 se borran con todos sus datos. Solo corre con los correos configurados (si no, nadie podría confirmar).
async function cleanUnverified(db: ReturnType<typeof getDb>) {
  const { emailEnabled, abandonedUnverified, UNVERIFIED_DAYS } = await import("@/server/email-verify");
  if (!emailEnabled()) return { unverifiedWarned: 0, unverifiedDeleted: 0 };
  const { ownerEmails } = await import("@/server/admin-team");
  const { deleteAccount } = await import("@/server/admin-accounts");
  const { sendVerifyEmail } = await import("@/server/account-mail");
  const staff = ownerEmails();
  const now = Date.now();
  let warned = 0, deleted = 0;
  // Aviso una semana antes: los que se borrarían dentro de 7 días y todavía no recibieron el aviso.
  const soon = await abandonedUnverified(db, now + 7 * 864e5, staff);
  for (const u of soon.slice(0, 100)) {
    if (await db.auditLog.count({ where: { action: "account.unverified_warned", entityId: u.id } })) continue;
    const user = await db.user.findUnique({ where: { id: u.id } });
    if (!user) continue;
    const r = await sendEmail({ purpose: "security", to: user.email, subject: "Tu cuenta de Somos Guafra se borra en 7 días", text: `Hola ${user.name.split(" ")[0]}:\n\nCreaste una cuenta en Somos Guafra pero nunca confirmaste tu correo ni la usaste. Si en 7 días sigue así, la borramos con todos sus datos.\n\nSi la querés conservar, entrá a ${appUrl()}/app y confirmá tu correo (te mandamos un código en otro correo).\n\nSomos Guafra` });
    if (r.sent) { await sendVerifyEmail(user); warned++; }
    await db.auditLog.create({ data: { action: "account.unverified_warned", entity: "user", entityId: u.id } });
  }
  // Borrado a los 30 días (de a 50 por día como máximo).
  for (const u of (await abandonedUnverified(db, now, staff)).slice(0, 50)) {
    await deleteAccount(db, u.id);
    await db.auditLog.create({ data: { action: "account.auto_deleted", entity: "user", entityId: u.id, meta: { reason: `sin confirmar ni usar en ${UNVERIFIED_DAYS} días` } } });
    deleted++;
  }
  return { unverifiedWarned: warned, unverifiedDeleted: deleted };
}
