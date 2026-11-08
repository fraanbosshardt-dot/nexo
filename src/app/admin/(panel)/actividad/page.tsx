import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { PageHead } from "@/components/page";
import { actionName, when } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Actividad" };
const FILTERS: [string, string, string | null][] = [["", "Todo", null], ["equipo", "Equipo", "admin."], ["ingresos", "Ingresos", "auth."], ["cobros", "Cobros", "billing."], ["tareas", "Tareas", "cron."]];

export default async function Activity({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = FILTERS.find(([k]) => k === (sp.ver ?? "")) ?? FILTERS[0];
  const q = (sp.q ?? "").trim().toLowerCase();
  const logs = await getDb().auditLog.findMany({
    where: {
      ...(f[2] ? { action: { startsWith: f[2] } } : {}),
      ...(q ? { OR: [{ user: { email: { contains: q, mode: "insensitive" } } }, { entityId: { contains: q, mode: "insensitive" } }, { meta: { path: ["admin"], string_contains: q } }] } : {}),
    },
    include: { user: { select: { email: true, id: true } } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return (
    <>
      <PageHead title="Actividad" desc="Todo lo que pasó, con quién lo hizo. Lo del equipo muestra el correo del panel." />
      <div className="acts">
        <div className="seg">{FILTERS.map(([k, l]) => <Link key={k} className={`segl ${f[0] === k ? "on" : ""}`} href={`/admin/actividad${k ? `?ver=${k}` : ""}`}>{l}</Link>)}</div>
        <form className="acts"><input type="hidden" name="ver" value={f[0]} /><input className="adm-q" name="q" defaultValue={q} placeholder="Buscar por correo" aria-label="Buscar por correo" /><button className="btn" type="submit">Buscar</button></form>
      </div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué pasó</th><th>Detalle</th></tr></thead>
        <tbody>{logs.map((l) => {
          const m = (l.meta ?? {}) as Record<string, unknown>;
          const who = typeof m.admin === "string" ? `${m.admin} (equipo)` : l.user?.email ?? (l.entity === "email" ? l.entityId : "—");
          const detail = [m.email, m.plan, m.code, m.subject, m.role, m.days !== undefined ? (m.days ? `${m.days} días` : "sin vencimiento") : null, m.via].filter((x) => typeof x === "string" || typeof x === "number").join(" · ");
          return <tr key={l.id}><td style={{ whiteSpace: "nowrap" }}>{when(l.createdAt)}</td><td>{l.user ? <Link className="lnk" href={`/admin/usuarios/${l.user.id}`}>{who}</Link> : who}</td><td>{actionName(l.action)}</td><td>{detail || "—"}</td></tr>;
        })}</tbody>
      </table></div>
      {!logs.length && <div className="empty">Nada para mostrar.</div>}</div>
    </>
  );
}
