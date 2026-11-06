import Link from "next/link";
import { Icon } from "./icons";

export function Brand({ inverse = false, href = "/" }: { inverse?: boolean; href?: string }) {
  return (
    <Link href={href} className="lp-brand" aria-label="NEXO, ir al inicio" style={{ textDecoration: "none" }}>
      <span className="brand-mark" style={inverse ? { background: "var(--on-ink)", color: "var(--ink)" } : undefined}>N</span>
      <b>NEXO</b>
    </Link>
  );
}

// Pantallas de registro, ingreso y verificación: una tarjeta blanca centrada, sin animaciones.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="nx auth">
      <div className="auth-card">
        <main className="auth-main">
          <Brand />
          <div className="auth-box">{children}</div>
        </main>
        <aside className="auth-side">
          <h2>Tu plata, ordenada mes a mes.</h2>
          <ul>
            <li><Icon name="check" /><span>Sabé cuánto tenés disponible hoy y con cuánto terminás el mes.</span></li>
            <li><Icon name="check" /><span>Tarjetas, cuotas y deudas en un solo lugar, sin contar nada dos veces.</span></li>
            <li><Icon name="check" /><span>Avisos antes de que un mes quede en rojo.</span></li>
            <li><Icon name="lock" /><span>Nunca te pedimos la clave de tu banco.</span></li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
