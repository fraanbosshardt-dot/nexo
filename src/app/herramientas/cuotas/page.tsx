import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { CuotasCalc } from "@/components/tools/cuotas-calc";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "¿Puedo comprarlo en cuotas? Calculadora gratis",
  description: "Calculá si te alcanza para comprar en cuotas: con lo que tenés hoy y lo que te sobra por mes, te mostramos tu saldo mes a mes y el mes más justo. Gratis y sin registro.",
  alternates: { canonical: "/herramientas/cuotas" },
};

const FAQ: [string, string][] = [
  ["¿Qué pongo en “me sobra por mes”?", "Lo que te queda después de tus gastos fijos: tus ingresos del mes menos alquiler, servicios, cuotas que ya tenés y lo que gastás normalmente."],
  ["¿Conviene en cuotas sin interés o de contado?", "Si son sin interés y te alcanza todos los meses, las cuotas cuidan tu saldo. Si hay descuento por pagar de contado, compará el descuento con el margen que te queda."],
  ["¿Y si las cuotas tienen interés?", "Cargá el total financiado en “Total con interés”. La calculadora te muestra cuánto pagás de más y si igual te alcanza."],
  ["¿Por qué dice que no me alcanza si la cuota es chica?", "Porque mira el peor mes: si algún mes tu saldo quedaría por debajo de cero, o de la plata que no querés tocar, te avisa."],
];

export default function CuotasPage() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "¿Puedo comprarlo en cuotas?", url: `${SITE.url}/herramientas/cuotas`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Cuotas"]]} />
        <div className="tool-grid">
          <div>
            <h1>¿Puedo comprarlo en cuotas?</h1>
            <p className="lp-lead">Poné cuánto tenés hoy, cuánto te sobra por mes y el precio. Te decimos si te alcanza todos los meses y cuál sería tu mes más justo.</p>
            <ul className="tool-points"><li>Gratis y sin registro.</li><li>No guardamos nada de lo que escribís.</li><li>Sirve en cualquier moneda.</li></ul>
          </div>
          <CuotasCalc />
        </div>
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Cómo se calcula</h2>
        <p className="lp-lead" style={{ maxWidth: "68ch" }}>Cada mes sumamos lo que te sobra y restamos la cuota. Si en algún mes el saldo queda por debajo de cero, o de la plata que no querés tocar, la respuesta es no. En Guafra el cálculo usa tus cuentas, tus vencimientos y lo que se repite todos los meses, no un promedio.</p>
        <div className="lp-faq" style={{ marginTop: 24 }}>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Hacerlo con mis datos reales</Link><Link className="ws-btn" href="/herramientas/prestamo">Calcular un préstamo</Link></div>
      </div></section>
    </PublicShell>
  );
}
