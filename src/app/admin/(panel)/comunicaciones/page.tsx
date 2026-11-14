import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { announcement } from "@/server/settings";
import { AUDIENCES, audienceUsers } from "@/server/admin-comms";
import { emailEnabled } from "@/lib/email";
import { COUNTRIES } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { int, when } from "@/components/admin-ui";
import { adminAddNewsAction, adminClearAnnouncementAction, adminDeleteNewsAction, adminSaveAnnouncementAction, adminSendCampaignAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Comunicaciones" };

export default async function Comms() {
  const admin = await requireAdmin();
  const owner = can(admin.role, "owner");
  const db = getDb();
  const [ann, campaigns, news, sizes] = await Promise.all([
    announcement(db),
    db.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.productNews.findMany({ orderBy: { publishedAt: "desc" }, take: 30 }),
    Promise.all(AUDIENCES.map(async ([k]) => [k, (await audienceUsers(db, k)).length] as const)),
  ]);
  const size = Object.fromEntries(sizes);
  const countries = (await db.workspace.groupBy({ by: ["country"], _count: { _all: true } })).sort((a, b) => b._count._all - a._count._all);
  return (
    <>
      <PageHead title="Comunicaciones" desc="Avisos dentro de la app, correos a tus clientes y la página de novedades." />
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
        <div className="chead"><h3>Correo a tus clientes</h3><span className="sub">Solo a quienes aceptan correos de Somos Guafra</span></div>
        {!emailEnabled() && <p className="notice a" style={{ marginBottom: 12 }}>Para que salgan los correos falta cargar RESEND_API_KEY y EMAIL_FROM en Vercel.</p>}
        {owner && (
          <ActionForm action={adminSendCampaignAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field" style={{ maxWidth: 360 }}>Para<select name="audience" defaultValue="all">
              {AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l} ({int(size[k] ?? 0)})</option>)}
              {countries.map((c) => <option key={c.country} value={`country:${c.country}`}>Solo {COUNTRIES.find((x) => x.code === c.country)?.name ?? c.country}</option>)}
            </select></label>
            <label className="field">Asunto<input name="subject" maxLength={120} placeholder="Novedades de noviembre en Somos Guafra" /></label>
            <label className="field">Texto<textarea name="body" rows={6} placeholder={"Te contamos lo nuevo de este mes:\n\n• …"} /></label>
            <p className="adm-hint">Cada correo empieza con "Hola" y el nombre, y termina con cómo dejar de recibirlos.</p>
            <div className="acts">
              <button className="btn" type="submit" name="test" value="1">Mandarme una prueba</button>
              <Submit pending="Enviando…">Enviar a todos</Submit>
            </div>
          </ActionForm>
        )}
        {campaigns.length > 0 && (
          <div className="list" style={{ marginTop: 14 }}>{campaigns.map((c) => (
            <div className="li" key={c.id}><div className="grow"><div className="t">{c.subject}</div><div className="s">{when(c.createdAt)} · {AUDIENCES.find(([k]) => k === c.audience)?.[1] ?? c.audience} · por {c.createdBy}</div></div><span className="num">{int(c.sent)} enviados{c.failed ? ` · ${int(c.failed)} fallaron` : ""}</span></div>
          ))}</div>
        )}
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
