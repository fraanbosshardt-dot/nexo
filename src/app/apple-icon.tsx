import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// Ícono para "Agregar a pantalla de inicio" en iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      // iPhone redondea las esquinas solo: el fondo va cuadrado.
      <img src={logoDataUri({ radius: 0, pad: 0.12, size: 180 })} width={180} height={180} alt="" />
    ),
    size,
  );
}
