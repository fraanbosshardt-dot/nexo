// Base PostgreSQL real (PGlite en memoria) con la misma migración que producción.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export async function startTestDb() {
  const pg = await PGlite.create();
  const dir = join(process.cwd(), "prisma", "migrations");
  for (const m of readdirSync(dir).filter((d) => /^\d+_/.test(d)).sort()) {
    await pg.exec(readFileSync(join(dir, m, "migration.sql"), "utf8"));
  }
  const port = 56000 + Math.floor(Math.random() * 2000);
  const server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
  await server.start();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`, max: 1 }) });
  return {
    db,
    async stop() {
      await db.$disconnect();
      await server.stop();
      await pg.close();
    },
  };
}
