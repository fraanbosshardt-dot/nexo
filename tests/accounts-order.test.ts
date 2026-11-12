// Orden de las cuentas elegido arrastrando.
import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, reorderAccounts } from "@/server/ledger";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, other: string;
const d = new Date("2026-11-01T00:00:00Z");
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "ord@test.com", name: "Olga", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  const u2 = await db.user.create({ data: { email: "ord2@test.com", name: "Otro", passwordHash: "" } });
  other = (await createWorkspaceForUser(db, u2.id)).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

const names = async () => (await db.account.findMany({ where: { workspaceId: ws }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] })).map((a) => a.name);

it("las cuentas nuevas van al final y el orden de un grupo se guarda sin tocar las demás", async () => {
  const mk = (name: string) => createAccount(db, ws, { name, type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d });
  const [a, , c] = [await mk("A"), await mk("Caja"), await mk("C")];
  expect(await names()).toEqual(["A", "Caja", "C"]);
  await reorderAccounts(db, ws, [c.id, a.id]); // se reordenan A y C (ocupan los lugares 1 y 3)
  expect(await names()).toEqual(["C", "Caja", "A"]);
});

it("no toca cuentas de otro espacio", async () => {
  const x = await createAccount(db, other, { name: "Ajena", type: "CASH", currency: "ARS", initialBalance: "0", initialDate: d });
  const before = x.position;
  await reorderAccounts(db, ws, [x.id]);
  expect((await db.account.findUniqueOrThrow({ where: { id: x.id } })).position).toBe(before);
});
