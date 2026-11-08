// Da el plan Pro (sin vencimiento, asignado a mano) a la cuenta de un correo.
// Uso en producción: node scripts/with-railway.mjs npx tsx scripts/give-pro.mts correo@ejemplo.com
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) { console.error("Falta el correo."); process.exit(1); }
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "", max: 1 }) });
const user = await db.user.findUnique({ where: { email }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
if (!user) { console.log(`No hay ninguna cuenta con ${email}. Tiene que registrarse primero.`); await db.$disconnect(); process.exit(2); }
const ws = user.memberships[0]?.workspaceId;
if (!ws) { console.log("La cuenta no tiene espacio."); await db.$disconnect(); process.exit(3); }
await db.subscription.upsert({
  where: { workspaceId: ws },
  create: { workspaceId: ws, plan: "PRO", status: "ACTIVE", provider: "manual" },
  update: { plan: "PRO", status: "ACTIVE", provider: "manual", trialEndsAt: null, canceledAt: null },
});
await db.auditLog.create({ data: { action: "admin.plan_changed", workspaceId: ws, entity: "user", entityId: user.id, meta: { plan: "PRO", via: "script" } } });
console.log(`Listo: ${email} (${user.name}) ahora tiene Pro sin vencimiento.`);
await db.$disconnect();
