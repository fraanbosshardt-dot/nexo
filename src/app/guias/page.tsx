import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { Reveal } from "@/components/landing-fx";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guías de finanzas personales",
  description: "Guías cortas y prácticas: cómo organizar el sueldo, si conviene pagar en cuotas, qué es el CFT y cómo calcular el neto de una venta de granos.",
  alternates: { canonical: "/guias" },
};

export default function Guides() {
  return (
    <PublicShell>
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Guías"]]} />
          <p className="ws-eyebrow">Guías</p>
          <h1 className="ws-h1">Ordená tu plata, <em>paso a paso.</em></h1>
          <p className="ws-lead">Explicaciones cortas, sin jerga, para decidir mejor. Información general: para tu caso, consultá con un profesional.</p>
        </div>
      </section>
      <section className="ws-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div className="gd-list">{GUIDES.map((g, i) => (
          <Reveal key={g.slug} className="gd-card" style={{ "--i": i } as React.CSSProperties}>
            <Link href={`/guias/${g.slug}`}><span className="gd-tag">{g.tag} · {g.minutes} min</span><b>{g.title}</b><span>{g.description}</span><em>Leer →</em></Link>
          </Reveal>
        ))}</div>
      </section>
    </PublicShell>
  );
}
