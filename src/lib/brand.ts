// Nombre de la marca y datos del titular, en un solo lugar: al cambiar el nombre o el dominio, se cambia acá.
export const BRAND = {
  name: "NEXO",
  tagline: "Finanzas personales en tu moneda",
  owner: "Francisco Jesús Bosshardt",
  cuit: "20-45836722-2",
  country: "República Argentina",
  // Sin domicilio físico: la atención es 100% en línea, desde Contacto.
  address: null as string | null,
  // Formulario oficial de Defensa del Consumidor (Ventanilla Única Federal).
  consumerUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
  legalUpdated: "09/11/2026",
};

// Áreas de contacto: cada una con su correo (se carga en el panel interno) y lo que atiende.
export const AREAS = [
  { key: "soporte", name: "Soporte", desc: "Dudas de uso, algo que no funciona, tu cuenta." },
  { key: "pagos", name: "Planes y pagos", desc: "Pro, cobros, facturas, cupones y reembolsos." },
  { key: "arrepentimiento", name: "Arrepentimiento", desc: "Cancelar una contratación dentro de los 10 días y pedir la devolución." },
  { key: "privacidad", name: "Privacidad y datos", desc: "Acceso, corrección o eliminación de tus datos personales." },
  { key: "reclamos", name: "Reclamos", desc: "Si algo no salió bien y querés dejar un reclamo formal." },
  { key: "prensa", name: "Prensa", desc: "Notas, entrevistas y material de la marca." },
  { key: "alianzas", name: "Alianzas y empresas", desc: "Bancos, cooperativas, contadores, escuelas y acuerdos." },
] as const;
export type AreaKey = (typeof AREAS)[number]["key"];
export const SOCIALS = [
  { key: "instagram", name: "Instagram" },
  { key: "x", name: "X" },
  { key: "linkedin", name: "LinkedIn" },
  { key: "tiktok", name: "TikTok" },
  { key: "youtube", name: "YouTube" },
] as const;
export type SocialKey = (typeof SOCIALS)[number]["key"];
