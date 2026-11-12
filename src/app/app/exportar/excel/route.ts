import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { exportMovementsXlsx } from "@/server/io";

// Descarga de todos los movimientos en Excel (.xlsx), con fechas y montos que se pueden sumar y filtrar. Pro.
export async function GET() {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "informes"))) return new Response("Exportar a Excel es parte de Pro.", { status: 403 });
  const file = await exportMovementsXlsx(getDb(), workspace.id);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(file), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="guafra-movimientos-${day}.xlsx"`, "cache-control": "no-store" } });
}
