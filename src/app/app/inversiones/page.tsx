import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { investmentsOverview } from "@/server/wealth";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createInvestmentAction, investmentMoveAction, valuationAction } from "@/app/actions/modules";
import { CURRENCIES } from "@/lib/countries";

export const metadata: Metadata = { title: "Inversiones" };
const KINDS = ["Plazo fijo", "Fondo común de inversión", "Acciones", "CEDEAR", "Bonos", "Criptomonedas", "Dólares", "Otra"];

export default async function Investments() {
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const [list, accounts] = await Promise.all([investmentsOverview(db, workspace.id), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } })]);
  const cur = workspace.baseCurrency;
  const inBase = list.filter((i) => i.inv.currency === cur);
  const invested = inBase.reduce((s, i) => s.plus(i.invested), ZERO), value = inBase.reduce((s, i) => s.plus(i.value), ZERO);
  return (
    <>
      <PageHead crumb="Patrimonio" title="Inversiones" desc="Lo invertido no es dinero disponible. Cambiar la valuación no mueve tu caja: solo aportar o retirar." />
      {list.length > 0 && <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}><Stat label="Invertido" value={formatMoney(invested, cur)} /><Stat label="Vale hoy" value={formatMoney(value, cur)} /><Stat label="Resultado" value={formatMoney(value.minus(invested), cur, { sign: true })} tone={value.lt(invested) ? "neg" : "pos"} /></div>}
      {list.map((i) => {
        const fm = (v: Parameters<typeof formatMoney>[0], o?: Parameters<typeof formatMoney>[2]) => formatMoney(v, i.inv.currency, o);
        const accs = accounts.filter((a) => a.currency === i.inv.currency);
        return (
          <div className="card" key={i.inv.id}>
            <div className="chead"><div><h3>{i.inv.name}</h3><p className="sub">{i.inv.kind} · {i.inv.currency}{i.valuedAt ? ` · valuada el ${fmtDate(i.valuedAt)}` : ""}</p></div>
              <div style={{ textAlign: "right" }}><b className="num" style={{ fontSize: 18 }}>{fm(i.value)}</b><div className={`sub ${i.gain.isNegative() ? "neg" : "pos"}`}>{fm(i.gain, { sign: true })}{i.pct != null ? ` · ${i.pct.toFixed(1).replace(".", ",")}%` : ""}</div></div></div>
            <details className="more"><summary>Aportar, retirar o actualizar el valor</summary>
              <div className="grid g2" style={{ paddingTop: 10 }}>
                <ActionForm action={investmentMoveAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="hidden" name="investmentId" value={i.inv.id} />
                  <div className="frow"><label className="field">Movimiento<select name="kind"><option value="CONTRIBUTION">Aporte</option><option value="WITHDRAWAL">Retiro</option></select></label><label className="field">Importe<input name="amount" inputMode="decimal" /></label></div>
                  <label className="field">Cuenta<select name="accountId">{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
                  {accs.length ? <div><Submit className="btn">Registrar</Submit></div> : <p className="sub">Necesitás una cuenta en {i.inv.currency}.</p>}
                </ActionForm>
                <ActionForm action={valuationAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input type="hidden" name="investmentId" value={i.inv.id} />
                  <label className="field">¿Cuánto vale hoy?<input name="value" inputMode="decimal" defaultValue={i.value.toFixed(2).replace(".", ",")} /></label>
                  <div><Submit className="btn">Actualizar valor</Submit></div>
                </ActionForm>
              </div>
              {i.inv.movements.length > 0 && <div className="list" style={{ paddingTop: 8 }}>{i.inv.movements.slice(0, 8).map((m) => <div className="li" key={m.id}><div className="grow"><div className="t">{m.kind === "CONTRIBUTION" ? "Aporte" : m.kind === "WITHDRAWAL" ? "Retiro" : m.kind}</div><div className="s">{fmtDate(m.date)}</div></div><b className="num">{fm(m.kind === "WITHDRAWAL" ? m.amount.neg() : m.amount)}</b></div>)}</div>}
            </details>
          </div>
        );
      })}
      <div className="card">
        <details className="more" open={list.length === 0}>
          <summary>+ Nueva inversión</summary>
          <ActionForm action={createInvestmentAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Plazo fijo 30 días" /></label><label className="field">Tipo<select name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label></div>
            <div className="frow"><label className="field">Moneda<select name="currency" defaultValue={cur}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label><label className="field">Primer aporte (opcional)<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
            <label className="field">Sale de<select name="accountId"><option value="">No registrar ahora</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
            <div><Submit>Crear inversión</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
