import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, recordMovement } from "@/server/ledger";
import { searchIds, normText } from "@/server/search";
import { createGrainSale } from "@/server/grain";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, other: string, acc: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "busca@test.com", name: "B", passwordHash: "" } });
  const u2 = await db.user.create({ data: { email: "otro@test.com", name: "O", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  other = (await createWorkspaceForUser(db, u2.id)).id;
  acc = (await createAccount(db, ws, { name: "Crédito Nación", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
  const acc2 = (await createAccount(db, other, { name: "Crédito ajeno", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: d("2026-10-01") })).id;
  await recordMovement(db, ws, { kind: "EXPENSE", description: "Pagué la cuota del crédito", amount: "100", accountId: acc, status: "PAID", effectiveDate: d("2026-11-02") });
  await recordMovement(db, other, { kind: "EXPENSE", description: "Cuota del crédito ajena", amount: "100", accountId: acc2, status: "PAID", effectiveDate: d("2026-11-02") });
  await db.debt.create({ data: { workspaceId: ws, creditor: "Banco Galicia", kind: "Préstamo personal", principal: "500000", currency: "ARS", system: "FRENCH", installments: 12, startDate: d("2026-10-01") } as never }).catch(() => null);
  await createGrainSale(db, ws, { saleDate: d("2026-11-01"), grain: "Maíz", tonnes: "10", pricePerTonne: "200000", priceCurrency: "ARS", taxPct: "1.2", collectDate: d("2026-11-20"), accountId: acc, collected: false });
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("buscador", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normText("  CRÉDITO Ñandú ")).toBe("credito nandu");
  });
  it("encuentra sin acentos, solo en tu cuenta, y también ventas de cereal", async () => {
    const r = await searchIds(db, ws, "credito");
    expect(r.tx).toHaveLength(1);
    expect(r.accounts).toHaveLength(1);
    const m = await searchIds(db, ws, "maiz");
    expect(m.grain).toHaveLength(1);
    expect(m.obl.length).toBeGreaterThanOrEqual(1); // la venta por cobrar
  });
  it("trata % y _ como texto (no como comodines)", async () => {
    expect((await searchIds(db, ws, "%")).tx).toHaveLength(0);
    expect((await searchIds(db, ws, "_")).tx).toHaveLength(0);
  });
});
