// Pro reservado por correo: si el panel guardó el correo, la cuenta nueva arranca con Pro.
import type { PrismaClient } from "@/generated/prisma/client";

export async function applyProGrant(db: PrismaClient, email: string, workspaceId: string) {
  const g = await db.proGrant.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!g || g.usedAt) return false;
  const trialEndsAt = g.days ? new Date(Date.now() + g.days * 864e5) : null;
  await db.$transaction([
    db.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, plan: "PRO", status: g.days ? "TRIALING" : "ACTIVE", provider: "manual", trialEndsAt },
      update: { plan: "PRO", status: g.days ? "TRIALING" : "ACTIVE", provider: "manual", trialEndsAt },
    }),
    db.proGrant.update({ where: { id: g.id }, data: { usedAt: new Date() } }),
    db.auditLog.create({ data: { action: "billing.pro_grant_used", workspaceId, meta: { email: g.email, days: g.days } } }),
  ]);
  return true;
}

// Regala Pro por N días a un espacio que ya existe (o sin vencimiento si days es null).
// No toca una suscripción paga activa: esa sigue como está.
export async function giftPro(db: PrismaClient, workspaceId: string, days: number | null) {
  return db.$transaction(async (tx) => {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
  const sub = await tx.subscription.findUnique({ where: { workspaceId } });
  if ((sub?.provider === "mercadopago" && (sub.status === "ACTIVE" || (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()))) || await tx.billingAgreement.count({ where: { workspaceId, status: { not: "cancelled" } } })) return "paga" as const;
  const base = sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date();
  const trialEndsAt = days ? new Date(base.getTime() + days * 864e5) : null;
  const data = { plan: "PRO" as const, status: (days ? "TRIALING" : "ACTIVE") as "TRIALING" | "ACTIVE", provider: "manual", trialEndsAt, canceledAt: null };
  await tx.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  return "ok" as const;
  });
}
