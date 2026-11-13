"use client";
// Funciones en una tarjeta grande: atrás, las pantallas de la app desenfocadas (se deslizan al cambiar de pestaña);
// adelante, el título. Al pasar el mouse la app se ve más nítida. Cambia sola cada pocos segundos hasta que tocás
// una pestaña. Con "reducir movimiento" no cambia sola ni se desliza.
import { useEffect, useRef, useState } from "react";

type Item = { tag: string; title: string; text: string };

export function Showcase({ items, screens }: { items: Item[]; screens: React.ReactNode[] }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const hover = useRef(false);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!hover.current) setI((x) => (x + 1) % items.length); }, 5500);
    return () => clearInterval(t);
  }, [auto, items.length]);
  const it = items[i];
  return (
    <div className="lx-show">
      <div className="lx-show-tabs" role="tablist" aria-label="Funciones">
        {items.map((x, k) => (
          <button key={x.tag} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => { setI(k); setAuto(false); }}>
            {x.tag}{k === i && auto && <i key={i} className="lx-show-timer" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="lx-show-card" role="tabpanel" onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }}>
        <div className="lx-show-bg" aria-hidden="true" style={{ "--k": i } as React.CSSProperties}>
          {screens.map((s, k) => <div key={k} className={`lx-show-pane ${k === i ? "on" : ""}`}>{s}</div>)}
        </div>
        <div key={i} className="lx-show-txt">
          <span>{it.tag}</span>
          <h3>{it.title}</h3>
          <p>{it.text}</p>
        </div>
      </div>
    </div>
  );
}
