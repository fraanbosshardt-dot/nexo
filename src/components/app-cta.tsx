"use client";
// Botones de la web pública: Gratis va al pago de Pro; Pro vuelve a la app.
// Se decide en el navegador, así la página se sirve igual para todos (y rápido, desde caché).
import Link from "next/link";
import { useEffect, useState } from "react";

export function useHasSession() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(/(?:^|; )somosguafra_in=1/.test(document.cookie)); }, []);
  return on;
}

export type PublicPlan = { logged: boolean; plan?: "FREE" | "PRO"; trial?: string | null; paid?: boolean; owner?: boolean };

export function usePublicPlan() {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  useEffect(() => {
    if (!/(?:^|; )somosguafra_in=1/.test(document.cookie)) return;
    let active = true;
    fetch("/api/mi-plan", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Plan no disponible");
      return r.json();
    }).then((value: PublicPlan) => { if (active) setPlan(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return plan;
}

export function AppCta({ className, label, href = "/registro", logged = false }: { className: string; label: string; href?: string; logged?: boolean }) {
  const hasSession = useHasSession();
  const plan = usePublicPlan();
  const on = plan ? plan.logged : hasSession || logged;
  const app = plan?.plan === "PRO" || plan?.owner === false;
  const target = !on ? href : app ? "/app" : "/suscribirme?ciclo=mensual";
  const text = !on ? label : app ? "Ir a la app" : plan ? "Pasar a Pro" : "Continuar";
  return <Link className={className} href={target}>{text}</Link>;
}
