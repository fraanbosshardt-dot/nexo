"use client";
import { useEffect, useRef, useState } from "react";

// Número fijo, sin animación.
export function CountUp({ to, prefix = "$ " }: { to: number; prefix?: string }) {
  return <>{prefix}{to.toLocaleString("es-AR")}</>;
}

// Agrega la clase "in" cuando el bloque entra en pantalla (solo mueve; nunca lo oculta).
export function Reveal({ children, className = "", as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "h2" | "li" | "details" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (el.classList.add("in"), io.disconnect())), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Tag ref={ref as any} className={`rv ${className}`}>{children}</Tag>;
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
