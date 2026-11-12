// Mejoras de la revisión: préstamo en el simulador y aviso de que no alcanza para lo que vence.
import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAccount, recordMovement } from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import { canAfford } from "@/server/forecast";
import { insights } from "@/server/insights";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, banco: string;
const today = new Date("2026-11-12T00:00:00Z");
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "rev@test.com", name: "Rita", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  banco = (await createAccount(db, ws, { name: "Banco", type: "CHECKING", currency: "ARS", initialBalance: "1000", initialDate: new Date("2026-11-01T00:00:00Z") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

it("un préstamo suma la plata ahora y resta las cuotas después", async () => {
  const r = await canAfford(db, ws, { currency: "ARS", today, price: "600", installments: 3, financedTotal: "900", firstDue: new Date("2026-12-10T00:00:00Z"), inflow: "600" });
  expect(r.rows[0].end.toNumber()).toBe(1600); // 1.000 + 600 que entran este mes
  expect(r.rows[3].end.toNumber()).toBe(700); // después de pagar las 3 cuotas de 300
});

it("avisa si lo que vence en 10 días es más que la plata de las cuentas", async () => {
  await recordMovement(db, ws, { kind: "EXPENSE", description: "Alquiler", amount: "1500", accountId: banco, status: "PENDING", dueDate: new Date("2026-11-15T00:00:00Z") });
  const list = await insights(db, ws, "ARS", today);
  const w = list.find((i) => /No te alcanza/.test(i.title));
  expect(w?.title).toMatch(/faltan \$\s?500/);
});
