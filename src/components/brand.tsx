import Link from "next/link";

export function Brand({ inverse = false, href = "/" }: { inverse?: boolean; href?: string }) {
  return (
    <Link href={href} className="lp-brand" aria-label="NEXO, ir al inicio" style={{ textDecoration: "none" }}>
      <span className="brand-mark" style={inverse ? { background: "var(--on-ink)", color: "var(--ink)" } : undefined}>N</span>
      <b>NEXO</b>
    </Link>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Brand inverse />
        <div>
          <h2>Tu plata, clara.</h2>
          <p>Cuentas, tarjetas, deudas y cobros en un solo lugar, con lo que vas a tener mes a mes.</p>
        </div>
        <ul>
          <li>Verificación en dos pasos</li>
          <li>Nunca te pedimos la clave de tu banco</li>
          <li>Tu moneda y otras, cada una en su cuenta</li>
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
