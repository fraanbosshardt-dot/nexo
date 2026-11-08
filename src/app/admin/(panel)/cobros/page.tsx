import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { billingConfig } from "@/server/billing";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { Stats, int } from "@/components/admin-ui";
import { adminCancelSubAction, adminCreateCouponAction, adminToggleCouponAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Cobros y cupones" };

export default async function Billing() {
  const admin = await requireAdmin();
  const owner = can(admin.role, "owner");
  const db = getDb();
  const soon = new Date(Date.now() + 7 * 864e5);
  const [subs, invoices, coupons] = await Promise.all([
    db.subscription.findMany({ where: { provider: "mercadopago" }, include: { workspace: { include: { members: { take: 1, include: { user: { select: { id: true, name: true, email: true } } } } } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    db.invoice.findMany({ include: { workspace: { include: { members: { take: 1, include: { user: { select: { id: true, email: true } } } } } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const bill = billingConfig();
  const active = subs.filter((s) => s.status === "ACTIVE"), pastDue = subs.filter((s) => s.status === "PAST_DUE");
  const renewing = active.filter((s) => s.currentPeriodEnd && s.currentPeriodEnd <= soon).length;
  const rejected = invoices.filter((i) => i.status === "rejected").length;
  const who = (w: { members: { user: { id: string; name?: string; email: string } }[] }) => w.members[0]?.user;
  return (
    <>
      <PageHead title="Cobros y cupones" desc="Suscripciones de Mercado Pago, pagos y descuentos." actions={owner ? <a className="btn" href="/admin/export/pagos">Descargar pagos (Excel)</a> : undefined} />
      {!bill.enabled && <p className="notice a">Los cobros con Mercado Pago todavía no están activados: faltan MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y los precios en Vercel. Mientras tanto, podés regalar Pro desde Clientes.</p>}
      <Stats items={[["Suscripciones activas", int(active.length)], ["Con pago pendiente", int(pastDue.length)], ["Renuevan en 7 días", int(renewing)], ["Pagos rechazados", int(rejected), "en los últimos 50"]]} />

      <div className="card">
        <div className="chead"><h3>Suscripciones</h3></div>
        {subs.length ? <div className="tw"><table>
          <thead><tr><th>Cliente</th><th>Ciclo</th><th>Estado</th><th>Cupón</th><th>Desde</th><th /></tr></thead>
          <tbody>{subs.map((s) => { const u = who(s.workspace); return (
            <tr key={s.id}>
              <td>{u ? <Link className="lnk" href={`/admin/usuarios/${u.id}`}>{u.email}</Link> : "—"}</td>
              <td>{s.billingCycle === "yearly" ? "Anual" : "Mensual"}</td>
              <td><span className={`pill ${s.status === "ACTIVE" ? "g" : s.status === "PAST_DUE" ? "r" : ""}`}>{s.status === "ACTIVE" ? "Al día" : s.status === "PAST_DUE" ? "Pago pendiente" : "Cancelada"}</span></td>
              <td>{s.couponCode ?? "—"}</td>
              <td>{fmtDate(s.createdAt)}</td>
              <td>{owner && s.status !== "CANCELED" && <form action={adminCancelSubAction}><input type="hidden" name="workspaceId" value={s.workspaceId} /><button className="btn ghost sm" type="submit">Cancelar</button></form>}</td>
            </tr>); })}</tbody>
        </table></div> : <div className="empty">Todavía no hay suscripciones pagas.</div>}
      </div>

      <div className="card">
        <div className="chead"><h3>Últimos pagos</h3><span className="sub">Las devoluciones se hacen desde Mercado Pago y se reflejan acá solas</span></div>
        {invoices.length ? <div className="tw"><table>
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Importe</th><th>Estado</th></tr></thead>
          <tbody>{invoices.map((i) => { const u = who(i.workspace); return (
            <tr key={i.id}><td>{fmtDate(i.paidAt ?? i.createdAt)}</td><td>{u ? <Link className="lnk" href={`/admin/usuarios/${u.id}`}>{u.email}</Link> : "—"}</td><td>{formatMoney(i.amount.toString(), i.currency)}</td>
              <td><span className={`pill ${i.status === "approved" ? "g" : "r"}`}>{i.status === "approved" ? "Aprobado" : i.status === "refunded" ? "Devuelto" : "Rechazado"}</span></td></tr>); })}</tbody>
        </table></div> : <div className="empty">Sin pagos todavía.</div>}
      </div>

      <div className="card">
        <div className="chead"><h3>Cupones de descuento</h3><span className="sub">El cliente lo escribe al pasar a Pro (Configuración → Plan)</span></div>
        {owner && (
          <ActionForm action={adminCreateCouponAction} className="frow" style={{ alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <label className="field" style={{ flex: "1 1 150px" }}>Código<input name="code" required placeholder="BIENVENIDA" style={{ textTransform: "uppercase" }} /></label>
            <label className="field" style={{ flex: "0 1 110px" }}>Descuento %<input name="percent" inputMode="numeric" required placeholder="20" /></label>
            <label className="field" style={{ flex: "0 1 120px" }}>Usos máximos<input name="maxUses" inputMode="numeric" placeholder="Sin límite" /></label>
            <label className="field" style={{ flex: "0 1 160px" }}>Vence<input name="until" type="date" /></label>
            <label className="field" style={{ flex: "1 1 160px" }}>Nota<input name="note" placeholder="Ej.: Instagram" /></label>
            <Submit>Crear cupón</Submit>
          </ActionForm>
        )}
        {coupons.length ? <div className="list">{coupons.map((c) => {
          const expired = c.expiresAt && c.expiresAt < new Date(), full = c.maxUses !== null && c.uses >= c.maxUses;
          return (
            <div className="li" key={c.id}>
              <div className="grow"><div className="t"><b style={{ fontWeight: 500 }}>{c.code}</b> · {c.percentOff}% menos</div><div className="s">{int(c.uses)}{c.maxUses !== null ? ` de ${int(c.maxUses)}` : ""} usos{c.expiresAt ? ` · vence ${fmtDate(c.expiresAt)}` : ""}{c.note ? ` · ${c.note}` : ""}</div></div>
              <span className={`pill ${c.active && !expired && !full ? "g" : ""}`}>{!c.active ? "Pausado" : expired ? "Vencido" : full ? "Agotado" : "Activo"}</span>
              {owner && <form action={adminToggleCouponAction}><input type="hidden" name="id" value={c.id} /><button className="btn ghost sm" type="submit">{c.active ? "Pausar" : "Reactivar"}</button></form>}
            </div>
          );
        })}</div> : <p className="adm-hint">No hay cupones.</p>}
      </div>
    </>
  );
}
