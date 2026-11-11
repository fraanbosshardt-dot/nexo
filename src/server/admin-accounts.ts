// Cupones, exportación de datos y borrado de cuentas (derechos de la Ley 25.326).
import type { PrismaClient } from "@/generated/prisma/client";

// ---------- Cupones ----------
export const normCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);

export async function checkCoupon(db: PrismaClient, raw: string, now = new Date()) {
  const code = normCode(raw);
  if (!code) return { ok: false as const, error: "Escribí el código del cupón." };
  const c = await db.coupon.findUnique({ where: { code } });
  if (!c || !c.active) return { ok: false as const, error: "Ese cupón no existe o ya no está activo." };
  if (c.expiresAt && c.expiresAt < now) return { ok: false as const, error: "Ese cupón ya venció." };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { ok: false as const, error: "Ese cupón ya se usó todas las veces posibles." };
  return { ok: true as const, coupon: c };
}

export const discounted = (price: number, percentOff: number) => Math.round(price * (100 - Math.min(100, Math.max(0, percentOff)))) / 100;

// ---------- Exportar datos de una cuenta ----------
export async function exportAccountData(db: PrismaClient, userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true, emailVerified: true, emailReminders: true, totpEnabledAt: true, lastSeenAt: true, memberships: { select: { workspaceId: true, role: true } } },
  });
  const spaces = [];
  for (const m of user.memberships) {
    const where = { workspaceId: m.workspaceId };
    spaces.push({
      workspace: await db.workspace.findUnique({ where: { id: m.workspaceId } }),
      role: m.role,
      subscription: await db.subscription.findUnique({ where }),
      accounts: await db.account.findMany({ where }),
      categories: await db.category.findMany({ where }),
      transactions: await db.transaction.findMany({ where }),
      obligations: await db.obligation.findMany({ where, include: { payments: true } }),
      recurringRules: await db.recurringRule.findMany({ where }),
      debts: await db.debt.findMany({ where, include: { schedule: true } }),
      creditCards: await db.creditCard.findMany({ where, include: { statements: true, plans: true } }),
      budgets: await db.budget.findMany({ where, include: { lines: true } }),
      goals: await db.goal.findMany({ where, include: { contributions: true } }),
      investments: await db.investment.findMany({ where, include: { movements: true, valuations: true } }),
      assets: await db.asset.findMany({ where, include: { valuations: true } }),
      grainSales: await db.grainSale.findMany({ where }),
      manualRates: await db.exchangeRate.findMany({ where }),
      invoices: await db.invoice.findMany({ where }),
    });
  }
  const tickets = await db.supportTicket.findMany({ where: { userId } });
  return { exportedAt: new Date().toISOString(), user, spaces, supportTickets: tickets };
}

// ---------- Borrar una cuenta ----------
// Borra los espacios de la persona (los que es dueña, aunque los haya compartido, y donde es la única integrante),
// con todo su contenido, y después la cuenta. De los espacios de otros solo se va (se borra su membresía).
// La auditoría queda sin el vínculo a la persona (la relación es SetNull).
export async function deleteAccount(db: PrismaClient, userId: string) {
  const ms = await db.membership.findMany({ where: { userId }, include: { workspace: { include: { _count: { select: { members: true } } } } } });
  const solo = ms.filter((m) => m.role === "OWNER" || m.workspace._count.members <= 1).map((m) => m.workspaceId);
  await db.$transaction(async (tx) => {
    for (const ws of solo) {
      const where = { workspaceId: ws };
      // Primero lo que depende de otras tablas del mismo espacio, después el resto.
      await tx.transaction.deleteMany({ where });
      await tx.obligation.deleteMany({ where });
      await tx.recurringRule.deleteMany({ where });
      await tx.debt.deleteMany({ where });
      await tx.creditCard.deleteMany({ where });
      await tx.budget.deleteMany({ where });
      await tx.goal.deleteMany({ where });
      await tx.investment.deleteMany({ where });
      await tx.asset.deleteMany({ where });
      await tx.grainSale.deleteMany({ where });
      await tx.importBatch.deleteMany({ where });
      await tx.account.deleteMany({ where });
      await tx.category.deleteMany({ where: { workspaceId: ws, parentId: { not: null } } });
      await tx.category.deleteMany({ where });
      await tx.workspace.delete({ where: { id: ws } });
    }
    await tx.user.delete({ where: { id: userId } });
  });
  return { deletedSpaces: solo.length };
}
