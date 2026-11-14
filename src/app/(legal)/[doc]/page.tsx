import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL } from "@/content/legal";
import { BRAND } from "@/lib/brand";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(LEGAL).map((doc) => ({ doc }));

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL[doc];
  return d ? { title: d.title, description: `${d.title} de ${BRAND.name}. ${d.intro}${doc === "terminos" ? ` Titular: ${BRAND.owner}, CUIT ${BRAND.cuit}.` : ""}`, alternates: { canonical: `/${doc}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = LEGAL[doc];
  if (!d) notFound();
  return (
    <PublicShell>
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Legales"], [d.title]]} />
          <p className="ws-eyebrow">Legales</p>
          <h1 className="ws-h1" style={{ fontSize: "clamp(34px,4.6vw,56px)" }}>{d.title}</h1>
          <p className="ws-lead">{d.intro}</p>
          <div className="ws-meta"><span>Última actualización: {BRAND.legalUpdated}</span>{doc === "terminos" && <span>Titular: {BRAND.owner} · CUIT {BRAND.cuit}</span>}</div>
        </div>
      </section>
      <section className="ws-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div className="ws-legal">
          <nav className="ws-toc" aria-label="Documentos legales">
            {Object.entries(LEGAL).map(([k, v]) => <Link key={k} href={`/${k}`} aria-current={k === doc ? "page" : undefined}>{v.short}</Link>)}
          </nav>
          <article className="ws-doc">
            {d.sections.map(([h, p], i) => <section key={h}><span>{String(i + 1).padStart(2, "0")}</span><h2>{h}</h2><p>{p}</p></section>)}
            {doc === "arrepentimiento" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 20 }}>
                <Link className="ws-btn pri" href="/contacto?area=arrepentimiento">Quiero arrepentirme de mi compra</Link>
                <Link className="ws-btn" href="/reembolsos">Ver política de reembolsos</Link>
              </div>
            )}
            {doc !== "arrepentimiento" && (
              <p className="ws-fine" style={{ paddingTop: 20 }}>¿Dudas sobre este documento? <Link href="/contacto">Escribinos</Link>. Si tenés un reclamo, también podés acudir a <a href={BRAND.consumerUrl} target="_blank" rel="noopener noreferrer">Defensa del Consumidor</a>.</p>
            )}
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
