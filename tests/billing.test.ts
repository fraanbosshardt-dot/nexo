// Cobro de Pro con Mercado Pago (simulado): primer cobro al terminar la prueba, pasarse de mensual a anual
// sin cobro doble, y que el aviso de una suscripción vieja no pise la actual.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { applyNotification, startCheckout } from "@/server/billing";
import { effectivePlan, savePlanSettings, PRICES_DEFAULT } from "@/server/plans";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string;
const DAY = 864e5;
// Mercado Pago simulado: guarda lo que se le pide y responde con las suscripciones cargadas acá.
const preapprovals = new Map<string, Record<string, unknown>>();
const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
const fakeFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
  const path = url.replace("https://api.mercadopago.com", "");
  const body = init.body ? JSON.parse(String(init.body)) : null;
  calls.push({ method: init.method ?? "GET", path, body });
  if (path === "/preapproval" && init.method === "POST") return new Response(JSON.stringify({ id: "nueva", init_point: "https://mp.test/pagar" }));
  const id = path.split("/")[2];
  if (init.method === "PUT") { preapprovals.set(id, { ...preapprovals.get(id), ...body }); return new Response("{}"); }
  return new Response(JSON.stringify(preapprovals.get(id) ?? {}));
});

beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "pago@test.com", name: "Pago", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  await savePlanSettings(db, { freeAlso: [], prices: PRICES_DEFAULT, pricesArs: { monthly: 7499, yearly: 74990 } });
  process.env.MP_ACCESS_TOKEN = "TEST";
  vi.stubGlobal("fetch", fakeFetch);
}, 60_000);
afterAll(async () => { vi.unstubAllGlobals(); delete process.env.MP_ACCESS_TOKEN; await t.stop(); });
afterEach(() => { calls.length = 0; });

describe("suscribirse durante la prueba", () => {
  it("el primer cobro queda para el día que termina la prueba", async () => {
    const end = new Date(Date.now() + 10 * DAY);
    await startCheckout(db, ws, "pago@test.com", "monthly", "https://x/app", undefined, end);
    const sent = calls.find((c) => c.method === "POST")!.body as { auto_recurring: { start_date?: string; frequency: number } };
    expect(sent.auto_recurring.start_date).toBe(end.toISOString());
    expect(sent.auto_recurring.frequency).toBe(1);
  });

  it("si cancela antes del primer cobro, conserva Pro hasta el fin de la prueba", async () => {
    const end = new Date(Date.now() + 10 * DAY);
    await db.subscription.update({ where: { workspaceId: ws }, data: { plan: "PRO", status: "TRIALING", trialEndsAt: end } });
    preapprovals.set("m1", { id: "m1", status: "authorized", external_reference: ws, auto_recurring: { frequency: 1 } });
    await applyNotification(db, "subscription_preapproval", "m1");
    let sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.currentPeriodEnd?.getTime()).toBe(end.getTime());
    preapprovals.set("m1", { ...preapprovals.get("m1"), status: "cancelled" });
    await applyNotification(db, "subscription_preapproval", "m1");
    sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(sub.status).toBe("CANCELED");
    expect(effectivePlan(sub)).toBe("PRO");
    expect(effectivePlan(sub, new Date(end.getTime() + DAY))).toBe("FREE");
  });
});

describe("pasarse de mensual a anual", () => {
  it("cancela la mensual en Mercado Pago y el aviso de esa cancelación no pisa la anual", async () => {
    const paidTo = new Date(Date.now() + 20 * DAY);
    await db.subscription.update({ where: { workspaceId: ws }, data: { plan: "PRO", status: "ACTIVE", provider: "mercadopago", providerRef: "mensual", billingCycle: "monthly", currentPeriodEnd: paidTo, trialEndsAt: null, canceledAt: null } });
    preapprovals.set("anual", { id: "anual", status: "authorized", external_reference: ws, auto_recurring: { frequency: 12 } });
    await applyNotification(db, "subscription_preapproval", "anual");
    expect(calls.some((c) => c.method === "PUT" && c.path === "/preapproval/mensual" && c.body?.status === "cancelled")).toBe(true);
    let sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(sub.providerRef).toBe("anual");
    expect(sub.billingCycle).toBe("yearly");
    expect(sub.currentPeriodEnd?.getTime()).toBe(paidTo.getTime());
    // Llega el aviso de que la mensual quedó cancelada: no cambia nada.
    preapprovals.set("mensual", { id: "mensual", status: "cancelled", external_reference: ws, auto_recurring: { frequency: 1 } });
    await applyNotification(db, "subscription_preapproval", "mensual");
    sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    expect(sub.providerRef).toBe("anual");
    expect(sub.status).toBe("ACTIVE");
  });
});
