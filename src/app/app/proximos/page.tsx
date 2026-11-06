import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { openObligations, type OpenItem } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDayMonth, fmtPeriod, period, todayIn } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { cancelObligationAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Próximos pagos" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function Upcoming({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { workspace, modules } = await requireWorkspace();
  const ver = (await searchParams).ver;
  const cur = workspace.baseCurrency;
  const today = todayIn(workspace.timezone);
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const thisMonth = period(today);
  const all = await openObligations(getDb(), workspace.id, today);
  const shown = all.filter((o) => (ver === "pagar" ? o.direction === "PAYABLE" : ver === "cobrar" ? o.direction === "RECEIVABLE" : true));

  // Una sola lista por fecha: atrasado, esta semana, resto del mes y después, mes por mes.
  const groups: [string, OpenItem[]][] = [
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
      <PageHead crumb="Pagos y deudas" title="Próximos pagos" desc="Lo que falta pagar y cobrar. Lo atrasado queda acá hasta que lo resuelvas." actions={<Link className="btn pri" href="/app/movimientos/nuevo?estado=pendiente">+ Agregar un pago o cobro</Link>} />
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
          <div className="card" key={title}>
            <div className="chead"><h3>{title}</h3><span className={`num ${n.isNegative() ? "neg" : "pos"}`}>{formatMoney(n, cur, { sign: true })}</span></div>
            <div className="list">{list.map((o) => {
              const rec = o.direction === "RECEIVABLE";
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
                  <Link className="btn sm" href={`/app/proximos/${o.id}`}>{rec ? "Cobrar" : "Pagar"}</Link>
                  <form action={cancelObligationAction}><input type="hidden" name="id" value={o.id} /><button className="dots" type="submit" title="Cancelar: ya no se va a pagar ni cobrar" aria-label={`Cancelar ${o.description}`}>×</button></form>
                </div>
              );
            })}</div>
          </div>
        );
      })}
    </>
  );
}
