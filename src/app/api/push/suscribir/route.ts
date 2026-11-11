// Guarda (POST) o borra (DELETE) el dispositivo donde la persona activó los avisos.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

const okSession = async () => {
  const s = await getSession();
  return s && (!s.user.totpEnabledAt || s.twoFactorVerified) ? s : null;
};

export async function POST(req: Request) {
  const s = await okSession();
  if (!s) return new Response("Ingresá primero", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  const endpoint = b?.endpoint ?? "", p256dh = b?.keys?.p256dh ?? "", auth = b?.keys?.auth ?? "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) return new Response("Datos inválidos", { status: 400 });
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await getDb().pushSubscription.upsert({ where: { endpoint }, create: { userId: s.userId, endpoint, p256dh, auth, userAgent: ua }, update: { userId: s.userId, p256dh, auth, userAgent: ua } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await okSession();
  if (!s) return new Response("Ingresá primero", { status: 401 });
  const b = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (b?.endpoint) await getDb().pushSubscription.deleteMany({ where: { endpoint: b.endpoint, userId: s.userId } });
  return Response.json({ ok: true });
}
