import Link from "next/link";
import { Icon } from "./icons";
import { BRAND } from "@/lib/brand";
import { LogoMark } from "@/components/logo-mark";

export function Brand({ href = "/" }: { inverse?: boolean; href?: string }) {
  return (
    <Link href={href} className="lp-brand" aria-label={`${BRAND.name}, ir al inicio`} style={{ textDecoration: "none" }}>
      <LogoMark />
      <b className="wordmark">{BRAND.name.toLowerCase().replace(/\s/g, "")}</b>
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
          <div className="auth-side-top">
            <h2>Tu plata, ordenada mes a mes.</h2>
            <ul>
              <li><Icon name="check" /><span>Sabé cuánto tenés disponible hoy y con cuánto terminás el mes.</span></li>
              <li><Icon name="check" /><span>Tarjetas, cuotas y deudas en un solo lugar, sin contar nada dos veces.</span></li>
              <li><Icon name="check" /><span>Avisos antes de que un mes quede en rojo.</span></li>
            </ul>
          </div>
          {/* Muestra de cómo se ve el inicio (datos de ejemplo). */}
          <div className="auth-demo" aria-hidden="true">
            <small>Te queda hasta tu próximo cobro, el 10</small>
            <b>$ 184.250</b>
            <div className="auth-demo-bar"><i /></div>
            <div className="auth-demo-row"><span>En tus cuentas</span><span>$ 412.900</span></div>
            <div className="auth-demo-row"><span>A pagar antes</span><span>−$ 228.650</span></div>
          </div>
          <p className="auth-safe"><Icon name="lock" /><span>Nunca te pedimos la clave de tu banco.</span></p>
        </aside>
      </div>
    </div>
  );
}
