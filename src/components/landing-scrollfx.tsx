"use client";
// Movimiento atado al scroll: a cada elemento con data-sfx le pone --p, de 0 (entra por abajo) a 1 (sale por arriba).
// Con eso el CSS mueve fondos, celulares y textos mientras bajás. Se apaga con "reducir movimiento".
import { useEffect } from "react";

export function ScrollFx() {
  useEffect(() => {
    // En el celular no se mueve nada con el scroll (es lo que más traba): queda quieto y fluido.
    if (window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 900px), (pointer: coarse)").matches) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-sfx]")];
    if (!els.length) return;
    let raf = 0;
    const frame = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue; // fuera de pantalla: no hace falta
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        el.style.setProperty("--p", p.toFixed(4));
      }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(frame); };
    frame();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return null;
}

// Fondo animado para una sección: manchas de color que se mueven solas y una grilla que se desliza con el scroll.
export function Aurora({ tone = "light", grid = false }: { tone?: "light" | "dark"; grid?: boolean }) {
  return (
    <div className={`lx-aur ${tone}`} aria-hidden="true">
      <span className="a1" /><span className="a2" /><span className="a3" />
      {grid && <i className="lx-aur-grid" />}
    </div>
  );
}
