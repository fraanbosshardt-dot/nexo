// Buscador sin importar acentos ni mayúsculas: "credito" encuentra "Crédito". Devuelve ids; después se traen con Prisma.
import type { PrismaClient } from "@/generated/prisma/client";

// Misma normalización en JS (para el texto buscado) y en SQL (para las columnas).
export const normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FROM = "áàäâãéèëêíìïîóòöôõúùüûñç";
const TO = "aaaaaeeeeiiiiooooouuuunc";
const likeArg = (q: string) => `%${normText(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchIds(db: PrismaClient, ws: string, q: string) {
  const p = likeArg(q);
  const n = (col: string) => `translate(lower(coalesce(${col}, '')), '${FROM}', '${TO}') LIKE $2`;
  const ids = async (sql: string) => ((await db.$queryRawUnsafe(sql, ws, p)) as { id: string }[]).map((r) => r.id);
  const [tx, obl, accounts, cats, rules, debts, grain] = await Promise.all([
    ids(`SELECT t."id" FROM "Transaction" t LEFT JOIN "Category" c ON c."id" = t."categoryId" WHERE t."workspaceId" = $1 AND (${n('t."description"')} OR ${n('t."notes"')} OR ${n('c."name"')}) ORDER BY t."effectiveDate" DESC LIMIT 30`),
    ids(`SELECT "id" FROM "Obligation" WHERE "workspaceId" = $1 AND "status" IN ('PENDING','PARTIAL') AND ${n('"description"')} ORDER BY "dueDate" ASC LIMIT 15`),
    ids(`SELECT "id" FROM "Account" WHERE "workspaceId" = $1 AND ${n('"name"')} LIMIT 10`),
    ids(`SELECT "id" FROM "Category" WHERE "workspaceId" = $1 AND "archived" = false AND ${n('"name"')} LIMIT 10`),
    ids(`SELECT "id" FROM "RecurringRule" WHERE "workspaceId" = $1 AND ${n('"description"')} LIMIT 10`),
    ids(`SELECT "id" FROM "Debt" WHERE "workspaceId" = $1 AND (${n('"creditor"')} OR ${n('"kind"')}) LIMIT 10`),
    ids(`SELECT "id" FROM "GrainSale" WHERE "workspaceId" = $1 AND ${n('"grain"')} ORDER BY "saleDate" DESC LIMIT 10`),
  ]);
  return { tx, obl, accounts, cats, rules, debts, grain };
}
