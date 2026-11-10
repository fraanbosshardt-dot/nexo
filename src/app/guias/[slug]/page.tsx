import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { GUIDES, guideBySlug } from "@/content/guides";
import { BRAND } from "@/lib/brand";
import { jsonLd, SITE } from "@/lib/seo";

export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  return g ? { title: g.title, description: g.description, alternates: { canonical: `/guias/${g.slug}` }, openGraph: { type: "article", title: g.title, description: g.description, url: `/guias/${g.slug}` } } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, datePublished: g.date, dateModified: g.date, inLanguage: "es", author: { "@type": "Organization", name: BRAND.name }, publisher: { "@type": "Organization", name: BRAND.name, logo: { "@type": "ImageObject", url: `${SITE.url}/icon.svg` } }, mainEntityOfPage: `${SITE.url}/guias/${g.slug}` })} />
      <section className="ws-hero">
        <div className="ws-w" style={{ maxWidth: 860 }}>
          <Breadcrumbs items={[["Inicio", "/"], ["Guías", "/guias"], [g.tag]]} />
          <p className="ws-eyebrow">{g.tag} · {g.minutes} minutos de lectura</p>
          <h1 className="ws-h1" style={{ fontSize: "clamp(32px,4.4vw,52px)" }}>{g.title}</h1>
          <p className="ws-lead">{g.intro}</p>
        </div>
      </section>
      <article className="ws-w gd-body" style={{ maxWidth: 860 }}>
        {g.sections.map((s) => <section key={s.h}><h2>{s.h}</h2>{s.p.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}</section>)}
        <div className="gd-cta">
          <div><b>Hacé estas cuentas con tus datos reales</b><span>{BRAND.name} es gratis y no te pide la clave del banco.</span></div>
          <Link className="ws-btn pri" href={g.cta.href}>{g.cta.label}</Link>
        </div>
        <p className="ws-fine">Información general y educativa, no es asesoramiento financiero ni impositivo. Para tu caso, consultá con un profesional.</p>
        <h2 className="gd-more">Seguí leyendo</h2>
        <div className="gd-list">{others.map((o) => (
          <div className="gd-card" key={o.slug}><Link href={`/guias/${o.slug}`}><span className="gd-tag">{o.tag} · {o.minutes} min</span><b>{o.title}</b><em>Leer →</em></Link></div>
        ))}</div>
      </article>
    </PublicShell>
  );
}
