import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { refreshRates } from "@/server/fx";
import { pushConfig, pushToUser } from "@/server/push";
import { remaining } from "@/server/ledger";

// Tarea diaria (Vercel Cron la llama una vez por día con CRON_SECRET):
// 1) actualiza las cotizaciones, 2) manda por email lo que vence mañana.
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
  let sent = 0, skipped = 0;
  // Solo los espacios cuyo dueño quiere avisos. Se procesan de a 20 en paralelo para no pasar el tiempo máximo.
  const workspaces = await db.workspace.findMany({
    where: { onboardedAt: { not: null }, members: { some: { role: "OWNER", user: { emailReminders: true, suspendedAt: null, deletedAt: null } } } },
    select: { id: true, timezone: true, members: { where: { role: "OWNER" }, take: 1, select: { user: { select: { email: true, name: true } } } } },
  });
  const one = async (ws: (typeof workspaces)[number]) => {
    const owner = ws.members[0]?.user;
    if (!owner) return;
    const today = todayIn(ws.timezone);
    const tomorrow = new Date(today.getTime() + 864e5);
    const due = await db.obligation.findMany({ where: { workspaceId: ws.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: tomorrow, remindedAt: null }, include: { payments: true } });
    if (!due.length) return;
    const lines = due.map((o) => `• ${o.description}: ${formatMoney(remaining(o), o.currency)} (${o.direction === "RECEIVABLE" ? "a cobrar" : "a pagar"})`);
    const r = await sendEmail({ to: owner.email, subject: due.length === 1 ? `Mañana vence ${due[0].description}` : `Mañana vencen ${due.length} pagos y cobros`, text: `Hola ${owner.name.split(" ")[0]}:\n\nMañana vence:\n${lines.join("\n")}\n\nRegistralo en ${appUrl()}/app/proximos\n\nSi no querés recibir estos avisos, apagalos en Configuración.\n\nFinan` });
    if (r.sent) { sent++; await db.obligation.updateMany({ where: { id: { in: due.map((o) => o.id) } }, data: { remindedAt: new Date() } }); } else skipped++;
  };
  for (let i = 0; i < workspaces.length; i += 20) {
    await Promise.all(workspaces.slice(i, i + 20).map((ws) => one(ws).catch((e) => { skipped++; console.error("[cron] aviso", ws.id, e); })));
  }
  const pushes = await pushDueTomorrow(db);
  await db.auditLog.create({ data: { action: "cron.diario", meta: { rates: fx, emails: sent, notSent: skipped, pushes } } });
  return Response.json({ ok: true, rates: fx, emails: sent, notSent: skipped, pushes });
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
