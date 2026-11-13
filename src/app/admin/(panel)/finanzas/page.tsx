import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { planSettings } from "@/server/plans";
import { monthlyCosts, overview, revenueByMonth, toArs } from "@/server/admin-metrics";
import { formatMoney } from "@/lib/money";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { Stats, ars } from "@/components/admin-ui";
import { adminAddCostAction, adminDeleteCostAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Finanzas" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Finance() {
  await requireAdmin("owner");
  const db = getDb();
  const [o, rev, costs] = await Promise.all([overview(db, (await planSettings(db)).pricesArs ?? { monthly: 0, yearly: 0 }), revenueByMonth(db, 6), monthlyCosts(db)]);
  const cobrado = rev[rev.length - 1]?.n ?? 0;
  const ganancia = cobrado - costs.total;
  const perMonth = await Promise.all(costs.items.map(async (c) => ({ c, usd: await toArs(db, Number(c.amount) / (c.period === "yearly" ? 12 : 1), c.currency) })));
  return (
    <>
      <PageHead title="Finanzas de Guafra" desc="Lo que entra contra lo que cuesta mantener Guafra, en pesos." actions={<><a className="btn" href="/admin/export/pagos">Pagos (Excel)</a><a className="btn" href="/admin/export/usuarios">Clientes (Excel)</a></>} />
      <Stats items={[
        ["Cobrado este mes", ars(cobrado)],
        ["Gastos por mes", ars(costs.total), costs.unknown ? `${costs.unknown} sin cotización` : undefined],
        ["Ganancia este mes", ars(ganancia)],
        ["Ingreso estimado por mes", ars(o.mrr), "según suscripciones activas"],
      ]} />
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Mes a mes</h3><span className="sub">Cobrado contra gastos de hoy</span></div>
          <div className="tw"><table>
            <thead><tr><th>Mes</th><th>Pagos</th><th>Cobrado</th><th>Ganancia</th></tr></thead>
            <tbody>{[...rev].reverse().map((r) => <tr key={r.key}><td>{MES[Number(r.key.slice(5, 7)) - 1]} {r.key.slice(0, 4)}</td><td>{r.count}</td><td>{ars(r.n)}</td><td className={r.n - costs.total < 0 ? "neg" : "pos"}>{ars(r.n - costs.total)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="card">
          <div className="chead"><h3>Gastos fijos</h3><span className="sub">Vercel, Railway, dominio, correos…</span></div>
          {perMonth.length ? <div className="list" style={{ marginBottom: 12 }}>{perMonth.map(({ c, usd: u }) => (
            <div className="li" key={c.id}><div className="grow"><div className="t">{c.name}</div><div className="s">{formatMoney(c.amount.toString(), c.currency)} por {c.period === "yearly" ? "año" : "mes"}{u !== null ? ` · ${ars(u)} por mes` : " · sin cotización"}</div></div>
              <form action={adminDeleteCostAction}><input type="hidden" name="id" value={c.id} /><button className="btn ghost sm" type="submit">Borrar</button></form></div>
          ))}</div> : <p className="adm-hint">Cargá lo que pagás para mantener Guafra y vas a ver la ganancia real.</p>}
          <ActionForm action={adminAddCostAction} className="frow" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "2 1 160px" }}>Qué es<input name="name" placeholder="Railway" /></label>
            <label className="field" style={{ flex: "1 1 100px" }}>Importe<input name="amount" inputMode="decimal" placeholder="5" /></label>
            <label className="field" style={{ flex: "0 1 100px" }}>Moneda<select name="currency" defaultValue="USD"><option>USD</option><option>ARS</option><option>EUR</option></select></label>
            <label className="field" style={{ flex: "0 1 120px" }}>Cada<select name="period" defaultValue="monthly"><option value="monthly">Mes</option><option value="yearly">Año</option></select></label>
            <Submit>Agregar</Submit>
          </ActionForm>
        </div>
      </div>
      <div className="card">
        <div className="chead"><h3>Facturación (AFIP)</h3></div>
        <p className="sub" style={{ fontSize: 14, margin: 0 }}>Las facturas electrónicas todavía se hacen a mano en el sitio de AFIP. Para tu contador: descargá los pagos en Excel con el botón de arriba.</p>
      </div>
    </>
  );
}
