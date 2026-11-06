import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { effectivePlan, planSettings, PRO_FEATURES } from "@/server/plans";
import { fmtDate } from "@/lib/dates";
import { countryByCode } from "@/lib/countries";
import { PageHead, Tabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { adminCloseTicketAction, adminReplyTicketAction, adminReset2faAction, adminSavePlansAction, adminSetPlanAction, adminSuspendAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Panel interno" };
type SP = { tab?: string; q?: string };

export default async function Admin({ searchParams }: { searchParams: Promise<SP> }) {
  const { user: me } = await requireAdmin();
  const sp = await searchParams;
  const tab = ["resumen", "usuarios", "planes", "soporte", "actividad"].includes(sp.tab ?? "") ? sp.tab! : "resumen";
  const db = getDb();
  const settings = await planSettings(db);
  const tabs = <Tabs current={tab} items={[["resumen", "Resumen"], ["usuarios", "Usuarios"], ["planes", "Planes y funciones"], ["soporte", "Soporte"], ["actividad", "Actividad"]].map(([k, l]) => ({ key: k, label: l, href: `/admin?tab=${k}` }))} />;
  let body: React.ReactNode = null;

  if (tab === "resumen") {
    const now = new Date(), week = new Date(now.getTime() - 7 * 864e5), month = new Date(now.getTime() - 30 * 864e5);
    const [users, newWeek, active, subs, openTickets, withMoves] = await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { createdAt: { gte: week } } }),
      db.session.findMany({ where: { createdAt: { gte: month } }, distinct: ["userId"], select: { userId: true } }),
      db.subscription.findMany({ select: { plan: true, status: true, trialEndsAt: true, billingCycle: true, provider: true } }),
      db.supportTicket.count({ where: { status: "OPEN" } }),
      db.transaction.findMany({ distinct: ["workspaceId"], select: { workspaceId: true } }),
    ]);
    const paid = subs.filter((x) => x.plan === "PRO" && x.status === "ACTIVE" && x.provider !== "manual");
    const trials = subs.filter((x) => x.status === "TRIALING" && x.trialEndsAt && x.trialEndsAt > now).length;
    const mrr = paid.reduce((t, x) => t + (x.billingCycle === "yearly" ? settings.prices.yearly / 12 : settings.prices.monthly), 0);
    const pro = subs.filter((x) => effectivePlan(x) === "PRO").length;
    const workspaces = await db.workspace.count();
    body = (
      <>
        <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          {[["Usuarios", users], ["Nuevos en 7 días", newWeek], ["Entraron en 30 días", active.length], ["Con Pro", pro], ["En prueba", trials], ["Ingreso por mes", `US$ ${mrr.toFixed(0)}`]].map(([l, v]) => <div key={String(l)}><small>{l}</small><b>{v}</b></div>)}
        </div>
        <div className="grid g2">
          <div className="card"><div className="chead"><h3>Activación</h3></div><dl className="kv"><dt>Espacios creados</dt><dd>{workspaces}</dd><dt>Cargaron al menos un movimiento</dt><dd>{withMoves.length}</dd><dt>Porcentaje</dt><dd>{workspaces ? Math.round((withMoves.length / workspaces) * 100) : 0}%</dd></dl></div>
          <div className="card"><div className="chead"><h3>Soporte</h3><Link className="lk" href="/admin?tab=soporte">Ver</Link></div><p className="sub" style={{ fontSize: 14 }}>{openTickets ? `${openTickets} ${openTickets === 1 ? "consulta espera" : "consultas esperan"} respuesta.` : "No hay consultas sin responder."}</p></div>
        </div>
        <p className="foot-note">El ingreso por mes cuenta solo suscripciones pagas por Mercado Pago; los planes dados a mano desde acá no suman.</p>
      </>
    );
  }

  if (tab === "usuarios") {
    const q = (sp.q ?? "").trim();
    const users = await db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      include: { memberships: { include: { workspace: { include: { subscription: true } } } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    body = (
      <div className="card">
        <form className="acts" style={{ marginBottom: 12 }}><input className="adm-q" name="q" defaultValue={q} placeholder="Buscar por nombre o email" /><input type="hidden" name="tab" value="usuarios" /><button className="btn" type="submit">Buscar</button></form>
        <div className="tw"><table>
          <thead><tr><th>Usuario</th><th>País</th><th>Plan</th><th>Dos pasos</th><th>Alta</th><th>Estado</th><th /></tr></thead>
          <tbody>{users.map((u) => {
            const ws = u.memberships[0]?.workspace;
            const plan = effectivePlan(ws?.subscription);
            return (
              <tr key={u.id}>
                <td><b style={{ fontWeight: 500 }}>{u.name}</b><small>{u.email}</small></td>
                <td>{ws ? countryByCode(ws.country).name : "—"}</td>
                <td>{ws ? <form action={adminSetPlanAction} style={{ display: "flex", gap: 6 }}><input type="hidden" name="workspaceId" value={ws.id} /><select name="plan" defaultValue={plan} className="st-sel" aria-label="Plan"><option value="FREE">Gratis</option><option value="PRO">Pro</option></select><button className="btn sm" type="submit">Cambiar</button></form> : "—"}{ws?.subscription?.status === "TRIALING" && <small>Prueba hasta {ws.subscription.trialEndsAt ? fmtDate(ws.subscription.trialEndsAt) : "—"}</small>}</td>
                <td>{u.totpEnabledAt ? <form action={adminReset2faAction}><input type="hidden" name="userId" value={u.id} /><span className="pill g">Sí</span> <button className="btn ghost sm" type="submit">Quitar</button></form> : <span className="pill">No</span>}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>{u.suspendedAt ? <span className="pill r">Suspendido</span> : <span className="pill g">Activo</span>}</td>
                <td>{u.id !== me.id && <form action={adminSuspendAction}><input type="hidden" name="userId" value={u.id} /><button className="btn sm" type="submit">{u.suspendedAt ? "Reactivar" : "Suspender"}</button></form>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {!users.length && <div className="empty">No encontramos usuarios.</div>}
      </div>
    );
  }

  if (tab === "planes") {
    body = (
      <ActionForm action={adminSavePlansAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="chead"><h3>Precio de Pro (US$)</h3></div>
        <div className="frow" style={{ maxWidth: 420 }}>
          <label className="field">Por mes<input name="monthly" inputMode="decimal" defaultValue={settings.prices.monthly} /></label>
          <label className="field">Por año<input name="yearly" inputMode="decimal" defaultValue={settings.prices.yearly} /></label>
        </div>
        <div className="chead" style={{ marginTop: 8 }}><h3>Funciones Pro</h3><span className="sub">Marcá las que también querés dar gratis</span></div>
        <div className="list">{PRO_FEATURES.map((f) => (
          <label className="li" key={f.key} style={{ cursor: "pointer" }}><div className="grow"><div className="t">{f.name}</div><div className="s">{settings.freeAlso.includes(f.key) ? "Incluida en Gratis" : "Solo Pro"}</div></div><span className="sw-t"><input type="checkbox" name="freeAlso" value={f.key} defaultChecked={settings.freeAlso.includes(f.key)} aria-label={`Dar gratis: ${f.name}`} /><span /></span></label>
        ))}</div>
        <div><Submit>Guardar</Submit></div>
      </ActionForm>
    );
  }

  if (tab === "soporte") {
    const tickets = await db.supportTicket.findMany({ include: { user: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 50 });
    body = tickets.length ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{tickets.map((t) => (
        <div className="card" key={t.id}>
          <div className="chead"><div><h3>{t.subject}</h3><p className="sub">{t.user.name} · {t.user.email} · {fmtDate(t.createdAt)}</p></div><span className={`pill ${t.status === "OPEN" ? "r" : t.status === "ANSWERED" ? "b" : ""}`}>{t.status === "OPEN" ? "Sin responder" : t.status === "ANSWERED" ? "Respondida" : "Cerrada"}</span></div>
          <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px" }}>{t.body}</p>
          {t.reply && <div className="notice" style={{ marginBottom: 12 }}><span><b>Respuesta:</b> {t.reply}</span></div>}
          {t.status !== "CLOSED" && (
            <div className="acts" style={{ alignItems: "flex-end" }}>
              <ActionForm action={adminReplyTicketAction} style={{ display: "flex", gap: 8, flex: "1 1 320px", alignItems: "flex-end" }}><input type="hidden" name="id" value={t.id} /><label className="field" style={{ flex: 1 }}>Responder<input name="reply" /></label><Submit>Enviar</Submit></ActionForm>
              <form action={adminCloseTicketAction}><input type="hidden" name="id" value={t.id} /><button className="btn" type="submit">Cerrar</button></form>
            </div>
          )}
        </div>
      ))}</div>
    ) : <div className="empty">No hay consultas.</div>;
  }

  if (tab === "actividad") {
    const logs = await db.auditLog.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 150 });
    body = (
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué pasó</th></tr></thead>
        <tbody>{logs.map((l) => <tr key={l.id}><td style={{ whiteSpace: "nowrap" }}>{fmtDate(l.createdAt)} {l.createdAt.toISOString().slice(11, 16)}</td><td>{l.user?.email ?? "—"}</td><td>{l.action}</td></tr>)}</tbody>
      </table></div></div>
    );
  }

  return (
    <div className="adm">
      <header className="adm-top"><div className="lp-w" style={{ display: "flex", alignItems: "center", gap: 16, height: 64 }}><Link href="/app" className="brand"><span className="brand-mark">N</span><b>NEXO</b></Link><span className="pill b">Panel interno</span><span style={{ flex: 1 }} /><Link className="btn sm" href="/app">Volver a la app</Link></div></header>
      <main className="lp-w adm-main">
        <PageHead title="Panel interno" desc="Para administrar NEXO como dueño: usuarios, planes, soporte y actividad." />
        {tabs}
        {body}
      </main>
    </div>
  );
}
