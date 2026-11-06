import { ImageResponse } from "next/og";

// Íconos PNG para instalar la app (Android pide 192 y 512; "maskable" deja margen para recortes redondos).
const SIZES = new Set(["192", "512", "maskable-512"]);

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response("No encontrado", { status: 404 });
  const px = size === "192" ? 192 : 512;
  const maskable = size.startsWith("maskable");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1A5FD0", borderRadius: maskable ? 0 : px * 0.22 }}>
        <div style={{ color: "#FFFFFF", fontSize: px * (maskable ? 0.46 : 0.58), fontWeight: 500, fontFamily: "sans-serif", lineHeight: 1 }}>N</div>
      </div>
    ),
    { width: px, height: px, headers: { "cache-control": "public, max-age=31536000, immutable" } },
  );
}
