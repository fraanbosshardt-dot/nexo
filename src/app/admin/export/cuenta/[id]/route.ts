// Copia de todos los datos de una cuenta (derecho de acceso, Ley 25.326). Solo dueños, y queda registrado.
import { getAdmin, adminAudit } from "@/lib/auth/admin";
import { can } from "@/server/admin-team";
import { getDb } from "@/lib/db";
import { exportAccountData } from "@/server/admin-accounts";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin.role, "owner")) return new Response("No autorizado", { status: 403 });
  const { id } = await params;
  const db = getDb();
  if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) return new Response("No existe", { status: 404 });
  const data = await exportAccountData(db, id);
  await adminAudit(admin, "admin.data_exported", { entity: "user", entityId: id });
  return new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="somosguafra-datos-${id}.json"`, "cache-control": "no-store" },
  });
}
