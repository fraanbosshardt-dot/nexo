// A quién le llega un correo del panel. Solo cuentas activas que aceptan correos (emailReminders).
import type { PrismaClient } from "@/generated/prisma/client";
import { effectivePlan } from "./plans";

export const AUDIENCES: [string, string][] = [["all", "Todos"], ["free", "Plan Gratis"], ["pro", "Plan Pro"], ["inactive", "No entran hace 30 días"]];

export async function audienceUsers(db: PrismaClient, audience: string, now = new Date()) {
  const users = await db.user.findMany({
    where: { deletedAt: null, suspendedAt: null, emailReminders: true },
    select: { id: true, email: true, name: true, lastSeenAt: true, createdAt: true, memberships: { take: 1, orderBy: { createdAt: "asc" }, select: { workspace: { select: { country: true, subscription: true } } } } },
  });
  return users.filter((u) => {
    const ws = u.memberships[0]?.workspace;
    const plan = effectivePlan(ws?.subscription);
    if (audience === "free") return plan === "FREE";
    if (audience === "pro") return plan === "PRO";
    if (audience === "inactive") return (u.lastSeenAt ?? u.createdAt).getTime() < now.getTime() - 30 * 864e5;
    if (audience.startsWith("country:")) return ws?.country === audience.slice(8);
    return true;
  });
}
