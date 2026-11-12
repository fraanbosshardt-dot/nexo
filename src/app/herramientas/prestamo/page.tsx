import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { PrestamoCalc } from "@/components/tools/prestamo-calc";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Calculadora de préstamos: cuota, intereses y cronograma",
  description: "Calculá la cuota de un préstamo con sistema francés, alemán o americano. Cronograma completo con capital e intereses, total a pagar y TEA equivalente. Gratis.",
  alternates: { canonical: "/herramientas/prestamo" },
};

const FAQ: [string, string][] = [
  ["¿Qué diferencia hay entre el sistema francés y el alemán?", "En el francés pagás siempre la misma cuota y al principio es casi todo interés. En el alemán devolvés lo mismo de capital cada mes, así que la cuota empieza más alta y va bajando; en total pagás menos intereses."],
  ["¿Qué es la TNA y qué es la TEA?", "La TNA es la tasa anual que informa el banco. La TEA es lo que realmente pagás en un año, porque los intereses se suman mes a mes. Por eso la TEA siempre es igual o mayor que la TNA."],
  ["¿El CFT entra en el cálculo?", "No. El CFT suma seguros, comisiones e impuestos. Sirve para comparar préstamos entre bancos: el que tenga el CFT más bajo es el más barato."],
  ["¿Conviene cancelar un préstamo antes?", "Generalmente sí: dejás de pagar los intereses futuros. En Guafra ves cuánto capital debés y cuánto te ahorrás si cancelás todo hoy."],
];

export default function PrestamoPage() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Calculadora de préstamos", url: `${SITE.url}/herramientas/prestamo`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Préstamos"]]} />
        <h1>Calculadora de préstamos</h1>
        <p className="lp-lead">Cuánto vas a pagar por mes, cuánto de interés y el cronograma completo. Elegí el sistema y, si la tenés, la TNA.</p>
        <PrestamoCalc />
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Preguntas frecuentes</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Seguir mis deudas en Guafra</Link><Link className="ws-btn" href="/glosario">Ver el glosario</Link></div>
      </div></section>
    </PublicShell>
  );
}
