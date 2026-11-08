import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { openObligations, type OpenItem } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtDayMonth, fmtPeriod, period, periodEnd, todayIn } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { cancelObligationAction } from "@/app/actions/app";
import { projectedAction } from "@/app/actions/modules";
import { projectedItems } from "@/server/recurring";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Help } from "@/components/help";

// Un proyectado es un pago que se repite más adelante: se calcula al vuelo y se crea recién al pagarlo o cancelarlo.
type Row = OpenItem & { proj?: { ruleId: string; occ: string; variable: boolean } };

export const metadata: Metadata = { title: "Próximos pagos" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Upcoming({ searchParams }: { searchParams: Promise<{ ver?: string; guardado?: string }> }) {
  const { workspace, modules } = await requireWorkspace();
  const { ver, guardado } = await searchParams;
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const thisMonth = period(today);
  // Se muestran los próximos 12 meses completos (hasta fin del mes, dentro de un año). Pendientes y proyectados, en paralelo.
  const horizon = periodEnd(addMonths(thisMonth, 12));
  const [all, projRaw] = await Promise.all([openObligations(getDb(), workspace.id, today), projectedItems(getDb(), workspace.id, today, horizon)]);
  const proj: Row[] = projRaw.map((p) => ({
    id: `p-${p.ruleId}-${p.occurrence.toISOString().slice(0, 10)}`, direction: p.direction, description: p.description, currency: p.currency, dueDate: p.dueDate,
    economicPeriod: period(p.occurrence), amount: p.amount, remaining: p.amount, certainty: "PROBABLE", overdue: false, status: "PENDING", category: null,
    proj: { ruleId: p.ruleId, occ: p.occurrence.toISOString().slice(0, 10), variable: p.variable },
  }));
  const rows: Row[] = [...all, ...proj].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const shown = rows.filter((o) => (ver === "pagar" ? o.direction === "PAYABLE" : ver === "cobrar" ? o.direction === "RECEIVABLE" : true));

  // Una sola lista por fecha: atrasado, esta semana, resto del mes y después, mes por mes.
  const groups: [string, Row[]][] = [
    ["Atrasado", shown.filter((o) => o.overdue)],
    ["Esta semana", shown.filter((o) => !o.overdue && o.dueDate <= in7)],
    ["Resto del mes", shown.filter((o) => o.dueDate > in7 && period(o.dueDate) === thisMonth)],
  ];
  const later = [...new Set(shown.filter((o) => o.dueDate > in7 && period(o.dueDate) !== thisMonth).map((o) => period(o.dueDate)))].sort();
  for (const p of later) groups.push([fmtPeriod(p), shown.filter((o) => o.dueDate > in7 && period(o.dueDate) === p)]);

  const inBase = (l: OpenItem[]) => l.filter((o) => o.currency === cur);
  const total = (l: OpenItem[], dir: "PAYABLE" | "RECEIVABLE") => inBase(l).filter((o) => o.direction === dir).reduce((s, o) => s.plus(o.remaining), ZERO);
  const week = all.filter((o) => o.overdue || o.dueDate <= in7);
  const lateList = all.filter((o) => o.overdue && o.direction === "PAYABLE");
  const net = (l: OpenItem[]) => total(l, "RECEIVABLE").minus(total(l, "PAYABLE"));

  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Próximos pagos" desc="Lo que falta pagar y cobrar en los próximos 12 meses. Lo marcado como Proyectado sale de tus pagos que se repiten." actions={<Link className="btn pri" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago o cobro</Link>} />
      {guardado && <div className="notice g" role="status"><span>Listo, quedó guardado.</span><Link className="btn sm" href="/app/movimientos/nuevo?estado=pendiente" style={{ marginLeft: "auto" }}>+ Cargar otro</Link></div>}
      {proj.length > 0 && <div className="sub help-line"><span className="pill">Proyectado</span> = lo que esperás de tus pagos que se repiten <Help term="proyectado" /></div>}
      {modules.calendario && <Tabs current="lista" items={[{ key: "lista", label: "Lista", href: "/app/proximos" }, { key: "cal", label: "Calendario", href: "/app/calendario" }]} />}
      <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div><small>Atrasado</small><b className={lateList.length ? "neg" : ""}>{formatMoney(total(lateList, "PAYABLE"), cur)}</b></div>
        <div><small>Esta semana salen</small><b>{formatMoney(total(week, "PAYABLE"), cur)}</b></div>
        <div><small>Esta semana entran</small><b className="pos">{formatMoney(total(week, "RECEIVABLE"), cur)}</b></div>
      </div>
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        {[["", "Todo"], ["pagar", "A pagar"], ["cobrar", "A cobrar"]].map(([k, l]) => <Link key={k} className={`segl ${(ver ?? "") === k ? "on" : ""}`} href={k ? `/app/proximos?ver=${k}` : "/app/proximos"}>{l}</Link>)}
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 12px" }}>{ver === "cobrar" ? "No tenés nada por cobrar." : ver === "pagar" ? "No tenés nada por pagar." : "No tenés nada por pagar ni por cobrar."}</p>
          <Link className="btn" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago o cobro</Link>
        </div>
      ) : groups.filter(([, l]) => l.length).map(([title, list]) => {
        const n = net(list);
        return (
          // Lo urgente queda abierto; cada mes que viene se despliega al tocarlo.
          <details className="card grp" key={title} open={["Atrasado", "Esta semana", "Resto del mes"].includes(title)}>
            <summary className="chead grp-sum"><span className="grp-t"><h3>{title}</h3><small>{list.length} {list.length === 1 ? "pago o cobro" : "pagos y cobros"}</small></span><span className={`num ${n.isNegative() ? "neg" : "pos"}`}>{formatMoney(n, cur, { sign: true })}</span><span className="grp-chev" aria-hidden="true">›</span></summary>
            <div className="list">{list.map((o) => {
              const rec = o.direction === "RECEIVABLE";
              if (o.proj) return (
                <div className="li proj" key={o.id}>
                  <div className="dchip"><b>{o.dueDate.getUTCDate()}</b><span>{MES[o.dueDate.getUTCMonth()]}</span></div>
                  <div className="grow">
                    <div className="t">{o.description}</div>
                    <div className="s"><span className="pill">Proyectado</span> {rec ? "A cobrar" : "A pagar"} · se repite{o.proj.variable ? " · monto aproximado" : ""}</div>
                  </div>
                  <b className={`num ${rec ? "pos" : "neg"}`}>{rec ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
                  <div className="li-acts">
                    <form action={projectedAction}><input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="pagar" /><button className="btn sm" type="submit">{rec ? "Cobrar" : "Pagar"}</button></form>
                    <form action={projectedAction}><input type="hidden" name="ruleId" value={o.proj.ruleId} /><input type="hidden" name="occurrence" value={o.proj.occ} /><input type="hidden" name="do" value="cancelar" /><input type="hidden" name="back" value="/app/proximos" /><ConfirmSubmit className="dots" title="Cancelar solo esta vez" ariaLabel={`Cancelar ${o.description} solo esta vez`} question={`¿Cancelar ${o.description} del ${o.dueDate.getUTCDate()} de ${MES[o.dueDate.getUTCMonth()]}?`} yes="Sí, cancelar">×</ConfirmSubmit></form>
                  </div>
                </div>
              );
              return (
                <div className="li" key={o.id}>
                  <div className="dchip"><b className={o.overdue ? "neg" : ""}>{o.dueDate.getUTCDate()}</b><span className={o.overdue ? "neg" : ""}>{MES[o.dueDate.getUTCMonth()]}</span></div>
                  <div className="grow">
                    <div className="t">{o.description}</div>
                    <div className="s">
                      {rec ? "A cobrar" : "A pagar"}
                      {o.overdue ? ` · venció el ${fmtDayMonth(o.dueDate)}` : ""}
                      {o.status === "PARTIAL" ? ` · ${rec ? "cobrado" : "pagado"} en parte, total ${formatMoney(o.amount, o.currency)}` : ""}
                      {o.category ? ` · ${o.category}` : ""}
                    </div>
                  </div>
                  <b className={`num ${rec ? "pos" : "neg"}`}>{rec ? "+" : "−"}{formatMoney(o.remaining, o.currency)}</b>
                  <div className="li-acts"><Link className="btn sm" href={`/app/proximos/${o.id}`}>{rec ? "Cobrar" : "Pagar"}</Link>
                  <form action={cancelObligationAction}><input type="hidden" name="id" value={o.id} /><ConfirmSubmit className="dots" title="Cancelar: ya no se va a pagar ni cobrar" ariaLabel={`Cancelar ${o.description}`} question={`¿Cancelar ${o.description} (${formatMoney(o.remaining, o.currency)})?`} yes="Sí, cancelar">×</ConfirmSubmit></form></div>
                </div>
              );
            })}</div>
          </details>
        );
      })}
    </>
  );
}
