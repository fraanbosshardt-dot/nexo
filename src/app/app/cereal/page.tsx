import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { grainTimeline, monthlyGrainRules, type GrainRow } from "@/server/grain";
import { dec, formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { ProGate } from "@/components/pro";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { changeMonthlyGrainAction, deleteGrainSaleAction, deleteGrainStockAction, grainSaleAction, grainStockAction, monthlyGrainAction, stopMonthlyGrainAction } from "@/app/actions/modules";
import { GrainForm, GRAINS } from "./grain-form";

export const metadata: Metadata = { title: "Ventas de cereal" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const LISTO: Record<string, string> = {
  editada: "Listo, la venta quedó actualizada.",
  borrada: "Listo, borramos la venta. Ya no cuenta en Próximos pagos ni en el flujo.",
  "borrada-cobrada": "Listo, borramos la venta y anulamos su cobro: el saldo de la cuenta volvió a como estaba.",
  "mensual-cambiada": "Listo, la estimación cambió desde hoy.",
  "mensual-terminada": "Listo, ya no se estiman los meses sin venta. Tus ventas quedan como estaban.",
};

export default async function Grain({ searchParams }: { searchParams: Promise<{ u?: string; mensual?: string; listo?: string; cargar?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) return <ProGate crumb="Mi dinero" title="Ventas de cereal" text="Para productores: cargá cada venta en quintales o toneladas, con precio por tonelada e impuesto al cheque. El neto se suma solo a tus ingresos." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const sp = await searchParams;
  const unit = sp.u === "t" ? "t" : "qq";
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [{ sales, rows }, accounts, monthly, stock] = await Promise.all([grainTimeline(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } }), monthlyGrainRules(db, workspace.id, today), db.grainStock.findMany({ where: { workspaceId: workspace.id }, orderBy: { grain: "asc" } })]);
  const plan0 = monthly[0];
  const cur = workspace.baseCurrency;
  const qty = (t: unknown) => `${dec(t as string).times(unit === "qq" ? 10 : 1).toDecimalPlaces(2).toNumber().toLocaleString("es-AR")} ${unit}`;
  const sold = sales.reduce((s, x) => s.plus(x.sale.tonnes.toString()), ZERO);
  const collected = sales.reduce((a, s) => a.plus(s.status === "SETTLED" ? s.net : s.paid), ZERO);
  const pending = sales.reduce((a, s) => a.plus(s.status === "SETTLED" ? ZERO : s.net.minus(s.paid)), ZERO);
  const accOpts = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const unitQs = unit === "t" ? "u=t&" : "";

  // "Cargar venta" desde un mes estimado trae su fecha; desde el botón de arriba, hoy.
  const loadDate = sp.cargar && /^\d{4}-\d{2}-\d{2}$/.test(sp.cargar) ? new Date(`${sp.cargar}T00:00:00Z`) : null;
  const showForm = !!sp.cargar || rows.length === 0;
  const collectDate = loadDate && !Number.isNaN(loadDate.getTime()) ? loadDate : today;
  const formAccount = loadDate && plan0?.accountId ? plan0.accountId : undefined;

  type Sale = Extract<GrainRow, { kind: "sale" }>["s"];
  const stateOf = (s: Sale) => s.status === "SETTLED" ? <span className="pill g">Cobrada</span>
    : <Link className={`pill ${s.sale.collectDate < today ? "r" : ""}`} href={`/app/proximos/${s.sale.obligationId}`}>{s.status === "PARTIAL" ? "Cobrada en parte" : s.sale.collectDate < today ? "Atrasada" : "Por cobrar"} · registrar</Link>;
  const actions = (s: Sale) => {
    const cobrado = s.status === "SETTLED" ? s.net : s.paid;
    const q = cobrado.gt(0)
      ? `¿Borrar la venta de ${s.sale.grain.toLowerCase()}? Se anula el cobro de ${formatMoney(cobrado, cur)} y el saldo de la cuenta baja.`
      : `¿Borrar la venta de ${s.sale.grain.toLowerCase()}? Deja de contar en Próximos pagos y en el flujo.`;
    return (
      <div className="li-acts gr-acts">
        <Link className="btn sm" href={`/app/cereal/${s.sale.id}`}>Editar</Link>
        <form action={deleteGrainSaleAction}><input type="hidden" name="id" value={s.sale.id} /><ConfirmSubmit className="btn sm ghost" question={q} yes="Sí, borrar" ariaLabel={`Borrar la venta de ${s.sale.grain} de ${fmtDate(s.sale.saleDate)}`}>Borrar</ConfirmSubmit></form>
      </div>
    );
  };
  const chip = (d: Date, late = false) => <div className="dchip"><b className={late ? "neg" : ""}>{d.getUTCDate()}</b><span>{MES[d.getUTCMonth()]}</span></div>;

  const row = (r: GrainRow) => {
    if (r.kind === "sale") {
      const s = r.s;
      const pt = dec(s.sale.pricePerTonne).times(s.sale.fxRate ? dec(s.sale.fxRate) : 1);
      return (
        <div className="li" key={s.sale.id}>
          {chip(r.date)}
          <div className="grow">
            <div className="t">{s.sale.grain} · {qty(s.sale.tonnes)}</div>
            <div className="s gr-s">{stateOf(s)}<span>Vendida el {fmtDate(s.sale.saleDate)} · {formatMoney(pt, cur)} la tonelada · impuesto {formatMoney(s.tax.neg(), cur)}</span></div>
          </div>
          <b className="num pos">{formatMoney(s.net, cur)}</b>
          {actions(s)}
        </div>
      );
    }
    if (r.kind === "estimated") {
      const late = r.date < today;
      return (
        <div className="li proj" key={`e-${isoDate(r.date)}`}>
          {chip(r.date, late)}
          <div className="grow">
            <div className="t">Sin venta cargada</div>
            <div className="s gr-s"><span className="pill o">Estimada</span>{late && <span>¿Ya vendiste? Cargala para que quede el cobro real</span>}</div>
          </div>
          <b className="num">≈ {formatMoney(r.amount, r.currency)}</b>
          <div className="li-acts"><Link className="btn sm" href={`/app/cereal?${unitQs}cargar=${isoDate(r.date)}#cargar`}>Cargar venta</Link></div>
        </div>
      );
    }
    return (
      <div className="li" key={`c-${r.obligationId}`}>
        {chip(r.date)}
        <div className="grow">
          <div className="t">Cobro sin detalle</div>
          <div className="s gr-s">{r.settled ? <span className="pill g">Cobrada</span> : <Link className="pill" href={`/app/proximos/${r.obligationId}`}>Cobrada en parte · registrar</Link>}<span>Se registró el cobro de la estimada, sin quintales ni precio</span></div>
        </div>
        <b className="num pos">{formatMoney(r.paid, r.currency)}</b>
      </div>
    );
  };
  // Separador de año cuando la lista cruza de un año a otro.
  const years = new Set(rows.map((r) => r.date.getUTCFullYear()));
  const list: React.ReactNode[] = [];
  let lastYear = 0;
  for (const r of rows) {
    const y = r.date.getUTCFullYear();
    if (years.size > 1 && y !== lastYear) list.push(<div className="gr-year" key={`y-${y}`}>{y}</div>);
    lastYear = y;
    list.push(row(r));
  }

  const planAccount = plan0 ? accounts.find((a) => a.id === plan0.accountId) : undefined;

  return (
    <>
      <PageHead crumb="Mi dinero" title="Ventas de cereal" desc="Cada mes, tu venta: cobrada, por cobrar o estimada."
        actions={<>
          <div className="seg"><Link className={`segl ${unit === "qq" ? "on" : ""}`} href="/app/cereal">Quintales</Link><Link className={`segl ${unit === "t" ? "on" : ""}`} href="/app/cereal?u=t">Toneladas</Link></div>
          <Link className="btn pri" href={`/app/cereal?${unitQs}cargar=nueva#cargar`}>+ Cargar venta</Link>
        </>} />
      {sp.mensual && <p className="notice g" role="status">Listo: los meses sin venta ya se estiman en Próximos pagos, el calendario y el flujo de caja.</p>}
      {sp.listo && LISTO[sp.listo] && <p className="notice g" role="status">{LISTO[sp.listo]}</p>}

      {showForm && (
        <div className="card" id="cargar">
          <div className="chead">
            <div><h3>{loadDate ? `Venta de ${fmtPeriod(period(collectDate)).toLowerCase()}` : "Nueva venta"}</h3>{loadDate && <p className="sub">Reemplaza a la estimada de ese mes.</p>}</div>
            {rows.length > 0 && <Link className="lk" href={`/app/cereal${unit === "t" ? "?u=t" : ""}`}>Cancelar</Link>}
          </div>
          <GrainForm action={grainSaleAction} mode="new" accounts={accOpts} cur={cur} submit="Guardar venta"
            d={{ saleDate: isoDate(collectDate > today ? today : collectDate), grain: "Soja", quantity: "", unit, price: "", priceCurrency: cur, taxPct: "1,2", other: "", fxRate: "", collectDate: isoDate(collectDate), accountId: formAccount }} />
        </div>
      )}

      {sales.length > 0 && <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}><Stat label="Vendido" value={qty(sold)} /><Stat label="Cobrado" value={formatMoney(collected, cur)} tone="pos" /><Stat label="Falta cobrar" value={formatMoney(pending, cur)} /></div>}

      {rows.length > 0 && <div className="card"><div className="list gr-list">{list}</div></div>}

      <div className="card">
        <div className="chead"><div><h3>Cereal sin vender</h3><p className="sub">Lo que tenés guardado, con un precio de referencia por tonelada. Suma a tu patrimonio y, al cargar una venta, sale de acá.</p></div></div>
        {stock.length > 0 && <div className="list">{stock.map((g) => (
          <div className="li" key={g.id}>
            <div className="grow"><div className="t">{g.grain} · {qty(g.tonnes)}</div><div className="s">{formatMoney(g.pricePerTonne, g.currency)} la tonelada</div></div>
            <b className="num">{formatMoney(dec(g.tonnes).times(dec(g.pricePerTonne)), g.currency)}</b>
            <form action={deleteGrainStockAction}><input type="hidden" name="id" value={g.id} /><ConfirmSubmit className="dots" ariaLabel={`Quitar el stock de ${g.grain}`} question={`¿Quitar el stock de ${g.grain.toLowerCase()}? Deja de sumar en tu patrimonio.`} yes="Sí, quitar">×</ConfirmSubmit></form>
          </div>
        ))}</div>}
        <details className="more">
          <summary>{stock.length ? "Cargar o actualizar un cereal" : "+ Cargar stock"}</summary>
          <ActionForm action={grainStockAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end", paddingTop: 10 }}>
            <label className="field" style={{ flex: "1 1 130px" }}>Cereal<select name="grain">{GRAINS.map((g) => <option key={g}>{g}</option>)}</select></label>
            <label className="field" style={{ flex: "1 1 120px" }}>Cantidad<input name="quantity" inputMode="decimal" placeholder="0" /></label>
            <label className="field" style={{ flex: "0 1 120px" }}>En<select name="unit" defaultValue={unit}><option value="qq">Quintales</option><option value="t">Toneladas</option></select></label>
            <label className="field" style={{ flex: "1 1 160px" }}>Precio por tonelada<input name="price" inputMode="decimal" placeholder="Pizarra o lo que te ofrecen" /></label>
            <Submit>Guardar stock</Submit>
          </ActionForm>
        </details>
      </div>

      <div className="card">
        <div className="chead"><div>
          <h3>Estimar meses sin venta</h3>
          <p className="sub">{plan0
            ? `≈ ${formatMoney(plan0.amount, plan0.currency)} el día ${plan0.dayOfMonth}${planAccount ? ` · entra en ${planAccount.name}` : ""}. Los meses sin venta cargada se cuentan con ese monto en Próximos pagos y en el flujo.`
            : "Si vendés todos los meses, poné un monto aproximado: los meses sin venta cargada se cuentan con ese monto en Próximos pagos y en el flujo."}</p>
        </div></div>
        {plan0 ? (
          <div className="gr-month-acts">
            <details className="more">
              <summary>Cambiar monto, día o cuenta</summary>
              <ActionForm action={changeMonthlyGrainAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end", paddingTop: 10 }}>
                <input type="hidden" name="ruleId" value={plan0.id} />
                <label className="field" style={{ flex: "0 1 130px" }}>Día del mes<input name="day" inputMode="numeric" defaultValue={plan0.dayOfMonth ?? ""} /></label>
                <label className="field" style={{ flex: "1 1 180px" }}>Monto aproximado por mes<input name="amount" inputMode="decimal" defaultValue={dec(plan0.amount).toFixed(2).replace(".", ",")} /></label>
                <label className="field" style={{ flex: "1 1 180px" }}>Entra en<select name="accountId" defaultValue={plan0.accountId ?? undefined}>{accounts.filter((a) => a.currency === plan0.currency).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
                <Submit>Guardar desde hoy</Submit>
              </ActionForm>
            </details>
            <form action={stopMonthlyGrainAction}><input type="hidden" name="ruleId" value={plan0.id} /><ConfirmSubmit className="btn sm ghost" question="¿Dejar de estimar los meses sin venta? Tus ventas quedan como están." yes="Sí, dejar de estimar">Dejar de estimar</ConfirmSubmit></form>
          </div>
        ) : (
          <details className="more">
            <summary>Activar</summary>
            <ActionForm action={monthlyGrainAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end", paddingTop: 10 }}>
              <label className="field" style={{ flex: "0 1 130px" }}>Día del mes<input name="day" inputMode="numeric" placeholder="Ej.: 15" /></label>
              <label className="field" style={{ flex: "1 1 180px" }}>Monto aproximado por mes<input name="amount" inputMode="decimal" placeholder="Lo que suele quedarte" /></label>
              <label className="field" style={{ flex: "1 1 180px" }}>Entra en<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
              <Submit>Estimar</Submit>
            </ActionForm>
          </details>
        )}
      </div>
    </>
  );
}
