import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount } from "@/server/ledger";
import { projectedItems } from "@/server/recurring";
import { changeMonthlyGrain, coverOlderSales, createGrainSale, deleteGrainSale, monthlyGrainRules, setupMonthlyGrain, stopMonthlyGrain, updateGrainSale, type GrainInput } from "@/server/grain";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, acc: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d("2026-11-08");
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "editar@test.com", name: "Papá", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

const input = (collect: string, over: Partial<GrainInput> = {}): GrainInput => ({ saleDate: d(collect), grain: "Soja", tonnes: "10", pricePerTonne: "100000", priceCurrency: "ARS", taxPct: "0", collectDate: d(collect), accountId: acc, collected: false, ...over });
const balance = async () => Number((await accountBalances(db, ws)).get(acc)?.toString() ?? 0);
// Meses en que cuenta la venta prevista: las que ya están guardadas como pendientes y las proyectadas.
const plannedMonths = async () => {
  const saved = await db.obligation.findMany({ where: { workspaceId: ws, description: "Venta de cereal (prevista)", status: "PENDING", dueDate: { gte: today } } });
  const proj = (await projectedItems(db, ws, today, d("2027-06-30"))).filter((p) => p.description === "Venta de cereal (prevista)");
  return [...new Set([...saved.map((o) => o.dueDate.toISOString().slice(0, 7)), ...proj.map((p) => p.occurrence.toISOString().slice(0, 7))])].sort();
};

describe("editar y borrar ventas de cereal", () => {
  it("una venta cargada antes de la mensual deja de contarse dos veces", async () => {
    const old = await createGrainSale(db, ws, input("2026-12-10")); // como la de tu papá: antes de la mensual
    await db.grainSale.update({ where: { id: old.id }, data: { createdAt: d("2026-11-01") } });
    await setupMonthlyGrain(db, ws, { day: 15, amount: "500000", accountId: acc, today });
    expect(await plannedMonths()).not.toContain("2026-12");
    expect(await coverOlderSales(db, ws, today)).toBe(0); // ya estaba cubierta: no hace nada
  });

  it("editar una venta por cobrar actualiza el cobro y puede moverla de mes", async () => {
    const s = await db.grainSale.findFirstOrThrow({ where: { workspaceId: ws } });
    await updateGrainSale(db, ws, s.id, input("2027-01-12", { tonnes: "20" }));
    const ob = await db.obligation.findUniqueOrThrow({ where: { id: s.obligationId! } });
    expect(Number(ob.amount)).toBe(2000000);
    expect(ob.dueDate.toISOString().slice(0, 10)).toBe("2027-01-12");
    const months = await plannedMonths();
    expect(months).toContain("2026-12"); // la prevista de diciembre vuelve
    expect(months).not.toContain("2027-01"); // y enero queda cubierto por la real
  });

  it("editar una venta cobrada corrige el ingreso y el saldo", async () => {
    const s = await createGrainSale(db, ws, input("2026-11-05", { collected: true }));
    expect(await balance()).toBe(1000000);
    await updateGrainSale(db, ws, s.id, input("2026-11-06", { tonnes: "12", collected: true }));
    expect(await balance()).toBe(1200000);
  });

  it("no deja bajar el neto por debajo de lo ya cobrado en parte", async () => {
    const s = await createGrainSale(db, ws, input("2027-03-10"));
    const { payObligation } = await import("@/server/ledger");
    await payObligation(db, ws, { obligationId: s.obligationId!, accountId: acc, amount: "600000", date: d("2027-03-10") });
    await expect(updateGrainSale(db, ws, s.id, input("2027-03-10", { tonnes: "5" }))).rejects.toThrow(/Ya cobraste/);
  });

  it("borrar una venta cobrada anula el cobro y el saldo vuelve", async () => {
    const before = await balance();
    const s = await db.grainSale.findFirstOrThrow({ where: { workspaceId: ws, collectDate: d("2026-11-06") } });
    const r = await deleteGrainSale(db, ws, s.id);
    expect(r.reversed.toNumber()).toBe(1200000);
    expect(await balance()).toBe(before - 1200000);
    expect(await db.grainSale.count({ where: { id: s.id } })).toBe(0);
  });

  it("borrar una venta por cobrar la saca del flujo y la prevista del mes vuelve", async () => {
    const s = await db.grainSale.findFirstOrThrow({ where: { workspaceId: ws, collectDate: d("2027-01-12") } });
    await deleteGrainSale(db, ws, s.id);
    expect((await db.obligation.findUniqueOrThrow({ where: { id: s.obligationId! } })).status).toBe("CANCELLED");
    expect(await plannedMonths()).toContain("2027-01");
  });

  it("la venta mensual se cambia desde hoy y se puede dejar de proyectar", async () => {
    const [r] = await monthlyGrainRules(db, ws, today);
    const next = await changeMonthlyGrain(db, ws, r.id, { day: 20, amount: "700000", accountId: acc, today });
    expect(next.dayOfMonth).toBe(20);
    expect(Number(next.amount)).toBe(700000);
    await expect(changeMonthlyGrain(db, ws, next.id, { day: 40, amount: "1", accountId: acc, today })).rejects.toThrow(/día/);
    await stopMonthlyGrain(db, ws, next.id, today);
    expect(await plannedMonths()).toEqual([]);
    expect(await monthlyGrainRules(db, ws, today)).toEqual([]); // la pantalla ya no la muestra
    // y se puede volver a proyectar el mismo día
    const again = await setupMonthlyGrain(db, ws, { day: 10, amount: "100000", accountId: acc, today });
    expect(again.id).not.toBe(next.id);
  });
});
