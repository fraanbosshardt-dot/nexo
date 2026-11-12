"use client";
// Agregar una inversión: por especie (con cotización automática) o por monto (plazo fijo u otra).
import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { createHoldingAction, createInvestmentAction } from "@/app/actions/modules";

type Cls = { key: string; label: string; hint: string; unit: string };
type Acc = { id: string; name: string; currency: string };

export function AddInvestment({ classes, accounts, currencies, base, today }: { classes: Cls[]; accounts: Acc[]; currencies: string[]; base: string; today: string }) {
  const [mode, setMode] = useState<"especie" | "monto">("especie");
  const [cls, setCls] = useState(classes[2]?.key ?? classes[0].key);
  const c = classes.find((x) => x.key === cls)!;
  const bond = cls === "BOND" || cls === "ON" || cls === "LETRA";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10, maxWidth: 680 }}>
      <div className="seg" role="tablist" aria-label="Tipo de inversión">
        <button type="button" role="tab" aria-selected={mode === "especie"} className={`segl ${mode === "especie" ? "on" : ""}`} onClick={() => setMode("especie")}>Bonos, acciones, cripto, FCI</button>
        <button type="button" role="tab" aria-selected={mode === "monto"} className={`segl ${mode === "monto" ? "on" : ""}`} onClick={() => setMode("monto")}>Plazo fijo u otra</button>
      </div>
      {mode === "especie" ? (
        <ActionForm action={createHoldingAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="frow">
            <label className="field">¿Qué es?<select name="assetClass" value={cls} onChange={(e) => setCls(e.target.value)}>{classes.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <label className="field">{cls === "FCI" ? "Nombre del fondo" : "Especie"}<input name="ticker" placeholder={c.hint} autoCapitalize="characters" /></label>
          </div>
          <div className="frow">
            <label className="field">¿Cuántos {c.unit} tenés?<input name="quantity" inputMode="decimal" placeholder="0" /></label>
            <label className="field">¿Cuánto pagaste en total?<input name="total" inputMode="decimal" placeholder="0,00" /></label>
          </div>
          {bond && <p className="sub" style={{ margin: 0 }}>Los bonos cotizan cada 100 nominales: vos poné los nominales que tenés y nosotros hacemos la cuenta.</p>}
          <div className="frow">
            {cls === "FCI" && <label className="field">Moneda del fondo<select name="currency" defaultValue={base}>{currencies.map((x) => <option key={x}>{x}</option>)}</select></label>}
            <label className="field">Fecha de compra<input name="date" type="date" defaultValue={today} /></label>
            <label className="field">¿Salió plata de una cuenta?<select name="accountId" defaultValue=""><option value="">No, ya lo tenía</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          </div>
          <p className="sub" style={{ margin: 0 }}>{cls === "FCI" ? "Los FCI no tienen cotización abierta: después cargás el valor de la cuotaparte y calculamos cuánto vale." : "El precio se actualiza solo. Ves cuánto vale hoy y cuánto ganaste o perdiste."}</p>
          <div className="stm-foot"><span className="sub">Comprar no es un gasto: la plata pasa de tu cuenta a la inversión.</span><Submit>Agregar inversión</Submit></div>
        </ActionForm>
      ) : (
        <ActionForm action={createInvestmentAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Plazo fijo 30 días" /></label><label className="field">Tipo<select name="kind">{["Plazo fijo", "Caución", "Cuenta remunerada", "Dólares", "Otra"].map((k) => <option key={k}>{k}</option>)}</select></label></div>
          <div className="frow"><label className="field">Moneda<select name="currency" defaultValue={base}>{currencies.map((x) => <option key={x}>{x}</option>)}</select></label><label className="field">Cuánto pusiste<input name="amount" inputMode="decimal" placeholder="0,00" /></label></div>
          <label className="field">¿De dónde sale?<select name="accountId" defaultValue=""><option value="">Ya lo tenía invertido (no sale de ninguna cuenta)</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          <div className="stm-foot"><span className="sub">Después actualizás cuánto vale cuando quieras.</span><Submit>Crear inversión</Submit></div>
        </ActionForm>
      )}
    </div>
  );
}
