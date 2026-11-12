"use client";
// Pagar el resumen de la tarjeta: el total, el mínimo u otro monto. Lo que no se paga pasa al próximo resumen.
import { useState } from "react";

export function PayChoice({ total, minimum, symbol, interest }: { total: string; minimum: string; symbol: string; interest: string | null }) {
  const [pick, setPick] = useState<"total" | "min" | "otro">("total");
  const [other, setOther] = useState("");
  const value = pick === "total" ? total : pick === "min" ? minimum : other;
  const opt = (k: typeof pick, title: string, amount: string | null, note: string) => (
    <label className={`paych ${pick === k ? "on" : ""}`}>
      <input type="radio" name="payPick" checked={pick === k} onChange={() => setPick(k)} />
      <span className="grow"><b>{title}</b><span className="sub">{note}</span></span>
      {amount && <b className="num">{symbol} {amount}</b>}
    </label>
  );
  return (
    <div className="field" role="radiogroup" aria-label="¿Cuánto pagás?">
      <span>¿Cuánto pagás?</span>
      <div className="paychs">
        {opt("total", "El total", total, "No te queda nada para el próximo resumen.")}
        {minimum !== total && opt("min", "El pago mínimo", minimum, interest ? `Lo que falta pasa al próximo resumen, con interés (${interest}).` : "Lo que falta pasa al próximo resumen, con interés.")}
        {opt("otro", "Otro monto", null, "Una parte: lo que falta pasa al próximo resumen.")}
      </div>
      {pick === "otro" && <input aria-label="Monto que pagás" inputMode="decimal" placeholder="0,00" value={other} onChange={(e) => setOther(e.target.value)} autoFocus style={{ maxWidth: 260, marginTop: 8 }} />}
      <input type="hidden" name="amount" value={value} />
    </div>
  );
}
