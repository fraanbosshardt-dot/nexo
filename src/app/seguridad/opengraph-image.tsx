import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Tu información financiera, cuidada en serio";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Tu información financiera, cuidada en serio", "Nunca te pedimos la clave de tu banco.", "Seguridad");
}
