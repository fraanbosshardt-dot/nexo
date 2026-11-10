import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { Reveal } from "@/components/landing-fx";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Seguridad",
  description: `Cómo cuida ${BRAND.name} tu información: sin claves del banco, conexión cifrada, verificación en dos pasos, accesos registrados y tus datos siempre bajo tu control.`,
  alternates: { canonical: "/seguridad" },
};

const P = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ITEMS: [React.ReactNode, string, string][] = [
  [P("M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z"), "Nunca te pedimos la clave del banco", `${BRAND.name} no se conecta a tu banco ni a tu billetera. Cargás saldos y movimientos vos, o subís el resumen en PDF. Así nadie puede mover tu plata desde acá.`],
  [P("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"), "Verificación en dos pasos", "Podés sumar un código de una app del celular a tu contraseña, o entrar con tu cuenta de Google."],
  [P("M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"), "Todo viaja cifrado", "La conexión usa HTTPS siempre. Los datos sensibles, como el secreto de la verificación en dos pasos, se guardan cifrados."],
  [P("M9 12l2 2 4-4M4 4h16v16H4z"), "Contraseñas que nadie puede leer", "Tu contraseña se guarda como un hash: ni nosotros podemos verla. Limitamos los intentos para frenar a quien quiera adivinarla."],
  [P("M12 8v4l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"), "Sesiones bajo tu control", "Ves dónde iniciaste sesión y podés cerrar todas las sesiones con un toque si perdés el celular."],
  [P("M4 6h16M4 12h16M4 18h10"), "Accesos internos registrados", "Solo unas pocas personas del equipo pueden entrar al panel interno, con su cuenta de Google y permisos por rol. Cada acción queda registrada."],
  [P("M12 3v12M7 10l5 5 5-5M5 21h14"), "Tus datos, cuando quieras", "Descargá toda tu información o borrá tu cuenta desde Configuración. No vendemos datos ni los usamos para publicidad."],
  [P("M4 7h16v13H4zM8 7V4h8v3"), "Copias de seguridad", "Hacemos copias de la base para que, ante un problema, no se pierda lo que cargaste."],
];

export default function Security() {
  return (
    <PublicShell>
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Seguridad"]]} />
          <p className="ws-eyebrow">Seguridad</p>
          <h1 className="ws-h1">Tu información financiera, <em>cuidada en serio.</em></h1>
          <p className="ws-lead">Lo primero que decidimos al crear {BRAND.name}: nunca pedirte la clave de tu banco. Esto es todo lo demás que hacemos para proteger tus datos.</p>
        </div>
      </section>
      <section className="ws-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div className="ws-grid">{ITEMS.map(([ic, t, d]) => <Reveal key={t} className="ws-card"><span className="ws-ic">{ic}</span><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
      </section>
      <section className="ws-navy">
        <div className="ws-w ws-sec" style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
            <h2 className="ws-h2">¿Encontraste algo que te preocupa?</h2>
            <p style={{ margin: 0, fontSize: 18 }}>Si ves un problema de seguridad, avisanos enseguida. Lo revisamos con prioridad.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link className="ws-btn pri" href="/contacto?area=privacidad">Reportar un problema</Link>
            <Link className="ws-btn" href="/privacidad">Política de privacidad</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
