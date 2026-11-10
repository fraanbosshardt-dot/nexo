import Link from "next/link";
import { Brand } from "./brand";
import { PublicNav } from "./public-nav";
import { BRAND, SOCIALS, type SocialKey } from "@/lib/brand";
import { getDb } from "@/lib/db";
import { contactSettings } from "@/server/contact";

// Encabezado y pie de las páginas públicas (landing, herramientas, glosario, contacto, legales).
export function PublicShell({ children, logged = false }: { children: React.ReactNode; logged?: boolean }) {
  return (
    <div className="lp site">
      <PublicNav logged={logged} />
      <main id="contenido">{children}</main>
      <SiteFooter />
    </div>
  );
}

const SOCIAL_ICON: Record<SocialKey, React.ReactNode> = {
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5v.01" /></>,
  x: <path d="M4 4l16 16M20 4L4 20" />,
  linkedin: <path d="M6 10v8M6 6v.01M10 18v-8M10 13a3 3 0 0 1 6 0v5" />,
  tiktok: <path d="M14 3v11a4 4 0 1 1-4-4M14 3c0 3 2 5 5 5" />,
  youtube: <><rect x="2.5" y="6" width="19" height="12" rx="4" /><path d="M10.5 9.5l4 2.5-4 2.5z" /></>,
};

const COLS: [string, [string, string][]][] = [
  ["Producto", [["Funciones", "/#funciones"], ["Precios", "/#planes"], ["Seguridad", "/seguridad"], ["Novedades", "/novedades"]]],
  ["Recursos", [["¿Puedo comprarlo en cuotas?", "/herramientas/cuotas"], ["Calculadora de préstamos", "/herramientas/prestamo"], ["Glosario", "/glosario"], ["Preguntas frecuentes", "/#preguntas"]]],
  ["Empresa", [["Quiénes somos", "/quienes-somos"], ["Contacto", "/contacto"], ["Prensa", "/contacto?area=prensa"], ["Alianzas", "/contacto?area=alianzas"]]],
  ["Legales", [["Términos", "/terminos"], ["Privacidad", "/privacidad"], ["Reembolsos", "/reembolsos"], ["Cookies", "/cookies"]]],
];

async function SiteFooter() {
  const { socials } = await contactSettings(getDb());
  const nets = SOCIALS.filter((s) => socials[s.key]);
  return (
    <footer className="ws-foot">
      <div className="ws-w ws-foot-in">
        <div className="ws-foot-top">
          <div className="ws-foot-brand">
            <Brand inverse />
            <p>{BRAND.tagline}. Hecho en Argentina.</p>
            {nets.length > 0 && (
              <div className="ws-social">{nets.map((s) => (
                <a key={s.key} href={socials[s.key]} target="_blank" rel="noopener noreferrer" aria-label={`${BRAND.name} en ${s.name}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SOCIAL_ICON[s.key]}</svg>
                </a>
              ))}</div>
            )}
          </div>
          {COLS.map(([title, links]) => (
            <nav key={title} aria-label={title}><b>{title}</b>{links.map(([l, h]) => <Link key={h} href={h}>{l}</Link>)}</nav>
          ))}
        </div>
        <div className="ws-foot-legal">
          <Link href="/arrepentimiento">Botón de arrepentimiento</Link>
          <a href={BRAND.consumerUrl} target="_blank" rel="noopener noreferrer">Defensa del Consumidor · Reclamos</a>
        </div>
        <div className="ws-foot-bot">
          <span>© {new Date().getFullYear()} {BRAND.name} · {BRAND.owner} · CUIT {BRAND.cuit} · Atención 100% en línea</span>
          <span>{BRAND.name} no es un banco ni da asesoramiento financiero.</span>
        </div>
      </div>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Ruta" className="crumb ws-crumbs">
      {items.map(([label, href], i) => <span key={label}>{href ? <Link href={href}>{label}</Link> : label}{i < items.length - 1 ? " ›" : ""}</span>)}
    </nav>
  );
}
