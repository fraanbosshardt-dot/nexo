// Marca a un usuario como administrador del panel interno.
// Uso: npm run admin -- tu@email.com
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) { console.error("Indicá el email: npm run admin -- tu@email.com"); process.exit(1); }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const u = await db.user.findUnique({ where: { email } });
  if (!u) { console.error(`No hay ningún usuario con ${email}. Creá la cuenta primero.`); process.exit(1); }
  await db.user.update({ where: { id: u.id }, data: { isAdmin: true } });
  console.log(`Listo: ${email} ya entra al panel interno en /admin.`);
  await db.$disconnect();
}
main();
