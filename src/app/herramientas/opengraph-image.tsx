import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Herramientas gratis para tus finanzas";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Herramientas gratis para tus finanzas", "Calculadoras sin registrarte: cuotas, préstamos y glosario.", "Gratis");
}
