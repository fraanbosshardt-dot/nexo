import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { PlazoFijoCalc } from "@/components/tools/more-calcs";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Calculadora de plazo fijo: cuánto ganás con tu TNA",
  description: "Calculá cuánto ganás con un plazo fijo según la TNA y los días, cuánto cobrás al vencer y cuánto juntás si lo renovás. Con la TEA equivalente. Gratis y sin registro.",
  alternates: { canonical: "/herramientas/plazo-fijo" },
};

const FAQ: [string, string][] = [
  ["¿Cómo se calcula el interés de un plazo fijo?", "Se multiplica el monto por la TNA y por la cantidad de días dividida 365. Por ejemplo, 100.000 al 36% durante 30 días ganan unos 2.959."],
  ["¿Qué diferencia hay entre TNA y TEA?", "La TNA es la tasa que informa el banco. La TEA es lo que ganás en un año si renovás siempre capital más intereses. Por eso la TEA es mayor."],
  ["¿Conviene renovar los intereses?", "Sí, si no necesitás esa plata: al renovar capital más intereses, cada vez ganás sobre un monto más grande (interés compuesto)."],
  ["¿El plazo fijo le gana a la inflación?", "Depende de la tasa y de la inflación de ese período. Compará la TEA con la inflación anual esperada en tu país."],
];

export default function Page() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Calculadora de plazo fijo", url: `${SITE.url}/herramientas/plazo-fijo`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Plazo fijo"]]} />
        <h1>Calculadora de plazo fijo</h1>
        <p className="lp-lead">Poné el monto, la TNA que te ofrece el banco y el plazo. Te decimos cuánto ganás y cuánto juntás si lo renovás.</p>
        <PlazoFijoCalc />
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Preguntas frecuentes</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Seguir tus inversiones en Somos Guafra</Link><Link className="ws-btn" href="/herramientas">Más herramientas</Link></div>
      </div></section>
    </PublicShell>
  );
}
