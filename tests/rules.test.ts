import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, payObligation } from "@/server/ledger";
import { changeRuleFrom, createRule, deleteRule, materialize, setRuleEnd } from "@/server/recurring";
import { forecast } from "@/server/forecast";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, acc: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "reglas@test.com", name: "R", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

const dues = async (ruleIds: string[]) => (await db.obligation.findMany({ where: { recurringRuleId: { in: ruleIds } }, orderBy: { dueDate: "asc" } })).map((o) => o.dueDate.toISOString().slice(0, 10));

describe("pagos que se repiten", () => {
  it("cambiar desde una fecha cambia también el día y mantiene la fecha hasta", async () => {
    const r = await createRule(db, ws, { direction: "PAYABLE", description: "Expensas", amount: "100000", currency: "ARS", accountId: acc, frequency: "MONTHLY", dayOfMonth: 10, startDate: d("2026-11-10"), endDate: d("2027-06-30") });
    await materialize(db, ws, d("2027-01-31"));
    const v2 = await changeRuleFrom(db, ws, r.id, d("2027-01-01"), { amount: "120000", dayOfMonth: 20 });
    expect(v2.dayOfMonth).toBe(20);
    expect(v2.endDate?.toISOString().slice(0, 10)).toBe("2027-06-30");
    await materialize(db, ws, d("2027-02-28"));
    expect(await dues([r.id, v2.id])).toEqual(["2026-11-10", "2026-12-10", "2027-01-20", "2027-02-20"]);
  });

  it("la fecha hasta se puede poner y sacar", async () => {
    const r = await createRule(db, ws, { direction: "PAYABLE", description: "Gimnasio", amount: "20000", currency: "ARS", accountId: acc, frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-11-05") });
    await materialize(db, ws, d("2027-02-28"));
    await setRuleEnd(db, ws, r.id, d("2026-12-31"));
    expect(await dues([r.id])).toEqual(["2026-11-05", "2026-12-05"]);
    await expect(setRuleEnd(db, ws, r.id, d("2026-01-01"))).rejects.toThrow(/después/);
    await setRuleEnd(db, ws, r.id, null);
    await materialize(db, ws, d("2027-02-28"));
    expect((await dues([r.id])).length).toBe(4);
  });

  it("borrar quita los pendientes y deja lo ya cobrado", async () => {
    const r = await createRule(db, ws, { direction: "RECEIVABLE", description: "Alquiler", amount: "300000", currency: "ARS", accountId: acc, frequency: "MONTHLY", dayOfMonth: 1, startDate: d("2026-11-01") });
    await materialize(db, ws, d("2027-01-31"));
    const first = (await db.obligation.findMany({ where: { recurringRuleId: r.id }, orderBy: { dueDate: "asc" } }))[0];
    await payObligation(db, ws, { obligationId: first.id, accountId: acc, amount: "300000", date: d("2026-11-01") });
    const res = await deleteRule(db, ws, r.id);
    expect(res.removedPending).toBe(2);
    expect(await db.recurringRule.findUnique({ where: { id: r.id } })).toBeNull();
    const kept = await db.obligation.findUniqueOrThrow({ where: { id: first.id } });
    expect(kept.status).toBe("SETTLED");
    expect(await db.transaction.count({ where: { obligationId: first.id } })).toBe(1);
  });

  it("un cobro que se repite se proyecta en el flujo a varios años", async () => {
    await createRule(db, ws, { direction: "RECEIVABLE", description: "Sueldo", amount: "500000", currency: "ARS", accountId: acc, frequency: "MONTHLY", dayOfMonth: 5, startDate: d("2026-11-05") });
    const { rows } = await forecast(db, ws, { currency: "ARS", today: d("2026-11-08"), months: 36, certainty: "prob" });
    const y2028 = rows.find((x) => x.period === "2028-06");
    expect(y2028).toBeTruthy();
    expect(y2028!.pendingIn.gt(0)).toBe(true);
  });
});
