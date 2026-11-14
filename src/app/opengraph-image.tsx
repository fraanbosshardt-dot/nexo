import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// Imagen que aparece al compartir el enlace en WhatsApp, redes o Slack. Se genera sola.
export const alt = "Somos Guafra · Finanzas personales en tu moneda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFFFFF", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={logoDataUri({ size: 72 })} width={72} height={72} alt="" />
          <div style={{ fontSize: 40, color: "#16493A", fontWeight: 700 }}>somosguafra</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, color: "#1F1F1F", lineHeight: 1.1, maxWidth: 980 }}>Sabé cuánto podés gastar hasta tu próximo cobro.</div>
          <div style={{ fontSize: 32, color: "#5F6368" }}>Cuentas, tarjetas en cuotas, deudas y vencimientos. En tu moneda. Gratis.</div>
        </div>
        <div style={{ display: "flex", height: 8, background: "#16493A", borderRadius: 4, width: 240 }} />
      </div>
    ),
    size,
  );
}
