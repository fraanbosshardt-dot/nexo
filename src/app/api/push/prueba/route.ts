// "Mandarme un aviso de prueba" desde Configuración.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pushToUser } from "@/server/push";

export async function POST() {
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return new Response("Ingresá primero", { status: 401 });
  return Response.json({ sent: await pushToUser(getDb(), s.userId) });
}
