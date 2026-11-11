import { audit, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { exportBackup } from "@/server/io";

// Respaldo completo del espacio en JSON.
export async function GET() {
  const { user, workspace } = await requireWorkspace();
  const json = await exportBackup(getDb(), workspace.id);
  await audit("data.backup_downloaded", { userId: user.id, workspaceId: workspace.id });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(json, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="finan-respaldo-${day}.json"`, "cache-control": "no-store" } });
}
