import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { planSettings } from "@/server/plans";
import { byCountry, funnel, monthlyCostsUsd, overview, revenueByMonth, signupMethods, signupsByDay } from "@/server/admin-metrics";
import { countryByCode } from "@/lib/countries";
import { can } from "@/server/admin-team";
import { PageHead } from "@/components/page";
import { Bars, HBars, Stats, int, pct, usd } from "@/components/admin-ui";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ sinpermiso?: string }> }) {
  const admin = await requireAdmin();
  const { sinpermiso } = await searchParams;
  const db = getDb();
  const settings = await planSettings(db);
  const [o, days, rev, fun, countries, methods, costs] = await Promise.all([
    overview(db, settings.prices), signupsByDay(db, 30), revenueByMonth(db, 6), funnel(db), byCountry(db), signupMethods(db, 30), monthlyCostsUsd(db),
  ]);
  const thisMonth = rev[rev.length - 1]?.n ?? 0;
  return (
    <>
      <PageHead title="Resumen" desc="Cómo viene NEXO: clientes, uso, plata y lo que espera respuesta." />
      {sinpermiso && <p className="notice a">Tu rol no tiene acceso a esa sección.</p>}
      <Stats items={[
        ["Clientes", int(o.users), `+${int(o.newWeek)} en 7 días`],
        ["Activos hoy", int(o.dau), `${int(o.mau)} en 30 días`],
        ["Pagan Pro", int(o.paid), `${pct(o.conversion)} del total`],
        ["Pro regalado", int(o.gifted), `${int(o.trials)} en prueba`],
        ["Ingreso por mes", usd(o.mrr), "estimado por suscripciones"],
        ["Cancelaron (30 días)", pct(o.churn), "de los que pagaban"],
      ]} />
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Altas por día</h3><span className="sub">Últimos 30 días · {int(days.reduce((t, d) => t + d.n, 0))} en total</span></div>
          <Bars label="Cuentas nuevas por día" data={days.map((d) => ({ key: d.key, n: d.n, tick: `${Number(d.key.slice(8))} ${MES[Number(d.key.slice(5, 7)) - 1]}` }))} />
          <p className="adm-hint" style={{ marginTop: 10 }}>Últimos 30 días: {int(methods.google)} con Google y {int(methods.email)} con correo.</p>
        </div>
        <div className="card">
          <div className="chead"><h3>Cobrado por mes</h3><span className="sub">En dólares, con la última cotización</span></div>
          <Bars label="Cobrado por mes en dólares" format={usd} data={rev.map((r) => ({ key: r.key, n: r.n, tick: `${MES[Number(r.key.slice(5, 7)) - 1]} ${r.key.slice(2, 4)}` }))} />
          {can(admin.role, "owner") && <p className="adm-hint" style={{ marginTop: 10 }}>Este mes: {usd(thisMonth)} cobrados contra {usd(costs.total)} de gastos. <Link className="lnk" href="/admin/finanzas">Ver finanzas</Link></p>}
        </div>
        <div className="card">
          <div className="chead"><h3>Activación</h3><span className="sub">De cada 100 que se registran</span></div>
          <HBars rows={fun} base={fun[0].n || 1} />
        </div>
        <div className="card">
          <div className="chead"><h3>Clientes por país</h3></div>
          <HBars rows={countries.map((c) => ({ label: c.key === "OTROS" ? "Otros" : countryByCode(c.key).name, n: c.n }))} />
        </div>
      </div>
      <div className="grid g2">
        <div className="card"><div className="chead"><h3>Soporte</h3><Link className="lk" href="/admin/soporte">Ver</Link></div><p className="sub" style={{ fontSize: 14 }}>{o.openTickets ? `${o.openTickets} ${o.openTickets === 1 ? "consulta espera" : "consultas esperan"} respuesta.` : "No hay consultas sin responder."}</p></div>
        <div className="card"><div className="chead"><h3>Privacidad</h3></div><p className="sub" style={{ fontSize: 14 }}>El panel muestra solo cantidades y totales del negocio. Nunca los montos ni los gastos de un cliente.</p></div>
      </div>
    </>
  );
}
