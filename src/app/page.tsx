import Link from "next/link";
import { Brand } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { CountUp, PlanToggle, Reveal, ScrollTo } from "@/components/landing-fx";
import { PLAN_FEATURES, PRICE_USD } from "@/lib/modules";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const FEATS: [IconName, string, string][] = [
  ["wallet", "Cuánto tenés", "Todas tus cuentas y billeteras, en la moneda de cada una, siempre al día."],
  ["cal", "Qué tenés que pagar", "Vencimientos y pendientes en una lista. Registrás el pago con un toque."],
  ["flow", "Cuánto vas a tener", "Lo que te queda a fin de mes, con lo que ya sabés que entra y sale."],
  ["bank", "Tus deudas, claras", "Cuotas, tasas y cuánto ahorrás si cancelás antes."],
  ["target", "Ahorro con objetivo", "Cuánto separar por mes para llegar a cada meta."],
  ["spark", "Avisos a tiempo", "Meses en rojo y vencimientos acumulados, antes de que pase."],
];
const FAQ: [string, string][] = [
  ["¿Es gratis?", `Sí. El plan Gratis incluye casi todo y no vence. Pro suma funciones avanzadas por US$ ${PRICE_USD.monthly} por mes.`],
  ["¿Tengo que conectar mi banco?", "No. Cargás tus movimientos o importás un archivo. NEXO nunca te pide la contraseña de tu banco."],
  ["¿Sirve en mi país y con mi moneda?", "Sí. Elegís tu país y tu moneda al registrarte, y podés usar varias monedas a la vez: cada cuenta tiene la suya y cada conversión guarda la cotización que usó."],
  ["¿Qué pasa si me arrepiento de Pro?", "Tenés 10 días corridos desde que lo contratás para pedir la devolución total, y podés darte de baja cuando quieras."],
  ["¿Mis datos están seguros?", "Tu contraseña se guarda cifrada, podés activar la verificación en dos pasos y pedir la eliminación de todo cuando quieras."],
];

export default async function Landing() {
  const logged = await getSession().then(Boolean, () => false); // sin base, la landing igual se muestra
  const plan = (price: number, period: string) => (
    <div className="lp-plans">
      <Reveal className="lp-plan"><h3>Gratis</h3><div className="lp-price">US$ 0</div><p className="sub">Para ordenar tus finanzas, sin límite de tiempo.</p>
        <ul>{PLAN_FEATURES.filter((f) => f.plan === "free").map((f) => <li key={f.name}>{f.name}</li>)}</ul><Link className="btn" href="/registro">Empezar gratis</Link></Reveal>
      <Reveal className="lp-plan pro"><span className="pill">Más elegido</span><h3>Pro</h3><div className="lp-price">US$ {price}<small> / {period}</small></div><p className="sub">Todo lo de Gratis, más:</p>
        <ul>{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <li key={f.name}>{f.name}</li>)}</ul><Link className="btn pri" href="/registro">Probar 14 días gratis</Link></Reveal>
    </div>
  );
  return (
    <div className="lp">
      <header className="lp-nav"><div className="lp-w lp-navin"><Brand />
        <nav className="lp-links">{[["lp-func", "Funciones"], ["lp-planes", "Planes"], ["lp-faq", "Preguntas"]].map(([id, l]) => <ScrollTo key={id} id={id}>{l}</ScrollTo>)}</nav>
        <div className="lp-cta-top">{logged ? <Link className="btn pri" href="/app">Ir a la app</Link> : <><Link className="btn" href="/ingresar">Iniciar sesión</Link><Link className="btn pri" href="/registro">Crear cuenta</Link></>}</div></div></header>

      <section className="lp-w lp-hero">
        <div className="lp-copy">
          <p className="lp-eyebrow">Finanzas personales, en tu moneda</p>
          <h1>Sabé cuánto tenés, cuánto debés y cuánto vas a tener.</h1>
          <p className="lp-lead">NEXO junta tus cuentas, tarjetas, deudas y cobros, y te muestra qué podés gastar sin comprometer lo que viene.</p>
          <div className="acts"><Link className="btn pri lp-big" href={logged ? "/app" : "/registro"}>{logged ? "Ir a la app" : "Crear cuenta gratis"}</Link><Link className="btn lp-big" href="/prototipo.html">Ver la demo</Link></div>
          <p className="sub">Gratis para siempre · Sin tarjeta · Verificación en dos pasos</p>
        </div>
        <div className="lp-mock" aria-hidden="true">
          <div className="lpm-card"><div className="lpm-lbl">Disponible para usar</div><div className="lpm-big num"><CountUp to={874081} /></div>
            <svg viewBox="0 0 300 80" className="lpm-chart"><path d="M0 60 L30 55 L60 58 L90 40 L120 44 L150 30 L180 36 L210 22 L240 26 L270 14 L300 18" /></svg>
            <div className="lpm-rows"><div><span>Alquiler depto.</span><b className="pos">+$ 650.000</b></div><div><span>Visa · resumen</span><b>−$ 684.320</b></div><div><span>Venta de soja · 300 qq</span><b className="pos">+$ 12.389.520</b></div></div></div>
          <div className="lpm-toast">Pago registrado · quedan $ 0 pendientes</div>
        </div>
      </section>

      <section className="lp-w lp-sec" id="lp-func"><Reveal as="h2">Todo tu dinero, en un lugar</Reveal>
        <div className="lp-grid">{FEATS.map(([i, t, d]) => <Reveal key={t} className="lp-feat"><Icon name={i} /><h3>{t}</h3><p>{d}</p></Reveal>)}</div></section>

      <section className="lp-band"><div className="lp-w lp-sec"><Reveal as="h2">Empezás en tres pasos</Reveal>
        <ol className="lp-steps">{[["Creá tu cuenta", "Con tu correo, en un minuto."], ["Elegí qué vas a usar", "NEXO se arma a tu medida: lo que no te sirve no aparece."], ["Cargá tus cuentas", "Desde ahí, todo se calcula solo."]].map(([t, d]) => <Reveal as="li" key={t}><b>{t}</b><span>{d}</span></Reveal>)}</ol></div></section>

      <section className="lp-w lp-sec lp-sec2"><Reveal><h2>Tus datos, cuidados</h2><p className="lp-lead">Nunca te pedimos la clave de tu banco. Activás la verificación en dos pasos con Google Authenticator, y podés pedir la eliminación de todo cuando quieras.</p></Reveal>
        <div className="lp-sgrid">{[["Verificación en dos pasos", "Un código de tu celular además de la contraseña."], ["Datos cifrados", "En tránsito y guardados."], ["Vos decidís", "Tus datos son tuyos."]].map(([t, d]) => <Reveal key={t} className="lp-feat"><h3>{t}</h3><p>{d}</p></Reveal>)}</div></section>

      <section className="lp-band" id="lp-planes"><div className="lp-w lp-sec"><Reveal as="h2">Planes simples</Reveal>
        <PlanToggle monthly={plan(PRICE_USD.monthly, "mes")} yearly={plan(PRICE_USD.yearly, "año")} /></div></section>

      <section className="lp-w lp-sec" id="lp-faq"><Reveal as="h2">Preguntas frecuentes</Reveal>
        <div className="lp-faq">{FAQ.map(([q, a]) => <Reveal as="details" key={q}><summary>{q}</summary><p>{a}</p></Reveal>)}</div></section>

      <section className="lp-w lp-final"><h2>Empezá hoy. Es gratis.</h2><div className="acts" style={{ justifyContent: "center" }}><Link className="btn pri lp-big" href="/registro">Crear cuenta</Link><Link className="btn lp-big" href="/prototipo.html">Ver la demo</Link></div></section>

      <footer className="lp-foot"><div className="lp-w lp-footin"><Brand />
        <div className="lp-flinks"><Link href="/terminos">Términos y condiciones</Link><Link href="/privacidad">Política de privacidad</Link><Link href="/arrepentimiento">Botón de arrepentimiento</Link><span>Ayuda: <span className="sel">soporte@nexo.app</span></span></div>
        <p className="sub">© 2026 NEXO.</p></div></footer>
    </div>
  );
}
