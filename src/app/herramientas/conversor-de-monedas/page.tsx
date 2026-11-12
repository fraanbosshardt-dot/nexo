import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { ConversorCalc } from "@/components/tools/more-calcs";
import { jsonLd, SITE } from "@/lib/seo";
import { getDb } from "@/lib/db";
import { ensureFreshRates } from "@/server/fx";
import { CURRENCIES } from "@/lib/countries";

// Las cotizaciones se leen de la base (se actualizan solas una vez por día); la página se rehace cada hora.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Conversor de monedas con cotización oficial",
  description: "Convertí entre pesos, dólares, euros, reales y más de 20 monedas con la cotización oficial de referencia, actualizada todos los días. Gratis y sin registro.",
  alternates: { canonical: "/herramientas/conversor-de-monedas" },
};

const FAQ: [string, string][] = [
  ["¿De dónde sale la cotización?", "De una fuente pública de cotizaciones oficiales, que se actualiza todos los días. Es una referencia: bancos y casas de cambio cobran con su propio precio de compra y venta."],
  ["¿Por qué el banco me da otro precio?", "Porque cada entidad suma su margen e impuestos. Usá este conversor para tener una idea; para operar, mirá el precio de tu banco."],
  ["¿Puedo tener cuentas en varias monedas en Guafra?", "Sí. Cargás cada cuenta en su moneda y Guafra te muestra tu patrimonio en tu moneda principal y en dólares."],
];

export default async function Page() {
  const db = getDb();
  await ensureFreshRates(db).catch(() => {});
  const rows = await db.exchangeRate.findMany({ where: { workspaceId: null, base: "USD", kind: "api" }, orderBy: { fetchedAt: "desc" }, take: 200 });
  const rates: Record<string, number> = {};
  for (const r of rows) if (!(r.quote in rates)) rates[r.quote] = Number(r.sell);
  const updated = rows[0] ? new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(rows[0].fetchedAt) : null;
  const currencies = CURRENCIES.filter((c) => c.code === "USD" || rates[c.code]).map((c) => ({ code: c.code, name: c.name }));
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Conversor de monedas", url: `${SITE.url}/herramientas/conversor-de-monedas`, applicationCategory: "FinanceApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, inLanguage: "es" })} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="lp-w lp-sec tool" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas", "/herramientas"], ["Conversor de monedas"]]} />
        <h1>Conversor de monedas</h1>
        <p className="lp-lead">Elegí las monedas y el monto. Usamos la cotización oficial de referencia, que se actualiza todos los días.</p>
        <ConversorCalc rates={rates} updated={updated} currencies={currencies} />
      </section>
      <section className="lp-band"><div className="lp-w lp-sec">
        <h2>Preguntas frecuentes</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <div className="acts" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}><Link className="ws-btn pri" href="/registro">Manejar varias monedas en Guafra</Link><Link className="ws-btn" href="/herramientas">Más herramientas</Link></div>
      </div></section>
    </PublicShell>
  );
}
