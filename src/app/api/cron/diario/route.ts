import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { refreshRates } from "@/server/fx";
import { remaining } from "@/server/ledger";

// Tarea diaria (Vercel Cron la llama una vez por día con CRON_SECRET):
// 1) actualiza las cotizaciones, 2) manda por email lo que vence mañana.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("No autorizado", { status: 401 });
  const db = getDb();
  const fx = await refreshRates(db).catch(() => 0);
  let sent = 0, skipped = 0;
  const workspaces = await db.workspace.findMany({ where: { onboardedAt: { not: null } }, include: { members: { where: { role: "OWNER" }, include: { user: true } } } });
  for (const ws of workspaces) {
    const owner = ws.members[0]?.user;
    if (!owner || !owner.emailReminders || owner.suspendedAt || owner.deletedAt) continue;
    const today = todayIn(ws.timezone);
    const tomorrow = new Date(today.getTime() + 864e5);
    const due = await db.obligation.findMany({ where: { workspaceId: ws.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: tomorrow, remindedAt: null }, include: { payments: true } });
    if (!due.length) continue;
    const lines = due.map((o) => {
      const left = remaining(o);
      return `• ${o.description}: ${formatMoney(left, o.currency)} (${o.direction === "RECEIVABLE" ? "a cobrar" : "a pagar"})`;
    });
    const r = await sendEmail({ to: owner.email, subject: due.length === 1 ? `Mañana vence ${due[0].description}` : `Mañana vencen ${due.length} pagos y cobros`, text: `Hola ${owner.name.split(" ")[0]}:\n\nMañana vence:\n${lines.join("\n")}\n\nRegistralo en ${appUrl()}/app/proximos\n\nSi no querés recibir estos avisos, apagalos en Configuración.\n\nNEXO` });
    if (r.sent) { sent++; await db.obligation.updateMany({ where: { id: { in: due.map((o) => o.id) } }, data: { remindedAt: new Date() } }); } else skipped++;
  }
  return Response.json({ ok: true, rates: fx, emails: sent, notSent: skipped });
}
