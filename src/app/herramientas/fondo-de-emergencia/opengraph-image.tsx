import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Fondo de emergencia";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Fondo de emergencia", "Cuánto necesitás según tus gastos y en cuántos meses llegás.", "Herramienta gratis");
}
