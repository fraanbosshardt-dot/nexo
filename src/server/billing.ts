// Autorizaciones y períodos pagados son estados distintos. Los eventos se concilian por espacio.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { effectivePlan, paidUntil, planSettings } from "./plans";
import { queueBillingNotice, drainEmailOutbox } from "./billing-mail";

const API = "https://api.mercadopago.com";
type Tx = Prisma.TransactionClient;
type Cycle = "monthly" | "yearly";
type Preapproval = { id: string; status: string; init_point?: string; external_reference?: string; last_modified?: string; next_payment_date?: string; auto_recurring?: { frequency: number; frequency_type?: string; start_date?: string; transaction_amount: number | string; currency_id: string } };
type AuthorizedPayment = { id: number | string; preapproval_id: string; transaction_amount: number | string; currency_id: string; status: string; date_created?: string; debit_date?: string; last_modified?: string; payment?: { id?: number | string; status?: string } };
const date = (v?: string | null) => v && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
const latest = (...ds: (Date | null | undefined)[]) => ds.reduce<Date | null>((a, d) => d && (!a || d > a) ? d : a, null);
const identifier = (id: string) => { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new UserError("Identificador de pago inválido."); return encodeURIComponent(id); };

export async function billingConfig(db: Db) {
  const token = process.env.MP_ACCESS_TOKEN;
  const ars = (await planSettings(db)).pricesArs;
  return { enabled: !!token && !!process.env.MP_WEBHOOK_SECRET && !!ars, token, currency: "ARS", monthly: ars?.monthly ?? 0, yearly: ars?.yearly ?? 0 };
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new UserError("Los cobros todavía no están activados.");
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000), redirect: "error", cache: "no-store" });
  if (!r.ok) throw new UserError("Mercado Pago no respondió. Probá de nuevo en un momento.");
  return await r.json() as T;
}

// Todas las operaciones del mismo espacio se serializan, incluidos webhooks concurrentes.
async function locked<T>(db: Db, ws: string, run: (tx: Tx) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${ws} FOR UPDATE`;
    return run(tx);
  }, { timeout: 60_000, maxWait: 10_000 });
}

export const splitRef = (ref: string | undefined) => { const [ws, coupon, checkout] = (ref ?? "").split("|"); return { ws: ws || null, coupon: coupon || null, checkout: checkout || null }; };

async function stopAgreement(id: string) {
  const p = await mp<Preapproval>(`/preapproval/${identifier(id)}`);
  if (p.status !== "cancelled") await mp(`/preapproval/${identifier(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}

export async function startCheckout(db: Db, ws: string, payerEmail: string, cycle: Cycle, backUrl: string, discount?: { code: string; percentOff: number }, startDate?: Date | null) {
  const cfg = await billingConfig(db);
  if (!cfg.enabled) throw new UserError("Los cobros todavía no están activados.");
  await recoverPendingCheckout(db, ws, payerEmail);
  if (discount && (!Number.isFinite(discount.percentOff) || discount.percentOff <= 0 || discount.percentOff >= 100)) throw new UserError("El descuento no permite una suscripción recurrente. Consultá al equipo.");
  const amount = Math.round((cycle === "yearly" ? cfg.yearly : cfg.monthly) * (100 - (discount?.percentOff ?? 0))) / 100;
  const reservation = await locked(db, ws, async (tx) => {
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: ws } });
    if (workspace.billingDisabledAt) throw new UserError("La cuenta está en proceso de baja. No se pueden iniciar nuevos cobros.");
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    if (sub?.provider === "manual" && sub.status === "ACTIVE" && effectivePlan(sub) === "PRO") throw new UserError("Ya tenés Pro activado. Revisá tu plan antes de suscribirte.");
    if (sub?.provider === "mercadopago" && sub.status === "ACTIVE" && !(sub.billingCycle === "monthly" && cycle === "yearly" && effectivePlan(sub) === "PRO")) throw new UserError("Ya tenés una suscripción. Administrala desde Tu plan.");
    const pending = await tx.billingAgreement.findFirst({ where: { workspaceId: ws, status: { in: ["creating", "uncertain", "pending"] } }, orderBy: { createdAt: "desc" } });
    if (pending) {
      if (pending.status !== "pending") throw new UserError("Estamos verificando una solicitud anterior. No se iniciará otro cobro mientras esté pendiente.");
      const remote = pending.providerRef ? await mp<Preapproval>(`/preapproval/${identifier(pending.providerRef)}`) : null;
      if (remote?.status === "authorized") throw new UserError("Mercado Pago ya autorizó la solicitud. Esperá su confirmación antes de iniciar otra.");
      if (remote?.status === "pending" && pending.cycle === cycle && Number(pending.amount) === amount && pending.couponCode === (discount?.code ?? null) && pending.checkoutUrl) return pending;
      if (pending.providerRef) await stopAgreement(pending.providerRef);
      await tx.billingAgreement.update({ where: { id: pending.id }, data: { status: "cancelled" } });
    }
    // Nunca adelantar un cobro por perder la prueba o el período ya pagado al cambiar de ciclo.
    const coveredUntil = latest(startDate, sub?.trialEndsAt, sub?.currentPeriodEnd);
    return tx.billingAgreement.create({ data: { workspaceId: ws, cycle, amount, couponCode: discount?.code, startsAt: coveredUntil && coveredUntil > new Date() ? coveredUntil : null } });
  });
  if (reservation.checkoutUrl) return reservation.checkoutUrl;
  try {
    const p = await mp<Preapproval>("/preapproval", { method: "POST", headers: { "X-Idempotency-Key": reservation.id }, body: JSON.stringify({
      reason: `somosguafra Pro · ${cycle === "yearly" ? "anual" : "mensual"}`,
      external_reference: `${ws}|${discount?.code ?? ""}|${reservation.id}`, payer_email: payerEmail, back_url: backUrl, status: "pending",
      auto_recurring: { frequency: cycle === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: amount, currency_id: "ARS", ...(reservation.startsAt ? { start_date: reservation.startsAt.toISOString() } : {}) },
    }) });
    if (!p.id || !p.init_point) throw new UserError("Mercado Pago no devolvió el enlace de pago.");
    identifier(p.id);
    const url = new URL(p.init_point);
    if (url.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.ar)?$/.test(url.hostname) || url.username || url.password) throw new UserError("El enlace de pago no es válido.");
    await db.billingAgreement.update({ where: { id: reservation.id }, data: { providerRef: p.id, checkoutUrl: url.href, status: "pending" } });
    return url.href;
  } catch (e) {
    // Ante un timeout puede haberse creado en MP: no crear otra autorización a ciegas.
    await db.billingAgreement.update({ where: { id: reservation.id }, data: { status: "uncertain" } });
    throw e;
  }
}

// Un timeout no autoriza a repetir un POST de dinero. Buscar primero el acuerdo por pagador
// y comparar su referencia completa, incluso si el resultado ocupa varias páginas.
async function recoverPendingCheckout(db: Db, ws: string, email: string) {
  const pending = await db.billingAgreement.findFirst({ where: { workspaceId: ws, providerRef: null, status: { in: ["creating", "uncertain"] }, createdAt: { lt: new Date(Date.now() - 60_000) } } });
  if (!pending) return;
  let complete = false;
  const matches: Preapproval[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await mp<{ paging?: { total: number }; results: Preapproval[] }>(`/preapproval/search?payer_email=${encodeURIComponent(email)}&offset=${offset}&limit=100`);
    if (!Array.isArray(page.results)) throw new UserError("No se pudo verificar la solicitud anterior.");
    for (const p of page.results) if (p.external_reference === `${ws}|${pending.couponCode ?? ""}|${pending.id}`) matches.push(p);
    if (page.results.length < 100 || (page.paging && offset + 100 >= page.paging.total)) { complete = true; break; }
  }
  if (!complete) throw new UserError("La verificación de la solicitud anterior necesita revisión del equipo.");
  if (matches.length > 1) {
    for (const p of matches) await stopAgreement(p.id);
    await db.billingAgreement.update({ where: { id: pending.id }, data: { status: "cancelled" } });
    return;
  }
  if (matches.length === 1) {
    const p = matches[0];
    await db.billingAgreement.updateMany({ where: { id: pending.id, providerRef: null }, data: { providerRef: p.id, status: "pending", checkoutUrl: p.init_point } });
    await applyPreapproval(db, p.id);
  } else if (pending.createdAt < new Date(Date.now() - 30 * 60_000)) {
    await db.billingAgreement.updateMany({ where: { id: pending.id, providerRef: null }, data: { status: "cancelled" } });
  }
}

async function recalculateAccess(tx: Tx, ws: string) {
  const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
  if (!sub || sub.provider !== "mercadopago") return;
  const invoices = await tx.invoice.findMany({ where: { workspaceId: ws, provider: "mercadopago", status: "approved", periodEnd: { not: null } }, select: { periodEnd: true } });
  const paidTo = latest(sub.legacyPaidUntil, ...invoices.map((p) => p.periodEnd));
  await tx.subscription.update({ where: { workspaceId: ws }, data: { currentPeriodEnd: latest(paidTo, sub.trialEndsAt), plan: "PRO" } });
}

export async function setManualPlan(db: Db, workspaceId: string, plan: "FREE" | "PRO") {
  await locked(db, workspaceId, async (tx) => {
    if (await tx.billingAgreement.count({ where: { workspaceId, status: { not: "cancelled" } } })) throw new UserError("Primero cancelá los cobros de Mercado Pago antes de cambiar a un plan manual.");
    await tx.subscription.upsert({ where: { workspaceId }, create: { workspaceId, plan, status: "ACTIVE", provider: "manual" }, update: { plan, status: "ACTIVE", provider: "manual", providerRef: null, trialEndsAt: null, currentPeriodEnd: null, legacyPaidUntil: null, nextPaymentAt: null, canceledAt: null } });
  });
}

// Se usa también antes del borrado administrativo: todos los acuerdos, no solo el último.
export async function cancelSubscription(db: Db, ws: string) {
  await locked(db, ws, async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    const agreements = await tx.billingAgreement.findMany({ where: { workspaceId: ws, status: { not: "cancelled" } } });
    if (agreements.some((a) => !a.providerRef)) throw new UserError("Hay una autorización en verificación. Resolvela antes de dar de baja la cuenta.");
    const refs = new Set(agreements.map((a) => a.providerRef!));
    if (sub?.provider === "mercadopago" && sub.providerRef) refs.add(sub.providerRef);
    for (const ref of refs) await stopAgreement(ref);
    await tx.billingAgreement.updateMany({ where: { workspaceId: ws }, data: { status: "cancelled" } });
    if (sub) await tx.subscription.update({ where: { workspaceId: ws }, data: { status: "CANCELED", canceledAt: new Date(), nextPaymentAt: null } });
    if (refs.size) await queueBillingNotice(tx, ws, `cancel-${[...refs].sort().join("-")}`, "Cancelaste tu suscripción a somosguafra Pro", "No se programarán nuevos cobros. Conservás el acceso hasta el final del período ya cubierto, si corresponde.");
  });
  await drainEmailOutbox(db).catch((e) => console.error("[email outbox]", e));
}

export function validSignature(signature: string | null, requestId: string | null, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !signature || !requestId || !/^[\w-]{1,100}$/.test(dataId)) return false;
  const parts = Object.fromEntries(signature.split(",").map((p) => p.trim().split("=")));
  if (!/^\d{10,13}$/.test(parts.ts ?? "") || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return false;
  const ts = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
  if (Math.abs(Date.now() - ts) > 15 * 60_000) return false;
  const mine = createHmac("sha256", secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest("hex");
  return timingSafeEqual(Buffer.from(mine, "hex"), Buffer.from(parts.v1, "hex"));
}

async function applyPreapproval(db: Db, id: string) {
  const p = await mp<Preapproval>(`/preapproval/${identifier(id)}`);
  const ref = splitRef(p.external_reference);
  if (p.id !== id || !ref.ws || !["pending", "authorized", "paused", "cancelled"].includes(p.status)) throw new UserError("Estado de suscripción inválido.");
  const ws = ref.ws;
  if (!await db.workspace.findUnique({ where: { id: ws } })) return;
  await locked(db, ws, async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    let agreement = await tx.billingAgreement.findUnique({ where: { providerRef: id } });
    if (!agreement && ref.checkout) agreement = await tx.billingAgreement.findFirst({ where: { id: ref.checkout, workspaceId: ws, providerRef: null } });
    if (!agreement && sub?.providerRef === id) agreement = await tx.billingAgreement.create({ data: { workspaceId: ws, providerRef: id, cycle: sub.billingCycle ?? "monthly", amount: 0, status: "pending" } });
    if (!agreement || agreement.workspaceId !== ws) throw new UserError("Suscripción no reconocida.");
    if ((await tx.workspace.findUniqueOrThrow({ where: { id: ws } })).billingDisabledAt && p.status !== "cancelled") { await stopAgreement(id); await tx.billingAgreement.update({ where: { id: agreement.id }, data: { status: "cancelled", providerRef: id } }); return; }
    const stamp = date(p.last_modified);
    if (stamp && agreement.providerUpdatedAt && stamp < agreement.providerUpdatedAt) return;
    if (agreement.status === "cancelled" && p.status !== "cancelled") { await stopAgreement(id); return; }
    const recurring = p.auto_recurring;
    if (Number(agreement.amount) > 0 && (!recurring || Number(recurring.transaction_amount) !== Number(agreement.amount) || recurring.currency_id !== agreement.currency || recurring.frequency !== (agreement.cycle === "yearly" ? 12 : 1) || (recurring.frequency_type && recurring.frequency_type !== "months"))) throw new UserError("El importe o ciclo no coincide con lo contratado.");
    if (p.status === "authorized" && sub?.providerRef !== id) {
      const old = await tx.billingAgreement.findMany({ where: { workspaceId: ws, providerRef: { not: id }, status: { in: ["authorized", "paused"] } } });
      const oldRefs = new Set(old.map((a) => a.providerRef).filter((r): r is string => !!r));
      if (sub?.provider === "mercadopago" && sub.providerRef) oldRefs.add(sub.providerRef);
      // No aceptar un cambio mientras la renovación anterior pueda seguir cobrando.
      try {
        for (const oldRef of oldRefs) { await stopAgreement(oldRef); await tx.billingAgreement.updateMany({ where: { providerRef: oldRef }, data: { status: "cancelled" } }); }
      } catch (error) {
        // Si no se pudo detener el mensual, detener el nuevo anual para no dejar dos renovaciones.
        await stopAgreement(id).catch((e) => console.error("[billing] no se pudo detener el nuevo acuerdo; conciliación pendiente", e));
        throw error;
      }
    }
    if (p.status === "authorized" && agreement.couponCode && !agreement.couponCounted) {
      const coupon = await tx.coupon.findUnique({ where: { code: agreement.couponCode } });
      if (!coupon || !coupon.active || (coupon.maxUses != null && coupon.uses >= coupon.maxUses)) { await stopAgreement(id); throw new UserError("El cupón ya no está disponible."); }
      const claimed = await tx.coupon.updateMany({ where: { id: coupon.id, uses: coupon.uses }, data: { uses: { increment: 1 } } });
      if (!claimed.count) throw new UserError("El cupón se está usando en otra solicitud. Reintentá en un momento.");
    }
    await tx.billingAgreement.update({ where: { id: agreement.id }, data: { providerRef: id, status: p.status, providerUpdatedAt: stamp ?? undefined, couponCounted: agreement.couponCounted || p.status === "authorized", checkoutUrl: p.init_point ?? undefined } });
    // Un acuerdo viejo no puede reemplazar la suscripción actual al llegar tarde su webhook.
    if (sub?.providerRef && sub.providerRef !== id && p.status !== "authorized") return;
    if (p.status === "pending") return;
    const status = p.status === "cancelled" ? "CANCELED" : p.status === "authorized" ? "ACTIVE" : "PAST_DUE";
    await tx.subscription.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws, plan: "PRO", status, provider: "mercadopago", providerRef: id, billingCycle: agreement.cycle, nextPaymentAt: date(p.next_payment_date) }, update: { plan: "PRO", status, provider: "mercadopago", providerRef: id, billingCycle: agreement.cycle, couponCode: agreement.couponCode, nextPaymentAt: p.status === "authorized" ? date(p.next_payment_date) : null, canceledAt: p.status === "cancelled" ? new Date() : null } });
    await recalculateAccess(tx, ws);
    await queueBillingNotice(tx, ws, `subscription-${id}-${p.status}`, p.status === "authorized" ? "Suscripción autorizada · somosguafra Pro" : p.status === "cancelled" ? "Suscripción cancelada · somosguafra Pro" : "Suscripción pausada · somosguafra Pro", p.status === "authorized" ? "Mercado Pago autorizó la suscripción. Pro se habilita durante la prueba vigente o el período cubierto por un pago aprobado. Los cobros siguen el ciclo contratado." : "Los nuevos cobros se detuvieron. Conservás el acceso durante el período ya cubierto, si corresponde.");
  });
}

async function applyPayment(db: Db, id: string) {
  const pay = await mp<AuthorizedPayment>(`/authorized_payments/${identifier(id)}`);
  if (String(pay.id) !== id || !pay.preapproval_id) throw new UserError("Pago inválido.");
  // El cobro puede notificarse antes que la autorización. Conciliarla primero.
  await applyPreapproval(db, pay.preapproval_id);
  let agreement = await db.billingAgreement.findUnique({ where: { providerRef: pay.preapproval_id } });
  if (!agreement) { await applyPreapproval(db, pay.preapproval_id); agreement = await db.billingAgreement.findUnique({ where: { providerRef: pay.preapproval_id } }); }
  if (!agreement) throw new UserError("No encontramos la suscripción del pago.");
  const ws = agreement.workspaceId;
  // El estado del pago real es la autoridad para reembolsos/contracargos; el resumen puede quedar atrasado.
  const paymentId = pay.payment?.id ? String(pay.payment.id) : null;
  const payment = paymentId ? await mp<{ id: number | string; status: string; transaction_amount: number; transaction_amount_refunded?: number; currency_id: string; date_approved?: string; date_last_updated?: string }>(`/v1/payments/${identifier(paymentId)}`) : null;
  if (payment && String(payment.id) !== paymentId) throw new UserError("Pago inválido.");
  const status = payment?.status ?? pay.payment?.status ?? pay.status;
  const amount = Number(pay.transaction_amount);
  if (!Number.isFinite(amount) || amount <= 0 || pay.currency_id !== agreement.currency || (Number(agreement.amount) > 0 && amount !== Number(agreement.amount)) || (payment && (Number(payment.transaction_amount) !== amount || payment.currency_id !== pay.currency_id))) throw new UserError("El pago no coincide con la suscripción.");
  const refunded = Number(payment?.transaction_amount_refunded ?? (status === "refunded" ? amount : 0));
  if (!Number.isFinite(refunded) || refunded < 0 || refunded > amount) throw new UserError("Importe de devolución inválido.");
  const start = date(pay.debit_date) ?? date(payment?.date_approved) ?? date(pay.date_created);
  if (!start) throw new UserError("El pago no tiene fecha válida.");
  const stamp = date(payment?.date_last_updated) ?? date(pay.last_modified);
  await locked(db, ws, async (tx) => {
    const before = await tx.invoice.findUnique({ where: { providerRef: id } });
    if (before && before.workspaceId !== ws) throw new UserError("Pago de otro espacio.");
    if (stamp && before?.providerUpdatedAt && stamp < before.providerUpdatedAt) return;
    // Sin versión de proveedor, un estado final no puede volver a "approved" por un evento atrasado.
    if (!stamp && before && ["refunded", "charged_back", "cancelled"].includes(before.status) && status === "approved") return;
    const end = before?.periodEnd ?? paidUntil(start, agreement!.cycle);
    await tx.invoice.upsert({ where: { providerRef: id }, create: { workspaceId: ws, provider: "mercadopago", providerRef: id, agreementRef: pay.preapproval_id, paymentId, refundedAmount: refunded.toFixed(2), amount: amount.toFixed(2), currency: pay.currency_id, status, periodStart: start, periodEnd: end, paidAt: date(payment?.date_approved) ?? (status === "approved" ? start : null), providerUpdatedAt: stamp }, update: { status, refundedAmount: refunded.toFixed(2), agreementRef: pay.preapproval_id, paymentId, periodStart: start, periodEnd: end, providerUpdatedAt: stamp ?? undefined, paidAt: date(payment?.date_approved) ?? before?.paidAt ?? (status === "approved" ? start : null) } });
    if (["refunded", "charged_back", "cancelled"].includes(status)) {
      // Una devolución total revoca ese período, no otros pagos válidos.
      const sub = await tx.subscription.findUnique({ where: { workspaceId: ws } });
      if (sub?.legacyPaidUntil && sub.legacyPaidUntil <= end && sub.legacyPaidUntil > start) await tx.subscription.update({ where: { workspaceId: ws }, data: { legacyPaidUntil: null } });
    }
    const current = await tx.subscription.findUnique({ where: { workspaceId: ws } });
    if (status === "approved" && current && current.provider !== "mercadopago") {
      await tx.subscription.update({ where: { workspaceId: ws }, data: { plan: "PRO", provider: "mercadopago", providerRef: pay.preapproval_id, billingCycle: agreement!.cycle, status: agreement!.status === "authorized" ? "ACTIVE" : "PAST_DUE" } });
    }
    await recalculateAccess(tx, ws);
    if (["approved", "rejected", "refunded", "cancelled", "charged_back"].includes(status)) {
      if (status === "approved" && refunded > 0 && Number(before?.refundedAmount ?? 0) !== refunded) {
        await queueBillingNotice(tx, ws, `payment-${id}-partial-${Math.round(refunded * 100)}`, "Reembolso parcial · somosguafra Pro", `Mercado Pago registra una devolución parcial de ARS ${refunded.toFixed(2)} sobre este pago. El período de Pro se mantiene hasta su vencimiento original. La devolución no cancela las próximas renovaciones.`);
      }
      const label: Record<string, string> = { approved: "Pago aprobado", rejected: "Pago rechazado", refunded: "Pago reembolsado", cancelled: "Pago cancelado", charged_back: "Pago con contracargo" };
      const total = new Intl.NumberFormat("es-AR", { style: "currency", currency: pay.currency_id }).format(amount);
      const zone = (await tx.workspace.findUniqueOrThrow({ where: { id: ws }, select: { timezone: true } })).timezone;
      const untilLabel = new Intl.DateTimeFormat("es-AR", { timeZone: zone, dateStyle: "medium", timeStyle: "short" }).format(end);
      await queueBillingNotice(tx, ws, `payment-${id}-${status}`, `${label[status]} · somosguafra Pro`, `${label[status]} por ${total}. ${status === "approved" ? `El pago cubre el período hasta ${untilLabel} (${zone}).` : status === "rejected" ? "Revisá el medio de pago en Mercado Pago. No se extendió el período de acceso." : "El acceso se recalculó según los pagos que siguen vigentes. Esto no cancela por sí solo las próximas renovaciones; podés cancelarlas desde Tu plan."}`);
    }
  });
}

export async function applyNotification(db: Db, type: string, id: string) {
  if (type === "subscription_preapproval") await applyPreapproval(db, id);
  else if (type === "subscription_authorized_payment") await applyPayment(db, id);
  else if (type === "payment") {
    const results = await mp<{ results: AuthorizedPayment[] }>(`/authorized_payments/search?payment_id=${identifier(id)}`);
    for (const pay of results.results ?? []) if (String(pay.payment?.id) === id) await applyPayment(db, String(pay.id));
  }
  await drainEmailOutbox(db).catch((e) => console.error("[email outbox]", e));
}

// Recupera eventos perdidos consultando el estado actual; nunca genera pagos.
export async function reconcileBilling(db: Db, limit = 20) {
  if (!process.env.MP_ACCESS_TOKEN) return 0;
  const unresolved = await db.billingAgreement.findMany({ where: { providerRef: null, status: { in: ["creating", "uncertain"] } }, take: 3 });
  for (const a of unresolved) {
    const owner = await db.membership.findFirst({ where: { workspaceId: a.workspaceId, role: "OWNER" }, include: { user: { select: { email: true } } } });
    if (owner) await recoverPendingCheckout(db, a.workspaceId, owner.user.email).catch((e) => console.error("[billing checkout recovery]", e));
  }
  const agreements = await db.billingAgreement.findMany({ where: { providerRef: { not: null } }, orderBy: { updatedAt: "asc" }, take: limit });
  let n = 0;
  for (const a of agreements) {
    try {
      await applyPreapproval(db, a.providerRef!);
      const payments = await mp<{ results: AuthorizedPayment[] }>(`/authorized_payments/search?preapproval_id=${identifier(a.providerRef!)}&limit=100`);
      for (const p of payments.results ?? []) await applyPayment(db, String(p.id));
      n++;
    } catch (e) { await db.auditLog.create({ data: { workspaceId: a.workspaceId, action: "billing.reconcile_failed", entityId: a.providerRef, meta: { error: String(e).slice(0, 300) } } }); }
  }
  return n;
}
