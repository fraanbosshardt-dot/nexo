import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Tus ventas de granos y tu plata, en un solo lugar";
export const size = OG_SIZE;
export const contentType = "image/png";
export default function Image() {
  return ogImage("Tus ventas de granos y tu plata, en un solo lugar", "Quintales, neto de cada venta y flujo de caja con lo que vas a cobrar.", "Para productores");
}
