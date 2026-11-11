import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { addMonths, fmtPeriod, period, periodEnd, periodStart, todayIn } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { projectedItems } from "@/server/recurring";
import { projectedAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Calendario" };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const { workspace } = await requireWorkspace();
  const today = todayIn(workspace.timezone);
  const sp = await searchParams;
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : period(today);
  const from = periodStart(p), to = periodEnd(p);
  const obs = await getDb().obligation.findMany({ where: { workspaceId: workspace.id, dueDate: { gte: from, lte: to }, status: { not: "CANCELLED" } }, orderBy: { dueDate: "asc" } });
  // Proyectados: lo que tus pagos que se repiten van a generar este mes (desde hoy en adelante).
  const proj = to < today ? [] : await projectedItems(getDb(), workspace.id, from > today ? from : today, to);
  const projByDay = new Map<string, typeof proj>();
  for (const p of proj) { const k = p.dueDate.toISOString().slice(0, 10); projByDay.set(k, [...(projByDay.get(k) ?? []), p]); }
  // Grilla de lunes a domingo.
  const lead = (from.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(from.getTime() + (i - lead) * 864e5));
  const byDay = new Map<string, typeof obs>();
  for (const o of obs) { const k = o.dueDate.toISOString().slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), o]); }
  const weeks = Math.ceil((lead + to.getUTCDate()) / 7);
  // Día elegido (al tocar un número): su lista va debajo. Por defecto, hoy si está en este mes.
  const todayKey = today.toISOString().slice(0, 10);
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") && sp.dia!.startsWith(p) ? sp.dia! : todayKey.startsWith(p) ? todayKey : null;
  const selItems = sel ? byDay.get(sel) ?? [] : [];
  const selProj = sel ? projByDay.get(sel) ?? [] : [];
  const selDate = sel ? new Date(`${sel}T00:00:00Z`) : null;
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Calendario" desc="Tocá un día para ver qué vence y registrar el pago o el cobro."
        actions={<><Link className="btn" href={`/app/calendario?mes=${addMonths(p, -1)}`} aria-label="Mes anterior">‹</Link><span className="btn" style={{ minWidth: 150, justifyContent: "center" }}>{fmtPeriod(p)}</span><Link className="btn" href={`/app/calendario?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente">›</Link></>} />
      <Tabs current="cal" items={[{ key: "lista", label: "Lista", href: "/app/proximos" }, { key: "cal", label: "Calendario", href: "/app/calendario" }]} />
      <div className="legend"><span><i style={{ background: "var(--green)" }} />Cobros</span><span><i style={{ background: "var(--ink)" }} />Pagos</span><span><i style={{ background: "var(--red)" }} />Atrasados</span><span><i style={{ background: "var(--line-2)" }} />Ya pagados</span><span><i style={{ background: "transparent", border: "1px dashed var(--line-2)" }} />Proyectados (se repiten)</span></div>
      <div className="tw" style={{ margin: 0, padding: 0 }}>
        <div className="cal cal-real">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div className="hd" key={d}>{d}</div>)}
          {days.slice(0, weeks * 7).map((d) => {
            const k = d.toISOString().slice(0, 10), items = byDay.get(k) ?? [], pitems = projByDay.get(k) ?? [];
            const out = d.getUTCMonth() !== from.getUTCMonth();
            return (
              <div key={k} className={`d ${out ? "out" : ""} ${k === todayKey ? "today" : ""} ${k === sel ? "sel" : ""}`}>
                {out ? <span className="dn">{d.getUTCDate()}</span> : <Link className="dn" href={`/app/calendario?mes=${p}&dia=${k}`} scroll={false} aria-label={`Ver el ${d.getUTCDate()}`} aria-current={k === sel ? "date" : undefined}>{d.getUTCDate()}</Link>}
                {items.slice(0, 3).map((o) => {
                  const settled = o.status === "SETTLED", late = !settled && o.dueDate < today;
                  const cls = settled ? "ev done" : late ? "ev late" : o.direction === "RECEIVABLE" ? "ev in" : "ev out";
                  const label = `${o.description} · ${formatMoney(o.amount, o.currency)}`;
                  return settled ? <span key={o.id} className={cls} title={label}>✓ {o.description}</span> : <Link key={o.id} className={cls} href={`/app/proximos/${o.id}`} title={label}>{o.description}</Link>;
                })}
                {pitems.slice(0, Math.max(0, 3 - items.length)).map((p) => (
                  <form key={`${p.ruleId}${k}`} action={projectedAction} className="ev-form">
                    <input type="hidden" name="ruleId" value={p.ruleId} /><input type="hidden" name="occurrence" value={p.occurrence.toISOString().slice(0, 10)} /><input type="hidden" name="do" value="pagar" />
                    <button type="submit" className={`ev proj ${p.direction === "RECEIVABLE" ? "in" : "out"}`} title={`Proyectado · ${p.description} · ${formatMoney(p.amount, p.currency)}`}>{p.description}</button>
                  </form>
                ))}
                {items.length + pitems.length > 3 && <small className="mut">+{items.length + pitems.length - 3} más</small>}
              </div>
            );
          })}
        </div>
      </div>
      {!obs.length && !proj.length && <div className="empty">No hay pagos ni cobros este mes.</div>}
      {selDate && (obs.length > 0 || proj.length > 0) && (
        <div className="card cal-day">
          <div className="chead"><h3>{selDate.getUTCDate()} de {fmtPeriod(p).split(" ")[0].toLowerCase()}</h3><span className="sub">{selItems.length + selProj.length ? `${selItems.length + selProj.length} ${selItems.length + selProj.length === 1 ? "pago o cobro" : "pagos y cobros"}` : "Nada para este día"}</span></div>
          {selItems.length + selProj.length > 0 && <div className="list">
            {selItems.map((o) => {
              const settled = o.status === "SETTLED", rec = o.direction === "RECEIVABLE";
              return (
                <div className="li" key={o.id}>
                  <div className="grow"><div className="t">{o.description}</div><div className="s">{settled ? (rec ? "Cobrado" : "Pagado") : o.dueDate < today ? <span className="neg">Atrasado</span> : rec ? "A cobrar" : "A pagar"}</div></div>
                  <b className={`num ${rec ? "pos" : "neg"}`}>{rec ? "+" : "−"}{formatMoney(o.amount, o.currency)}</b>
                  {!settled && <Link className="btn sm" href={`/app/proximos/${o.id}`}>{rec ? "Cobrar" : "Pagar"}</Link>}
                </div>
              );
            })}
            {selProj.map((x) => (
              <div className="li proj" key={x.ruleId}>
                <div className="grow"><div className="t">{x.description}</div><div className="s">Proyectado · se repite</div></div>
                <b className={`num ${x.direction === "RECEIVABLE" ? "pos" : "neg"}`}>{x.direction === "RECEIVABLE" ? "+" : "−"}{formatMoney(x.amount, x.currency)}</b>
                <form action={projectedAction}><input type="hidden" name="ruleId" value={x.ruleId} /><input type="hidden" name="occurrence" value={x.occurrence.toISOString().slice(0, 10)} /><input type="hidden" name="do" value="pagar" /><button className="btn sm" type="submit">{x.direction === "RECEIVABLE" ? "Cobrar" : "Pagar"}</button></form>
              </div>
            ))}
          </div>}
        </div>
      )}
    </>
  );
}
