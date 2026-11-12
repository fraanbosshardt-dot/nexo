// Datos de una tarjeta, para crearla y para editarla. Lo simple a la vista; lo profesional en "Más detalles".
import { CURRENCIES, currencyName } from "@/lib/countries";
import { SecondCurrency } from "./currency2";

export type CardDefaults = { name?: string; issuer?: string; last4?: string; limit?: string; closingDay?: string; dueDay?: string; currency?: string; payAccountId?: string; currency2?: string | null; financeRate?: string; monthlyFee?: string; alertPct?: string; holders?: string };

export function CardFields({ accounts, base, d = {}, edit = false }: { accounts: { id: string; name: string }[]; base: string; d?: CardDefaults; edit?: boolean }) {
  const second = d.currency2 ?? (base === "USD" ? "EUR" : "USD");
  return (
    <>
      <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Visa Galicia" defaultValue={d.name} /></label><label className="field">Banco o emisor<input name="issuer" placeholder="Ej.: Banco Galicia" defaultValue={d.issuer} /></label></div>
      <div className="frow"><label className="field">Día de cierre<input name="closingDay" inputMode="numeric" placeholder="Ej.: 26" defaultValue={d.closingDay} /></label><label className="field">Día de vencimiento<input name="dueDay" inputMode="numeric" placeholder="Ej.: 7" defaultValue={d.dueDay} /></label></div>
      <div className="frow"><label className="field">Límite<input name="limit" inputMode="decimal" placeholder="0,00" defaultValue={d.limit} /></label><label className="field">Se paga desde<select name="payAccountId" defaultValue={d.payAccountId}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>
      {edit && d.currency2 ? (
        <p className="sub" style={{ margin: 0 }}>También tiene consumos en {currencyName(d.currency2).toLowerCase()} ({d.currency2}).</p>
      ) : (
        <SecondCurrency initial={second} options={CURRENCIES.filter((c) => c.code !== (d.currency ?? base)).map((c) => ({ code: c.code, name: c.name }))} />
      )}
      <details className="more" open={edit && !!(d.financeRate || d.monthlyFee || d.alertPct || d.holders)}><summary>Más detalles (opcional)</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
          <div className="frow">
            {!edit && <label className="field">Moneda principal<select name="currency" defaultValue={d.currency ?? base}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label>}
            <label className="field">Últimos 4 números<input name="last4" inputMode="numeric" maxLength={4} placeholder="1234" defaultValue={d.last4} /></label>
          </div>
          <div className="frow">
            <label className="field">Tasa de financiación (TNA %)<input name="financeRate" inputMode="decimal" placeholder="Ej.: 95" defaultValue={d.financeRate} /><span className="sub" style={{ fontWeight: 400 }}>Si pagás menos que el total, calculamos el interés de lo que falta.</span></label>
            <label className="field">Cargos fijos por resumen<input name="monthlyFee" inputMode="decimal" placeholder="0,00" defaultValue={d.monthlyFee} /><span className="sub" style={{ fontWeight: 400 }}>Mantenimiento, seguro y otros cargos que cobra el banco cada mes.</span></label>
          </div>
          <div className="frow">
            <label className="field">Avisarme si uso más del (% del límite)<input name="alertPct" inputMode="numeric" placeholder="Ej.: 30" defaultValue={d.alertPct} /></label>
            <label className="field">Tarjetas adicionales (nombres, separados por coma)<input name="holders" placeholder="Ej.: Ana, Tomás" defaultValue={d.holders} /></label>
          </div>
        </div>
      </details>
    </>
  );
}
