import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Hablemos";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Hablemos", "Escribinos por área y te respondemos con un número de trámite.", "Contacto");
}
