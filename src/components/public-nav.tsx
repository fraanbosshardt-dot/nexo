"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { useHasSession } from "./app-cta";

const LINKS: [string, string][] = [["funciones", "Funciones"], ["como", "Cómo funciona"], ["agro", "Para el campo"], ["planes", "Precios"], ["preguntas", "Preguntas"]];

// Barra de la parte pública: acompaña al bajar y se vuelve semitransparente.
// En la landing, los enlaces bajan suave hasta cada sección; desde otras páginas, llevan a la landing.
export function PublicNav({ logged: loggedServer }: { logged: boolean }) {
  const logged = useHasSession() || loggedServer;
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Si se llega con #seccion desde otra página, baja suave al cargar.
  useEffect(() => {
    if (path !== "/" || !location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [path]);
  const go = (id: string) => (e: React.MouseEvent) => {
    if (path !== "/") return; // otra página: navega a /#id
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <header className={`lp-nav ${scrolled ? "scrolled" : ""}`} style={scrolled ? { backdropFilter: "saturate(180%) blur(14px)", WebkitBackdropFilter: "saturate(180%) blur(14px)" } : undefined}>
      <div className="lp-w lp-navin">
        <Brand />
        <nav className="lp-links" aria-label="Secciones">
          {LINKS.map(([id, label]) => <Link key={id} href={`/#${id}`} onClick={go(id)} scroll={false}>{label}</Link>)}
        </nav>
        <div className="lp-cta-top">{logged ? <Link className="btn pri" href="/app">Ir a la app</Link> : <><Link className="btn ghost" href="/ingresar">Ingresar</Link><Link className="btn pri" href="/registro">Crear cuenta</Link></>}</div>
      </div>
    </header>
  );
}
