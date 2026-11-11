import { ImageResponse } from "next/og";

// Ícono para "Agregar a pantalla de inicio" en iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1A5FD0" }}>
        <div style={{ color: "#FFFFFF", fontSize: 104, fontWeight: 500, fontFamily: "sans-serif" }}>F</div>
      </div>
    ),
    size,
  );
}
