// Imagen para compartir (WhatsApp, redes): la misma base para todas las páginas, con su propio título.
import { ImageResponse } from "next/og";
import { BRAND } from "./brand";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage(title: string, subtitle: string, tag?: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0B1220", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#1A5FD0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700 }}>{BRAND.name.slice(0, 1)}</div>
          <div style={{ fontSize: 40, color: "#FFFFFF", fontWeight: 700 }}>{BRAND.name}</div>
          {tag && <div style={{ marginLeft: 16, fontSize: 26, color: "#8FB4F5", border: "2px solid #2A3550", borderRadius: 999, padding: "8px 22px" }}>{tag}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, color: "#FFFFFF", lineHeight: 1.08, maxWidth: 1000, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#A7B0C0", maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", height: 8, background: "#1A5FD0", borderRadius: 4, width: 240 }} />
      </div>
    ),
    OG_SIZE,
  );
}
