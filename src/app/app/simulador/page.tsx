import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { canAfford, forecast } from "@/server/forecast";
import { formatMoney, parseAmount, ZERO } from "@/lib/money";
import { addMonths, fmtDate, fmtPeriod, isoDate, parseDate, period, periodStart, todayIn } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { ProGate } from "@/components/pro";

export const metadata: Metadata = { title: "Simulador" };
type SP = Record<string, string | undefined>;

export default async function Simulator({ searchParams }: { searchParams: Promise<SP> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const tab = sp.tab === "escenarios" ? "escenarios" : "cuotas";
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const tabs = <Tabs current={tab} items={[{ key: "cuotas", label: "¿Puedo comprarlo en cuotas?", href: "/app/simulador" }, { key: "escenarios", label: "Escenarios · Pro", href: "/app/simulador?tab=escenarios" }]} />;

  if (tab === "cuotas") {
    const price = parseAmount(sp.precio ?? "");
    const n = Math.max(1, Math.min(48, Number.parseInt(sp.cuotas ?? "6", 10) || 6));
    const financed = sp.interes === "con" ? parseAmount(sp.total ?? "") : null;
    const first = parseDate(sp.primera ?? "") ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 10));
    const cushion = parseAmount(sp.colchon ?? "") ?? ZERO;
    const r = price && price.gt(0) ? await canAfford(getDb(), workspace.id, { currency: cur, today, price, installments: n, financedTotal: financed, firstDue: first, cushion }) : null;
    return (
      <>
        <PageHead crumb="Planificar" title="Simulador" desc="Probá una decisión antes de tomarla. Nada de esto cambia tus datos." />
        {tabs}
        <div className="split sim">
          <form className="card" method="get" style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
            <h3>¿Qué querés comprar?</h3>
            <label className="field">Precio de contado<input name="precio" inputMode="decimal" placeholder="0,00" defaultValue={sp.precio ?? ""} /></label>
            <div className="frow"><label className="field">Cuotas<select name="cuotas" defaultValue={String(n)}>{[1, 2, 3, 6, 9, 12, 18, 24, 36].map((x) => <option key={x} value={x}>{x === 1 ? "En un pago" : `${x} cuotas`}</option>)}</select></label>
              <label className="field">Primera cuota<input name="primera" type="date" defaultValue={isoDate(first)} /></label></div>
            <div className="frow"><label className="field">Interés<select name="interes" defaultValue={sp.interes ?? "sin"}><option value="sin">Sin interés</option><option value="con">Con interés</option></select></label>
              <label className="field">Total financiado<input name="total" inputMode="decimal" placeholder="Solo si es con interés" defaultValue={sp.total ?? ""} /></label></div>
            <label className="field">Colchón mínimo que querés mantener<input name="colchon" inputMode="decimal" placeholder="0,00" defaultValue={sp.colchon ?? ""} /></label>
            <div><button className="btn pri" type="submit">Calcular</button></div>
            <p className="sub">Mira tu dinero de hoy y todo lo que ya sabés que entra y sale, mes a mes, y le suma las cuotas.</p>
          </form>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {!r ? <div className="empty">Cargá el precio y las cuotas para ver si te alcanza.</div> : (
              <>
                <div className={`card verdict ${r.ok ? "yes" : "no"}`}>
                  <div className="verdict-big">{r.ok ? "Sí, podés" : "No te conviene"}</div>
                  <p style={{ margin: "6px 0 0" }}>{r.installments > 1 ? `${r.installments} cuotas de ${fm(r.cuota)}` : `Un pago de ${fm(r.total)}`}. {r.ok
                    ? `Tu saldo más bajo sería ${fm(r.worst.min)}${r.worst.minDate ? ` (${fmtDate(r.worst.minDate)})` : ""}, sin bajar de tu colchón.`
                    : `En ${fmtPeriod(r.worst.period).toLowerCase()} tu saldo bajaría a ${fm(r.worst.min)}${r.cushion.gt(0) ? `, por debajo de tu colchón de ${fm(r.cushion)}` : ""}.`}</p>
                </div>
                <div className="card"><div className="chead"><h3>Otras opciones</h3><span className="sub">mismo total, distinta cantidad de cuotas</span></div>
                  <div className="chips">{r.options.map((o) => <span key={o.installments} className={`opt ${o.ok ? "ok" : "ko"}`}>{o.installments === 1 ? "Contado" : `${o.installments} cuotas`} · {fm(o.cuota)} {o.ok ? "✓" : "✕"}</span>)}</div></div>
                <div className="card"><div className="chead"><h3>Cómo quedaría tu dinero</h3></div>
                  <div className="tw"><table><thead><tr><th>Mes</th><th className="n">Sin la compra</th><th className="n">Cuota</th><th className="n">Con la compra</th><th className="n">Punto más bajo</th></tr></thead>
                    <tbody>{r.rows.map((x, i) => <tr key={x.period}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(x.period)}</td><td className="n">{fm(r.baseRows[i].end)}</td><td className="n">{x.cuota.gt(0) ? fm(x.cuota.neg()) : "—"}</td><td className="n"><b className={x.end.isNegative() ? "neg" : ""}>{fm(x.end)}</b></td><td className={`n ${x.min.lt(r.cushion) ? "neg" : ""}`}>{fm(x.min)}</td></tr>)}</tbody></table></div></div>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!(await canUse(plan, "simulador"))) return <>{tabs}<ProGate crumb="Planificar" title="Escenarios" text="Compará tu situación actual con escenarios optimistas, pesimistas o armados por vos: gastar más, perder un ingreso, recibir un extra o invertir todos los meses." trialUsed={!!workspace.subscription?.trialEndsAt} /></>;

  const db = getDb();
  const incomeRules = await db.recurringRule.findMany({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", pausedAt: null, currency: cur } });
  const PRESETS: Record<string, SP> = { base: {}, optimista: { gastos: "-10", extra: "1000000" }, pesimista: { gastos: "20", sin: incomeRules[0]?.id } };
  const preset = sp.preset && PRESETS[sp.preset] ? sp.preset : sp.gastos || sp.extra || sp.sin || sp.invertir ? "custom" : "base";
  const v = preset === "custom" ? sp : PRESETS[preset];
  const months = 12;
  const expensePct = Number(v.gastos ?? 0) || 0;
  const extra = parseAmount(v.extra ?? "");
  const invest = parseAmount(v.invertir ?? "");
  const extras = [
    ...(extra && extra.gt(0) ? [{ date: periodStart(addMonths(period(today), 1)), amount: extra, description: "Ingreso extra" }] : []),
    ...(invest && invest.gt(0) ? Array.from({ length: months }, (_, i) => ({ date: new Date(periodStart(addMonths(period(today), i)).getTime() + 24 * 864e5), amount: invest.neg(), description: "Inversión mensual" })) : []),
  ];
  const [base, scen] = await Promise.all([
    forecast(db, workspace.id, { currency: cur, today, months }),
    forecast(db, workspace.id, { currency: cur, today, months, adjust: { expensePct, extra: extras, dropRuleIds: v.sin ? [v.sin] : [] } }),
  ]);
  const minOf = (rows: typeof base.rows) => rows.reduce((m, r) => (r.min.lt(m) ? r.min : m), rows[0].min);
  const desc: Record<string, string> = { base: "Tus datos tal como están.", optimista: "Gastos −10% e ingreso extra de 1.000.000 el mes que viene.", pesimista: `Gastos +20%${incomeRules[0] ? ` y sin "${incomeRules[0].description}"` : ""}.`, custom: "Elegí vos cada ajuste." };
  return (
    <>
      <PageHead crumb="Planificar" title="Simulador" desc="Probá una decisión antes de tomarla. Nada de esto cambia tus datos." />
      {tabs}
      <div className="presets">{["base", "optimista", "pesimista", "custom"].map((k) => <a key={k} className={`preset ${preset === k ? "on" : ""}`} href={k === "custom" ? "/app/simulador?tab=escenarios&gastos=0" : `/app/simulador?tab=escenarios&preset=${k}`}><b>{k === "base" ? "Base" : k === "optimista" ? "Optimista" : k === "pesimista" ? "Pesimista" : "Personalizado"}</b><span>{desc[k]}</span></a>)}</div>
      <div className="split sim">
        <form className="card" method="get" style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "start" }}>
          <input type="hidden" name="tab" value="escenarios" />
          <h3>Ajustes</h3>
          <label className="field">Cambio en tus gastos (%)<input name="gastos" inputMode="numeric" defaultValue={String(expensePct)} /></label>
          <label className="field">Ingreso extra el mes que viene<input name="extra" inputMode="decimal" defaultValue={v.extra ?? ""} placeholder="0,00" /></label>
          <label className="field">Invertir por mes<input name="invertir" inputMode="decimal" defaultValue={v.invertir ?? ""} placeholder="0,00" /></label>
          <label className="field">Perder un ingreso<select name="sin" defaultValue={v.sin ?? ""}><option value="">Ninguno</option>{incomeRules.map((r) => <option key={r.id} value={r.id}>{r.description}</option>)}</select></label>
          <div><button className="btn pri" type="submit">Simular</button></div>
        </form>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div className="fstep"><span>En 12 meses (base)</span><b className="num">{fm(base.rows.at(-1)!.end)}</b></div>
            <div className="fstep"><span>En 12 meses (escenario)</span><b className={`num ${scen.rows.at(-1)!.end.isNegative() ? "neg" : ""}`}>{fm(scen.rows.at(-1)!.end)}</b></div>
            <div className="fstep"><span>Diferencia</span><b className={`num ${scen.rows.at(-1)!.end.minus(base.rows.at(-1)!.end).isNegative() ? "neg" : "pos"}`}>{fm(scen.rows.at(-1)!.end.minus(base.rows.at(-1)!.end), { sign: true })}</b></div>
            <div className="fstep"><span>Punto más bajo</span><b className={`num ${minOf(scen.rows).isNegative() ? "neg" : ""}`}>{fm(minOf(scen.rows))}</b></div>
          </div>
          <div className="card"><div className="tw"><table><thead><tr><th>Mes</th><th className="n">Base</th><th className="n">Escenario</th><th className="n">Diferencia</th></tr></thead>
            <tbody>{base.rows.map((b, i) => <tr key={b.period}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(b.period)}</td><td className="n">{fm(b.end)}</td><td className="n"><b className={scen.rows[i].end.isNegative() ? "neg" : ""}>{fm(scen.rows[i].end)}</b></td><td className={`n ${scen.rows[i].end.minus(b.end).isNegative() ? "neg" : "pos"}`}>{fm(scen.rows[i].end.minus(b.end), { sign: true })}</td></tr>)}</tbody></table></div></div>
        </div>
      </div>
    </>
  );
}
