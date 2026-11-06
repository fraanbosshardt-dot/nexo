// Datos del sitio para buscadores y redes sociales.
export const SITE = {
  name: "NEXO",
  title: "NEXO · Finanzas personales en tu moneda",
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
  { path: "/glosario", priority: 0.7 },
  { path: "/registro", priority: 0.6 },
  { path: "/terminos", priority: 0.2 },
  { path: "/privacidad", priority: 0.2 },
];

// Bloque de datos estructurados (schema.org) para que Google entienda la página.
export function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
