import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, payObligation, recordMovement } from "@/server/ledger";
import { createRule, materialize } from "@/server/recurring";
import { categoryUsage, deleteCategory } from "@/server/categories";
import { saveBudget } from "@/server/planning";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, acc: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "papa@test.com", name: "Papá", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("ingresos que cambian de monto", () => {
  it("cobrar más de lo esperado con 'fue el total' cierra el pendiente y actualiza los meses que vienen", async () => {
    const rule = await createRule(db, ws, { direction: "RECEIVABLE", description: "Sueldo", amount: "480000", currency: "ARS", accountId: acc, frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-11-05"), variableAmount: true });
    await materialize(db, ws, d("2027-01-31"));
    const obs = await db.obligation.findMany({ where: { recurringRuleId: rule.id }, orderBy: { dueDate: "asc" } });
    expect(obs.length).toBeGreaterThanOrEqual(3);
    await expect(payObligation(db, ws, { obligationId: obs[0].id, accountId: acc, amount: "520000", date: d("2026-11-05") })).rejects.toThrow(/Fue el total/);
    const r = await payObligation(db, ws, { obligationId: obs[0].id, accountId: acc, amount: "520000", date: d("2026-11-06"), settle: true, updateFuture: true });
    expect(r.status).toBe("SETTLED");
    const after = await db.obligation.findMany({ where: { recurringRuleId: rule.id }, orderBy: { dueDate: "asc" } });
    expect(after[0].amount.toString()).toBe("520000");
    expect(after[1].amount.toString()).toBe("520000");
    expect((await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } })).amount.toString()).toBe("520000");
    const tx = await db.transaction.findFirstOrThrow({ where: { obligationId: obs[0].id } });
    expect(tx.amount.toString()).toBe("520000");
    expect(tx.effectiveDate.toISOString().slice(0, 10)).toBe("2026-11-06");
  });
  it("cobrar menos con 'fue el total' no deja deuda colgada; sin marcarlo queda el resto pendiente", async () => {
    const obs = await db.obligation.findMany({ where: { workspaceId: ws, status: "PENDING", direction: "RECEIVABLE" }, orderBy: { dueDate: "asc" } });
    const a = await payObligation(db, ws, { obligationId: obs[0].id, accountId: acc, amount: "300000", date: d("2026-12-05"), settle: true });
    expect(a.status).toBe("SETTLED");
    const b = await payObligation(db, ws, { obligationId: obs[1].id, accountId: acc, amount: "100000", date: d("2027-01-05") });
    expect(b.status).toBe("PARTIAL");
  });
});

describe("borrar categorías", () => {
  it("pasa movimientos, pendientes y presupuestos a otra categoría y borra las subcategorías", async () => {
    const food = await db.category.create({ data: { workspaceId: ws, kind: "EXPENSE", name: "Comida test" } });
    const sub = await db.category.create({ data: { workspaceId: ws, kind: "EXPENSE", name: "Delivery", parentId: food.id } });
    const other = await db.category.create({ data: { workspaceId: ws, kind: "EXPENSE", name: "Varios test" } });
    const income = await db.category.findFirstOrThrow({ where: { workspaceId: ws, kind: "INCOME" } });
    await recordMovement(db, ws, { kind: "EXPENSE", description: "Pizza", amount: "5000", accountId: acc, categoryId: sub.id, status: "PAID", effectiveDate: d("2026-11-02") });
    await recordMovement(db, ws, { kind: "EXPENSE", description: "Super", amount: "9000", accountId: acc, categoryId: food.id, status: "PENDING", dueDate: d("2026-11-20") });
    await saveBudget(db, ws, "2026-11", "ARS", [{ categoryId: food.id, limit: "50000" }]);
    expect((await categoryUsage(db, ws, food.id)).total).toBeGreaterThanOrEqual(2);
    await expect(deleteCategory(db, ws, food.id, income.id)).rejects.toThrow(/mismo tipo/);
    await expect(deleteCategory(db, ws, food.id, sub.id)).rejects.toThrow(/otra categoría/);
    await deleteCategory(db, ws, food.id, other.id);
    expect(await db.category.count({ where: { id: { in: [food.id, sub.id] } } })).toBe(0);
    expect(await db.transaction.count({ where: { workspaceId: ws, categoryId: other.id } })).toBe(1);
    expect(await db.obligation.count({ where: { workspaceId: ws, categoryId: other.id } })).toBe(1);
    expect(await db.budgetLine.count({ where: { categoryId: other.id } })).toBe(1);
  });
  it("sin destino, los movimientos quedan sin categoría pero no se borran", async () => {
    const c = await db.category.create({ data: { workspaceId: ws, kind: "EXPENSE", name: "Para borrar" } });
    const m = await recordMovement(db, ws, { kind: "EXPENSE", description: "Cosa", amount: "100", accountId: acc, categoryId: c.id, status: "PAID", effectiveDate: d("2026-11-03") });
    await deleteCategory(db, ws, c.id, null);
    const id = (m as { transactionId?: string; id?: string }).transactionId ?? (m as { id?: string }).id;
    const tx = id ? await db.transaction.findUnique({ where: { id } }) : await db.transaction.findFirst({ where: { workspaceId: ws, description: "Cosa" } });
    expect(tx).not.toBeNull();
    expect(tx!.categoryId).toBeNull();
  });
});
