import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Presupuesto 50/30/20";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Presupuesto 50/30/20", "Repartí tu ingreso entre necesidades, gustos y ahorro.", "Herramienta gratis");
}
