import { getDb } from "@/lib/db";
import { applyNotification, validSignature } from "@/server/billing";

// Notificaciones de Mercado Pago (suscripciones y cobros). Solo se aceptan con firma válida.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? "";
  // La firma de MP utiliza data.id de la URL. No permitir que el cuerpo firme otro recurso.
  const queryId = url.searchParams.get("data.id");
  const bodyId = body.data?.id != null ? String(body.data.id) : null;
  if (queryId && bodyId && queryId.toLowerCase() !== bodyId.toLowerCase()) return new Response("Id inconsistente", { status: 400 });
  const id = queryId ?? bodyId ?? "";
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
