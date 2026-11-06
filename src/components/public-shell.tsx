import Link from "next/link";
import { Brand } from "./brand";
import { PublicNav } from "./public-nav";

// Encabezado y pie de las páginas públicas (landing, herramientas, glosario).
export function PublicShell({ children, logged = false }: { children: React.ReactNode; logged?: boolean }) {
  return (
    <div className="lp">
      <PublicNav logged={logged} />
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
