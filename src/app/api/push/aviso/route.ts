// El celular pide qué mostrar cuando llega un aviso (el aviso viaja vacío, sin datos).
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pushMessage } from "@/server/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return Response.json({ title: "Somos Guafra", body: "Tenés novedades en tus pagos y cobros.", url: "/app" }, { headers: { "cache-control": "no-store" } });
  return Response.json(await pushMessage(getDb(), s.userId), { headers: { "cache-control": "no-store" } });
}
