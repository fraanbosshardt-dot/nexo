import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { Reveal } from "@/components/landing-fx";
import { Icon, type IconName } from "@/components/icons";
import { AppCta } from "@/components/app-cta";
import { BRAND } from "@/lib/brand";
import { jsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Para productores agropecuarios: ventas de granos y flujo de caja",
  description: `Cargá tus ventas de soja, maíz, trigo o girasol en quintales o toneladas, con impuesto al cheque, y mirá tu flujo de caja mes a mes con lo que vas a cobrar. ${BRAND.name} para el campo.`,
  alternates: { canonical: "/productores" },
};

const POINTS: [IconName, string, string][] = [
  ["grain", "Cada venta con su neto", "Quintales o toneladas, precio por tonelada, impuesto al cheque y otros descuentos. El neto se calcula solo."],
  ["repeat", "Ventas mes a mes", "Si vendés todos los meses, cargás un monto aproximado y se proyecta. Cuando vendés de verdad, la venta real ocupa ese mes."],
  ["flow", "Flujo de caja con lo que viene", "Lo que está por cobrar suma en lo proyectado: ves con cuánto terminás cada mes, aunque todavía no hayas cobrado."],
  ["fuel", "El campo y la casa juntos", "Gasoil, insumos y arrendamientos en el mismo lugar que el alquiler, los servicios y las tarjetas."],
  ["clock", "Avisos antes de vencer", "Próximos pagos y cobros ordenados por fecha, con aviso por correo un día antes."],
  ["tag", "Pesos y dólares", "Precios en dólares con la cotización del día, y cuentas en la moneda que uses."],
];
const FAQ: [string, string][] = [
  ["¿Tengo que cargar cada venta a mano?", "Sí, cada venta lleva cantidad, precio y fecha de cobro. Tarda menos de un minuto y después el neto, los pendientes y el flujo se calculan solos."],
  ["¿Qué pasa si vendo más de una vez en el mes?", "Podés cargar todas las ventas que quieras. La primera venta del mes ocupa el lugar de la estimada, así no se cuenta dos veces."],
  ["¿Puedo corregir o borrar una venta?", "Sí. Si la editás se actualiza su cobro; si la borrás y ya estaba cobrada, se anula el ingreso y el saldo vuelve a como estaba."],
  ["¿Es gratis?", "Las cuentas, tarjetas, deudas y el flujo de caja son gratis. El módulo de ventas de granos es parte de Pro, y lo probás 14 días sin pagar."],
];

export default function Producers() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) })} />
      <section className="ws-navy pr-hero">
        <div className="ws-w lx-two" style={{ paddingBlock: "clamp(48px,7vw,96px)" }}>
          <div className="lx-two-copy">
            <Breadcrumbs items={[["Inicio", "/"], ["Para productores"]]} />
            <p className="ws-eyebrow">Para el campo</p>
            <h1 className="ws-h1" style={{ color: "#fff" }}>Tus ventas de granos y tu plata, <em style={{ color: "#8FB4F5" }}>en un solo lugar.</em></h1>
            <p className="ws-lead">Cargá cada venta en quintales o toneladas y mirá el flujo de caja con lo que vas a cobrar. Sin planillas.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
              <AppCta className="ws-btn pri lx-big" label="Probar 14 días gratis" />
              <Link className="ws-btn lx-big" href="/guias/impuesto-al-cheque-venta-de-granos">Cómo calcular el neto</Link>
            </div>
          </div>
          <div className="lx-grain" aria-label="Ejemplo de ventas de cereal">
            <div className="lx-grain-h"><b>Ventas de cereal</b><small>Datos de ejemplo</small></div>
            {[["10", "nov", "Soja · 700 qq", "Cobrado", "+$ 23.514.400", "ok"], ["10", "dic", "Maíz · 1.100 qq", "Por cobrar · proyectado", "+$ 20.649.200", "wait"], ["10", "ene", "Venta estimada", "Estimada", "+$ 2.400.000", "wait"]].map(([d, m, t, s, v, k]) => (
              <div key={t + m} className={`lx-grain-r ${k}`}><span><b>{d}</b>{m}</span><span><b>{t}</b><small>{s}</small></span><b>{v}</b></div>
            ))}
          </div>
        </div>
      </section>
      <section className="ws-w ws-sec">
        <Reveal className="ws-head"><p className="ws-eyebrow">Qué podés hacer</p><h2 className="ws-h2">Pensado para cómo vende el productor.</h2></Reveal>
        <div className="ws-grid c3">{POINTS.map(([ic, t, d], i) => <Reveal key={t} className="ws-card" tilt style={{ "--i": i % 3 } as React.CSSProperties}><span className="ws-ic"><Icon name={ic} /></span><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
      </section>
      <section className="ws-soft">
        <div className="ws-w ws-sec lx-faq" style={{ marginInline: "auto" }}>
          <Reveal className="ws-head c"><h2 className="ws-h2">Preguntas de productores</h2></Reveal>
          <div>{FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
        </div>
      </section>
      <section className="ws-w lx-final-wrap" style={{ paddingTop: "clamp(64px,8vw,96px)" }}>
        <div className="lx-final">
          <div><h2 className="ws-h2">Probalo con tus ventas de este mes.</h2><p>14 días de Pro gratis. Sin tarjeta.</p></div>
          <AppCta className="ws-btn lx-big" label="Crear mi cuenta" />
        </div>
      </section>
    </PublicShell>
  );
}
