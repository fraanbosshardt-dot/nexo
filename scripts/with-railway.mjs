// Corre un comando usando la base de Railway de .env.railway (sin mostrar la dirección).
// Uso: node scripts/with-railway.mjs npx prisma migrate deploy
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const m = readFileSync(".env.railway", "utf8").match(/^DATABASE_URL="?([^"\r\n]*)"?/m);
const url = m?.[1];
if (!url || url.includes("${{")) { console.error("Falta la dirección de Railway en .env.railway."); process.exit(1); }
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, DATABASE_URL: url, DB_POOL_MAX: "3" } });
process.exit(r.status ?? 1);
