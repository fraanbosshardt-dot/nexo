import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Herramientas gratis para tus finanzas",
  description: "Calculadoras gratuitas y sin registro: ¿puedo comprarlo en cuotas?, cuotas de un préstamo con sistema francés o alemán, y glosario de TNA, TEA y CFT.",
  alternates: { canonical: "/herramientas" },
};

const TOOLS = [
  { href: "/herramientas/cuotas", icon: "sliders" as const, title: "¿Puedo comprarlo en cuotas?", text: "Poné cuánto tenés, cuánto te sobra por mes y el precio. Te dice si te alcanza y cómo queda tu dinero mes a mes." },
  { href: "/herramientas/prestamo", icon: "bank" as const, title: "Calculadora de préstamos", text: "Cuota, intereses y cronograma completo con sistema francés, alemán o americano. Con la TEA equivalente." },
  { href: "/glosario", icon: "file" as const, title: "Glosario financiero", text: "TNA, TEA, CFT, sistema francés y más, explicados en una línea y con ejemplos." },
];

export default function Tools() {
  return (
    <PublicShell>
      <section className="lp-w lp-sec" style={{ paddingTop: 40 }}>
        <Breadcrumbs items={[["Inicio", "/"], ["Herramientas"]]} />
        <h1 style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 400, margin: "10px 0 12px" }}>Herramientas gratis</h1>
        <p className="lp-lead">Sin registrarte y sin guardar nada. Si te sirven, en NEXO las mismas cuentas se hacen solas con tus datos reales.</p>
        <div className="lp-grid">{TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="lp-feat rv" style={{ color: "inherit" }}><Icon name={t.icon} /><h2 style={{ fontSize: 16, fontWeight: 500, margin: "10px 0 6px" }}>{t.title}</h2><p>{t.text}</p><span className="lk" style={{ marginTop: 8 }}>Usar ahora →</span></Link>
        ))}</div>
      </section>
    </PublicShell>
  );
}
