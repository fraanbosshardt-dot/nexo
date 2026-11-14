// Guarda (POST) o borra (DELETE) el dispositivo donde la persona activó los avisos.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { sameOrigin, validPushEndpoint, validPushKeys } from "@/lib/push-endpoint";

const okSession = async () => {
  const s = await getSession();
  return s && (!s.user.totpEnabledAt || s.twoFactorVerified) ? s : null;
};

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen inválido", { status: 403 });
  const s = await okSession();
  if (!s) return new Response("Ingresá primero", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = b?.endpoint ?? "", p256dh = b?.keys?.p256dh ?? "", auth = b?.keys?.auth ?? "";
  if (!validPushEndpoint(endpoint) || !validPushKeys(p256dh, auth)) return new Response("Datos inválidos", { status: 400 });
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const saved = await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${s.userId} FOR UPDATE`;
    const existing = await tx.pushSubscription.findUnique({ where: { endpoint } });
    if (existing && existing.userId !== s.userId) return false;
    if (!existing && await tx.pushSubscription.count({ where: { userId: s.userId } }) >= 10) return false;
    await tx.pushSubscription.upsert({ where: { endpoint }, create: { userId: s.userId, endpoint, p256dh, auth, userAgent: ua }, update: { p256dh, auth, userAgent: ua } });
    return true;
  });
  if (!saved) return new Response("No se puede registrar este dispositivo", { status: 409 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen inválido", { status: 403 });
  const s = await okSession();
  if (!s) return new Response("Ingresá primero", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (b?.endpoint) await getDb().pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId: s.userId } });
  return Response.json({ ok: true });
}
