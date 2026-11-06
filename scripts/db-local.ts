// PostgreSQL local sin Docker: PGlite (Postgres compilado a WebAssembly) servido por TCP.
// Los datos quedan en .data/pglite. Uso: npm run db:local (dejalo corriendo en otra terminal).
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";

const port = Number(process.env.PGLITE_PORT ?? 5434);
const dataDir = process.env.PGLITE_DIR ?? ".data/pglite";

async function main() {
  mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  // PGlite es de una sola conexión; el servidor las multiplexa para que la app y las migraciones convivan.
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
  console.log(`PostgreSQL local listo en postgresql://postgres:postgres@localhost:${port}/postgres (datos en ${dataDir})`);
  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("No se pudo iniciar la base local:", err);
  process.exit(1);
});
