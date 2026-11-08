import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { effectivePlan } from "@/server/plans";
import { can } from "@/server/admin-team";
import { countryByCode } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { adminAddGrantAction, adminDeleteGrantAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Clientes" };
type SP = { q?: string; plan?: string; borrada?: string };

export default async function Users({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const db = getDb();
  const [list, grants] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null, ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}), ...(sp.plan === "suspendidos" ? { suspendedAt: { not: null } } : {}) },
      include: { memberships: { take: 1, orderBy: { createdAt: "asc" }, include: { workspace: { include: { subscription: true } } } } },
      orderBy: { createdAt: "desc" }, take: 200,
    }),
    db.proGrant.findMany({ where: { usedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const users = list.filter((u) => {
    const p = effectivePlan(u.memberships[0]?.workspace.subscription);
    return sp.plan === "pro" ? p === "PRO" : sp.plan === "gratis" ? p === "FREE" : true;
  });
  const support = can(admin.role, "support");
  return (
    <>
      <PageHead title="Clientes" desc="Buscá una cuenta para ver su plan, sesiones y consultas. Nunca se ven sus montos." actions={can(admin.role, "owner") ? <a className="btn" href="/admin/export/usuarios">Descargar lista (Excel)</a> : undefined} />
      {sp.borrada && <p className="notice g">La cuenta se borró con todos sus datos.</p>}
      <div className="card">
        <form className="acts" style={{ marginBottom: 12 }}>
          <input className="adm-q" name="q" defaultValue={q} placeholder="Buscar por nombre o correo" aria-label="Buscar" />
          <select name="plan" defaultValue={sp.plan ?? ""} className="st-sel" aria-label="Filtrar"><option value="">Todos</option><option value="pro">Pro</option><option value="gratis">Gratis</option><option value="suspendidos">Suspendidos</option></select>
          <button className="btn" type="submit">Buscar</button>
        </form>
        <div className="tw"><table>
          <thead><tr><th>Cliente</th><th>País</th><th>Plan</th><th>Alta</th><th>Último uso</th><th>Estado</th></tr></thead>
          <tbody>{users.map((u) => {
            const ws = u.memberships[0]?.workspace;
            const sub = ws?.subscription;
            const plan = effectivePlan(sub);
            return (
              <tr key={u.id}>
                <td><Link className="lnk" href={`/admin/usuarios/${u.id}`} style={{ fontWeight: 500 }}>{u.name}</Link><small>{u.email}</small></td>
                <td>{ws ? countryByCode(ws.country).name : "—"}</td>
                <td>{plan === "PRO" ? <span className="pill b">Pro{sub?.provider === "manual" ? " regalado" : sub?.status === "TRIALING" ? " prueba" : ""}</span> : <span className="pill">Gratis</span>}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>{u.lastSeenAt ? fmtDate(u.lastSeenAt) : "—"}</td>
                <td>{u.suspendedAt ? <span className="pill r">Suspendida</span> : <span className="pill g">Activa</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {!users.length && <div className="empty">No encontramos clientes.</div>}
        {users.length === 200 && <p className="adm-hint">Se muestran los 200 más nuevos. Buscá para encontrar otros.</p>}
      </div>

      <div className="card">
        <div className="chead"><h3>Pro reservado por correo</h3><span className="sub">Para alguien que todavía no tiene cuenta</span></div>
        <p className="sub" style={{ fontSize: 13.5, margin: "0 0 12px" }}>Cuando esa persona se registre (con Google o con correo), arranca con Pro. Si ya tiene cuenta, se le da en el momento.</p>
        {support ? (
          <ActionForm action={adminAddGrantAction} className="frow" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "2 1 220px" }}>Correo<input name="email" type="email" required placeholder="nombre@gmail.com" /></label>
            <label className="field" style={{ flex: "1 1 150px" }}>Por cuánto tiempo<select name="days" defaultValue="30"><option value="14">14 días</option><option value="30">30 días</option><option value="90">3 meses</option><option value="365">1 año</option>{can(admin.role, "owner") && <option value="0">Sin vencimiento</option>}</select></label>
            <label className="field" style={{ flex: "2 1 200px" }}>Nota (opcional)<input name="note" placeholder="Ej.: familia, prensa" /></label>
            <Submit>Reservar</Submit>
          </ActionForm>
        ) : <p className="adm-hint">Tu rol solo puede mirar.</p>}
        {grants.length > 0 && (
          <div className="list" style={{ marginTop: 12 }}>{grants.map((g) => (
            <div className="li" key={g.id}>
              <div className="grow"><div className="t">{g.email}</div><div className="s">{g.days ? `${g.days} días` : "Sin vencimiento"} · esperando que cree la cuenta{g.note ? ` · ${g.note}` : ""} · {g.addedBy}</div></div>
              {support && <form action={adminDeleteGrantAction}><input type="hidden" name="id" value={g.id} /><button className="btn ghost sm" type="submit">Quitar</button></form>}
            </div>
          ))}</div>
        )}
      </div>
    </>
  );
}
