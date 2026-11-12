// Inversiones por especie: nominales, costo promedio, precio automático (bonos cada 100 nominales) y precio a mano.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { accountBalances, createAccount } from "@/server/ledger";
import { createWorkspaceForUser } from "@/server/workspace";
import { holdingTrade, investmentsOverview, setManualPrice } from "@/server/wealth";
import { currencyFor, quoteKey } from "@/server/quotes";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, banco: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "inv@test.com", name: "Iva", passwordHash: "" } });
  ws = (await createWorkspaceForUser(db, u.id)).id;
  banco = (await createAccount(db, ws, { name: "Banco", type: "CHECKING", currency: "USD", initialBalance: "10000", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("especies", () => {
  it("un bono en dólares vale nominales × precio / 100, con el costo promedio y la ganancia", async () => {
    const inv = await db.investment.create({ data: { workspaceId: ws, name: "AL30D", kind: "Bono", currency: "USD", ticker: "AL30D", assetClass: "BOND" } });
    await holdingTrade(db, ws, { investmentId: inv.id, side: "BUY", quantity: "1000", total: "600", accountId: banco, date: d("2026-11-01") });
    await holdingTrade(db, ws, { investmentId: inv.id, side: "BUY", quantity: "1000", total: "700", date: d("2026-11-05") });
    await holdingTrade(db, ws, { investmentId: inv.id, side: "SELL", quantity: "500", total: "350", accountId: banco, date: d("2026-11-08") });
    await db.quote.create({ data: { source: "data912", symbol: "arg_bonds:AL30D", price: "68", currency: "USD", fetchedAt: new Date() } });
    const o = (await investmentsOverview(db, ws)).find((x) => x.inv.id === inv.id)!;
    expect(o.holding!.qty.toNumber()).toBe(1500);
    expect(o.invested.toNumber()).toBe(975); // costo 1.300 − 325 de lo vendido
    expect(o.value.toNumber()).toBe(1020); // 1.500 × 68 / 100
    expect(o.holding!.realized.toNumber()).toBe(25); // vendió a 350 lo que costó 325
    expect((await accountBalances(db, ws)).get(banco)!.toNumber()).toBe(10000 - 600 + 350);
  });

  it("no deja vender más de lo que tenés", async () => {
    const inv = await db.investment.create({ data: { workspaceId: ws, name: "GGAL", kind: "Acción argentina", currency: "ARS", ticker: "GGAL", assetClass: "AR_STOCK" } });
    await holdingTrade(db, ws, { investmentId: inv.id, side: "BUY", quantity: "10", total: "50000", date: d("2026-11-01") });
    await expect(holdingTrade(db, ws, { investmentId: inv.id, side: "SELL", quantity: "11", total: "1", date: d("2026-11-02") })).rejects.toThrow(/Revisá la cantidad/);
  });

  it("un FCI se valúa con la cuotaparte cargada a mano", async () => {
    const inv = await db.investment.create({ data: { workspaceId: ws, name: "Fondo Ahorro", kind: "Fondo común (FCI)", currency: "ARS", ticker: "Fondo Ahorro", assetClass: "FCI" } });
    await holdingTrade(db, ws, { investmentId: inv.id, side: "BUY", quantity: "2000", total: "100000", date: d("2026-11-01") });
    await setManualPrice(db, ws, inv.id, "55", d("2026-11-10"));
    const o = (await investmentsOverview(db, ws)).find((x) => x.inv.id === inv.id)!;
    expect([o.value.toNumber(), o.gain.toNumber()]).toEqual([110000, 10000]);
  });

  it("moneda y clave de cotización según la especie", () => {
    expect([currencyFor("BOND", "AL30"), currencyFor("BOND", "AL30D"), currencyFor("AR_STOCK", "YPFD"), currencyFor("US_STOCK", "AAPL")]).toEqual(["ARS", "USD", "ARS", "USD"]);
    expect(quoteKey({ assetClass: "CEDEAR", ticker: "AAPL", quoteId: null })).toEqual({ source: "data912", symbol: "arg_cedears:AAPL" });
    expect(quoteKey({ assetClass: "FCI", ticker: "X", quoteId: null })).toBeNull();
  });
});
