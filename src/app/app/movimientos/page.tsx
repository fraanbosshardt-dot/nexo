import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listMovements } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Movimientos" };
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const TYPE_LABEL: Record<string, string> = { TRANSFER: "Transferencia", ADJUSTMENT: "Corrección de saldo", DEBT_PAYMENT: "Cuota de deuda", CARD_PAYMENT: "Pago de tarjeta", INVESTMENT: "Inversión", DEBT_DISBURSEMENT: "Préstamo recibido" };

export default async function Movements({ searchParams }: { searchParams: Promise<{ mes?: string; tipo?: string; q?: string; desde?: string; hasta?: string; n?: string; guardado?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const p = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : period(todayIn(workspace.timezone));
  const tipo = ["INCOME", "EXPENSE", "TRANSFER"].includes(sp.tipo ?? "") ? sp.tipo! : "ALL";
  const q = (sp.q ?? "").trim().toLowerCase();
  // Rango libre: desde y hasta (si están, reemplazan al mes).
  const iso = (v?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? new Date(`${v}T00:00:00Z`) : null);
  let from = iso(sp.desde), to = iso(sp.hasta);
  if (from && to && from > to) [from, to] = [to, from];
  const ranged = !!(from || to);
  // Se traen todos los del período (los totales siempre son exactos) y se muestran de a 200 con "Ver más".
  const all = await listMovements(getDb(), workspace.id, ranged ? { from: from ?? undefined, to: to ?? undefined, take: 20000 } : { period: p, take: 20000 });
  const showN = Math.min(20000, Math.max(200, Number(sp.n) || 200));
  const fmtD = (d: Date) => `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
  const rangeLabel = ranged ? (from && to ? `Del ${fmtD(from)} al ${fmtD(to)}` : from ? `Desde el ${fmtD(from)}` : `Hasta el ${fmtD(to!)}`) : "";
  const rows = all
    .filter((t) => (tipo === "ALL" ? !(t.type === "TRANSFER" && t.direction === "IN") : tipo === "TRANSFER" ? t.type === "TRANSFER" && t.direction === "OUT" : t.type === tipo))
    .filter((t) => !q || `${t.description} ${t.category?.name ?? ""} ${t.account.name}`.toLowerCase().includes(q));
  const rangeQ: Record<string, string> = ranged ? { ...(sp.desde ? { desde: sp.desde } : {}), ...(sp.hasta ? { hasta: sp.hasta } : {}) } : { mes: p };
  const link = (o: Record<string, string>) => `/app/movimientos?${new URLSearchParams({ mes: p, ...(tipo !== "ALL" ? { tipo } : {}), ...(q ? { q } : {}), ...o })}`;
  const cur = workspace.baseCurrency;
  const real = all.filter((t) => t.currency === cur && !t.reversedBy && !t.reversalOfId);
  const inc = real.filter((t) => t.type === "INCOME").reduce((s, t) => (t.direction === "IN" ? s.plus(t.amount) : s.minus(t.amount)), ZERO);
  const out = real.filter((t) => t.type === "EXPENSE" || t.type === "DEBT_PAYMENT").reduce((s, t) => (t.direction === "OUT" ? s.plus(t.amount) : s.minus(t.amount)), ZERO);
  const visible = rows.slice(0, showN);
  const byDay = new Map<string, typeof rows>();
  for (const t of visible) { const k = t.effectiveDate.toISOString().slice(0, 10); byDay.set(k, [...(byDay.get(k) ?? []), t]); }

  return (
    <>
      <PageHead crumb="Mi dinero" title="Movimientos" desc="Lo que ya entró y salió de tus cuentas. Lo que falta está en Próximos pagos." />
      {sp.guardado && <div className="notice g" role="status"><span>Listo, quedó guardado.</span><span className="acts" style={{ marginLeft: "auto" }}><Link className="btn sm" href="/app/movimientos/nuevo">+ Cargar otro</Link>{/^[a-z0-9]{20,}$/.test(sp.guardado) && <Link className="btn sm" href={`/app/movimientos/${sp.guardado}`}>Ver o anular</Link>}</span></div>}
      <div className="acts" style={{ justifyContent: "space-between", alignItems: "center" }}>
        {ranged ? (
          <div className="acts" style={{ alignItems: "center" }}><b style={{ fontSize: 18, fontWeight: 400 }}>{rangeLabel}</b><Link className="btn sm" href={`/app/movimientos?mes=${p}`}>Volver al mes</Link></div>
        ) : (
          <div className="acts" style={{ alignItems: "center" }}>
            <Link className="ibtn" href={link({ mes: addMonths(p, -1) })} aria-label="Mes anterior">‹</Link>
            <b style={{ fontSize: 20, fontWeight: 400, minWidth: 150, textAlign: "center" }}>{fmtPeriod(p)}</b>
            <Link className="ibtn" href={link({ mes: addMonths(p, 1) })} aria-label="Mes siguiente">›</Link>
          </div>
        )}
        <form className="search" style={{ maxWidth: 320 }}>{Object.entries(rangeQ).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}{tipo !== "ALL" && <input type="hidden" name="tipo" value={tipo} />}<input name="q" defaultValue={sp.q ?? ""} placeholder={ranged ? "Buscar en estas fechas" : "Buscar en este mes"} aria-label="Buscar" /></form>
      </div>
      <details className="more" open={ranged}>
        <summary>Elegir fechas desde y hasta</summary>
        <form className="acts" style={{ alignItems: "flex-end", paddingTop: 10 }}>
          <label className="field" style={{ flex: "1 1 150px" }}>Desde<input name="desde" type="date" defaultValue={sp.desde ?? ""} /></label>
          <label className="field" style={{ flex: "1 1 150px" }}>Hasta<input name="hasta" type="date" defaultValue={sp.hasta ?? ""} /></label>
          {tipo !== "ALL" && <input type="hidden" name="tipo" value={tipo} />}
          <button className="btn" type="submit">Ver</button>
        </form>
      </details>
      <div className="fc" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        <div><small>Entró</small><b className="pos">{formatMoney(inc, cur)}</b></div>
        <div><small>Salió</small><b className="neg">{formatMoney(out, cur)}</b></div>
        <div><small>Resultado</small><b className={inc.minus(out).isNegative() ? "neg" : ""}>{formatMoney(inc.minus(out), cur, { sign: true })}</b></div>
      </div>
      <div className="seg" style={{ alignSelf: "flex-start" }}>
        {[["ALL", "Todos"], ["INCOME", "Ingresos"], ["EXPENSE", "Gastos"], ["TRANSFER", "Transferencias"]].map(([k, l]) => <Link key={k} className={`segl ${tipo === k ? "on" : ""}`} href={`/app/movimientos?${new URLSearchParams({ ...rangeQ, ...(k !== "ALL" ? { tipo: k } : {}), ...(q ? { q } : {}) })}`}>{l}</Link>)}
      </div>
      <div className="card">
        {rows.length ? (
          <div className="list">
            {[...byDay.entries()].map(([day, list]) => {
              const d = new Date(day + "T00:00:00Z");
              return (
                <div key={day}>
                  <div className="crumb" style={{ padding: "14px 0 4px", borderBottom: "1px solid var(--line)" }}>{DIAS[d.getUTCDay()]} {d.getUTCDate()} de {MESES[d.getUTCMonth()]}</div>
                  {list.map((t) => {
                    const off = !!(t.reversedBy || t.reversalOfId);
                    const isIn = t.direction === "IN";
                    return (
                      <Link className="li" key={t.id} href={`/app/movimientos/${t.id}`} style={{ color: "inherit", opacity: off ? 0.55 : 1 }}>
                        <div className="grow">
                          <div className="t" style={off ? { textDecoration: "line-through" } : undefined}>{t.description}</div>
                          <div className="s">{[TYPE_LABEL[t.type], t.category?.name, t.account.name, off ? (t.reversedBy ? "Anulado" : "Anulación") : null].filter(Boolean).join(" · ")}</div>
                        </div>
                        <b className={`num ${t.type === "TRANSFER" ? "" : isIn ? "pos" : "neg"}`}>{isIn ? "+" : "−"}{formatMoney(t.amount, t.currency)}</b>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            {rows.length > visible.length && <div className="acts" style={{ justifyContent: "center", paddingTop: 14 }}><Link className="btn" href={`/app/movimientos?${new URLSearchParams({ ...rangeQ, ...(tipo !== "ALL" ? { tipo } : {}), ...(q ? { q } : {}), n: String(showN + 200) })}`}>Ver más ({rows.length - visible.length} más)</Link></div>}
          </div>
        ) : (
          <div className="empty">
            <p style={{ margin: "0 0 12px" }}>{ranged ? (q ? `No encontramos "${sp.q}" en esas fechas.` : "No hay movimientos en esas fechas.") : q ? `No encontramos "${sp.q}" en ${fmtPeriod(p).toLowerCase()}.` : `No hay movimientos en ${fmtPeriod(p).toLowerCase()}.`}</p>
            <Link className="btn" href="/app/movimientos/nuevo">+ Cargar un gasto</Link>
          </div>
        )}
      </div>
    </>
  );
}
