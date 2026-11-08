import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { savedReplies } from "@/server/settings";
import { emailEnabled } from "@/lib/email";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { when } from "@/components/admin-ui";
import { adminCloseTicketAction, adminDeleteReplyAction, adminReplyTicketAction, adminSaveReplyAction, adminTicketPriorityAction } from "@/app/actions/admin";
import { ReplyBox } from "./reply-box";

export const metadata: Metadata = { title: "Soporte" };
const PRI: Record<string, [string, string]> = { HIGH: ["Alta", "r"], NORMAL: ["Normal", ""], LOW: ["Baja", "a"] };

export default async function Support({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await requireAdmin();
  const support = can(admin.role, "support");
  const ver = (await searchParams).ver ?? "abiertas";
  const db = getDb();
  const status = ver === "cerradas" ? ["CLOSED"] : ver === "respondidas" ? ["ANSWERED"] : ver === "todas" ? ["OPEN", "ANSWERED", "CLOSED"] : ["OPEN"];
  const [tickets, replies, counts] = await Promise.all([
    db.supportTicket.findMany({ where: { status: { in: status } }, include: { user: { select: { id: true, name: true, email: true } } }, take: 100 }),
    savedReplies(db),
    db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const order = { HIGH: 0, NORMAL: 1, LOW: 2 } as Record<string, number>;
  tickets.sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1) || a.createdAt.getTime() - b.createdAt.getTime());
  const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  return (
    <>
      <PageHead title="Soporte" desc="Consultas de los clientes, de la más urgente a la más vieja." />
      {!emailEnabled() && <p className="notice a">Las respuestas se guardan y el cliente las ve en Ayuda, pero no le llega un correo hasta cargar la clave de Resend.</p>}
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        {[["abiertas", `Sin responder (${c("OPEN")})`], ["respondidas", `Respondidas (${c("ANSWERED")})`], ["cerradas", "Cerradas"], ["todas", "Todas"]].map(([k, l]) => <Link key={k} className={`segl ${ver === k ? "on" : ""}`} href={`/admin/soporte?ver=${k}`}>{l}</Link>)}
      </div>
      {tickets.length ? tickets.map((t) => (
        <div className="card" key={t.id}>
          <div className="chead">
            <div><h3>{t.subject}</h3><p className="sub"><Link className="lnk" href={`/admin/usuarios/${t.user.id}`}>{t.user.name}</Link> · {t.user.email} · {when(t.createdAt)}</p></div>
            <span className={`pill ${PRI[t.priority]?.[1] ?? ""}`}>Prioridad {PRI[t.priority]?.[0] ?? "Normal"}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{t.body}</p>
          {t.reply && <div className="notice" style={{ marginBottom: 12 }}><span><b>Respuesta:</b> {t.reply}</span></div>}
          {support && t.status !== "CLOSED" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ActionForm action={adminReplyTicketAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="id" value={t.id} />
                <ReplyBox replies={replies} name={t.user.name.split(" ")[0]} />
                <div><Submit pending="Enviando…">Responder</Submit></div>
              </ActionForm>
              <div className="acts">
                <form action={adminTicketPriorityAction} className="acts"><input type="hidden" name="id" value={t.id} /><select name="priority" defaultValue={t.priority} className="st-sel" aria-label="Prioridad"><option value="HIGH">Alta</option><option value="NORMAL">Normal</option><option value="LOW">Baja</option></select><button className="btn sm" type="submit">Cambiar prioridad</button></form>
                <form action={adminCloseTicketAction}><input type="hidden" name="id" value={t.id} /><button className="btn sm" type="submit">Cerrar consulta</button></form>
              </div>
            </div>
          )}
        </div>
      )) : <div className="empty">No hay consultas acá.</div>}

      {support && (
        <div className="card">
          <div className="chead"><h3>Respuestas guardadas</h3><span className="sub">Para no escribir lo mismo cada vez. Usá {"{nombre}"} para el nombre del cliente</span></div>
          {replies.length > 0 && <div className="list" style={{ marginBottom: 12 }}>{replies.map((r) => (
            <div className="li" key={r.title}><div className="grow"><div className="t">{r.title}</div><div className="s">{r.text.slice(0, 120)}{r.text.length > 120 ? "…" : ""}</div></div>
              <form action={adminDeleteReplyAction}><input type="hidden" name="title" value={r.title} /><button className="btn ghost sm" type="submit">Borrar</button></form></div>
          ))}</div>}
          <ActionForm action={adminSaveReplyAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="field" style={{ maxWidth: 320 }}>Nombre<input name="title" placeholder="Ej.: Cómo cargar un resumen" /></label>
            <label className="field">Texto<textarea name="text" rows={4} placeholder="Hola {nombre}, para cargar el resumen…" /></label>
            <div><Submit>Guardar respuesta</Submit></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
