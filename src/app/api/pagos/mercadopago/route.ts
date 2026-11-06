import { getDb } from "@/lib/db";
import { applyNotification, validSignature } from "@/server/billing";

// Notificaciones de Mercado Pago (suscripciones y cobros). Solo se aceptan con firma válida.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? "");
  if (!id) return new Response("Falta el id", { status: 400 });
  if (!validSignature(req.headers.get("x-signature"), req.headers.get("x-request-id"), id)) return new Response("Firma inválida", { status: 401 });
  try {
    await applyNotification(getDb(), type, id);
  } catch (e) {
    console.error("[mercadopago]", e);
    return new Response("Error", { status: 500 }); // Mercado Pago reintenta
  }
  return new Response("ok");
}
