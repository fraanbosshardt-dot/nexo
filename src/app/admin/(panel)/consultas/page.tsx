import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { savedReplies } from "@/server/settings";
import { emailEnabled } from "@/lib/email";
import { AREAS } from "@/lib/brand";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { Stats, when } from "@/components/admin-ui";
import { adminContactStatusAction, adminReplyContactAction } from "@/app/actions/admin";
import { ReplyBox } from "../soporte/reply-box";

export const metadata: Metadata = { title: "Consultas del sitio" };
const ST: Record<string, [string, string]> = { OPEN: ["Sin responder", "r"], ANSWERED: ["Respondida", "g"], CLOSED: ["Cerrada", ""] };

export default async function Inquiries({ searchParams }: { searchParams: Promise<{ ver?: string; area?: string; q?: string }> }) {
  const admin = await requireAdmin();
  const support = can(admin.role, "support");
  const { ver = "abiertas", area = "", q = "" } = await searchParams;
  const db = getDb();
  const status = ver === "cerradas" ? ["CLOSED"] : ver === "respondidas" ? ["ANSWERED"] : ver === "todas" ? ["OPEN", "ANSWERED", "CLOSED"] : ["OPEN"];
  const term = q.trim().slice(0, 80);
  const where = {
    status: { in: status },
    ...(AREAS.some((a) => a.key === area) ? { area } : {}),
    ...(term ? { OR: [{ code: { contains: term.toUpperCase() } }, { email: { contains: term.toLowerCase() } }, { name: { contains: term, mode: "insensitive" as const } }, { subject: { contains: term, mode: "insensitive" as const } }] } : {}),
  };
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [list, byStatus, byArea, week, replies] = await Promise.all([
    db.contactMessage.findMany({ where, orderBy: { createdAt: ver === "abiertas" ? "asc" : "desc" }, take: 100 }),
    db.contactMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    db.contactMessage.groupBy({ by: ["area"], where: { status: "OPEN" }, _count: { _all: true } }),
    db.contactMessage.count({ where: { createdAt: { gt: weekAgo } } }),
    savedReplies(db),
  ]);
  const c = (s: string) => byStatus.find((x) => x.status === s)?._count._all ?? 0;
  const openIn = (a: string) => byArea.find((x) => x.area === a)?._count._all ?? 0;
  const href = (p: Record<string, string>) => {
    const u = new URLSearchParams({ ver, ...(area ? { area } : {}), ...(term ? { q: term } : {}), ...p });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `/admin/consultas?${u}`;
  };
  return (
    <>
      <PageHead title="Consultas del sitio" desc="Lo que escriben desde el formulario de Contacto, por área. Clientes y personas sin cuenta." />
      {!emailEnabled() && <p className="notice a">Las respuestas se guardan, pero no salen por correo hasta cargar la clave de Resend. Mientras tanto, respondé a mano al correo de cada consulta.</p>}
      <p className="notice">Las consultas del formulario llegan a esta bandeja. Abrí una consulta y respondé desde acá; la persona recibe tu respuesta por correo.</p>
      <Stats items={[["Sin responder", c("OPEN")], ["Respondidas", c("ANSWERED")], ["Cerradas", c("CLOSED")], ["Últimos 7 días", week]]} />
      <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
        {[["abiertas", `Sin responder (${c("OPEN")})`], ["respondidas", "Respondidas"], ["cerradas", "Cerradas"], ["todas", "Todas"]].map(([k, l]) => <Link key={k} className={`segl ${ver === k ? "on" : ""}`} href={href({ ver: k })}>{l}</Link>)}
      </div>
      <div className="chips" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Link className={`chip ${!area ? "on" : ""}`} href={href({ area: "" })}>Todas las áreas</Link>
        {AREAS.map((a) => <Link key={a.key} className={`chip ${area === a.key ? "on" : ""}`} href={href({ area: a.key })}>{a.name}{openIn(a.key) ? ` · ${openIn(a.key)}` : ""}</Link>)}
      </div>
      <form className="frow" style={{ maxWidth: 520 }} action="/admin/consultas">
        <input type="hidden" name="ver" value={ver} />{area && <input type="hidden" name="area" value={area} />}
        <label className="field" style={{ flex: 1 }}><span className="sr-only">Buscar</span><input name="q" defaultValue={term} placeholder="Buscar por número, correo, nombre o asunto" /></label>
        <button className="btn" type="submit">Buscar</button>
      </form>
      {list.length ? list.map((m) => {
        const areaName = AREAS.find((a) => a.key === m.area)?.name ?? m.area;
        return (
          <div className="card" key={m.id}>
            <div className="chead">
              <div><h3>{m.subject}</h3><p className="sub">{m.name} · <span>{m.email}</span> · {when(m.createdAt)}{m.userId ? <> · <Link className="lnk" href={`/admin/usuarios/${m.userId}`}>tiene cuenta</Link></> : " · sin cuenta"}</p></div>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}><span className="pill b">{areaName}</span><span className={`pill ${ST[m.status]?.[1] ?? ""}`}>{ST[m.status]?.[0] ?? m.status}</span><span className="pill">{m.code}</span></span>
            </div>
            {m.area === "arrepentimiento" && <p className="notice a" style={{ marginTop: 0 }}>Pedido de arrepentimiento: hay que cancelar y devolver el pago dentro de los plazos de la ley.</p>}
            <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{m.body}</p>
            {m.reply && <div className="notice" style={{ marginBottom: 12 }}><span style={{ whiteSpace: "pre-wrap" }}><b>Respuesta:</b> {m.reply}</span></div>}
            {support && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {m.status !== "CLOSED" && (
                  <ActionForm action={adminReplyContactAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input type="hidden" name="id" value={m.id} />
                    <ReplyBox replies={replies} name={m.name.split(" ")[0]} />
                    <div><Submit pending="Enviando…">{m.reply ? "Responder de nuevo" : "Responder"}</Submit></div>
                  </ActionForm>
                )}
                <div className="acts">
                  {m.status !== "CLOSED" && <form action={adminContactStatusAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="CLOSED" /><button className="btn sm" type="submit">Cerrar</button></form>}
                  {m.status !== "OPEN" && <form action={adminContactStatusAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value="OPEN" /><button className="btn sm ghost" type="submit">Volver a abrir</button></form>}
                </div>
              </div>
            )}
          </div>
        );
      }) : <div className="empty">{term ? "No hay consultas que coincidan." : "No hay consultas acá."}</div>}
    </>
  );
}
