// Descargas para el contador: clientes o pagos en CSV (se abre con Excel). Solo dueños, y queda registrado.
import { getAdmin, adminAudit } from "@/lib/auth/admin";
import { can } from "@/server/admin-team";
import { getDb } from "@/lib/db";
import { effectivePlan } from "@/server/plans";

export const dynamic = "force-dynamic";

// Separador ";" y BOM para que Excel en español lo abra bien. Las celdas que empiezan con = + - @ se escapan.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const admin = await getAdmin();
  if (!admin || !can(admin.role, "owner")) return new Response("No autorizado", { status: 403 });
  const { kind } = await params;
  const db = getDb();
  let body: string;
  if (kind === "usuarios") {
    const users = await db.user.findMany({ where: { deletedAt: null }, include: { memberships: { take: 1, orderBy: { createdAt: "asc" }, include: { workspace: { include: { subscription: true } } } } }, orderBy: { createdAt: "asc" } });
    body = csv([["Nombre", "Correo", "País", "Plan", "Alta", "Último uso", "Estado"], ...users.map((u) => {
      const ws = u.memberships[0]?.workspace;
      return [u.name, u.email, ws?.country, effectivePlan(ws?.subscription) === "PRO" ? "Pro" : "Gratis", u.createdAt, u.lastSeenAt, u.suspendedAt ? "Suspendida" : "Activa"];
    })]);
  } else if (kind === "pagos") {
    const inv = await db.invoice.findMany({ include: { workspace: { include: { members: { take: 1, include: { user: { select: { email: true, name: true } } } } } } }, orderBy: { createdAt: "asc" } });
    body = csv([["Fecha", "Cliente", "Correo", "Importe", "Moneda", "Estado", "Referencia"], ...inv.map((i) => [i.paidAt ?? i.createdAt, i.workspace.members[0]?.user.name, i.workspace.members[0]?.user.email, i.amount.toString().replace(".", ","), i.currency, i.status, i.providerRef])]);
  } else return new Response("No existe", { status: 404 });
  await adminAudit(admin, "admin.export", { meta: { kind } });
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nexo-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
