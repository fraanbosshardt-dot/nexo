import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, payObligation } from "@/server/ledger";
import { materialize, projectedItems } from "@/server/recurring";
import { createGrainSale, setupMonthlyGrain } from "@/server/grain";
import { forecast } from "@/server/forecast";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, acc: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d("2026-11-08");
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "campo@test.com", name: "Papá", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

const sale = (collect: string, collected = false) => createGrainSale(db, ws, { saleDate: d(collect), grain: "Soja", tonnes: "30", pricePerTonne: "300000", priceCurrency: "ARS", taxPct: "1.2", collectDate: d(collect), accountId: acc, collected });
const planned = async () => (await projectedItems(db, ws, today, d("2027-12-31"))).filter((p) => p.description === "Venta de cereal (prevista)").map((p) => p.occurrence.toISOString().slice(0, 7));

describe("venta mensual de cereal", () => {
  it("se proyecta todos los meses y no se puede duplicar", async () => {
    const r = await setupMonthlyGrain(db, ws, { day: 15, amount: "8000000", accountId: acc, today });
    expect(r.variableAmount).toBe(true);
    expect(r.startDate.toISOString().slice(0, 10)).toBe("2026-11-15");
    await expect(setupMonthlyGrain(db, ws, { day: 10, amount: "1", accountId: acc, today })).rejects.toThrow(/Ya tenés/);
    expect((await planned()).slice(0, 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("la venta real reemplaza a la prevista de ese mes (guardada o proyectada) y no se cuenta dos veces", async () => {
    await materialize(db, ws, d("2026-12-23")); // noviembre y diciembre quedan guardados, como en la app
    const before = await forecast(db, ws, { currency: "ARS", today, months: 3, certainty: "prob" });
    const decBefore = before.rows.find((x) => x.period === "2026-12")!.pendingIn;
    await sale("2026-12-20"); // reemplaza diciembre (estaba guardado)
    await sale("2027-02-18"); // reemplaza febrero (estaba solo proyectado)
    const months = await planned();
    expect(months).not.toContain("2026-12");
    expect(months).not.toContain("2027-02");
    expect(months).toContain("2027-01");
    const after = await forecast(db, ws, { currency: "ARS", today, months: 3, certainty: "prob" });
    const decAfter = after.rows.find((x) => x.period === "2026-12")!.pendingIn;
    // Diciembre: sale la prevista (8.000.000) y entra la real (neto 8.892.000): no se suman las dos.
    expect(decAfter.minus(decBefore).toNumber()).toBeCloseTo(8892000 - 8000000, 0);
  });

  it("si la prevista del mes ya se cobró, la venta real no la toca", async () => {
    const nov = await db.obligation.findFirstOrThrow({ where: { workspaceId: ws, description: "Venta de cereal (prevista)", occurrenceDate: d("2026-11-15") } });
    await payObligation(db, ws, { obligationId: nov.id, accountId: acc, amount: "7500000", date: d("2026-11-15"), settle: true });
    await sale("2026-11-25", true);
    expect((await db.obligation.findUniqueOrThrow({ where: { id: nov.id } })).status).toBe("SETTLED");
  });
});
