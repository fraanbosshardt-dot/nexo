"use client";
import { Help } from "@/components/help";
import { useState } from "react";

const KINDS = ["Préstamo personal", "Préstamo de billetera virtual", "Financiación bancaria", "Deuda informal", "Deuda comercial", "Plan de pagos de impuestos", "Deuda con proveedor", "Refinanciación"];

const SYSTEMS: [string, string, string][] = [
  ["FRENCH", "Francés", "Cuota fija todos los meses. Al principio pagás más interés y menos capital."],
  ["GERMAN", "Alemán", "Devolvés la misma parte de capital cada mes. La cuota empieza alta y baja."],
  ["AMERICAN", "Americano", "Pagás solo intereses cada mes y todo el capital en la última cuota."],
  ["NO_INTEREST", "Cuotas sin interés", "El importe se divide en partes iguales."],
  ["NONE", "Sin cronograma", "Para deudas informales: registrás los pagos cuando los hacés."],
];

// Valores para editar una deuda (en el alta van vacíos).
export type DebtDefaults = { creditor?: string; kind?: string; system?: string; principal?: string; installments?: string; firstDue?: string; installmentAmount?: string; tna?: string; tea?: string; cft?: string; startDate?: string; paidInstallments?: string; notes?: string };

export function DebtFormFields({ accounts, today, baseCurrency, d = {}, edit = false }: { accounts: { id: string; name: string; currency: string }[]; today: string; baseCurrency: string; d?: DebtDefaults; edit?: boolean }) {
  const [sys, setSys] = useState(d.system ?? "FRENCH");
  const withRate = ["FRENCH", "GERMAN", "AMERICAN"].includes(sys);
  const free = sys === "NONE";
  return (
    <>
      <div className="frow"><label className="field">¿A quién le debés?<input name="creditor" placeholder="Ej.: Banco, billetera, familiar" defaultValue={d.creditor} /></label>
        <label className="field">Tipo<select name="kind" defaultValue={d.kind ?? "Préstamo personal"}>{[...(d.kind && !KINDS.includes(d.kind) ? [d.kind] : []), ...KINDS].map((k) => <option key={k}>{k}</option>)}</select></label></div>
      <label className="field">Sistema de amortización<select name="system" value={sys} onChange={(e) => setSys(e.target.value)}>{SYSTEMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><span className="sub" style={{ fontWeight: 400 }}>{SYSTEMS.find((s) => s[0] === sys)?.[2]}</span></label>
      <div className="frow"><label className="field">Importe que te prestaron<input name="principal" inputMode="decimal" placeholder="0,00" defaultValue={d.principal} /></label>
        {!free && <label className="field">Cantidad de cuotas<input name="installments" inputMode="numeric" placeholder="Ej.: 12" defaultValue={d.installments} /></label>}</div>
      {!free && <div className="frow"><label className="field">Primera cuota<input name="firstDue" type="date" defaultValue={d.firstDue} /></label><label className="field">Importe de la cuota (si lo sabés)<input name="installmentAmount" inputMode="decimal" placeholder="0,00" defaultValue={d.installmentAmount} /></label></div>}
      {withRate && (
        <details className="more" open={!!(d.tna || d.tea || d.cft)}><summary>Tasas (opcional)</summary>
          <div className="frow" style={{ gridTemplateColumns: "1fr 1fr 1fr", paddingTop: 8 }}><label className="field"><span>TNA % <Help term="TNA" /></span><input name="tna" inputMode="decimal" defaultValue={d.tna} /></label><label className="field"><span>TEA % <Help term="TEA" /></span><input name="tea" inputMode="decimal" defaultValue={d.tea} /></label><label className="field"><span>CFT % <Help term="CFT" /></span><input name="cft" inputMode="decimal" defaultValue={d.cft} /></label></div>
          <p className="sub">Si no las tenés, no pasa nada: alcanza con el importe de la cuota. Nunca inventamos una tasa.</p>
        </details>
      )}
      <details className="more" open={edit}><summary>Más opciones</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
          <div className="frow"><label className="field">Fecha del préstamo<input name="startDate" type="date" defaultValue={d.startDate ?? today} /></label>{!free && <label className="field">Cuotas ya pagadas<input name="paidInstallments" inputMode="numeric" placeholder="0" defaultValue={d.paidInstallments} /></label>}</div>
          {!edit && <><div className="frow"><label className="field">Cuenta<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label><label className="field">Moneda (si no elegís cuenta)<input name="currency" defaultValue={baseCurrency} /></label></div>
          <label className="simtg"><input type="checkbox" name="credited" /><span>El dinero entró en esa cuenta ahora (no cuenta como ingreso)</span></label></>}
          <label className="field">Notas<input name="notes" defaultValue={d.notes} /></label>
        </div>
      </details>
    </>
  );
}
