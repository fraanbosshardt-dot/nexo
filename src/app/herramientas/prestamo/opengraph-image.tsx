import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Calculadora de préstamos";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Calculadora de préstamos", "Cuota, intereses y cronograma con sistema francés, alemán o americano.", "Herramienta gratis");
}
