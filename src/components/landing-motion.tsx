"use client";
// Movimiento de la landing: barra de lectura, celular con profundidad, números que cuentan,
// línea de los pasos, inclinación de tarjetas y el recorrido del celular por las funciones.
// Todo se apaga con "reducir movimiento" y nada esconde contenido sin JavaScript.
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  if (!Number.isFinite(to) || el.dataset.done) return;
  el.dataset.done = "1";
  const pre = el.dataset.prefix ?? "", dur = 1300, t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + Math.round(to * e).toLocaleString("es-AR");
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function LandingMotion() {
  useEffect(() => {
    if (reduced()) return;
    const root = document.documentElement;
    const bar = document.querySelector<HTMLElement>(".lx-progress i");
    const hero = document.querySelector<HTMLElement>(".lx-phone-wrap");
    const tracks = [...document.querySelectorAll<HTMLElement>("[data-progress]")];
    let raf = 0;
    const frame = () => {
      raf = 0;
      const y = window.scrollY, h = root.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
      if (hero && y < 1200) hero.style.setProperty("--sy", String(y));
      const vh = window.innerHeight;
      for (const t of tracks) {
        const r = t.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        t.style.setProperty("--prog", p.toFixed(3));
        t.dataset.step = String(Math.min(3, Math.floor(p * 3.2)));
      }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(frame); };
    frame();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);

    // Números: cuentan desde 0 cuando aparecen.
    const nums = [...document.querySelectorAll<HTMLElement>("[data-count]")];
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target as HTMLElement); io.unobserve(e.target); } }), { threshold: 0.6 });
    nums.forEach((n) => io.observe(n));

    // Tarjetas que se inclinan con el mouse (solo con mouse de verdad).
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cards = fine ? [...document.querySelectorAll<HTMLElement>("[data-tilt]")] : [];
    const move = (e: PointerEvent) => {
      const c = e.currentTarget as HTMLElement, r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.classList.add("tilt");
      c.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
      c.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
      c.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    };
    const leave = (e: PointerEvent) => { const c = e.currentTarget as HTMLElement; c.style.transform = ""; };
    cards.forEach((c) => { c.addEventListener("pointermove", move); c.addEventListener("pointerleave", leave); });

    return () => {
      window.removeEventListener("scroll", on); window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      cards.forEach((c) => { c.removeEventListener("pointermove", move); c.removeEventListener("pointerleave", leave); });
    };
  }, []);
  return <div className="lx-progress" aria-hidden="true"><i /></div>;
}

// Recorrido: el celular queda fijo y cambia de pantalla según la función que estás leyendo.
export function PhoneTour({ steps, screens }: { steps: { title: string; text: string; tag: string }[]; screens: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) setActive(Number((vis.target as HTMLElement).dataset.i));
    }, { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 1] });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <div className="lx-tour">
      <div className="lx-tour-phone" aria-hidden="true">
        <div className="lx-phone lx-phone-static">
          <div className="lx-screen lx-tour-screen">
            <div className="lx-notch"><span /></div>
            {screens.map((s, i) => <div key={i} className={`lx-tour-pane ${i === active ? "on" : ""}`}>{s}</div>)}
            <div className="lx-tabs lx-tour-tabs">{["Inicio", "Tarjetas", "Pagos", "Flujo"].map((t, i) => <span key={t} className={i === active ? "on" : ""}>{t}</span>)}</div>
          </div>
        </div>
        <div className="lx-tour-dots">{steps.map((s, i) => <i key={s.title} className={i === active ? "on" : ""} />)}</div>
      </div>
      <ol className="lx-tour-steps">
        {steps.map((s, i) => (
          <li key={s.title} data-i={i} ref={(el) => { refs.current[i] = el; }} className={i === active ? "on" : ""}>
            <span className="lx-tour-tag">{s.tag}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
            <div className="lx-tour-inline" aria-hidden="true"><div className="lx-screen">{screens[i]}</div></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
