import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Conversor de monedas";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Conversor de monedas", "Pesos, dólares, euros y más, con la cotización oficial del día.", "Herramienta gratis");
}
