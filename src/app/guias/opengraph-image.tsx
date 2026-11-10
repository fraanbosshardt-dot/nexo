import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Guías para ordenar tu plata";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Guías para ordenar tu plata", "Cómo organizar el sueldo, cuotas, CFT y más, explicado simple.", "Guías");
}
