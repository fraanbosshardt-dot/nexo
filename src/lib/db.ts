import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForDb = globalThis as unknown as { somosguafraDb?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL. Mirá .env.example.");
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 5) });
  return new PrismaClient({ adapter });
}

// Se crea recién al primer uso, para que el build no necesite la base.
export function getDb(): PrismaClient {
  if (!globalForDb.somosguafraDb) globalForDb.somosguafraDb = createClient();
  return globalForDb.somosguafraDb;
}
