// Números del negocio para el panel interno. Solo cuentas y totales: nunca montos de los clientes.
import type { PrismaClient } from "@/generated/prisma/client";
import { effectivePlan } from "./plans";

const DAY = 864e5;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);

// Cuántas unidades de una moneda vale 1 USD (la última cotización automática). USD = 1.
export async function usdRate(db: PrismaClient, currency: string): Promise<number | null> {
  if (currency === "USD") return 1;
  const r = await db.exchangeRate.findFirst({ where: { workspaceId: null, base: "USD", quote: currency }, orderBy: { fetchedAt: "desc" } });
  return r ? Number(r.sell) : null;
}
export async function toUsd(db: PrismaClient, amount: number, currency: string) {
  const r = await usdRate(db, currency);
  return r ? amount / r : null;
}

export async function overview(db: PrismaClient, prices: { monthly: number; yearly: number }, now = new Date()) {
  const [users, newWeek, newMonth, dau, mau, subs, openTickets, canceled30] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    db.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
    db.user.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.user.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
    db.subscription.findMany({ select: { plan: true, status: true, trialEndsAt: true, billingCycle: true, provider: true } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.subscription.count({ where: { provider: "mercadopago", canceledAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
  ]);
  const paid = subs.filter((s) => s.plan === "PRO" && s.status === "ACTIVE" && s.provider === "mercadopago");
  const gifted = subs.filter((s) => s.provider === "manual" && effectivePlan(s) === "PRO").length;
  const trials = subs.filter((s) => s.status === "TRIALING" && s.provider !== "manual" && s.trialEndsAt && s.trialEndsAt > now).length;
  const mrr = paid.reduce((t, s) => t + (s.billingCycle === "yearly" ? prices.yearly / 12 : prices.monthly), 0);
  const conversion = users ? (paid.length / users) * 100 : 0;
  const churn = paid.length + canceled30 ? (canceled30 / (paid.length + canceled30)) * 100 : 0;
  return { users, newWeek, newMonth, dau, mau, paid: paid.length, gifted, trials, mrr, conversion, churn, openTickets };
}

export async function signupsByDay(db: PrismaClient, days = 30, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY);
  const rows = await db.user.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true } });
  const out = Array.from({ length: days }, (_, i) => ({ key: ymd(new Date(from.getTime() + i * DAY)), n: 0 }));
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const r of rows) { const i = idx.get(ymd(r.createdAt)); if (i !== undefined) out[i].n++; }
  return out;
}

// Cobrado por mes (pagos aprobados), pasado a dólares con la última cotización.
export async function revenueByMonth(db: PrismaClient, months = 6, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const inv = await db.invoice.findMany({ where: { status: "approved", paidAt: { gte: from } }, select: { amount: true, currency: true, paidAt: true } });
  const keys = Array.from({ length: months }, (_, i) => ym(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1))));
  const out = keys.map((key) => ({ key, n: 0, count: 0 }));
  const rates = new Map<string, number | null>();
  for (const i of inv) {
    if (!rates.has(i.currency)) rates.set(i.currency, await usdRate(db, i.currency));
    const r = rates.get(i.currency);
    const row = out.find((o) => o.key === ym(i.paidAt!));
    if (!row) continue;
    row.count++;
    if (r) row.n += Number(i.amount) / r;
  }
  return out.map((o) => ({ ...o, n: Math.round(o.n * 100) / 100 }));
}

export async function funnel(db: PrismaClient) {
  const [signed, onboarded, moved, users] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.workspace.count({ where: { onboardedAt: { not: null } } }),
    db.transaction.findMany({ distinct: ["workspaceId"], select: { workspaceId: true } }),
    db.user.findMany({ where: { deletedAt: null, lastSeenAt: { not: null } }, select: { createdAt: true, lastSeenAt: true } }),
  ]);
  const returned = users.filter((u) => u.lastSeenAt!.getTime() - u.createdAt.getTime() >= 7 * DAY).length;
  return [
    { label: "Se registraron", n: signed },
    { label: "Terminaron la bienvenida", n: onboarded },
    { label: "Cargaron un movimiento", n: moved.length },
    { label: "Volvieron después de 7 días", n: returned },
  ];
}

export async function byCountry(db: PrismaClient, top = 6) {
  const g = await db.workspace.groupBy({ by: ["country"], _count: { _all: true } });
  const sorted = g.map((x) => ({ key: x.country, n: x._count._all })).sort((a, b) => b.n - a.n);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((t, x) => t + x.n, 0);
  return rest ? [...head, { key: "OTROS", n: rest }] : head;
}

export async function signupMethods(db: PrismaClient, days = 30, now = new Date()) {
  const since = new Date(now.getTime() - days * DAY);
  const [google, email] = await Promise.all([
    db.auditLog.count({ where: { action: "auth.signup", createdAt: { gte: since }, meta: { path: ["via"], equals: "google" } } }),
    db.auditLog.count({ where: { action: "auth.signup", createdAt: { gte: since }, NOT: { meta: { path: ["via"], equals: "google" } } } }),
  ]);
  return { google, email };
}

// Costos de la empresa por mes, en dólares.
export async function monthlyCostsUsd(db: PrismaClient) {
  const costs = await db.companyCost.findMany({ where: { active: true } });
  let total = 0, unknown = 0;
  for (const c of costs) {
    const perMonth = Number(c.amount) / (c.period === "yearly" ? 12 : 1);
    const usd = await toUsd(db, perMonth, c.currency);
    if (usd === null) unknown++; else total += usd;
  }
  return { total: Math.round(total * 100) / 100, unknown, items: costs };
}
