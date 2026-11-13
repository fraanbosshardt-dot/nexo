"use client";
// "Un mes con Guafra": mientras bajás, se cuenta un mes de ejemplo. A la derecha (arriba en el celular) queda fija
// una tarjeta con "te queda", la línea del mes que se va dibujando y el aviso de cada momento.
// Datos de ejemplo. Sin JavaScript se ve el primer paso y todos los textos.
import { useEffect, useRef, useState } from "react";

type Step = { day: number; title: string; text: string; left: number; toast: string; tone: "ok" | "warn" | "pos" };
const STEPS: Step[] = [
  { day: 1, title: "Cobrás el sueldo", text: "Entran $ 1.250.000. Guafra ya resta el alquiler, los servicios y las cuotas que vienen, y te dice lo que de verdad podés gastar.", left: 420000, toast: "Sueldo cobrado · +$ 1.250.000", tone: "pos" },
  { day: 5, title: "Cierra la tarjeta", text: "El resumen trae las cuotas de la heladera y las compras del mes. Ya estaban contadas: no te sorprende nada.", left: 356000, toast: "Visa cerró · $ 312.480, ya contado", tone: "ok" },
  { day: 12, title: "Te avisa antes", text: "Gastaste más en salidas de lo que te habías propuesto. Te avisa que te pasaste del presupuesto ahora, no cuando ya no queda nada.", left: 198000, toast: "Te pasaste del presupuesto de Salidas", tone: "warn" },
  { day: 20, title: "Decidís con datos", text: "Querés comprar algo grande. Con “¿Puedo comprarlo en cuotas?” probás empezar a pagarlo el mes que viene y ves al toque si te alcanza.", left: 151000, toast: "En 6 cuotas desde enero · te alcanza", tone: "ok" },
  { day: 30, title: "Terminás en verde", text: "Llegás al cobro con plata de sobra y ya sabés cómo viene el mes que viene, con las cuotas y los vencimientos.", left: 38000, toast: "Mes cerrado · te sobraron $ 38.000", tone: "pos" },
];
const START = STEPS[0].left;
const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
// Gráfico: x = día (1 a 30), y = "te queda". La línea punteada es el ritmo parejo (gastar lo mismo cada día).
const W = 320, H = 150, X = (d: number) => 14 + ((d - 1) / 29) * (W - 28), Y = (v: number) => 12 + (1 - v / START) * (H - 30);

export function MonthStory() {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const [shown, setShown] = useState(START);

  // El paso activo es el más cerca del medio de la pantalla (se recalcula al bajar o cambiar el tamaño).
  useEffect(() => {
    const pick = () => {
      const mid = window.innerHeight / 2;
      let best = 0, dist = Infinity;
      refs.current.forEach((r, k) => {
        if (!r) return;
        const b = r.getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - mid);
        if (d < dist) { dist = d; best = k; }
      });
      setI(best);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => { window.removeEventListener("scroll", pick); window.removeEventListener("resize", pick); };
  }, []);

  // El número va contando hasta el valor del paso (sin animación si se pidió reducir movimiento).
  useEffect(() => {
    const to = STEPS[i].left;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(to); return; }
    let raf = 0; const from = shown, t0 = performance.now();
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); setShown(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    // Por si el navegador pausa la animación (pestaña en segundo plano): igual termina en el número correcto.
    const done = setTimeout(() => setShown(to), 800);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const s = STEPS[i];
  const pts = STEPS.slice(0, i + 1).map((p) => `${X(p.day)},${Y(p.left)}`).join(" ");
  const daysLeft = Math.max(1, 31 - s.day);
  return (
    <div className="lx-month">
      <div className="lx-month-vis">
        <div className="lx-month-card">
          <div className="lx-month-top"><small>Día {s.day} de 30</small><span className={`lx-month-dot ${s.tone}`} /></div>
          <small>Te queda hasta el cobro</small>
          <b className="num">{fmt(shown)}</b>
          <small>{s.day < 30 ? `${fmt(s.left / daysLeft)} por día` : "Mes terminado"}</small>
          <svg viewBox={`0 0 ${W} ${H}`} className="lx-month-chart" role="img" aria-label={`Cómo baja lo que te queda durante el mes. Día ${s.day}: ${fmt(s.left)}.`}>
            <line x1={X(1)} y1={Y(START)} x2={X(30)} y2={Y(0)} className="ideal" />
            <line x1={X(1)} x2={X(30)} y1={Y(0)} y2={Y(0)} className="base" />
            <polyline points={pts} className="real" />
            {STEPS.slice(0, i + 1).map((p, k) => <circle key={p.day} cx={X(p.day)} cy={Y(p.left)} r={k === i ? 5.5 : 3.5} className={k === i ? `on ${p.tone}` : ""} />)}
          </svg>
          <div className="lx-month-legend"><span><i className="r" />Lo que te queda</span><span><i className="d" />Ritmo parejo</span></div>
        </div>
        <div key={i} className={`lx-month-toast ${s.tone}`} role="status" aria-live="polite">{s.toast}</div>
      </div>
      <ol className="lx-month-steps">
        {STEPS.map((p, k) => (
          <li key={p.day} data-i={k} ref={(el) => { refs.current[k] = el; }} className={k === i ? "on" : ""}>
            <span className="lx-month-day">Día {p.day}<b className="lx-month-left">Te queda {fmt(p.left)}</b></span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
