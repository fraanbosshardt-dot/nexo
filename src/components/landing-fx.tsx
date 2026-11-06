"use client";
import { useEffect, useRef, useState } from "react";

// Número fijo, sin animación.
export function CountUp({ to, prefix = "$ " }: { to: number; prefix?: string }) {
  return <>{prefix}{to.toLocaleString("es-AR")}</>;
}

// Aparición suave al bajar. Solo esconde lo que está más abajo de la pantalla al cargar,
// así nada queda oculto sin JavaScript ni para los buscadores. Además del observador,
// revisa en cada scroll y al cambiar el tamaño: si el observador falla, igual aparece.
const pending = new Set<HTMLElement>();
let listening = false;
function show(el: HTMLElement) { el.classList.remove("pre"); el.classList.add("in"); pending.delete(el); }
function check() {
  const h = window.innerHeight;
  for (const el of pending) if (el.getBoundingClientRect().top < h * 0.92) show(el);
  if (!pending.size && listening) { window.removeEventListener("scroll", check); window.removeEventListener("resize", check); listening = false; }
}

export function Reveal({ children, className = "", as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "h2" | "li" | "details" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("pre");
    void el.offsetHeight; // fija el estado inicial antes de animar
    pending.add(el);
    if (!listening) { window.addEventListener("scroll", check, { passive: true }); window.addEventListener("resize", check); listening = true; }
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { show(el); io?.disconnect(); } }), { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
      io.observe(el);
    }
    return () => { io?.disconnect(); pending.delete(el); };
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Tag ref={ref as any} className={"rv " + className}>{children}</Tag>;
}

export function ScrollTo({ id, children }: { id: string; children: React.ReactNode }) {
  return <button type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "auto" })}>{children}</button>;
}

export function PlanToggle({ monthly, yearly }: { monthly: React.ReactNode; yearly: React.ReactNode }) {
  const [y, setY] = useState(false);
  return (
    <>
      <div className="seg lp-yr"><button className={y ? "" : "on"} onClick={() => setY(false)}>Mensual</button><button className={y ? "on" : ""} onClick={() => setY(true)}>Anual · 2 meses gratis</button></div>
      {y ? yearly : monthly}
    </>
  );
}
