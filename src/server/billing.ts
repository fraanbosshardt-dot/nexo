// Cobro de Pro con suscripciones de Mercado Pago (preapproval).
// Se activa cargando MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET. El precio es uno solo: el de Panel → Ajustes → Precio de Pro,
// el mismo que se muestra en la web y en la app.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { paidUntil, planSettings } from "./plans";
import { sendBillingNotice } from "./billing-mail";

const API = "https://api.mercadopago.com";

export async function billingConfig(db: Db) {
  const token = process.env.MP_ACCESS_TOKEN;
  const ars = (await planSettings(db)).pricesArs;
  return { enabled: !!token && !!ars, token, currency: "ARS", monthly: ars?.monthly ?? 0, yearly: ars?.yearly ?? 0 };
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new UserError("Los cobros todavía no están activados.");
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!r.ok) throw new UserError("Mercado Pago no respondió. Probá de nuevo en un momento.");
  return (await r.json()) as T;
}

type Preapproval = { id: string; status: "pending" | "authorized" | "paused" | "cancelled"; init_point?: string; external_reference?: string; auto_recurring?: { frequency: number; transaction_amount: number; currency_id: string } };

// Crea la suscripción y devuelve el enlace de pago de Mercado Pago.
// La referencia externa lleva el espacio y, si hay, el cupón: "espacio|CUPON".
export const splitRef = (ref: string | undefined) => { const [ws, coupon] = (ref ?? "").split("|"); return { ws: ws || null, coupon: coupon || null }; };

// startDate: el primer cobro queda para esa fecha (fin de la prueba, o fin del mes ya pagado al pasarse a anual).
export async function startCheckout(db: Db, ws: string, payerEmail: string, cycle: "monthly" | "yearly", backUrl: string, discount?: { code: string; percentOff: number }, startDate?: Date | null) {
  const c = await billingConfig(db);
  const base = cycle === "yearly" ? c.yearly : c.monthly;
  const amount = discount ? Math.round(base * (100 - discount.percentOff)) / 100 : base;
  if (!c.enabled) throw new UserError("Los cobros todavía no están activados.");
  const p = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: cycle === "yearly" ? "Somos Guafra Pro · anual" : "Somos Guafra Pro · mensual",
      external_reference: discount ? `${ws}|${discount.code}` : ws,
      payer_email: payerEmail,
      back_url: backUrl,
      auto_recurring: { frequency: cycle === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: amount, currency_id: c.currency, ...(startDate && startDate.getTime() > Date.now() + 3600_000 ? { start_date: startDate.toISOString() } : {}) },
    }),
  });
  if (!p.init_point) throw new UserError("Mercado Pago no devolvió el enlace de pago.");
  return p.init_point;
}

export async function cancelSubscription(db: Db, ws: string) {
  const sub = await db.subscription.findUnique({ where: { workspaceId: ws } });
  if (sub?.provider === "mercadopago" && sub.providerRef) await mp(`/preapproval/${sub.providerRef}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  // Pro sigue hasta el fin del período pagado (effectivePlan mira currentPeriodEnd).
  await db.subscription.update({ where: { workspaceId: ws }, data: { status: "CANCELED", canceledAt: new Date() } });
  await sendBillingNotice(db, ws, `cancel-${sub?.providerRef ?? sub?.id}`, "Cancelaste tu suscripción a Somos Guafra Pro", "Tu suscripción quedó cancelada. Conservás Pro hasta que termine el período ya cubierto.");
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
    const { ws, coupon } = splitRef(p.external_reference);
    if (!ws || !(await db.workspace.findUnique({ where: { id: ws } }))) return;
    const active = p.status === "authorized";
    const before = await db.subscription.findUnique({ where: { workspaceId: ws } });
    // Aviso de una suscripción vieja (por ejemplo, la mensual que se canceló al pasarse a anual): no pisa la actual.
    if (before?.providerRef && before.providerRef !== p.id && !active) return;
    // Se pasó a otra suscripción (de mensual a anual): la anterior se cancela en Mercado Pago, sin cobro doble.
    if (active && before?.providerRef && before.providerRef !== p.id && before.status === "ACTIVE" && before.provider === "mercadopago") {
      await mp(`/preapproval/${before.providerRef}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }).catch((e) => console.error("[mp] cancelar la anterior", e));
    }
    // Se suscribió durante la prueba: si después cancela antes del primer cobro, conserva Pro hasta el fin de la prueba.
    const keepUntil = active && before?.trialEndsAt && before.trialEndsAt > new Date() && (!before.currentPeriodEnd || before.currentPeriodEnd < before.trialEndsAt) ? before.trialEndsAt : undefined;
    // El cupón cuenta un uso solo la primera vez que esa suscripción queda activa.
    if (active && coupon && !(before?.providerRef === p.id && before.status === "ACTIVE")) {
      await db.coupon.updateMany({ where: { code: coupon }, data: { uses: { increment: 1 } } });
    }
    const cycle = p.auto_recurring?.frequency === 12 ? "yearly" : "monthly";
    await db.subscription.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, plan: active ? "PRO" : "FREE", status: active ? "ACTIVE" : p.status === "cancelled" ? "CANCELED" : "PAST_DUE", provider: "mercadopago", providerRef: p.id, billingCycle: cycle, couponCode: coupon },
      // Cancelada o pausada: el plan queda en Pro y effectivePlan lo corta al terminar el período pagado.
      update: { plan: active ? "PRO" : undefined, status: active ? "ACTIVE" : p.status === "cancelled" ? "CANCELED" : "PAST_DUE", provider: "mercadopago", providerRef: p.id, billingCycle: cycle, trialEndsAt: active ? null : undefined, currentPeriodEnd: keepUntil, couponCode: coupon ?? undefined, canceledAt: p.status === "cancelled" ? new Date() : undefined },
    });
    if (active || p.status === "cancelled" || p.status === "paused") {
      const subject = active ? "Tu suscripción a Somos Guafra Pro está activa" : p.status === "cancelled" ? "Cancelaste tu suscripción a Somos Guafra Pro" : "Tu suscripción a Somos Guafra Pro está pausada";
      await sendBillingNotice(db, ws, p.status === "cancelled" ? `cancel-${p.id}` : `subscription-${p.id}-${p.status}`, subject,
        active ? "Mercado Pago autorizó tu suscripción. Los cobros se realizan según el ciclo contratado; recibirás un aviso por cada resultado de pago." : "Los cobros de esta suscripción se detuvieron. Conservás Pro durante el período ya cubierto, si corresponde.");
    }
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
    if (status === "approved") {
      const until = paidUntil(new Date(pay.date_created ?? Date.now()), sub.billingCycle);
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd < until) await db.subscription.update({ where: { id: sub.id }, data: { currentPeriodEnd: until } });
    }
    if (["approved", "rejected", "refunded", "cancelled"].includes(status)) {
      const labels: Record<string, string> = { approved: "Pago aprobado", rejected: "Pago rechazado", refunded: "Pago reembolsado", cancelled: "Pago cancelado" };
      const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: pay.currency_id }).format(pay.transaction_amount);
      await sendBillingNotice(db, sub.workspaceId, `payment-${pay.id}-${status}`, `${labels[status]} · Somos Guafra Pro`,
        `${labels[status]} por ${amount} para tu suscripción Pro.${status === "approved" ? " Si es una renovación, tu período de acceso ya quedó actualizado." : status === "rejected" ? " Revisá el medio de pago en Mercado Pago para regularizar la suscripción." : " Podés revisar el detalle en Mercado Pago."}`);
    }
  }
}
