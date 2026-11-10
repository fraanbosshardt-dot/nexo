// Formulario de una venta de cereal: el mismo para cargar una nueva y para editarla.
import { ActionForm, Submit } from "@/components/forms";
import { CURRENCIES } from "@/lib/countries";
import type { FormState } from "@/app/actions/auth";

export const GRAINS = ["Soja", "Maíz", "Trigo", "Girasol", "Sorgo", "Cebada", "Otro"];

export type GrainDefaults = {
  id?: string; saleDate: string; grain: string; quantity: string; unit: "qq" | "t"; price: string; priceCurrency: string;
  taxPct: string; other: string; fxRate: string; collectDate: string; accountId?: string;
};

export function GrainForm({ action, d, accounts, cur, mode, settled, showReplace, submit }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; d: GrainDefaults; accounts: { id: string; name: string; currency: string }[]; cur: string;
  mode: "new" | "edit"; settled?: boolean; showReplace?: boolean; submit: string;
}) {
  const grains = GRAINS.includes(d.grain) ? GRAINS : [d.grain, ...GRAINS];
  return (
    <ActionForm action={action} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 680 }}>
      {d.id && <input type="hidden" name="id" value={d.id} />}
      <div className="frow"><label className="field">Fecha de venta<input name="saleDate" type="date" defaultValue={d.saleDate} /></label><label className="field">Cereal<select name="grain" defaultValue={d.grain}>{grains.map((g) => <option key={g}>{g}</option>)}</select></label></div>
      <div className="frow"><label className="field">Cantidad<input name="quantity" inputMode="decimal" placeholder="0" defaultValue={d.quantity} /></label><label className="field">En<select name="unit" defaultValue={d.unit}><option value="qq">Quintales</option><option value="t">Toneladas</option></select></label></div>
      <div className="frow"><label className="field">Precio por tonelada<input name="price" inputMode="decimal" placeholder="0,00" defaultValue={d.price} /></label><label className="field">Moneda del precio<select name="priceCurrency" defaultValue={d.priceCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label></div>
      <div className="frow"><label className="field">Impuesto al cheque (%)<input name="taxPct" inputMode="decimal" defaultValue={d.taxPct} /></label><label className="field">Otros descuentos (opcional)<input name="other" inputMode="decimal" placeholder="Comisión, flete, secada…" defaultValue={d.other} /></label></div>
      <label className="field">Cotización (solo si el precio está en otra moneda)<input name="fxRate" inputMode="decimal" placeholder={`¿Cuántos ${cur} por unidad?`} defaultValue={d.fxRate} /></label>
      <div className="frow"><label className="field">Se cobra el<input name="collectDate" type="date" defaultValue={d.collectDate} /></label><label className="field">Entra en<select name="accountId" defaultValue={d.accountId}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label></div>
      {settled
        ? <p className="notice" style={{ margin: 0 }}>Esta venta ya está cobrada. Si cambiás el monto, la fecha o la cuenta, se corrige también ese ingreso y el saldo queda bien.</p>
        : <label className="simtg"><input type="checkbox" name="collected" /><span>Ya la cobré</span></label>}
      {mode === "new" && (showReplace ? <label className="simtg"><input type="checkbox" name="replacePlanned" defaultChecked /><span>Reemplaza a la venta prevista de ese mes (recomendado, para no contarla dos veces)</span></label> : <input type="hidden" name="replacePlanned" value="on" />)}
      <p className="sub">1 tonelada = 10 quintales. El impuesto se calcula sobre el total bruto.</p>
      <div><Submit>{submit}</Submit></div>
    </ActionForm>
  );
}
