// "Mandarme un aviso de prueba" desde Configuración.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pushToUser } from "@/server/push";
import { sameOrigin } from "@/lib/push-endpoint";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen inválido", { status: 403 });
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return new Response("Ingresá primero", { status: 401 });
  const db = getDb();
  const allowed = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${s.userId} FOR UPDATE`;
    if (await tx.auditLog.count({ where: { userId: s.userId, action: "push.test", createdAt: { gt: new Date(Date.now() - 60_000) } } })) return false;
    await tx.auditLog.create({ data: { userId: s.userId, action: "push.test" } });
    return true;
  });
  if (!allowed) return new Response("Esperá un minuto antes de probar de nuevo", { status: 429 });
  return Response.json({ sent: await pushToUser(db, s.userId) });
}
