// Cobro de Pro con suscripciones de Mercado Pago (preapproval).
// Se activa cargando MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_CURRENCY y los precios en esa moneda.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";

const API = "https://api.mercadopago.com";

export function billingConfig() {
  const token = process.env.MP_ACCESS_TOKEN;
  const currency = process.env.MP_CURRENCY || "ARS";
  const monthly = Number(process.env.MP_PRICE_MONTHLY || 0), yearly = Number(process.env.MP_PRICE_YEARLY || 0);
  return { enabled: !!token && monthly > 0 && yearly > 0, token, currency, monthly, yearly };
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = billingConfig();
  if (!token) throw new UserError("Los cobros todavía no están activados.");
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!r.ok) throw new UserError("Mercado Pago no respondió. Probá de nuevo en un momento.");
  return (await r.json()) as T;
}

type Preapproval = { id: string; status: "pending" | "authorized" | "paused" | "cancelled"; init_point?: string; external_reference?: string; auto_recurring?: { frequency: number; transaction_amount: number; currency_id: string } };

// Crea la suscripción y devuelve el enlace de pago de Mercado Pago.
export async function startCheckout(ws: string, payerEmail: string, cycle: "monthly" | "yearly", backUrl: string) {
  const c = billingConfig();
  if (!c.enabled) throw new UserError("Los cobros todavía no están activados.");
  const p = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: cycle === "yearly" ? "NEXO Pro · anual" : "NEXO Pro · mensual",
      external_reference: ws,
      payer_email: payerEmail,
      back_url: backUrl,
      auto_recurring: { frequency: cycle === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: cycle === "yearly" ? c.yearly : c.monthly, currency_id: c.currency },
    }),
  });
  if (!p.init_point) throw new UserError("Mercado Pago no devolvió el enlace de pago.");
  return p.init_point;
}

export async function cancelSubscription(db: Db, ws: string) {
  const sub = await db.subscription.findUnique({ where: { workspaceId: ws } });
  if (sub?.provider === "mercadopago" && sub.providerRef) await mp(`/preapproval/${sub.providerRef}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  await db.subscription.update({ where: { workspaceId: ws }, data: { status: "CANCELED", canceledAt: new Date() } });
}

// Firma de las notificaciones: x-signature "ts=...,v1=..." sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
export function validSignature(signature: string | null, requestId: string | null, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(signature.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ""};ts:${parts.ts};`;
  const mine = createHmac("sha256", secret).update(manifest).digest("hex");
  return mine.length === parts.v1.length && timingSafeEqual(Buffer.from(mine), Buffer.from(parts.v1));
}

// Aplica una notificación: estado de la suscripción o un cobro realizado.
export async function applyNotification(db: Db, type: string, id: string) {
  if (type === "subscription_preapproval") {
    const p = await mp<Preapproval>(`/preapproval/${id}`);
    const ws = p.external_reference;
    if (!ws || !(await db.workspace.findUnique({ where: { id: ws } }))) return;
    const active = p.status === "authorized";
    const cycle = p.auto_recurring?.frequency === 12 ? "yearly" : "monthly";
    await db.subscription.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, plan: active ? "PRO" : "FREE", status: active ? "ACTIVE" : p.status === "cancelled" ? "CANCELED" : "PAST_DUE", provider: "mercadopago", providerRef: p.id, billingCycle: cycle },
      update: { plan: active ? "PRO" : p.status === "cancelled" ? "FREE" : undefined, status: active ? "ACTIVE" : p.status === "cancelled" ? "CANCELED" : "PAST_DUE", provider: "mercadopago", providerRef: p.id, billingCycle: cycle, trialEndsAt: active ? null : undefined },
    });
  }
  if (type === "subscription_authorized_payment") {
    const pay = await mp<{ id: number | string; preapproval_id: string; transaction_amount: number; currency_id: string; status: string; date_created?: string; payment?: { status?: string } }>(`/authorized_payments/${id}`);
    const sub = await db.subscription.findFirst({ where: { provider: "mercadopago", providerRef: pay.preapproval_id } });
    if (!sub) return;
    const status = pay.payment?.status ?? pay.status;
    await db.invoice.upsert({
      where: { providerRef: String(pay.id) },
      create: { workspaceId: sub.workspaceId, provider: "mercadopago", providerRef: String(pay.id), amount: pay.transaction_amount.toFixed(2), currency: pay.currency_id, status, paidAt: status === "approved" ? new Date(pay.date_created ?? Date.now()) : null },
      update: { status, paidAt: status === "approved" ? new Date(pay.date_created ?? Date.now()) : null },
    });
  }
}
