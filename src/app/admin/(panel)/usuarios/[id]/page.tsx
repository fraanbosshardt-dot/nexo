import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { effectivePlan } from "@/server/plans";
import { can } from "@/server/admin-team";
import { countryByCode } from "@/lib/countries";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { Stats, actionName, int, when } from "@/components/admin-ui";
import { adminCloseSessionsAction, adminDeleteAccountAction, adminGiftProAction, adminReset2faAction, adminSetPlanAction, adminSuspendAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Cliente" };

export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const db = getDb();
  const u = await db.user.findUnique({ where: { id }, include: { memberships: { orderBy: { createdAt: "asc" }, include: { workspace: { include: { subscription: true } } } } } });
  if (!u || u.deletedAt) notFound();
  const ws = u.memberships[0]?.workspace;
  const where = { workspaceId: ws?.id ?? "-" };
  // Solo cantidades: nunca montos ni descripciones de los movimientos del cliente.
  const [sessions, tickets, logs, invoices, accounts, moves, cards, debts] = await Promise.all([
    db.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    db.supportTicket.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { OR: [{ userId: id }, { entityId: id }, ...(ws ? [{ workspaceId: ws.id, action: { startsWith: "admin." } }] : [])] }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 12 }),
    db.account.count({ where }), db.transaction.count({ where }), db.creditCard.count({ where }), db.debt.count({ where }),
  ]);
  const sub = ws?.subscription;
  const plan = effectivePlan(sub);
  const support = can(admin.role, "support"), owner = can(admin.role, "owner");
  const subText = !sub ? "Gratis" : sub.provider === "mercadopago" ? `Pro pago (${sub.billingCycle === "yearly" ? "anual" : "mensual"}) · ${sub.status === "ACTIVE" ? "al día" : sub.status === "PAST_DUE" ? "pago pendiente" : sub.status === "CANCELED" ? "cancelado" : sub.status}${sub.couponCode ? ` · cupón ${sub.couponCode}` : ""}` : plan === "PRO" ? (sub.trialEndsAt ? `Pro hasta el ${fmtDate(sub.trialEndsAt)}` : "Pro regalado sin vencimiento") : "Gratis";
  return (
    <>
      <PageHead crumb="Clientes" title={u.name} desc={u.email} actions={<Link className="btn" href="/admin/usuarios">Volver</Link>} />
      <Stats items={[["Plan", plan === "PRO" ? "Pro" : "Gratis"], ["Cuentas", int(accounts)], ["Movimientos", int(moves)], ["Tarjetas", int(cards)], ["Deudas", int(debts)], ["Sesiones abiertas", int(sessions.length)]]} />
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Datos</h3></div>
          <dl className="kv">
            <dt>Alta</dt><dd>{fmtDate(u.createdAt)}</dd>
            <dt>Último uso</dt><dd>{u.lastSeenAt ? when(u.lastSeenAt) : "—"}</dd>
            <dt>País y moneda</dt><dd>{ws ? `${countryByCode(ws.country).name} · ${ws.baseCurrency}` : "—"}</dd>
            <dt>Ingresa con</dt><dd>{u.googleSub ? (u.passwordHash ? "Google y contraseña" : "Google") : "Correo y contraseña"}</dd>
            <dt>Segundo paso</dt><dd>{u.totpEnabledAt ? "Activado" : "No"}</dd>
            <dt>Estado</dt><dd>{u.suspendedAt ? `Suspendida desde ${fmtDate(u.suspendedAt)}` : "Activa"}</dd>
            <dt>Suscripción</dt><dd>{subText}</dd>
          </dl>
        </div>
        <div className="card">
          <div className="chead"><h3>Acciones</h3></div>
          {!support ? <p className="adm-hint">Tu rol solo puede mirar.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {ws && (
                <form action={adminGiftProAction} className="acts" style={{ alignItems: "center" }}>
                  <input type="hidden" name="workspaceId" value={ws.id} />
                  <span style={{ fontSize: 14 }}>Regalar Pro</span>
                  <select name="days" defaultValue="30" className="st-sel" aria-label="Días de Pro"><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option><option value="90">3 meses</option><option value="365">1 año</option>{owner && <option value="0">Sin vencimiento</option>}</select>
                  <button className="btn sm" type="submit">Dar</button>
                </form>
              )}
              {owner && ws && (
                <form action={adminSetPlanAction} className="acts" style={{ alignItems: "center" }}>
                  <input type="hidden" name="workspaceId" value={ws.id} />
                  <span style={{ fontSize: 14 }}>Plan fijo</span>
                  <select name="plan" defaultValue={plan} className="st-sel" aria-label="Plan"><option value="FREE">Gratis</option><option value="PRO">Pro</option></select>
                  <button className="btn sm" type="submit">Cambiar</button>
                </form>
              )}
              <div className="acts">
                <form action={adminCloseSessionsAction}><input type="hidden" name="userId" value={u.id} /><button className="btn sm" type="submit" disabled={!sessions.length}>Cerrar sus sesiones</button></form>
                {u.totpEnabledAt && <form action={adminReset2faAction}><input type="hidden" name="userId" value={u.id} /><button className="btn sm" type="submit">Quitar segundo paso</button></form>}
                <form action={adminSuspendAction}><input type="hidden" name="userId" value={u.id} /><button className="btn sm" type="submit">{u.suspendedAt ? "Reactivar" : "Suspender"}</button></form>
              </div>
              {owner && (
                <details className="adm-danger">
                  <summary>Datos personales (Ley 25.326)</summary>
                  <p className="adm-hint">Si la persona lo pide, podés darle una copia de todos sus datos o borrar la cuenta. Las dos acciones quedan registradas con tu correo.</p>
                  <a className="btn sm" href={`/admin/export/cuenta/${u.id}`}>Descargar sus datos (JSON)</a>
                  <ActionForm action={adminDeleteAccountAction} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <input type="hidden" name="userId" value={u.id} />
                    <label className="field">Para borrar la cuenta y todos sus datos, escribí su correo<input name="confirm" autoComplete="off" placeholder={u.email} /></label>
                    <div><Submit className="btn danger sm" pending="Borrando…">Borrar la cuenta para siempre</Submit></div>
                  </ActionForm>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Sesiones abiertas</h3></div>
          {sessions.length ? <div className="list">{sessions.map((s) => <div className="li" key={s.id}><div className="grow"><div className="t">{(s.userAgent ?? "Navegador").replace(/\(.*?\)/g, "").slice(0, 60)}</div><div className="s">Desde {when(s.createdAt)}{s.ip ? ` · ${s.ip}` : ""}</div></div></div>)}</div> : <p className="adm-hint">No tiene sesiones abiertas.</p>}
        </div>
        <div className="card">
          <div className="chead"><h3>Pagos</h3></div>
          {invoices.length ? <div className="list">{invoices.map((i) => <div className="li" key={i.id}><div className="grow"><div className="t">{formatMoney(i.amount.toString(), i.currency)}</div><div className="s">{fmtDate(i.paidAt ?? i.createdAt)} · {i.provider}</div></div><span className={`pill ${i.status === "approved" ? "g" : "r"}`}>{i.status === "approved" ? "Aprobado" : i.status === "refunded" ? "Devuelto" : "Rechazado"}</span></div>)}</div> : <p className="adm-hint">Sin pagos.</p>}
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Consultas</h3><Link className="lk" href="/admin/soporte">Soporte</Link></div>
          {tickets.length ? <div className="list">{tickets.map((t) => <div className="li" key={t.id}><div className="grow"><div className="t">{t.subject}</div><div className="s">{fmtDate(t.createdAt)}</div></div><span className={`pill ${t.status === "OPEN" ? "r" : t.status === "ANSWERED" ? "b" : ""}`}>{t.status === "OPEN" ? "Sin responder" : t.status === "ANSWERED" ? "Respondida" : "Cerrada"}</span></div>)}</div> : <p className="adm-hint">No hizo consultas.</p>}
        </div>
        <div className="card">
          <div className="chead"><h3>Actividad</h3></div>
          <div className="list">{logs.map((l) => <div className="li" key={l.id}><div className="grow"><div className="t">{actionName(l.action)}</div><div className="s">{when(l.createdAt)}{(l.meta as { admin?: string } | null)?.admin ? ` · por ${(l.meta as { admin: string }).admin}` : ""}</div></div></div>)}</div>
        </div>
      </div>
    </>
  );
}
