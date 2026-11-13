import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { jsonLd, organizationLd } from "@/lib/seo";
import { Reveal } from "@/components/landing-fx";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description: `${BRAND.name} nació en Argentina para que cualquier persona sepa cuánto tiene, cuánto debe y cuánto puede gastar, sin planillas ni términos difíciles.`,
  alternates: { canonical: "/quienes-somos" },
};

const VALUES: [string, string][] = [
  ["Claro antes que complicado", "Nada de jerga financiera. Si algo necesita explicación, la ponemos al lado, en una línea."],
  ["Tus datos son tuyos", "No nos conectamos a tu banco, no vendemos información y podés llevarte o borrar todo cuando quieras."],
  ["Hecho para la vida real", "Varias monedas, cuotas sin interés, sueldos que cambian, vencimientos que se juntan, ventas de cereal. La realidad de todos los días, no la de un manual."],
  ["Construido escuchando", "Cada mejora sale de lo que nos piden las personas que lo usan."],
];

export default function About() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationLd())} />
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Quiénes somos"]]} />
          <div className="ws-about-hero">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p className="ws-eyebrow">Quiénes somos</p>
              <h1 className="ws-h1">Queremos que llegar a fin de mes <em>deje de ser una sorpresa.</em></h1>
              <p className="ws-lead">{BRAND.name} es una app argentina de finanzas personales. Te muestra hoy cómo termina tu mes, con tus cuentas, tus cuotas y tus vencimientos en un solo lugar.</p>
            </div>
            <div className="ws-stack" aria-hidden="true">
              <div className="a"><small>Antes</small><b>Cuadernos, planillas y recordatorios</b></div>
              <div className="b"><small>Con {BRAND.name}</small><b>Te quedan $ 184.250 hasta el cobro</b></div>
              <div className="c"><small>Y además</small><b>Avisos antes de cada vencimiento</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="ws-w ws-sec">
        <Reveal className="ws-split">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="ws-eyebrow">Por qué existe</p>
            <h2 className="ws-h2">Nació en casa, para ordenar la plata de una familia real.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--muted)" }}>
            <p style={{ margin: 0 }}>Sueldos que no siempre llegan el mismo día, compras en cuotas que se pisan, servicios que vencen todos juntos y, en el campo, ventas de cereal que se cobran mes a mes. Las planillas mostraban lo que ya había pasado, pero no respondían la pregunta importante: <b style={{ color: "var(--fg)" }}>¿cuánto puedo gastar hoy sin quedar en rojo?</b></p>
            <p style={{ margin: 0 }}>Así empezó {BRAND.name}: una herramienta simple, que se usa desde el celular en segundos y que hace las cuentas por vos. La pensamos para personas y familias que buscan lo mismo: tranquilidad.</p>
          </div>
        </Reveal>
      </section>

      <section className="ws-soft">
        <div className="ws-w ws-sec">
          <div className="ws-head"><p className="ws-eyebrow">Lo que nos guía</p><h2 className="ws-h2">Cuatro ideas que no negociamos.</h2></div>
          <div className="ws-values">{VALUES.map(([t, d]) => <Reveal key={t} className="ws-card"><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
        </div>
      </section>

      <section className="ws-navy">
        <div className="ws-w ws-sec" style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 620 }}>
            <h2 className="ws-h2">¿Querés sumarte, escribir sobre nosotros o proponer algo?</h2>
            <p style={{ margin: 0, fontSize: 18 }}>Bancos, cooperativas, contadores, escuelas y medios: nos encanta conversar.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link className="ws-btn pri" href="/contacto?area=alianzas">Alianzas</Link>
            <Link className="ws-btn" href="/contacto?area=prensa">Prensa</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
