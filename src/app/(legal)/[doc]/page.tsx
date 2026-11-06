import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LEGAL } from "@/content/legal";
import { Brand } from "@/components/brand";

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(LEGAL).map((doc) => ({ doc }));

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  return { title: LEGAL[(await params).doc]?.title };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = LEGAL[doc];
  if (!d) notFound();
  return (
    <div className="lp">
      <header className="lp-nav"><div className="lp-w lp-navin"><Brand /><span style={{ flex: 1 }} /><Link className="btn" href="/">Volver</Link></div></header>
      <main className="lp-w legal">
        <p className="lp-eyebrow">Legales</p>
        <h1>{d.title}</h1>
        <p className="sub">Última actualización: 06/11/2026 · Borrador para revisar con un abogado antes de publicar.</p>
        <nav className="legal-tabs">{Object.entries(LEGAL).map(([k, v]) => <Link key={k} className={`chip ${k === doc ? "on" : ""}`} href={`/${k}`}>{v.title}</Link>)}</nav>
        {d.sections.map(([h, p], i) => <section key={h}><h2>{i + 1}. {h}</h2><p>{p}</p></section>)}
      </main>
    </div>
  );
}
