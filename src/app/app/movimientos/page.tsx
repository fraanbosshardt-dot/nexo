import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listMovements } from "@/server/ledger";
import { formatMoney } from "@/lib/money";
import { addMonths, fmtDate, fmtPeriod, period, todayIn } from "@/lib/dates";
import { Empty, PageHead, Tabs } from "@/components/page";
import { reverseAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Movimientos" };

const TYPE_LABEL: Record<string, string> = { INCOME: "Ingreso", EXPENSE: "Gasto", TRANSFER: "Transferencia", ADJUSTMENT: "Ajuste", DEBT_PAYMENT: "Cuota", CARD_PAYMENT: "Tarjeta", INVESTMENT: "Inversión" };

export default async function Movements({ searchParams }: { searchParams: Promise<{ mes?: string; tipo?: string }> }) {
  const { workspace, modules } = await requireWorkspace();
  const sp = await searchParams;
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : period(todayIn(workspace.timezone));
  const tipo = ["INCOME", "EXPENSE", "TRANSFER"].includes(sp.tipo ?? "") ? sp.tipo! : "ALL";
  const all = await listMovements(getDb(), workspace.id, { period: p });
  const rows = tipo === "ALL" ? all : all.filter((t) => t.type === tipo);
  const q = (o: Record<string, string>) => `/app/movimientos?${new URLSearchParams({ mes: p, ...(tipo !== "ALL" ? { tipo } : {}), ...o })}`;
  return (
    <>
      <PageHead crumb="Mi dinero" title="Movimientos" desc="Cada movimiento guarda a qué mes corresponde y cuándo se movió el dinero."
        actions={<><Link className="btn" href={q({ mes: addMonths(p, -1) })} aria-label="Mes anterior">‹</Link><span className="btn" style={{ minWidth: 150, justifyContent: "center" }}>{fmtPeriod(p)}</span><Link className="btn" href={q({ mes: addMonths(p, 1) })} aria-label="Mes siguiente">›</Link><Link className="btn pri" href="/app/movimientos/nuevo">+ Nuevo movimiento</Link></>} />
      {modules.tipos && (
        <Tabs current={tipo} items={[["ALL", "Todos"], ["INCOME", "Ingresos"], ["EXPENSE", "Gastos"], ["TRANSFER", "Transferencias"]].map(([k, l]) => ({ key: k, label: l, href: `/app/movimientos?${new URLSearchParams({ mes: p, ...(k !== "ALL" ? { tipo: k } : {}) })}` }))} />
      )}
      <div className="card">
        {rows.length ? (
          <div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Corresponde a</th><th>Cuenta</th><th className="n">Importe</th><th /></tr></thead>
            <tbody>{rows.map((t) => {
              const sign = t.direction === "IN" ? t.amount : t.amount.neg();
              return (
                <tr key={t.id} style={t.reversedBy || t.reversalOfId ? { opacity: 0.6 } : undefined}>
                  <td className="num">{fmtDate(t.effectiveDate)}</td>
                  <td>{t.description}{t.category && <small>{t.category.name}</small>}{t.reversedBy && <small>Revertido</small>}</td>
                  <td><span className={`pill ${t.type === "INCOME" ? "g" : ""}`}>{TYPE_LABEL[t.type]}</span></td>
                  <td>{fmtPeriod(t.economicPeriod)}</td>
                  <td>{t.account.name}</td>
                  <td className={`n ${t.type === "INCOME" && t.direction === "IN" ? "pos" : ""}`}>{formatMoney(sign, t.currency, { sign: t.type !== "TRANSFER" })}</td>
                  <td>{!t.reversedBy && !t.reversalOfId && (
                    <form action={reverseAction}><input type="hidden" name="id" value={t.id} /><button className="btn sm ghost" type="submit" title="Crea un movimiento opuesto; no borra el original">Revertir</button></form>
                  )}</td>
                </tr>);
            })}</tbody>
          </table></div>
        ) : <Empty>No hay movimientos en {fmtPeriod(p).toLowerCase()}. <Link className="lk" href="/app/movimientos/nuevo">Cargá el primero</Link>.</Empty>}
      </div>
      <p className="foot-note">Revertir no borra: crea un movimiento opuesto vinculado, así el historial queda completo.</p>
    </>
  );
}
