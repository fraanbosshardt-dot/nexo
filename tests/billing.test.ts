import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { applyNotification, cancelSubscription, startCheckout, setManualPlan } from "@/server/billing";
import { effectivePlan, paidUntil, savePlanSettings, startFreeTrial, PRICES_DEFAULT } from "@/server/plans";
import { deleteAccount } from "@/server/admin-accounts";

let t: Awaited<ReturnType<typeof startTestDb>>, ws: string, userId: string;
const agreements = new Map<string, Record<string, any>>(), payments = new Map<string, Record<string, any>>();
const calls: { method: string; path: string; body?: any }[] = [];
let failCancel = "", sequence = 0;
const DAY = 864e5;
const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
  const path = url.replace("https://api.mercadopago.com", ""), method = init.method ?? "GET";
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ path, method, body });
  if (path === "/preapproval" && method === "POST") {
    const id = `checkout-${++sequence}`;
    const p = { ...body, id, init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}` };
    agreements.set(id, p); return Response.json(p);
  }
  if (path.startsWith("/preapproval/")) {
    const id = path.split("/")[2], p = agreements.get(id);
    if (!p) return new Response("missing", { status: 404 });
    if (method === "PUT") { if (failCancel === id) return new Response("fail", { status: 503 }); Object.assign(p, body); }
    return Response.json(p);
  }
  if (path.startsWith("/authorized_payments/search")) {
    const q = new URL(url).searchParams;
    return Response.json({ results: [...payments.values()].filter(p => q.has("payment_id") ? String(p.payment?.id) === q.get("payment_id") : p.preapproval_id === q.get("preapproval_id")) });
  }
  if (path.startsWith("/authorized_payments/")) return Response.json(payments.get(path.split("/")[2]) ?? {});
  if (path.startsWith("/v1/payments/")) {
    const p = [...payments.values()].find(p => String(p.payment?.id) === path.split("/")[3]);
    return Response.json({ id: p?.payment?.id, status: p?.payment?.status, transaction_amount: Number(p?.transaction_amount), transaction_amount_refunded: p?.refunded ?? 0, currency_id: "ARS", date_approved: p?.debit_date, date_last_updated: p?.paymentUpdated });
  }
  throw new Error(`Unexpected request: ${url}`);
});

beforeAll(async () => {
  t = await startTestDb();
  await savePlanSettings(t.db, { freeAlso: [], prices: PRICES_DEFAULT, pricesArs: { monthly: 7499, yearly: 74990 } });
  vi.stubEnv("MP_ACCESS_TOKEN", "LOCAL-TEST"); vi.stubEnv("MP_WEBHOOK_SECRET", "LOCAL-SECRET"); vi.stubEnv("RESEND_API_KEY", "");
  vi.stubGlobal("fetch", fetchMock);
});
beforeEach(async () => {
  const user = await t.db.user.create({ data: { email: `billing-${++sequence}@test.com`, name: "Test", passwordHash: "" } });
  userId = user.id; ws = (await createWorkspaceForUser(t.db, user.id)).id;
  calls.length = 0; failCancel = "";
});
afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await t.stop(); });

async function checkout(cycle: "monthly" | "yearly" = "monthly", start?: Date) {
  const url = await startCheckout(t.db, ws, "test@test.com", cycle, "https://somosguafra.com/app", undefined, start);
  return new URL(url).searchParams.get("preapproval_id")!;
}
async function authorize(id: string) {
  agreements.get(id)!.status = "authorized";
  await applyNotification(t.db, "subscription_preapproval", id);
}
async function pay(id: string, agreement: string, status = "approved", start = new Date()) {
  const a = agreements.get(agreement)!;
  payments.set(id, { id, preapproval_id: agreement, transaction_amount: a.auto_recurring.transaction_amount, currency_id: "ARS", debit_date: start.toISOString(), date_created: new Date(start.getTime() - DAY).toISOString(), payment: { id: `real-${id}`, status } });
  await applyNotification(t.db, "subscription_authorized_payment", id);
}
const sub = () => t.db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });

describe("ciclo completo de suscripción", () => {
  it("recibir el pago antes del webhook de autorización habilita el período correcto", async () => {
    const id = await checkout(); agreements.get(id)!.status = "authorized";
    await pay("out-of-order", id);
    expect(effectivePlan(await sub())).toBe("PRO");
  });
  it("la prueba dura 14 días, es de un solo uso y no pisa pagos", async () => {
    const before = Date.now();
    expect(await startFreeTrial(t.db, ws)).toBe(true);
    expect((await sub()).trialEndsAt!.getTime()).toBeGreaterThanOrEqual(before + 14 * DAY);
    expect(await startFreeTrial(t.db, ws)).toBe(false);
    const id = await checkout(); await authorize(id);
    expect(await startFreeTrial(t.db, ws)).toBe(false);
  });
  it("una autorización en curso impide cambiar a un plan manual", async () => {
    const id = await checkout(); await authorize(id);
    await expect(setManualPlan(t.db, ws, "PRO")).rejects.toThrow("Primero cancelá");
    expect((await sub()).provider).toBe("mercadopago");
    await cancelSubscription(t.db, ws); await setManualPlan(t.db, ws, "PRO");
    expect((await sub()).provider).toBe("manual");
  });
  it("autorizar sin pago no regala Pro; el pago aprobado sí", async () => {
    const id = await checkout(); await authorize(id);
    expect(effectivePlan(await sub())).toBe("FREE");
    await pay("first", id);
    expect(effectivePlan(await sub())).toBe("PRO");
    expect((await sub()).currentPeriodEnd).not.toBeNull();
  });
  it("reutiliza el mismo checkout y evita altas duplicadas", async () => {
    const id = await checkout(); expect(await checkout()).toBe(id);
    expect(calls.filter(c => c.method === "POST")).toHaveLength(1);
  });
  it("serializa dos solicitudes concurrentes sin crear dos autorizaciones", async () => {
    const result = await Promise.allSettled([checkout(), checkout()]);
    expect(result.filter(r => r.status === "fulfilled").length).toBeGreaterThan(0);
    expect(calls.filter(c => c.method === "POST")).toHaveLength(1);
  });
  it("no cobra antes de la prueba, incluso si le quedan minutos", async () => {
    const end = new Date(Date.now() + 10 * 60_000);
    await t.db.subscription.update({ where: { workspaceId: ws }, data: { plan: "PRO", status: "TRIALING", trialEndsAt: end } });
    const id = await checkout();
    expect(agreements.get(id)!.auto_recurring.start_date).toBe(end.toISOString());
    await authorize(id); await cancelSubscription(t.db, ws);
    expect(effectivePlan(await sub())).toBe("PRO");
    expect(effectivePlan(await sub(), end)).toBe("FREE");
  });
  it("cancelar conserva exactamente el período cubierto y no cobra otro", async () => {
    const id = await checkout(); await authorize(id); await pay("cancel-paid", id);
    const until = (await sub()).currentPeriodEnd!;
    await cancelSubscription(t.db, ws); await cancelSubscription(t.db, ws);
    expect(agreements.get(id)!.status).toBe("cancelled");
    expect((await sub()).currentPeriodEnd).toEqual(until);
    expect(effectivePlan(await sub())).toBe("PRO");
    expect(effectivePlan(await sub(), until)).toBe("FREE");
  });
  it("la renovación duplicada no suma dos meses", async () => {
    const id = await checkout(); await authorize(id);
    const start = new Date(); await pay("renew", id, "approved", start);
    const until = (await sub()).currentPeriodEnd;
    await applyNotification(t.db, "subscription_authorized_payment", "renew");
    expect((await sub()).currentPeriodEnd).toEqual(until);
    expect(await t.db.invoice.count({ where: { workspaceId: ws } })).toBe(1);
  });
  it("un rechazo no corta otro período pagado ni extiende la fecha", async () => {
    const id = await checkout(); await authorize(id); await pay("good", id);
    const until = (await sub()).currentPeriodEnd!;
    await pay("bad", id, "rejected", until);
    expect((await sub()).currentPeriodEnd).toEqual(until);
    expect(effectivePlan(await sub(), until)).toBe("FREE");
  });
  it("una devolución total revoca su período", async () => {
    const id = await checkout(); await authorize(id); await pay("refund", id);
    payments.get("refund")!.payment.status = "refunded";
    await applyNotification(t.db, "payment", "real-refund");
    expect(effectivePlan(await sub())).toBe("FREE");
  });
  it("una devolución parcial mantiene el período y conserva el importe devuelto", async () => {
    const id = await checkout(); await authorize(id); await pay("partial", id);
    const until = (await sub()).currentPeriodEnd;
    payments.get("partial")!.refunded = 1000;
    await applyNotification(t.db, "subscription_authorized_payment", "partial");
    expect((await sub()).currentPeriodEnd).toEqual(until);
    expect(Number((await t.db.invoice.findUniqueOrThrow({ where: { providerRef: "partial" } })).refundedAmount)).toBe(1000);
    expect(await t.db.emailOutbox.count({ where: { workspaceId: ws, subject: "Reembolso parcial · somosguafra Pro" } })).toBe(1);
  });
  it("un aprobado atrasado sin versión no revierte un reembolso final", async () => {
    const id = await checkout(); await authorize(id); await pay("terminal", id);
    payments.get("terminal")!.payment.status = "refunded";
    await applyNotification(t.db, "subscription_authorized_payment", "terminal");
    payments.get("terminal")!.payment.status = "approved";
    await applyNotification(t.db, "subscription_authorized_payment", "terminal");
    expect(effectivePlan(await sub())).toBe("FREE");
  });
  it("devolver un pago anterior no revoca una renovación válida", async () => {
    const id = await checkout(); await authorize(id); await pay("old", id, "approved", new Date(Date.now() - 40 * DAY)); await pay("new", id);
    const until = (await sub()).currentPeriodEnd;
    payments.get("old")!.payment.status = "refunded";
    await applyNotification(t.db, "subscription_authorized_payment", "old");
    expect((await sub()).currentPeriodEnd).toEqual(until);
  });
  it("un contracargo no deja acceso indefinido", async () => {
    const id = await checkout(); await authorize(id); await pay("chargeback", id);
    payments.get("chargeback")!.payment.status = "charged_back";
    await applyNotification(t.db, "subscription_authorized_payment", "chargeback");
    expect(effectivePlan(await sub())).toBe("FREE");
  });
  it("pasar a anual empieza al terminar lo pagado y cancela mensual", async () => {
    const monthly = await checkout(); await authorize(monthly); await pay("monthly", monthly);
    const until = (await sub()).currentPeriodEnd!;
    const yearly = await checkout("yearly");
    expect(agreements.get(yearly)!.auto_recurring.start_date).toBe(until.toISOString());
    await authorize(yearly);
    expect(agreements.get(monthly)!.status).toBe("cancelled");
    await applyNotification(t.db, "subscription_preapproval", monthly);
    expect((await sub()).providerRef).toBe(yearly);
    expect((await sub()).currentPeriodEnd).toEqual(until);
    await pay("annual", yearly, "approved", until);
    expect((await sub()).currentPeriodEnd).toEqual(paidUntil(until, "yearly"));
  });
  it("si no se puede detener el acuerdo anterior no confirma el cambio", async () => {
    const monthly = await checkout(); await authorize(monthly); await pay("switch", monthly);
    const yearly = await checkout("yearly"); failCancel = monthly;
    await expect(authorize(yearly)).rejects.toThrow("Mercado Pago");
    expect((await sub()).providerRef).toBe(monthly);
    failCancel = ""; await authorize(yearly);
    expect((await sub()).providerRef).toBe(yearly);
  });
  it("un webhook viejo no revive un acuerdo cancelado", async () => {
    const id = await checkout(); await authorize(id); await cancelSubscription(t.db, ws);
    agreements.get(id)!.status = "authorized";
    await applyNotification(t.db, "subscription_preapproval", id);
    expect(agreements.get(id)!.status).toBe("cancelled");
    expect((await sub()).status).toBe("CANCELED");
  });
  it("verifica importe y moneda antes de habilitar Pro", async () => {
    const id = await checkout(); await authorize(id);
    payments.set("wrong", { id: "wrong", preapproval_id: id, transaction_amount: 1, currency_id: "ARS", debit_date: new Date().toISOString(), payment: { status: "approved" } });
    await expect(applyNotification(t.db, "subscription_authorized_payment", "wrong")).rejects.toThrow("no coincide");
    expect(effectivePlan(await sub())).toBe("FREE");
  });
  it("al borrar desde administración detiene todos los cobros", async () => {
    const id = await checkout(); await authorize(id); await pay("deleted", id);
    await deleteAccount(t.db, userId);
    expect(agreements.get(id)!.status).toBe("cancelled");
    expect(await t.db.user.findUnique({ where: { id: userId } })).toBeNull();
  });
  it("un fallo de cancelación impide borrar la cuenta y conserva el vínculo", async () => {
    const id = await checkout(); await authorize(id); failCancel = id;
    await expect(deleteAccount(t.db, userId)).rejects.toThrow("Mercado Pago");
    expect(await sub()).not.toBeNull();
    expect(await t.db.user.findUnique({ where: { id: userId } })).not.toBeNull();
    await expect(checkout()).rejects.toThrow("proceso de baja");
  });
});

describe("fechas y límites exactos", () => {
  it("respeta el día local del proveedor cuando el débito cruza medianoche UTC", () => {
    expect(paidUntil(new Date("2027-02-28T23:00:00-03:00"), "monthly", -180).toISOString()).toBe("2027-03-29T02:00:00.000Z");
  });
  it("usa el próximo débito informado por el proveedor y no lo mueve por un reenvío", async () => {
    const id = await checkout(); await authorize(id);
    const start = new Date("2027-02-28T23:00:00-03:00"), next = new Date("2027-03-28T23:00:00-03:00");
    agreements.get(id)!.next_payment_date = next.toISOString();
    await pay("provider-period", id, "approved", start);
    expect((await sub()).currentPeriodEnd).toEqual(next);
    agreements.get(id)!.next_payment_date = "2027-04-29T02:00:00Z";
    await applyNotification(t.db, "subscription_authorized_payment", "provider-period");
    expect((await sub()).currentPeriodEnd).toEqual(next);
  });
  it.each([["2027-01-31", "monthly", "2027-02-28"], ["2028-01-31", "monthly", "2028-02-29"], ["2028-02-29", "yearly", "2029-02-28"], ["2026-12-31", "monthly", "2027-01-31"]])("%s + %s termina %s", (from, cycle, until) => {
    expect(paidUntil(new Date(`${from}T15:42:00Z`), cycle).toISOString()).toBe(`${until}T15:42:00.000Z`);
  });
  it("un ACTIVE de MP vencido es Gratis; una concesión manual permanente sigue Pro", () => {
    const now = new Date();
    expect(effectivePlan({ plan: "PRO", status: "ACTIVE", provider: "mercadopago", trialEndsAt: null, currentPeriodEnd: now }, now)).toBe("FREE");
    expect(effectivePlan({ plan: "PRO", status: "ACTIVE", provider: "manual", trialEndsAt: null }, now)).toBe("PRO");
  });
});
