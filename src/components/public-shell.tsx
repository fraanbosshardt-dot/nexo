import Link from "next/link";
import { Brand } from "./brand";

// Encabezado y pie de las páginas públicas (landing, herramientas, glosario).
export function PublicShell({ children, logged = false }: { children: React.ReactNode; logged?: boolean }) {
  return (
    <div className="lp">
      <header className="lp-nav"><div className="lp-w lp-navin"><Brand />
        <nav className="lp-links" aria-label="Secciones">
          <Link href="/#funciones">Funciones</Link><Link href="/herramientas">Herramientas gratis</Link><Link href="/#planes">Planes</Link><Link href="/#preguntas">Preguntas</Link>
        </nav>
        <div className="lp-cta-top">{logged ? <Link className="btn pri" href="/app">Ir a la app</Link> : <><Link className="btn ghost" href="/ingresar">Ingresar</Link><Link className="btn pri" href="/registro">Crear cuenta</Link></>}</div>
      </div></header>
      <main>{children}</main>
      <footer className="lp-foot"><div className="lp-w lp-footin">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Brand /><span className="sub" style={{ margin: 0 }}>Finanzas personales en tu moneda.</span></div>
        <nav className="lp-flinks" aria-label="Pie de página">
          <Link href="/herramientas/cuotas">¿Puedo comprarlo en cuotas?</Link>
          <Link href="/herramientas/prestamo">Calculadora de préstamos</Link>
          <Link href="/glosario">Glosario</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/arrepentimiento">Botón de arrepentimiento</Link>
        </nav>
        <p className="sub">© {new Date().getFullYear()} NEXO.</p>
      </div></footer>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Ruta" className="crumb" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map(([label, href], i) => <span key={label}>{href ? <Link href={href} style={{ color: "inherit" }}>{label}</Link> : label}{i < items.length - 1 ? " ›" : ""}</span>)}
    </nav>
  );
}
