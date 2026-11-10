"use client";
// Partes interactivas de la landing: la prueba de cuotas y el selector de precios.
import { useState } from "react";
import Link from "next/link";

const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const CUOTAS = [1, 3, 6, 12, 18];

function Range({ label, value, set, min, max, step }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="lx-range">
      <span><span>{label}</span><b>{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} style={{ "--p": `${pct}%` } as React.CSSProperties} />
    </label>
  );
}

export function CuotasDemo() {
  const [cobro, setCobro] = useState(1250000);
  const [fijos, setFijos] = useState(820000);
  const [precio, setPrecio] = useState(900000);
  const [n, setN] = useState(6);
  const cuota = precio / n, sobra = cobro - fijos, queda = sobra - cuota;
  const ok = queda >= 0, justo = ok && queda < sobra * 0.2;
  const tone = !ok ? "no" : justo ? "justo" : "si";
  return (
    <div className="lx-demo">
      <Range label="Cobrás por mes" value={cobro} set={setCobro} min={300000} max={4000000} step={50000} />
      <Range label="Gastos fijos por mes" value={fijos} set={setFijos} min={100000} max={3500000} step={50000} />
      <Range label="Precio de lo que querés comprar" value={precio} set={setPrecio} min={100000} max={6000000} step={50000} />
      <div className="lx-cuotas">
        <span>Cuotas</span>
        <div role="group" aria-label="Cantidad de cuotas">
          {CUOTAS.map((c) => <button key={c} type="button" aria-pressed={n === c} className={n === c ? "on" : ""} onClick={() => setN(c)}>{c === 1 ? "1 pago" : c}</button>)}
        </div>
      </div>
      <div className={`lx-verdict ${tone}`} role="status" aria-live="polite">
        <b>{!ok ? "No te alcanza" : justo ? "Te alcanza, pero justo" : "Te alcanza"}</b>
        <span>Cuota de {fmt(cuota)} por mes. {ok ? `Te quedan ${fmt(queda)} libres cada mes.` : `Te faltarían ${fmt(-queda)} por mes. Probá con más cuotas.`}</span>
      </div>
      <Link className="lx-more" href="/herramientas/cuotas">Ver la calculadora completa, mes a mes →</Link>
    </div>
  );
}

export function PriceSwitch({ monthly, yearly }: { monthly: React.ReactNode; yearly: React.ReactNode }) {
  const [y, setY] = useState(false);
  return (
    <>
      <div className="lx-seg" role="group" aria-label="Forma de pago">
        <button type="button" aria-pressed={!y} className={!y ? "on" : ""} onClick={() => setY(false)}>Por mes</button>
        <button type="button" aria-pressed={y} className={y ? "on" : ""} onClick={() => setY(true)}>Por año · 2 meses gratis</button>
      </div>
      {y ? yearly : monthly}
    </>
  );
}
