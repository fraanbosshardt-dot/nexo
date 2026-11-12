// Sugerencias de especies mientras se escribe (para cargar una inversión). Solo con sesión.
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ASSET_CLASSES, searchTickers, type AssetClass } from "@/server/quotes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return Response.json([], { status: 401 });
  const u = new URL(req.url);
  const cls = u.searchParams.get("tipo") as AssetClass;
  const q = (u.searchParams.get("q") ?? "").slice(0, 40);
  if (!ASSET_CLASSES.some((a) => a.key === cls)) return Response.json([]);
  return Response.json(await searchTickers(getDb(), cls, q), { headers: { "cache-control": "no-store" } });
}
