"use client";
// Botones de la web pública que cambian a "Ir a la app" si la persona ya tiene la sesión abierta.
// Se decide en el navegador, así la página se sirve igual para todos (y rápido, desde caché).
import Link from "next/link";
import { useEffect, useState } from "react";

export function useHasSession() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(/(?:^|; )somosguafra_in=1/.test(document.cookie)); }, []);
  return on;
}

export function AppCta({ className, label, href = "/registro" }: { className: string; label: string; href?: string }) {
  const on = useHasSession();
  return <Link className={className} href={on ? "/app" : href}>{on ? "Ir a la app" : label}</Link>;
}
