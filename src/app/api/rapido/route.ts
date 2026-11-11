// Datos para la carga rápida del celular (cuentas y categorías). Solo para quien tiene la sesión abierta.
import { getSession } from "@/lib/auth/session";
import { pickMembership } from "@/server/sharing";
import { quickAddData } from "@/server/quick-add";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return new Response("Ingresá primero", { status: 401 });
  const ws = pickMembership(s.user.memberships, s.user.activeWorkspaceId)?.workspace;
  if (!ws) return new Response("Sin espacio", { status: 404 });
  return Response.json(await quickAddData(ws.id, ws.timezone), { headers: { "cache-control": "no-store" } });
}
