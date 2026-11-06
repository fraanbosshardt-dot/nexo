import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PlanToggle, Reveal } from "@/components/landing-fx";
import { PublicShell } from "@/components/public-shell";
import { CuotasCalc } from "@/components/tools/cuotas-calc";
import { PLAN_FEATURES } from "@/lib/modules";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { planSettings, PRICES_DEFAULT } from "@/server/plans";
import { jsonLd, SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

const FEATS: [IconName, string, string][] = [
  ["wallet", "Cuánto podés gastar", "Lo que tenés menos lo que vence antes de tu próximo cobro, y cuánto te queda por día."],
  ["clock", "Qué tenés que pagar", "Vencimientos y cobros en una sola lista por fecha. Lo atrasado no se borra solo."],
  ["card", "Tarjetas en cuotas", "Cada compra cuenta como gasto una sola vez. Las cuotas aparecen en el mes en que vencen."],
  ["bank", "Deudas y préstamos", "Cronograma francés, alemán o americano, y cuánto ahorrás si cancelás antes."],
  ["flow", "Cuánto vas a tener", "Con cuánto terminás cada mes, con lo que se repite y lo que ya sabés que viene."],
  ["bell", "Avisos a tiempo", "Un email antes de cada vencimiento y alertas si un mes va a quedar en rojo."],
];
const FAQ: [string, string][] = [
  ["¿Es gratis?", "Sí. El plan Gratis incluye casi todo y no vence. Pro suma funciones avanzadas y lo podés probar gratis 14 días."],
  ["¿Tengo que conectar mi banco?", "No. Cargás tus movimientos o importás el extracto en CSV. NEXO nunca te pide la contraseña de tu banco."],
  ["¿Sirve en mi país y con mi moneda?", "Sí. Elegís tu país y tu moneda al registrarte, y podés usar varias monedas a la vez. Las cotizaciones se actualizan solas."],
  ["¿Puedo usarlo en el celular?", "Sí. Funciona en cualquier navegador y lo podés instalar como app en la pantalla de inicio de tu celular."],
  ["¿Las compras con tarjeta se cuentan dos veces?", "No. La compra es el gasto. Pagar el resumen es pasar plata de tu cuenta a la tarjeta, así que no suma otra vez."],
  ["¿Mis datos están seguros?", "Tu contraseña se guarda cifrada, podés activar la verificación en dos pasos y descargar o eliminar tus datos cuando quieras."],
];

export default async function Landing() {
  const logged = await getSession().then(Boolean, () => false); // sin base, la landing igual se muestra
  const prices = await planSettings(getDb()).then((s) => s.prices, () => PRICES_DEFAULT);
  const plan = (price: number, period: string) => (
    <div className="lp-plans">
      <Reveal className="lp-plan"><h3>Gratis</h3><div className="lp-price">US$ 0</div><p className="sub">Para ordenar tus finanzas, sin límite de tiempo.</p>
        <ul>{PLAN_FEATURES.filter((f) => f.plan === "free").map((f) => <li key={f.name}>{f.name}</li>)}</ul><Link className="btn" href="/registro">Empezar gratis</Link></Reveal>
      <Reveal className="lp-plan pro"><h3>Pro</h3><div className="lp-price">US$ {price}<small> / {period}</small></div><p className="sub">Todo lo de Gratis, más:</p>
        <ul>{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <li key={f.name}>{f.name}</li>)}</ul><Link className="btn pri" href="/registro">Probar 14 días gratis</Link></Reveal>
    </div>
  );
  const ld = [
    { "@context": "https://schema.org", "@type": "Organization", name: "NEXO", url: SITE.url, logo: `${SITE.url}/icon.svg` },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "NEXO", url: SITE.url, applicationCategory: "FinanceApplication", operatingSystem: "Web, Android, iOS", inLanguage: "es", description: SITE.description,
      offers: [{ "@type": "Offer", name: "Gratis", price: "0", priceCurrency: "USD" }, { "@type": "Offer", name: "Pro", price: String(prices.monthly), priceCurrency: "USD" }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return (
    <PublicShell logged={logged}>
      {ld.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={jsonLd(d)} />)}

      <section className="lp-w lp-hero">
        <div className="lp-copy">
          <p className="lp-eyebrow">Finanzas personales, en tu moneda</p>
          <h1>Sabé cuánto podés gastar hasta tu próximo cobro.</h1>
          <p className="lp-lead">NEXO junta tus cuentas, tarjetas, deudas y vencimientos, y te dice qué te queda sin comprometer lo que viene. Gratis, en tu moneda y sin conectar tu banco.</p>
          <div className="acts"><Link className="btn pri lp-big" href={logged ? "/app" : "/registro"}>{logged ? "Ir a la app" : "Crear cuenta gratis"}</Link><Link className="btn lp-big" href="/herramientas">Ver herramientas gratis</Link></div>
          <p className="sub">Gratis para siempre · Sin tarjeta · Verificación en dos pasos</p>
        </div>
        <div className="lp-tool">
          <p className="lp-tool-lbl">Probalo ahora: ¿puedo comprarlo en cuotas?</p>
          <CuotasCalc compact />
        </div>
      </section>

      <section className="lp-w lp-sec" id="funciones"><Reveal as="h2">Todo tu dinero, en un lugar</Reveal>
        <div className="lp-grid">{FEATS.map(([i, t, d]) => <Reveal key={t} className="lp-feat"><Icon name={i} /><h3>{t}</h3><p>{d}</p></Reveal>)}</div></section>

      <section className="lp-band"><div className="lp-w lp-sec"><Reveal as="h2">Empezás en tres pasos</Reveal>
        <ol className="lp-steps">{[["Creá tu cuenta", "Con tu correo, en un minuto. Elegís tu país y tu moneda."], ["Cargá tu cuenta y tus ingresos fijos", "El sueldo, la jubilación o un alquiler que cobrás se repiten solos."], ["Mirá cuánto te queda", "Desde ahí, NEXO calcula todo con tus datos."]].map(([t, d]) => <Reveal as="li" key={t}><b>{t}</b><span>{d}</span></Reveal>)}</ol></div></section>

      <section className="lp-w lp-sec" id="herramientas"><Reveal as="h2">Herramientas gratis, sin registrarte</Reveal>
        <div className="lp-grid">
          {[["/herramientas/cuotas", "sliders", "¿Puedo comprarlo en cuotas?", "Te dice si te alcanza todos los meses y cuál sería tu mes más justo."], ["/herramientas/prestamo", "bank", "Calculadora de préstamos", "Cuota, intereses y cronograma con sistema francés, alemán o americano."], ["/glosario", "file", "Glosario financiero", "TNA, TEA, CFT, pago mínimo y más, explicados simple."]].map(([href, ic, t, d]) => (
            <Reveal key={href} className="lp-feat"><Link href={href} style={{ color: "inherit", display: "flex", flexDirection: "column", gap: 6 }}><Icon name={ic as IconName} /><h3>{t}</h3><p>{d}</p><span className="lk">Usar ahora →</span></Link></Reveal>
          ))}
        </div></section>

      <section className="lp-band"><div className="lp-w lp-sec lp-sec2"><Reveal><h2>Tus datos, cuidados</h2><p className="lp-lead">Nunca te pedimos la clave de tu banco. Activás la verificación en dos pasos con Google Authenticator, y podés descargar o eliminar todo cuando quieras.</p></Reveal>
        <div className="lp-sgrid">{[["Verificación en dos pasos", "Un código de tu celular además de la contraseña."], ["Contraseña cifrada", "Nadie, ni nosotros, puede leerla."], ["Tus datos son tuyos", "Descargalos en CSV o en un respaldo completo."]].map(([t, d]) => <Reveal key={t} className="lp-feat"><h3>{t}</h3><p>{d}</p></Reveal>)}</div></div></section>

      <section className="lp-w lp-sec" id="planes"><Reveal as="h2">Planes simples</Reveal>
        <PlanToggle monthly={plan(prices.monthly, "mes")} yearly={plan(prices.yearly, "año")} /></section>

      <section className="lp-band" id="preguntas"><div className="lp-w lp-sec"><Reveal as="h2">Preguntas frecuentes</Reveal>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></div></section>

      <section className="lp-w lp-final"><Reveal as="h2">Empezá hoy. Es gratis.</Reveal><div className="acts" style={{ justifyContent: "center" }}><Link className="btn pri lp-big" href="/registro">Crear cuenta</Link><Link className="btn lp-big" href="/herramientas/cuotas">Probar la calculadora</Link></div></section>
    </PublicShell>
  );
}
