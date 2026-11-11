import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { exportMovementsCsv } from "@/server/io";

// Descarga de todos los movimientos en CSV (separado por punto y coma, abre bien en Excel).
export async function GET() {
  const { workspace } = await requireWorkspace();
  const csv = await exportMovementsCsv(getDb(), workspace.id);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="finan-movimientos-${day}.csv"`, "cache-control": "no-store" } });
}
