import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };
export const dynamic = "force-static";

// Se muestra cuando la app instalada se abre sin internet.
export default function Offline() {
  return (
    <div className="nx auth">
      <div className="auth-card" style={{ maxWidth: 480, gridTemplateColumns: "1fr" }}>
        <main className="auth-main" style={{ gap: 16 }}>
          <span className="lp-brand"><span className="brand-mark">G</span><b>Guafra</b></span>
          <div className="auth-box">
            <h1>Sin conexión</h1>
            <p className="sub">No hay internet en este momento. Por seguridad, tus datos no se guardan en el teléfono: cuando vuelva la conexión, Guafra se abre con todo al día.</p>
            <a className="btn pri auth-btn" href="/app">Probar de nuevo</a>
          </div>
        </main>
      </div>
    </div>
  );
}
