import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Calculadora de plazo fijo";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Calculadora de plazo fijo", "Cuánto ganás según la TNA y los días, y cuánto juntás si lo renovás.", "Herramienta gratis");
}
