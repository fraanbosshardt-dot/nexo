import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/logo";

// Íconos PNG para instalar la app (Android pide 192 y 512; "maskable" deja margen para recortes redondos).
const SIZES = new Set(["192", "512", "maskable-512"]);

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response("No encontrado", { status: 404 });
  const px = size === "192" ? 192 : 512;
  const maskable = size.startsWith("maskable");
  return new ImageResponse(
    (
      <img src={logoDataUri(maskable ? { radius: 0, pad: 0.22, size: px } : { radius: 0.22, pad: 0.12, size: px })} width={px} height={px} alt="" />
    ),
    { width: px, height: px, headers: { "cache-control": "public, max-age=31536000, immutable" } },
  );
}
