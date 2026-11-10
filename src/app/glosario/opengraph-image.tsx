import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Glosario de finanzas personales";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Glosario de finanzas personales", "TNA, TEA, CFT, sistema francés y más, explicados simple.", "Glosario");
}
