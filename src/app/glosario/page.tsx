import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { jsonLd, SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Glosario de finanzas personales: TNA, TEA, CFT y más",
  description: "Qué es la TNA, la TEA y el CFT, cómo funcionan el sistema francés y el alemán, qué es el resumen de la tarjeta y el pago mínimo. Explicado simple.",
  alternates: { canonical: "/glosario" },
};

const TERMS: [string, string, string][] = [
  ["tna", "TNA (tasa nominal anual)", "El interés anual que informa el banco, sin contar que los intereses se suman mes a mes. Es la base para calcular las cuotas: una TNA de 60% equivale a 5% por mes."],
  ["tea", "TEA (tasa efectiva anual)", "Lo que realmente pagás de interés en un año, porque cada mes el interés se suma al capital. Una TNA de 60% equivale a una TEA de casi 80%."],
  ["cft", "CFT (costo financiero total)", "El interés más todos los gastos: seguros, comisiones e impuestos. Es el número correcto para comparar préstamos o compras en cuotas entre bancos."],
  ["sistema-frances", "Sistema francés", "La cuota es siempre la misma. Al principio pagás casi todo interés y al final casi todo capital. Es el más común en préstamos personales."],
  ["sistema-aleman", "Sistema alemán", "Devolvés la misma parte de capital cada mes y el interés se calcula sobre lo que queda. La cuota empieza más alta y baja; en total pagás menos intereses que en el francés."],
  ["sistema-americano", "Sistema americano", "Durante el préstamo pagás solo intereses y el capital entero en la última cuota."],
  ["resumen", "Resumen de la tarjeta", "El detalle de lo que compraste con la tarjeta entre dos fechas de cierre. Tiene una fecha de vencimiento para pagarlo."],
  ["cierre", "Fecha de cierre", "El día en que la tarjeta corta el resumen. Lo que comprás después del cierre va al resumen del mes siguiente."],
  ["pago-minimo", "Pago mínimo", "Lo mínimo que podés pagar del resumen sin quedar en mora. El resto pasa al mes siguiente con intereses, que suelen ser de los más caros."],
  ["flujo-de-caja", "Flujo de caja", "Con cuánto empezás y terminás cada mes según lo que entra y sale. Sirve para ver antes un mes en rojo."],
  ["patrimonio-neto", "Patrimonio neto", "Todo lo que tenés (cuentas, inversiones, bienes) menos todo lo que debés (tarjetas y préstamos)."],
  ["fondo-de-emergencia", "Fondo de emergencia", "Plata apartada para imprevistos, en general de 3 a 6 meses de tus gastos fijos. No se usa para el día a día."],
];

export default function Glossary() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Glosario de finanzas personales", url: `${SITE.url}/glosario`, inLanguage: "es", hasDefinedTerm: TERMS.map(([id, name, d]) => ({ "@type": "DefinedTerm", name, description: d, url: `${SITE.url}/glosario#${id}` })) })} />
      <section className="lp-w lp-sec" style={{ paddingTop: 40, maxWidth: 860 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Glosario"]]} />
        <h1 style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 400, margin: "10px 0 12px" }}>Glosario de finanzas personales</h1>
        <p className="lp-lead">Las palabras que aparecen en préstamos, tarjetas y resúmenes, explicadas simple.</p>
        <nav className="chips" aria-label="Términos" style={{ margin: "8px 0 24px" }}>{TERMS.map(([id, name]) => <a key={id} className="chip" href={`#${id}`}>{name.split(" (")[0]}</a>)}</nav>
        <dl className="gloss">{TERMS.map(([id, name, d]) => <div key={id} id={id} className="rv"><dt>{name}</dt><dd>{d}</dd></div>)}</dl>
        <div className="acts" style={{ marginTop: 32 }}><Link className="btn pri lp-big" href="/herramientas/prestamo">Calcular un préstamo</Link><Link className="btn lp-big" href="/herramientas/cuotas">¿Puedo comprarlo en cuotas?</Link></div>
      </section>
    </PublicShell>
  );
}
