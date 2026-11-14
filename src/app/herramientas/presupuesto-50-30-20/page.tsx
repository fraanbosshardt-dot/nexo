import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { PresupuestoCalc } from "@/components/tools/more-calcs";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Regla 50/30/20: calculá tu presupuesto",
  description: "Repartí tu ingreso con la regla 50/30/20: 50% para necesidades, 30% para gustos y 20% para ahorro. Compará con lo que gastás hoy. Gratis y sin registro.",
  alternates: { canonical: "/herramientas/presupuesto-50-30-20" },
};

const FAQ: [string, string][] = [
  ["¿Qué es la regla 50/30/20?", "Es una guía para repartir el ingreso: 50% a necesidades, 30% a gustos y 20% a ahorro o a pagar deudas. Es un punto de partida, no una obligación."],
  ["¿Y si mis necesidades superan el 50%?", "Es común con alquileres altos. Empezá por lo que puedas: aunque ahorres un 5% o un 10%, lo importante es que sea todos los meses."],
  ["¿Las cuotas de deudas van en necesidades o en ahorro?", "El mínimo que tenés que pagar va en necesidades. Lo que pagás de más para cancelar antes cuenta como parte del 20%."],
];

export default function Page() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Presupuesto 50/30/20", url: `${SITE.url}/herramientas/presupuesto-50-30-20`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Presupuesto 50/30/20"]]} />
        <h1>Presupuesto 50/30/20</h1>
        <p className="lp-lead">Una forma simple de ordenar lo que cobrás: la mitad para lo necesario, un 30% para gustos y un 20% para ahorrar.</p>
        <PresupuestoCalc />
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Preguntas frecuentes</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Armar tu presupuesto en Somos Guafra</Link><Link className="ws-btn" href="/herramientas">Más herramientas</Link></div>
      </div></section>
    </PublicShell>
  );
}
