import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyNotification, cancelSubscription, reconcileWorkspaceBilling } from "@/server/billing";
import { effectivePlan } from "@/server/plans";
import type { Db } from "@/server/ledger";

vi.mock("@/server/billing-mail", () => ({ queueBillingNotice: vi.fn(async () => {}), drainEmailOutbox: vi.fn(async () => 0) }));

// All state and responses stay in memory. No database or network is used.
let local: any, remote: any, payment: any, invoice: any, agreement: any;
let pages = false;
let unconfirmedCancellation = false;
const calls: string[] = [];
const start = new Date("2026-11-14T12:00:00Z"), end = new Date("2026-12-14T12:00:00Z");
const patch = (target: any, data: any) => { for (const [k, value] of Object.entries(data)) if (value !== undefined) target[k] = value; return target; };
const memory: any = {
  $transaction: async (run: any) => run(memory), $queryRaw: async () => [],
  workspace: { findUnique: async () => ({ id: "space" }), findUniqueOrThrow: async () => ({ id: "space", timezone: "UTC", billingDisabledAt: null }) },
  subscription: { findUnique: async () => local, upsert: async ({ update }: any) => patch(local, update), update: async ({ data }: any) => patch(local, data) },
  billingAgreement: {
    findUnique: async () => agreement, findMany: async ({ where }: any) => where.providerRef?.not ? [] : [agreement],
    update: async ({ data }: any) => patch(agreement, data),
  },
  invoice: {
    findUnique: async () => invoice,
    findMany: async () => invoice?.status === "approved" ? [{ periodEnd: invoice.periodEnd }] : [],
    upsert: async ({ create, update }: any) => invoice ? patch(invoice, update) : (invoice = create),
  },
};

beforeEach(() => {
  calls.length = 0; pages = false; invoice = null; unconfirmedCancellation = false;
  local = { plan: "PRO", status: "ACTIVE", provider: "mercadopago", providerRef: "agreement", trialEndsAt: null, legacyPaidUntil: null, currentPeriodEnd: null, billingCycle: "monthly" };
  agreement = { id: "reservation", workspaceId: "space", providerRef: "agreement", amount: 7499, currency: "ARS", cycle: "monthly", status: "authorized", couponCode: null, couponCounted: false };
  remote = { id: "agreement", external_reference: "space||reservation", status: "authorized", next_payment_date: end.toISOString(), auto_recurring: { transaction_amount: 7499, currency_id: "ARS", frequency: 1, frequency_type: "months" } };
  payment = { id: "actual-payment", status: "approved", transaction_amount: 7499, currency_id: "ARS", transaction_amount_refunded: 0, date_approved: start.toISOString() };
  vi.stubEnv("MP_ACCESS_TOKEN", "in-memory-test-only");
  vi.stubGlobal("fetch", vi.fn(async (input: string, options?: RequestInit) => {
    const url = new URL(input); calls.push(url.pathname + url.search);
    if (options?.method === "PUT" && unconfirmedCancellation) return Response.json(remote);
    if (options?.method && options.method !== "GET") throw new Error("This fixture forbids provider writes");
    if (url.pathname === "/preapproval/agreement") return Response.json(remote);
    if (url.pathname === "/authorized_payments/charge") return Response.json({ id: "charge", preapproval_id: "agreement", transaction_amount: 7499, currency_id: "ARS", debit_date: start.toISOString(), payment: { id: "actual-payment", status: "approved" } });
    if (url.pathname === "/v1/payments/actual-payment") return Response.json(payment);
    if (url.pathname === "/authorized_payments/search") {
      const offset = Number(url.searchParams.get("offset"));
      const results = pages ? Array.from({ length: offset === 0 ? 100 : 1 }, () => ({ id: "charge" })) : [];
      return Response.json({ results, paging: { total: pages ? 101 : 0 } });
    }
    throw new Error("Unexpected request; real network is disabled");
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const db = memory as Db;

it("authorization alone does not grant a paid period", async () => {
  await applyNotification(db, "subscription_preapproval", "agreement");
  expect(effectivePlan(local, start)).toBe("FREE");
});

it("a successful HTTP response without confirmed cancellation cannot mark the plan as cancelled", async () => {
  unconfirmedCancellation = true;
  await expect(cancelSubscription(db, "space")).rejects.toThrow("no confirmó la cancelación");
  expect(local.status).toBe("ACTIVE");
  expect(agreement.status).toBe("authorized");
});

it.each(["pending", "rejected", "in_process"])("a %s payment cannot grant a paid period", async (status) => {
  payment.status = status;
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(effectivePlan(local, start)).toBe("FREE");
});

it("a full refunded amount removes access even before the provider changes approved to refunded", async () => {
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(effectivePlan(local, start)).toBe("PRO");
  payment.transaction_amount_refunded = 7499;
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(invoice.status).toBe("refunded");
  expect(effectivePlan(local, start)).toBe("FREE");
});

it("a partial refund preserves the original access period", async () => {
  payment.transaction_amount_refunded = 1000;
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(invoice.status).toBe("approved");
  expect(local.currentPeriodEnd).toEqual(end);
});

it("a duplicate notification cannot move the original expiration by one day", async () => {
  await applyNotification(db, "subscription_authorized_payment", "charge");
  remote.next_payment_date = "2026-12-15T12:00:00Z";
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(local.currentPeriodEnd).toEqual(end);
});

it("late events from a cancelled agreement preserve manually granted Pro", async () => {
  local.provider = "manual"; local.providerRef = null;
  remote.status = "cancelled"; agreement.status = "cancelled";
  await applyNotification(db, "subscription_preapproval", "agreement");
  await applyNotification(db, "subscription_authorized_payment", "charge");
  expect(local.provider).toBe("manual");
  expect(effectivePlan(local, start)).toBe("PRO");
});

it("a changed reservation reference cannot assign the agreement", async () => {
  remote.external_reference = "space||unrecognized-reservation";
  await expect(applyNotification(db, "subscription_preapproval", "agreement")).rejects.toThrow("referencia");
  expect(local.currentPeriodEnd).toBeNull();
});

it.each([1, 74990])("a payment for an unexpected amount %s cannot grant Pro", async (amount) => {
  payment.transaction_amount = amount;
  await expect(applyNotification(db, "subscription_authorized_payment", "charge")).rejects.toThrow("no coincide");
  expect(effectivePlan(local, start)).toBe("FREE");
});

it("workspace reconciliation follows pagination without creating or charging anything", async () => {
  pages = true;
  await reconcileWorkspaceBilling(db, "space");
  expect(calls.some(path => path.includes("offset=100"))).toBe(true);
  expect(local.currentPeriodEnd).toEqual(end);
});
