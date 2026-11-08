import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { ownerEmails, ROLE_HELP, ROLE_NAMES, type AdminRole } from "@/server/admin-team";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { when } from "@/components/admin-ui";
import { adminAddMemberAction, adminRemoveMemberAction, adminRevokeSessionAction, adminSetRoleAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Equipo" };

export default async function Team() {
  const me = await requireAdmin("owner");
  const db = getDb();
  const [members, sessions] = await Promise.all([
    db.adminMember.findMany({ orderBy: { createdAt: "asc" } }),
    db.adminSession.findMany({ where: { revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const roles: AdminRole[] = ["OWNER", "SUPPORT", "VIEWER"];
  return (
    <>
      <PageHead title="Equipo" desc="Quién puede entrar al panel. Se entra solo con Google y con un correo de esta lista." />
      <div className="card">
        <div className="chead"><h3>Lista blanca</h3></div>
        <div className="list">
          {ownerEmails().map((e) => (
            <div className="li" key={e}><div className="grow"><div className="t">{e}</div><div className="s">Dueño fijo (variable ADMIN_EMAILS en Vercel). No se puede quitar desde acá.</div></div><span className="pill b">Dueño</span></div>
          ))}
          {members.map((m) => (
            <div className="li" key={m.id}>
              <div className="grow"><div className="t">{m.email}</div><div className="s">{m.lastLoginAt ? `Entró ${when(m.lastLoginAt)}` : "Todavía no entró"}{m.addedBy ? ` · lo sumó ${m.addedBy}` : ""}</div></div>
              {m.email === me.email ? <span className="pill b">{ROLE_NAMES[m.role as AdminRole] ?? m.role}</span> : (
                <div className="li-acts">
                  <form action={adminSetRoleAction} className="acts"><input type="hidden" name="email" value={m.email} /><select name="role" defaultValue={m.role} className="st-sel" aria-label={`Rol de ${m.email}`}>{roles.map((r) => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}</select><button className="btn sm" type="submit">Cambiar</button></form>
                  <form action={adminRemoveMemberAction}><input type="hidden" name="email" value={m.email} /><button className="btn ghost sm" type="submit">Quitar</button></form>
                </div>
              )}
            </div>
          ))}
          {!ownerEmails().length && !members.length && <p className="adm-hint">No hay nadie en la lista.</p>}
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Sumar a alguien</h3></div>
          <ActionForm action={adminAddMemberAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field">Correo de Google<input name="email" type="email" required placeholder="nombre@gmail.com" /></label>
            <label className="field">Rol<select name="role" defaultValue="SUPPORT">{roles.map((r) => <option key={r} value={r}>{ROLE_NAMES[r]} — {ROLE_HELP[r]}</option>)}</select></label>
            <div><Submit>Sumar</Submit></div>
          </ActionForm>
        </div>
        <div className="card">
          <div className="chead"><h3>Sesiones abiertas del panel</h3><span className="sub">Duran 8 horas</span></div>
          <div className="list">{sessions.map((s) => (
            <div className="li" key={s.id}>
              <div className="grow"><div className="t">{s.email}{s.id === me.sessionId ? " (vos, ahora)" : ""}</div><div className="s">Desde {when(s.createdAt)}{s.ip ? ` · ${s.ip}` : ""}</div></div>
              {s.id !== me.sessionId && <form action={adminRevokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn ghost sm" type="submit">Cerrar</button></form>}
            </div>
          ))}</div>
        </div>
      </div>
      <div className="card">
        <div className="chead"><h3>Qué puede hacer cada rol</h3></div>
        <dl className="kv">{roles.map((r) => <><dt key={`t${r}`}>{ROLE_NAMES[r]}</dt><dd key={`d${r}`} style={{ textAlign: "left" }}>{ROLE_HELP[r]}</dd></>)}</dl>
      </div>
    </>
  );
}
