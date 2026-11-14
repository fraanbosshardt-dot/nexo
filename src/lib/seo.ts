import { BRAND } from "./brand";
import { GUIDES } from "@/content/guides";
// Datos del sitio para buscadores y redes sociales.
export const SITE = {
  name: "Somos Guafra",
  title: "Somos Guafra · Finanzas personales en tu moneda",
  description: "Sabé cuánto tenés, cuánto debés y cuánto podés gastar hasta tu próximo cobro. Cuentas, tarjetas en cuotas, deudas y vencimientos en un solo lugar. Gratis.",
  url: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  locale: "es",
};

// Páginas públicas que se indexan (las de la app nunca).
export const PUBLIC_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/herramientas", priority: 0.8 },
  { path: "/herramientas/cuotas", priority: 0.9 },
  { path: "/herramientas/prestamo", priority: 0.9 },
  { path: "/herramientas/plazo-fijo", priority: 0.8 },
  { path: "/herramientas/conversor-de-monedas", priority: 0.8 },
  { path: "/herramientas/fondo-de-emergencia", priority: 0.8 },
  { path: "/herramientas/presupuesto-50-30-20", priority: 0.8 },
  { path: "/glosario", priority: 0.7 },
  { path: "/novedades", priority: 0.5 },
  { path: "/registro", priority: 0.6 },
  { path: "/productores", priority: 0.8 },
  { path: "/guias", priority: 0.7 },
  ...GUIDES.map((g) => ({ path: `/guias/${g.slug}`, priority: 0.7 })),
  { path: "/quienes-somos", priority: 0.6 },
  { path: "/seguridad", priority: 0.6 },
  { path: "/contacto", priority: 0.5 },
  { path: "/terminos", priority: 0.2 },
  { path: "/privacidad", priority: 0.2 },
  { path: "/reembolsos", priority: 0.2 },
  { path: "/cookies", priority: 0.2 },
  { path: "/arrepentimiento", priority: 0.2 },
];

// Bloque de datos estructurados (schema.org) para que Google entienda la página.
export function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

// Datos de la empresa para Google (la ficha con nombre, contacto y titular).
export function organizationLd() {
  return {
    "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon.svg`,
    founder: { "@type": "Person", name: BRAND.owner }, taxID: BRAND.cuit, areaServed: "AR",
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: `${SITE.url}/contacto`, availableLanguage: "es" },
  };
}
