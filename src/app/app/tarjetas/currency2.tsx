"use client";
// "¿Tiene consumos en otra moneda?": la moneda se elige solo si se marca la opción.
import { useState } from "react";

export function SecondCurrency({ options, initial }: { options: { code: string; name: string }[]; initial: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="c2">
      <label className="simtg"><input type="checkbox" name="hasCurrency2" checked={on} onChange={(e) => setOn(e.target.checked)} /><span><b style={{ fontWeight: 500 }}>También tiene consumos en otra moneda</b><br /><span className="sub">Ej.: Netflix o compras en el exterior en dólares. Cada moneda tiene su propio resumen.</span></span></label>
      {on && (
        <label className="field c2-pick">¿En qué moneda?
          <select name="currency2" defaultValue={initial}>{options.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select>
        </label>
      )}
    </div>
  );
}
