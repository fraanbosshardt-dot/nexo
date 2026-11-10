import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "¿Puedo comprarlo en cuotas?";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("¿Puedo comprarlo en cuotas?", "Calculadora gratis: te dice si te alcanza y cómo queda tu plata mes a mes.", "Herramienta gratis");
}
