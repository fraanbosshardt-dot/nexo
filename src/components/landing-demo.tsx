"use client";
// Partes interactivas de la landing: la prueba de cuotas y el selector de precios.
import { useState } from "react";
import Link from "next/link";

const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const CUOTAS = [1, 3, 6, 12, 18];

function Range({ label, value, set, min, max, step, show = fmt }: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; show?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="lx-range">
      <span><span>{label}</span><b>{show(value)}</b></span>
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

// "¿Cuánto te queda?": lo que tenés, menos lo que vence antes del cobro, repartido en los días que faltan.
export function QuedaDemo() {
  const [tengo, setTengo] = useState(612900);
  const [vence, setVence] = useState(428650);
  const [dias, setDias] = useState(23);
  const queda = tengo - vence, porDia = queda / dias;
  const pct = tengo > 0 ? Math.max(0, Math.min(100, (queda / tengo) * 100)) : 0;
  const tone = queda < 0 ? "no" : pct < 15 ? "justo" : "si";
  return (
    <div className="lx-demo">
      <Range label="Lo que tenés hoy en tus cuentas" value={tengo} set={setTengo} min={50000} max={5000000} step={10000} />
      <Range label="Lo que vence antes del cobro" value={vence} set={setVence} min={0} max={4000000} step={10000} />
      <Range label="Días hasta el próximo cobro" value={dias} set={setDias} min={1} max={31} step={1} show={(v) => (v === 1 ? "1 día" : `${v} días`)} />
      <div className="lx-queda" aria-hidden="true"><i style={{ width: `${pct}%` }} className={tone} /></div>
      <div className={`lx-verdict ${tone}`} role="status" aria-live="polite">
        <b>{queda < 0 ? `Te faltan ${fmt(-queda)}` : `Te quedan ${fmt(queda)}`}</b>
        <span>{queda < 0 ? "Lo que vence es más de lo que tenés: conviene mover algún pago o buscar un ingreso antes." : `Son ${fmt(porDia)} por día hasta el cobro. En Guafra este número se actualiza solo con cada gasto.`}</span>
      </div>
      <Link className="lx-more" href="/registro">Calcularlo con mis datos reales →</Link>
    </div>
  );
}

// Las dos pruebas de la portada, en pestañas.
export function DemoTabs({ titles, children }: { titles: [string, string]; children: [React.ReactNode, React.ReactNode] }) {
  const [t, setT] = useState(0);
  return (
    <div className="lx-demo-tabs">
      <div className="lx-seg" role="tablist" aria-label="Elegí la prueba">
        {titles.map((x, k) => <button key={x} type="button" role="tab" aria-selected={t === k} className={t === k ? "on" : ""} onClick={() => setT(k)}>{x}</button>)}
      </div>
      <div role="tabpanel">{children[t]}</div>
    </div>
  );
}
