import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { announcement } from "@/server/settings";
import { AUDIENCES } from "@/server/admin-comms";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { adminAddNewsAction, adminClearAnnouncementAction, adminDeleteNewsAction, adminSaveAnnouncementAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Comunicaciones" };

export default async function Comms() {
  const admin = await requireAdmin();
  const owner = can(admin.role, "owner");
  const db = getDb();
  const [ann, news] = await Promise.all([
    announcement(db),
    db.productNews.findMany({ orderBy: { publishedAt: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <PageHead title="Comunicaciones" desc="Avisos dentro de la app y la página de novedades. Sin campañas por correo." />
      {!owner && <p className="notice a">Tu rol solo puede mirar esta sección.</p>}

      <div className="card">
        <div className="chead"><h3>Aviso dentro de la app</h3><span className="sub">Aparece arriba de todo, en todas las pantallas</span></div>
        {ann ? (
          <div className={`notice ${ann.tone === "warn" ? "a" : "b"}`} style={{ marginBottom: 12 }}>
            <span><b>Publicado ahora:</b> {ann.text} · para {AUDIENCES.find(([k]) => k === ann.audience)?.[1].toLowerCase() ?? "todos"}{ann.until ? ` · hasta el ${fmtDate(new Date(`${ann.until}T12:00:00Z`))}` : ""}</span>
          </div>
        ) : <p className="adm-hint">No hay ningún aviso publicado.</p>}
        {owner && (
          <ActionForm action={adminSaveAnnouncementAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field">Texto (hasta 240 letras)<input name="text" defaultValue={ann?.text ?? ""} maxLength={240} placeholder="Nuevo: ahora podés leer el resumen de la tarjeta desde el PDF." /></label>
            <div className="frow" style={{ flexWrap: "wrap" }}>
              <label className="field" style={{ flex: "1 1 140px" }}>Tipo<select name="tone" defaultValue={ann?.tone ?? "info"}><option value="info">Novedad</option><option value="warn">Importante</option></select></label>
              <label className="field" style={{ flex: "1 1 140px" }}>Para<select name="audience" defaultValue={ann?.audience ?? "all"}><option value="all">Todos</option><option value="free">Plan Gratis</option><option value="pro">Plan Pro</option></select></label>
              <label className="field" style={{ flex: "1 1 150px" }}>Hasta (opcional)<input name="until" type="date" defaultValue={ann?.until ?? ""} /></label>
              <label className="field" style={{ flex: "2 1 200px" }}>Enlace (opcional)<input name="link" defaultValue={ann?.link ?? ""} placeholder="Ej.: /novedades (escribilo para que aparezca «Ver más»)" /></label>
            </div>
            <div className="acts"><Submit>Publicar aviso</Submit></div>
          </ActionForm>
        )}
        {owner && ann && <form action={adminClearAnnouncementAction} style={{ marginTop: 8 }}><button className="btn ghost sm" type="submit">Sacar el aviso</button></form>}
      </div>

      <div className="card">
        <div className="chead"><h3>Novedades</h3><a className="lk" href="/novedades" target="_blank">Ver la página</a></div>
        {owner && (
          <ActionForm action={adminAddNewsAction} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            <label className="field">Título<input name="title" maxLength={120} placeholder="Leé el resumen de la tarjeta desde el PDF" /></label>
            <label className="field">Texto<textarea name="body" rows={3} /></label>
            <div><Submit>Publicar novedad</Submit></div>
          </ActionForm>
        )}
        {news.length ? <div className="list">{news.map((n) => (
          <div className="li" key={n.id}><div className="grow"><div className="t">{n.title}</div><div className="s">{fmtDate(n.publishedAt)}</div></div>
            {owner && <form action={adminDeleteNewsAction}><input type="hidden" name="id" value={n.id} /><button className="btn ghost sm" type="submit">Borrar</button></form>}</div>
        ))}</div> : <p className="adm-hint">Todavía no hay novedades publicadas.</p>}
      </div>
    </>
  );
}
