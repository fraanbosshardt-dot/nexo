// Copia de seguridad SOLO LECTURA: guarda todas las tablas en .data/backups/<fecha>.json (fuera de git).
// Uso: node scripts/with-railway.mjs npx tsx scripts/backup-db.mts
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"); // foto consistente, sin poder escribir
const { rows: tables } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
const dump: Record<string, unknown[]> = {};
let total = 0;
for (const { table_name } of tables) {
  const { rows } = await client.query(`SELECT * FROM "${table_name.replace(/"/g, "")}"`);
  dump[table_name] = rows;
  total += rows.length;
}
await client.query("COMMIT");
await client.end();
mkdirSync(".data/backups", { recursive: true });
const file = `.data/backups/nexo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), tables: dump }));
console.log(`Copia guardada: ${file} · ${tables.length} tablas · ${total} filas`);
