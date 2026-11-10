import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Breadcrumbs } from "@/components/public-shell";
import { jsonLd, organizationLd } from "@/lib/seo";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { contactSettings } from "@/server/contact";
import { AREAS, BRAND } from "@/lib/brand";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contacto",
  description: `Escribile al equipo de ${BRAND.name}: soporte, planes y pagos, arrepentimiento, privacidad, reclamos, prensa y alianzas. Te respondemos por correo con un número de trámite.`,
  alternates: { canonical: "/contacto" },
};

const check = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;

export default async function Contact({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area = "soporte" } = await searchParams;
  const [session, cfg] = await Promise.all([getSession().catch(() => null), contactSettings(getDb())]);
  const mails = AREAS.filter((a) => cfg.emails[a.key]);
  return (
    <PublicShell logged={!!session}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationLd())} />
      <section className="ws-hero">
        <div className="ws-w">
          <Breadcrumbs items={[["Inicio", "/"], ["Contacto"]]} />
          <p className="ws-eyebrow">Contacto</p>
          <h1 className="ws-h1">Hablemos. <em>Te respondemos rápido.</em></h1>
          <p className="ws-lead">Elegí el área y contanos. Te damos un número de trámite en el momento y te respondemos por correo. La atención es 100% en línea.</p>
        </div>
      </section>
      <section className="ws-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div className="ws-contact">
          <ContactForm area={area} email={session?.user.email ?? ""} name={session?.user.name ?? ""} />
          <aside className="ws-aside">
            <div className="ws-card">
              <h3>Lo que tenés que saber</h3>
              <ul className="ws-list">
                <li>{check}<span>Respondemos en menos de 48 horas hábiles.</span></li>
                <li>{check}<span>Nunca te vamos a pedir tu contraseña ni la clave del banco.</span></li>
                <li>{check}<span>Si contrataste Pro, tenés 10 días para arrepentirte. <Link href="/contacto?area=arrepentimiento">Pedirlo acá</Link>.</span></li>
              </ul>
            </div>
            {mails.length > 0 && (
              <div className="ws-card">
                <h3>Correos por área</h3>
                <div>{mails.map((a) => <div className="ws-mail" key={a.key}><span>{a.name}</span><a href={`mailto:${cfg.emails[a.key]}`}>{cfg.emails[a.key]}</a></div>)}</div>
              </div>
            )}
            <div className="ws-card">
              <h3>¿Algo no salió bien?</h3>
              <p>Dejanos tu reclamo en el área Reclamos. También podés acudir a <a href={BRAND.consumerUrl} target="_blank" rel="noopener noreferrer">Defensa del Consumidor</a>.</p>
              <p style={{ fontSize: 13 }}>{BRAND.owner} · CUIT {BRAND.cuit}</p>
            </div>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}
