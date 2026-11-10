import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { Reveal } from "@/components/landing-fx";
import { Icon, type IconName } from "@/components/icons";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Herramientas gratis para tus finanzas",
  description: "Calculadoras gratuitas y sin registro: ¿puedo comprarlo en cuotas?, cuotas de un préstamo con sistema francés o alemán, glosario de TNA, TEA y CFT, y guías prácticas.",
  alternates: { canonical: "/herramientas" },
};

const TOOLS: [string, IconName, string, string][] = [
  ["/herramientas/cuotas", "sliders", "¿Puedo comprarlo en cuotas?", "Poné cuánto tenés, cuánto te sobra por mes y el precio. Te dice si te alcanza y cómo queda tu plata mes a mes."],
  ["/herramientas/prestamo", "bank", "Calculadora de préstamos", "Cuota, intereses y cronograma completo con sistema francés, alemán o americano. Con la TEA equivalente."],
  ["/glosario", "file", "Glosario financiero", "TNA, TEA, CFT, sistema francés y más, explicados en una línea y con ejemplos."],
  ["/guias", "help", "Guías prácticas", "Cómo ordenar el sueldo, cuándo conviene pagar en cuotas y más, paso a paso."],
];

export default function Tools() {
  return (
    <PublicShell>
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Herramientas"]]} />
          <p className="ws-eyebrow">Gratis y sin registrarte</p>
          <h1 className="ws-h1">Herramientas para <em>decidir mejor.</em></h1>
          <p className="ws-lead">No guardamos nada de lo que escribís. Si te sirven, en {BRAND.name} las mismas cuentas se hacen solas con tus datos reales.</p>
        </div>
      </section>
      <section className="ws-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div className="lx-tools lx-tools-2">{TOOLS.map(([href, ic, t, d], i) => (
          <Reveal key={href} className="lx-tool" style={{ "--i": i } as React.CSSProperties}><Link href={href}><span className="ws-ic"><Icon name={ic} /></span><b>{t}</b><span>{d}</span><em>Usar ahora →</em></Link></Reveal>
        ))}</div>
      </section>
    </PublicShell>
  );
}
