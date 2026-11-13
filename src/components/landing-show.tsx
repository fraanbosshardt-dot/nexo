"use client";
// Funciones en una tarjeta grande que queda fija mientras bajás: cada tramo de scroll pasa a la pestaña siguiente
// (Inicio → Tarjetas → Próximos pagos → Flujo de caja). Atrás, las pantallas de la app desenfocadas se deslizan;
// adelante, el título. Tocar una pestaña baja hasta su tramo. La rayita de la pestaña muestra cuánto falta para la próxima.
import { useEffect, useRef, useState } from "react";

type Item = { tag: string; title: string; text: string };

export function Showcase({ items, screens }: { items: Item[]; screens: React.ReactNode[] }) {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0); // avance dentro de la pestaña actual (0 a 1)
  const wrap = useRef<HTMLDivElement>(null);
  const n = items.length;
  const [mobile, setMobile] = useState(false);
  const touch = useRef<number | null>(null);
  useEffect(() => { const mq = window.matchMedia("(max-width: 900px), (pointer: coarse)"); const on = () => setMobile(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);

  useEffect(() => {
    if (mobile) return; // en el celular cambia con el dedo, no con el scroll
    let raf = 0;
    const frame = () => {
      raf = 0;
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const run = r.height - window.innerHeight; // recorrido mientras la tarjeta está fija
      const p = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
      const x = Math.min(n - 0.0001, p * n);
      setI(Math.floor(x));
      setT(x - Math.floor(x));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(frame); };
    frame();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [n, mobile]);

  // Tocar una pestaña: baja (o sube) hasta la mitad de su tramo.
  const go = (k: number) => {
    if (mobile) { setI(k); setT(0); return; }
    const el = wrap.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + ((k + 0.5) / n) * run, behavior: smooth ? "smooth" : "auto" });
  };

  const it = items[i];
  return (
    <div className={`lx-show-scroll ${mobile ? "swipe" : ""}`} ref={wrap} style={{ "--n": n } as React.CSSProperties}>
      <div className="lx-show">
        <div className="lx-show-tabs" role="tablist" aria-label="Funciones">
          {items.map((x, k) => (
            <button key={x.tag} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : k < i ? "done" : ""} onClick={() => go(k)}>
              {x.tag}<i className="lx-show-timer" aria-hidden="true" style={{ transform: `scaleX(${k < i ? 1 : k === i ? t : 0})` }} />
            </button>
          ))}
        </div>
        <div className="lx-show-card" data-sfx="" role="tabpanel"
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const x0 = touch.current; touch.current = null; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) setI((k) => Math.min(n - 1, Math.max(0, k + (dx < 0 ? 1 : -1)))); }}>
          {/* Fondo vivo: manchas de luz que giran y un barrido de brillo */}
          <div className="lx-show-aur" aria-hidden="true"><span /><span /><span /></div>
          <i className="lx-show-shine" aria-hidden="true" />
          <div className="lx-show-bg" aria-hidden="true" style={{ "--k": i } as React.CSSProperties}>
            {screens.map((s, k) => <div key={k} className={`lx-show-pane ${k === i ? "on" : ""}`} style={{ "--i": k } as React.CSSProperties}>{s}</div>)}
          </div>
          {mobile && <div className="lx-show-dots" aria-hidden="true">{items.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>}
          <div key={i} className="lx-show-txt">
            <span>{it.tag}</span>
            <h3>{it.title}</h3>
            <p>{it.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
