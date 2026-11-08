// Solo lectura: dice si existe una cuenta con cada correo (sí/no) y si ya tiene Pro. No modifica nada.
// Uso: node scripts/with-railway.mjs npx tsx scripts/check-email.mts a@b.com c@d.com
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "", max: 1 }) });
for (const raw of process.argv.slice(2)) {
  const email = raw.trim().toLowerCase();
  const u = await db.user.findUnique({ where: { email }, select: { memberships: { take: 1, select: { workspace: { select: { subscription: { select: { plan: true, status: true } } } } } } } });
  const sub = u?.memberships[0]?.workspace.subscription;
  console.log(`${email}: ${u ? "tiene cuenta" : "no tiene cuenta"}${u ? ` · plan ${sub?.plan ?? "FREE"}${sub ? ` (${sub.status})` : ""}` : ""}`);
}
console.log(`Cuentas en total: ${await db.user.count()}`);
await db.$disconnect();
