import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { forecast, type Certainty } from "@/server/forecast";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { Help } from "@/components/help";

export const metadata: Metadata = { title: "Flujo de caja" };

export default async function Flow({ searchParams }: { searchParams: Promise<{ h?: string; c?: string; detalle?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const long = await canUse(plan, "flujo5");
  const h = [12, 24, 36, 60].includes(Number(sp.h)) && (long || Number(sp.h) === 12) ? Number(sp.h) : 12;
  const c = (["conf", "prob", "hipo"].includes(sp.c ?? "") ? sp.c : "prob") as Certainty;
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const { cashNow, rows, events } = await forecast(getDb(), workspace.id, { currency: cur, today, months: h, certainty: c });
  // Saldo día a día (Pro): los próximos 60 días, solo los días en que algo entra o sale.
  const until = new Date(today.getTime() + 60 * 864e5);
  const daily: { date: Date; items: typeof events; delta: (typeof cashNow); balance: typeof cashNow }[] = [];
  let bal = cashNow;
  for (const e of events.filter((x) => x.date <= until)) {
    const last = daily[daily.length - 1];
    bal = bal.plus(e.amount);
    if (last && last.date.getTime() === e.date.getTime()) { last.items.push(e); last.delta = last.delta.plus(e.amount); last.balance = bal; }
    else daily.push({ date: e.date, items: [e], delta: e.amount, balance: bal });
  }
  const lowest = daily.reduce<(typeof daily)[number] | null>((m, d) => (!m || d.balance.lt(m.balance) ? d : m), null);
  // ¿Hay ingresos que se repiten hasta el final del período? Si no, a futuro solo quedan los gastos y da déficit.
  const lastP = rows[rows.length - 1].period;
  const horizonEnd = new Date(Date.UTC(Number(lastP.slice(0, 4)), Number(lastP.slice(5, 7)), 0));
  const incomeRules = await getDb().recurringRule.findMany({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", currency: cur, pausedAt: null, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { description: true, endDate: true } });
  const lasting = incomeRules.filter((x) => !x.endDate || x.endDate >= horizonEnd);
  const endsSoon = incomeRules.filter((x) => x.endDate && x.endDate < horizonEnd).sort((a, b) => a.endDate!.getTime() - b.endDate!.getTime());
  const f = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, cur, o);
  const max = rows.reduce((m, r) => (r.end.abs().gt(m) ? r.end.abs() : m), ZERO);
  const red = rows.filter((r) => r.min.lt(0));
  const q = (o: Record<string, string>) => `/app/flujo?${new URLSearchParams({ h: String(h), c, ...(sp.detalle ? { detalle: "1" } : {}), ...o })}`;
  const step = (l: string, v: (typeof rows)[number]["end"]) => <div className="fstep"><span>{l}</span><b className={`num ${v.isNegative() ? "neg" : ""}`}>{f(v)}</b></div>;
  return (
    <>
      <PageHead crumb="Planificar" title="Flujo de caja" desc="Cuánto entra, cuánto sale y con cuánto terminás cada mes, con lo que ya sabés que viene."
        actions={<div className="seg">{[12, 24, 36, 60].map((x) => long || x === 12 ? <Link key={x} className={`segl ${h === x ? "on" : ""}`} href={q({ h: String(x) })}>{x === 12 ? "1 año" : `${x / 12} años`}</Link> : <span key={x} className="segl dis" title="Función Pro">{x / 12} años · Pro</span>)}</div>} />
      <div className="sub help-line">¿Cómo se calcula? <Help term="flujo" /></div>
      <div className="card">
        <div className="fsteps">{step("Hoy", cashNow)}<i>→</i>{step("Fin de mes", rows[0].end)}<i>→</i>{step("En 6 meses", rows[Math.min(5, rows.length - 1)].end)}<i>→</i>{step(h === 12 ? "En 1 año" : `En ${h / 12} años`, rows[rows.length - 1].end)}</div>
        <p className="sub" style={{ marginTop: 12 }}>{red.length ? <span className="neg">Ojo: en {fmtPeriod(red[0].period).toLowerCase()} tu saldo baja a {f(red[0].min)}{red[0].minDate ? ` (el ${fmtDate(red[0].minDate)})` : ""}.</span> : <span className="pos">Tu saldo no baja de cero en este período.</span>}</p>
        {h > 12 && <p className="sub" style={{ marginTop: 6 }}>A más de un año es una estimación: supone que tus cobros y gastos que se repiten siguen igual y no cuenta aumentos. Usalo para ver la tendencia, no el número exacto.</p>}
      </div>
      {c !== "conf" && !lasting.length && (
        <div className="notice a"><span><b>{incomeRules.length ? `Tus ingresos que se repiten terminan antes (${endsSoon[endsSoon.length - 1]?.description} el ${fmtDate(endsSoon[endsSoon.length - 1].endDate!)})` : "No tenés ingresos que se repitan"}</b>: la proyección solo incluye los cobros que cargaste. Si faltan ingresos o gastos, el resultado puede cambiar. Cargá tu sueldo, alquileres o cosechas como cobro que se repite (si el monto cambia, marcalo como variable). <Link className="lnk" href="/app/recurrentes?nueva=1">Cargar un cobro que se repite</Link></span></div>
      )}
      <div className="card">
        <div className="chead"><h3>Mes a mes</h3>
          <div className="acts">
            <div className="seg">{[["conf", "Solo lo confirmado"], ["prob", "Con lo que se repite"]].map(([k, l]) => <Link key={k} className={`segl ${c === k ? "on" : ""}`} href={q({ c: k })}>{l}</Link>)}</div>
            <Link className="btn sm" href={sp.detalle ? `/app/flujo?h=${h}&c=${c}` : q({ detalle: "1" })}>{sp.detalle ? "Ver resumido" : "Ver desglose"}</Link>
          </div>
        </div>
        <div className="tw"><table>
          <thead><tr>{sp.detalle ? <><th>Mes</th><th className="n">Saldo inicial</th><th className="n">Ya entró</th><th className="n">Ya salió</th><th className="n">Falta entrar</th><th className="n">Falta salir</th><th className="n">Saldo final</th><th className="n">Punto más bajo</th></> : <><th>Mes</th><th className="n mh">Entra</th><th className="n mh">Sale</th><th className="n">Resultado</th><th className="n">Saldo final</th><th className="mh" style={{ width: "26%" }} /></>}</tr></thead>
          <tbody>{rows.map((r) => sp.detalle ? (
            <tr key={r.period}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(r.period)}</td><td className="n">{f(r.start)}</td><td className="n">{f(r.realizedIn)}</td><td className="n">{f(r.realizedOut.neg())}</td><td className="n">{f(r.pendingIn)}</td><td className="n">{f(r.pendingOut.neg())}</td><td className="n"><b className={r.end.isNegative() ? "neg" : ""}>{f(r.end)}</b></td><td className={`n ${r.min.isNegative() ? "neg" : ""}`}>{f(r.min)}</td></tr>
          ) : (
            <tr key={r.period}><td style={{ whiteSpace: "nowrap" }}>{fmtPeriod(r.period)}</td><td className="n pos mh">{f(r.realizedIn.plus(r.pendingIn))}</td><td className="n mh">{f(r.realizedOut.plus(r.pendingOut).neg())}</td><td className="n"><span className={`pill ${r.result.isNegative() ? "r" : "g"}`}>{f(r.result, { sign: true })}</span></td><td className="n"><b className={r.end.isNegative() ? "neg" : ""}>{f(r.end)}</b></td>
              <td className="mh"><div className="bar" style={{ height: 6 }}><i style={{ width: `${max.isZero() ? 0 : r.end.abs().dividedBy(max).times(100).toNumber()}%`, background: r.end.isNegative() ? "var(--red)" : "var(--ink)" }} /></div></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="chead"><div><h3>Día a día</h3><p className="sub">Tu saldo después de cada día con cobros o pagos, en los próximos 60 días.</p></div>{lowest && long && <span className={`pill ${lowest.balance.isNegative() ? "r" : ""}`}>Lo más bajo: {f(lowest.balance)} el {fmtDate(lowest.date)}</span>}</div>
        {!long ? (
          <p className="sub">Con Pro ves el saldo de cada día, para saber exactamente qué día te quedás corto. <Link className="lnk" href="/app/configuracion?tab=plan">Probar Pro</Link></p>
        ) : daily.length ? (
          <div className="list">{daily.map((d) => (
            <details className="li day-row" key={d.date.toISOString()}>
              <summary><span className="grow"><b style={{ fontWeight: 500 }}>{fmtDate(d.date)}</b><span className="s"> · {d.items.length === 1 ? d.items[0].description : `${d.items.length} movimientos`}</span></span><span className={`num ${d.delta.isNegative() ? "neg" : "pos"}`}>{f(d.delta, { sign: true })}</span><b className={`num ${d.balance.isNegative() ? "neg" : ""}`} style={{ minWidth: 110, textAlign: "right" }}>{f(d.balance)}</b></summary>
              {d.items.length > 1 && <div className="list" style={{ paddingLeft: 12 }}>{d.items.map((e, i) => <div className="li" key={i}><span className="grow s">{e.description}</span><span className={`num ${e.amount.isNegative() ? "neg" : "pos"}`}>{f(e.amount, { sign: true })}</span></div>)}</div>}
            </details>
          ))}</div>
        ) : <p className="sub">No hay cobros ni pagos en los próximos 60 días.</p>}
      </div>
      <div className="card"><details className="more"><summary>¿Cómo se calcula?</summary><p className="sub" style={{ paddingTop: 6 }}>Arranca con el dinero de tus cuentas en {cur} (sin inversiones ni tarjetas). Suma los cobros y resta los pagos pendientes, las reglas recurrentes y los resúmenes de tarjeta estimados, en el orden de sus fechas. Cada mes empieza con el saldo final del anterior. Las cuentas en otras monedas no se mezclan.</p></details></div>
    </>
  );
}
