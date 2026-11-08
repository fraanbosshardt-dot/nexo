// Suma un correo de Google a la lista blanca del panel interno.
// Uso: npm run admin -- tu@gmail.com [OWNER|SUPPORT|VIEWER]   (por defecto OWNER)
// En producción: node scripts/with-railway.mjs npm run admin -- tu@gmail.com
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const role = ["OWNER", "SUPPORT", "VIEWER"].includes((process.argv[3] ?? "").toUpperCase()) ? process.argv[3].toUpperCase() : "OWNER";
  if (!email.includes("@")) { console.error("Indicá el correo: npm run admin -- tu@gmail.com"); process.exit(1); }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 1 }) });
  await db.adminMember.upsert({ where: { email }, create: { email, role, addedBy: "script" }, update: { role } });
  console.log(`Listo: ${email} entra al panel (/admin/ingresar) con Google, con rol ${role}.`);
  await db.$disconnect();
}
main();
