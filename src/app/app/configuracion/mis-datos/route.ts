// Descarga de todos los datos de la propia cuenta (derecho de acceso, Ley 25.326).
import { getSession, audit } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { exportAccountData } from "@/server/admin-accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) return new Response("Ingresá primero", { status: 401 });
  const data = await exportAccountData(getDb(), s.userId);
  await audit("auth.data_downloaded", { userId: s.userId });
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="mis-datos-nexo-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" },
  });
}
