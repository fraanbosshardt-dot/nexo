import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { openObligations, type OpenItem } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtDayMonth, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { cancelObligationAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Próximos pagos" };

export default async function Upcoming() {
  const { workspace } = await requireWorkspace();
  const today = todayIn(workspace.timezone);
  const in7 = new Date(today.getTime() + 7 * 864e5);
  const all = await openObligations(getDb(), workspace.id, today);
  const pays = all.filter((o) => o.direction === "PAYABLE"), cobros = all.filter((o) => o.direction === "RECEIVABLE");
  const groups: [string, OpenItem[], string][] = [
    ["Atrasados", pays.filter((o) => o.overdue), "var(--red)"],
    ["Próximos 7 días", pays.filter((o) => !o.overdue && o.dueDate <= in7), "var(--amber)"],
    ["Más adelante", pays.filter((o) => o.dueDate > in7), "var(--line)"],
    ["Cobros pendientes", cobros, "var(--green)"],
  ];
  const sum = (l: OpenItem[]) => l.reduce((s, o) => s.plus(o.remaining), ZERO);
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Próximos pagos" desc="Lo atrasado nunca se borra al cambiar de mes: queda acá hasta que lo pagues o lo canceles." actions={<Link className="btn pri" href="/app/movimientos/nuevo">+ Nuevo pendiente</Link>} />
      {groups.map(([title, list, color]) => (
        <div className="card" key={title}>
          <div className="chead"><h3>{title} {list.length > 0 && <span className="mut num">· {formatMoney(sum(list), workspace.baseCurrency)}</span>}</h3></div>
          {list.length ? (
            <div className="list">{list.map((o) => (
              <div className="li" key={o.id}>
                <i className="sev" style={{ background: color }} />
                <div className="dchip"><b>{o.dueDate.getUTCDate()}</b><span>{fmtDayMonth(o.dueDate).split(" ")[1]}</span></div>
                <div className="grow">
                  <div className="t">{o.description}</div>
                  <div className="s">{o.overdue ? `Venció el ${fmtDate(o.dueDate)}` : `Vence el ${fmtDate(o.dueDate)}`}{o.economicPeriod !== period(o.dueDate) ? ` · corresponde a ${o.economicPeriod}` : ""}{o.status === "PARTIAL" ? ` · pagado en parte, total ${formatMoney(o.amount, o.currency)}` : ""}{o.certainty !== "CONFIRMED" ? " · probable" : ""}</div>
                </div>
                <b className={`num ${o.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(o.remaining, o.currency)}</b>
                <Link className="btn sm" href={`/app/proximos/${o.id}`}>{o.direction === "RECEIVABLE" ? "Registrar cobro" : "Registrar pago"}</Link>
                <form action={cancelObligationAction}><input type="hidden" name="id" value={o.id} /><button className="btn sm ghost" type="submit" title="Ya no se va a pagar ni cobrar">Cancelar</button></form>
              </div>))}</div>
          ) : <div className="empty">Nada pendiente.</div>}
        </div>
      ))}
    </>
  );
}
