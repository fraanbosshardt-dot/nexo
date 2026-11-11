// Arreglos y funciones de la auditoría del 11/11/2026.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, createAccount, payObligation, recordMovement } from "@/server/ledger";
import { effectivePlan, paidUntil } from "@/server/plans";
import { csvCell, guessColumn, previewImport } from "@/server/io";
import { createGrainSale, deleteGrainSale, setGrainStock } from "@/server/grain";
import { netWorth } from "@/server/wealth";
import { parseDate } from "@/lib/dates";
import { checkVerifyToken, describeAgent, verifyToken } from "@/server/account-mail";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let ws: string, acc: string, userId: string;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
beforeAll(async () => {
  process.env.AUTH_SECRET ??= "x".repeat(44);
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "audit@test.com", name: "Ana Prueba", passwordHash: "" } });
  userId = u.id;
  ws = (await createWorkspaceForUser(db, u.id)).id;
  acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "1000", initialDate: d("2026-10-01") })).id;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("cobros de Pro", () => {
  const now = d("2026-11-11");
  it("cancelado o con pago pendiente, sigue en Pro hasta el fin del período pagado", () => {
    expect(effectivePlan({ plan: "PRO", status: "CANCELED", trialEndsAt: null, currentPeriodEnd: d("2026-12-01") }, now)).toBe("PRO");
    expect(effectivePlan({ plan: "PRO", status: "PAST_DUE", trialEndsAt: null, currentPeriodEnd: d("2026-11-10") }, now)).toBe("FREE");
    expect(effectivePlan({ plan: "PRO", status: "CANCELED", trialEndsAt: null, currentPeriodEnd: null }, now)).toBe("FREE");
    expect(effectivePlan({ plan: "PRO", status: "ACTIVE", trialEndsAt: null }, now)).toBe("PRO");
  });
  it("un pago cubre un mes o un año", () => {
    expect(paidUntil(d("2026-01-31"), "monthly").toISOString().slice(0, 10)).toBe("2026-03-03");
    expect(paidUntil(d("2026-11-11"), "yearly").toISOString().slice(0, 10)).toBe("2027-11-11");
  });
});

describe("pagos", () => {
  it("dos toques al mismo tiempo registran un solo cobro", async () => {
    const r = await recordMovement(db, ws, { kind: "INCOME", description: "Alquiler", amount: "500", accountId: acc, status: "PENDING", dueDate: d("2026-11-10") });
    const pay = () => payObligation(db, ws, { obligationId: r.obligationId!, accountId: acc, amount: "500", date: d("2026-11-11"), settle: true });
    const results = await Promise.allSettled([pay(), pay()]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.transaction.count({ where: { obligationId: r.obligationId! } })).toBe(1);
  });

  it("el saldo de hoy no suma lo cargado con fecha futura", async () => {
    await recordMovement(db, ws, { kind: "INCOME", description: "Cobro futuro", amount: "300", accountId: acc, status: "PAID", effectiveDate: d("2026-12-20") });
    const today = (await accountBalances(db, ws, d("2026-11-11"))).get(acc)!;
    const all = (await accountBalances(db, ws)).get(acc)!;
    expect(all.minus(today).toNumber()).toBe(300);
  });
});

describe("exportar e importar", () => {
  it("el CSV no deja pasar fórmulas, pero sí números negativos", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("@SUMA")).toBe(`"'@SUMA"`);
    expect(csvCell("-cmd")).toBe(`"'-cmd"`);
    expect(csvCell("-1234,50")).toBe(`"-1234,50"`);
    expect(csvCell("Supermercado")).toBe(`"Supermercado"`);
  });

  it("reconoce el extracto de Mercado Pago (entradas y salidas separadas, fecha con hora)", async () => {
    expect(guessColumn("DATE")).toBe("fecha");
    expect(guessColumn("NET_CREDIT_AMOUNT")).toBe("credito");
    expect(guessColumn("NET_DEBIT_AMOUNT")).toBe("debito");
    expect(guessColumn("PARTIAL_BALANCE")).toBe("ignorar");
    expect(guessColumn("Saldo total")).toBe("ignorar");
    expect(parseDate("2026-11-03T10:20:30.000-03:00")?.toISOString().slice(0, 10)).toBe("2026-11-03");
    const csv = "DATE,SOURCE_ID,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,PARTIAL_BALANCE\n2026-11-01T00:00:00.000-03:00,,initial_available_balance,0,0,1000\n2026-11-03T10:20:30.000-03:00,123,Transferencia recibida,1500.50,0,2500.50\n2026-11-04T09:00:00.000-03:00,124,Pago en comercio,0,320.25,2180.25";
    const map = { 0: "fecha", 1: "ignorar", 2: "concepto", 3: "credito", 4: "debito", 5: "ignorar" };
    const p = await previewImport(db, ws, acc, csv, map);
    expect(p.errors).toEqual([]);
    expect(p.ok.map((o) => [o.description, o.amount.toNumber()])).toEqual([["Transferencia recibida", 1500.5], ["Pago en comercio", -320.25]]);
  });
});

describe("agro y patrimonio", () => {
  it("el stock de cereal suma al patrimonio y baja al vender (vuelve si se borra la venta)", async () => {
    await setGrainStock(db, ws, { grain: "Soja", tonnes: "100", pricePerTonne: "300000", currency: "ARS" });
    const before = await netWorth(db, ws, "ARS");
    expect(before.lines.some((l) => l.name.startsWith("Soja en stock (1.000 qq)") && l.amount.toNumber() === 30_000_000)).toBe(true);
    const sale = await createGrainSale(db, ws, { saleDate: d("2026-11-05"), grain: "Soja", tonnes: "30", pricePerTonne: "300000", priceCurrency: "ARS", taxPct: "1.2", collectDate: d("2026-11-20"), accountId: acc, collected: false });
    expect((await db.grainStock.findFirstOrThrow({ where: { workspaceId: ws, grain: "Soja" } })).tonnes.toString()).toBe("70");
    await deleteGrainSale(db, ws, sale.id);
    expect((await db.grainStock.findFirstOrThrow({ where: { workspaceId: ws, grain: "Soja" } })).tonnes.toString()).toBe("100");
  });
});

describe("cuenta", () => {
  it("el enlace para confirmar el correo vale solo para ese correo y vence", async () => {
    const tok = verifyToken(userId, "audit@test.com");
    expect((await checkVerifyToken(db, tok))?.id).toBe(userId);
    expect(await checkVerifyToken(db, tok.slice(0, -2) + "xx")).toBeNull();
    expect(await checkVerifyToken(db, tok, Date.now() + 8 * 864e5)).toBeNull();
    await db.user.update({ where: { id: userId }, data: { email: "otro@test.com" } });
    expect(await checkVerifyToken(db, tok)).toBeNull();
  });
  it("describe el dispositivo en palabras", () => {
    expect(describeAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36")).toBe("Chrome en Android");
    expect(describeAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari en iPhone o iPad");
  });
});
