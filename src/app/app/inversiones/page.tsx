import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { investmentsOverview, latestRates } from "@/server/wealth";
import { ensureFreshRates } from "@/server/fx";
import { ASSET_CLASSES } from "@/server/quotes";
import { dec, formatMoney, round2, ZERO } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { PageHead, Stat, Tabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { deleteInvestmentAction, holdingTradeAction, investmentMoveAction, manualPriceAction, valuationAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CURRENCIES } from "@/lib/countries";
import { AddInvestment } from "./add-investment";

export const metadata: Metadata = { title: "Inversiones" };

const NOTICE: Record<string, string> = { borrada: "Listo, eliminamos la inversión y sus movimientos.", guardada: "Listo, agregamos la inversión.", operacion: "Listo, registramos la operación.", precio: "Listo, actualizamos el precio." };
const qtyFmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 8 });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;

// Eliminar una inversión cargada por error (la plata que salió de una cuenta vuelve a la cuenta).
function DeleteInv({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteInvestmentAction} className="dz" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <input type="hidden" name="investmentId" value={id} />
      <span className="sub" style={{ margin: 0 }}>¿La cargaste por error? Se borran sus movimientos y la plata que salió de una cuenta vuelve.</span>
      <ConfirmSubmit className="btn sm danger" question={`¿Eliminar ${name} con todos sus movimientos? No se puede deshacer.`} yes="Sí, eliminar">Eliminar inversión</ConfirmSubmit>
    </form>
  );
}

export default async function Investments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const cur = workspace.baseCurrency;
  await ensureFreshRates(db);
  const [list, accounts, rates] = await Promise.all([
    investmentsOverview(db, workspace.id),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    latestRates(db, workspace.id, cur),
  ]);
  // Todo pasado a la moneda principal (y a dólares) con la cotización oficial.
  const toBase = (v: typeof ZERO, c: string) => (c === cur ? v : rates.get(c) ? round2(v.times(rates.get(c)!.rate)) : null);
  const usdRate = cur === "USD" ? dec(1) : rates.get("USD")?.rate ?? null;
  let value = ZERO, invested = ZERO;
  const missing = new Set<string>();
  for (const i of list) {
    const v = toBase(i.value, i.inv.currency), c = toBase(i.invested, i.inv.currency);
    if (v == null || c == null) { missing.add(i.inv.currency); continue; }
    value = value.plus(v); invested = invested.plus(c);
  }
  const gain = value.minus(invested);
  const today = isoDate(todayIn(workspace.timezone));
  const holdings = list.filter((i) => i.holding), byAmount = list.filter((i) => !i.holding);
  const accFor = (c: string) => accounts.filter((a) => a.currency === c);
  return (
    <>
      <PageHead crumb="Patrimonio" title="Inversiones" desc="Bonos, acciones, CEDEARs, cripto, FCI y plazos fijos, con su cotización. Lo invertido no es dinero disponible." />
      <Tabs current="inv" items={[{ key: "pat", label: "Patrimonio neto", href: "/app/patrimonio" }, { key: "inv", label: "Inversiones", href: "/app/inversiones" }]} />
      {Object.entries(NOTICE).map(([k, t]) => sp[k] && <p key={k} className="notice g" role="status">{t}</p>)}
      {list.length > 0 && (
        <div className="card inv-sum">
          <Stat label="Vale hoy" value={formatMoney(value, cur)} />
          {usdRate && cur !== "USD" && <Stat label="En dólares" value={formatMoney(round2(value.dividedBy(usdRate)), "USD")} />}
          <Stat label="Invertido" value={formatMoney(invested, cur)} />
          <Stat label="Resultado" value={`${formatMoney(gain, cur, { sign: true })}${invested.gt(0) ? ` (${pct(gain.dividedBy(invested).times(100).toNumber())})` : ""}`} tone={gain.isNegative() ? "neg" : "pos"} />
          {missing.size > 0 && <p className="sub" style={{ flexBasis: "100%", margin: 0 }}>No sumamos lo que está en {[...missing].join(", ")} porque falta su cotización (cargala en Patrimonio).</p>}
        </div>
      )}

      {holdings.length > 0 && (
        <div className="card">
          <div className="chead"><h3>Tus especies</h3></div>
          <div className="inv-list">{holdings.map((i) => {
            const h = i.holding!;
            const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, i.inv.currency, o);
            const accs = accFor(i.inv.currency);
            return (
              <details className="inv-row" key={i.inv.id}>
                <summary>
                  <span className="inv-tk"><b>{i.inv.ticker}</b><span className="sub">{i.inv.kind}{i.inv.name !== i.inv.ticker ? ` · ${i.inv.name}` : ""}</span></span>
                  <span className="inv-q"><span>{qtyFmt(h.qty.toNumber())} {h.unitLabel}</span><span className="sub">{h.price ? `${fm(h.price)}${h.per100 ? " c/100" : ""}${h.changePct != null ? ` · ${pct(h.changePct)} hoy` : ""}` : "Sin precio"}</span></span>
                  <span className="inv-v"><b className="num">{fm(i.value)}</b><span className={`sub ${i.gain.isNegative() ? "neg" : "pos"}`}>{fm(i.gain, { sign: true })}{i.pct != null ? ` (${pct(i.pct)})` : ""}</span></span>
                </summary>
                <div className="inv-body">
                  <dl className="ctile-kv">
                    <div><dt>Pagaste (costo)</dt><dd>{fm(i.invested)}</dd></div>
                    {h.qty.gt(0) && <div><dt>Precio promedio</dt><dd>{fm(round2(i.invested.dividedBy(h.qty).times(h.per100 ? 100 : 1)))}{h.per100 ? " c/100" : ""}</dd></div>}
                    {!h.realized.isZero() && <div><dt>Ganancia ya cobrada</dt><dd className={h.realized.isNegative() ? "neg" : "pos"}>{fm(h.realized, { sign: true })}</dd></div>}
                    <div><dt>Precio</dt><dd>{h.auto ? "Automático" : "Cargado a mano"}{i.valuedAt ? ` · ${fmtDate(i.valuedAt)}` : ""}{h.converted ? ` · cotiza en ${h.quoteCurrency}, pasado a ${i.inv.currency}` : ""}</dd></div>
                  </dl>
                  <div className="grid g2" style={{ gap: 16 }}>
                    <ActionForm action={holdingTradeAction} className="inv-form">
                      <input type="hidden" name="investmentId" value={i.inv.id} />
                      <div className="frow"><label className="field">Operación<select name="side"><option value="BUY">Compré más</option><option value="SELL">Vendí</option></select></label><label className="field">Cantidad<input name="quantity" inputMode="decimal" placeholder="0" /></label></div>
                      <div className="frow"><label className="field">Importe total<input name="total" inputMode="decimal" placeholder="0,00" /></label><label className="field">Fecha<input name="date" type="date" defaultValue={today} /></label></div>
                      <label className="field">Cuenta<select name="accountId" defaultValue=""><option value="">No mover ninguna cuenta</option>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                      <div><Submit className="btn">Registrar</Submit></div>
                    </ActionForm>
                    <ActionForm action={manualPriceAction} className="inv-form">
                      <input type="hidden" name="investmentId" value={i.inv.id} />
                      <label className="field">{i.inv.assetClass === "FCI" ? "Valor de la cuotaparte hoy" : `Precio a mano${h.per100 ? " (cada 100 nominales)" : ""}`}<input name="price" inputMode="decimal" placeholder={h.price ? h.price.toNumber().toLocaleString("es-AR") : "0,00"} /></label>
                      <p className="sub" style={{ margin: 0 }}>{h.auto ? "Solo si querés usar otro precio: el automático se sigue actualizando y tiene prioridad." : "Lo usamos para calcular cuánto vale."}</p>
                      <div><Submit className="btn">Guardar precio</Submit></div>
                    </ActionForm>
                  </div>
                  {h.noRate && <p className="notice" style={{ margin: 0 }}>Cotiza en {h.quoteCurrency} y la tenés en {i.inv.currency}: falta la cotización entre las dos monedas. Cargala en Patrimonio o poné el precio a mano.</p>}
                  {i.inv.movements.length > 0 && <div className="list">{i.inv.movements.slice(0, 10).map((m) => <div className="li" key={m.id}><div className="grow"><div className="t">{m.kind === "BUY" ? "Compra" : m.kind === "SELL" ? "Venta" : m.kind === "YIELD" ? "Renta o dividendo" : m.kind}{m.quantity ? ` · ${qtyFmt(Number(m.quantity))}` : ""}</div><div className="s">{fmtDate(m.date)}</div></div><span className="num">{fm(m.amount)}</span></div>)}</div>}
                  <DeleteInv id={i.inv.id} name={i.inv.ticker ?? i.inv.name} />
                </div>
              </details>
            );
          })}</div>
        </div>
      )}

      {byAmount.map((i) => {
        const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, i.inv.currency, o);
        const accs = accFor(i.inv.currency);
        return (
          <div className="card" key={i.inv.id}>
            <div className="chead"><div><h3>{i.inv.name}</h3><p className="sub">{i.inv.kind} · {i.inv.currency}{i.valuedAt ? ` · valuada el ${fmtDate(i.valuedAt)}` : ""}</p></div>
              <div style={{ textAlign: "right" }}><b className="num" style={{ fontSize: 18 }}>{fm(i.value)}</b><div className={`sub ${i.gain.isNegative() ? "neg" : "pos"}`}>{fm(i.gain, { sign: true })}{i.pct != null ? ` · ${i.pct.toFixed(1).replace(".", ",")}%` : ""}</div></div></div>
            <details className="more"><summary>Aportar, retirar o actualizar el valor</summary>
              <div className="grid g2" style={{ paddingTop: 10, gap: 16 }}>
                <ActionForm action={investmentMoveAction} className="inv-form">
                  <input type="hidden" name="investmentId" value={i.inv.id} />
                  <div className="frow"><label className="field">Movimiento<select name="kind"><option value="CONTRIBUTION">Aporte</option><option value="WITHDRAWAL">Retiro</option></select></label><label className="field">Importe<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
                  <label className="field">Cuenta<select name="accountId">{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                  {accs.length ? <div><Submit className="btn">Registrar</Submit></div> : <p className="sub">Necesitás una cuenta en {i.inv.currency}.</p>}
                </ActionForm>
                <ActionForm action={valuationAction} className="inv-form">
                  <input type="hidden" name="investmentId" value={i.inv.id} />
                  <label className="field">¿Cuánto vale hoy?<input name="value" inputMode="decimal" defaultValue={i.value.toFixed(2).replace(".", ",")} /></label>
                  <div><Submit className="btn">Actualizar valor</Submit></div>
                </ActionForm>
              </div>
              {i.inv.movements.length > 0 && <div className="list" style={{ paddingTop: 8 }}>{i.inv.movements.slice(0, 8).map((m) => <div className="li" key={m.id}><div className="grow"><div className="t">{m.kind === "CONTRIBUTION" ? "Aporte" : m.kind === "WITHDRAWAL" ? "Retiro" : m.kind}</div><div className="s">{fmtDate(m.date)}</div></div><span className="num">{fm(m.amount)}</span></div>)}</div>}
              <DeleteInv id={i.inv.id} name={i.inv.name} />
            </details>
          </div>
        );
      })}

      <div className="card">
        <details className="more" open={list.length === 0 || !!sp.nueva}>
          <summary>+ Agregar inversión</summary>
          <AddInvestment classes={ASSET_CLASSES} accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} currencies={[cur, ...CURRENCIES.map((c) => c.code).filter((c) => c !== cur)]} base={cur} today={today} />
        </details>
      </div>
    </>
  );
}
