import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { FondoCalc } from "@/components/tools/more-calcs";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Fondo de emergencia: cuánto necesitás y en cuánto llegás",
  description: "Calculá cuánto tendría que tener tu fondo de emergencia según tus gastos fijos, cuántos meses cubrís hoy y en cuánto tiempo llegás a la meta. Gratis y sin registro.",
  alternates: { canonical: "/herramientas/fondo-de-emergencia" },
};

const FAQ: [string, string][] = [
  ["¿Cuántos meses tiene que cubrir?", "Lo habitual es entre 3 y 6 meses de gastos fijos. Si tus ingresos varían mucho o trabajás por tu cuenta, conviene acercarse a 6 o más."],
  ["¿Dónde lo guardo?", "En algo que puedas usar enseguida y que no pierda valor: una cuenta remunerada o un plazo fijo corto. No en inversiones que puedan bajar justo cuando lo necesites."],
  ["¿Qué cuenta como gasto fijo?", "Lo que pagás todos los meses sí o sí: vivienda, servicios, comida, transporte, salud y cuotas de deudas."],
];

export default function Page() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Calculadora de fondo de emergencia", url: `${SITE.url}/herramientas/fondo-de-emergencia`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Fondo de emergencia"]]} />
        <h1>Calculadora de fondo de emergencia</h1>
        <p className="lp-lead">Un colchón para imprevistos: perder un ingreso, una enfermedad o un arreglo de urgencia. Calculá tu meta y en cuánto llegás.</p>
        <FondoCalc />
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Preguntas frecuentes</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Armar tu fondo con un objetivo en Somos Guafra</Link><Link className="ws-btn" href="/herramientas">Más herramientas</Link></div>
      </div></section>
    </PublicShell>
  );
}
