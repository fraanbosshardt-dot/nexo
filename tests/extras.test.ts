// Pruebas de lo agregado el 07/11: firma de Mercado Pago, cotizaciones automáticas y fechas cortas.
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { validSignature } from "@/server/billing";
import { latestRates, saveManualRate } from "@/server/wealth";
import { createWorkspaceForUser } from "@/server/workspace";
import { fmtDate, fmtDateNum } from "@/lib/dates";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
beforeAll(async () => { t = await startTestDb(); db = t.db as unknown as PrismaClient; }, 60_000);
afterAll(async () => { await t?.stop(); });

describe("Mercado Pago", () => {
  it("acepta solo notificaciones con la firma correcta", () => {
    process.env.MP_WEBHOOK_SECRET = "secreto-de-prueba";
    const ts = "1700000000";
    const v1 = createHmac("sha256", "secreto-de-prueba").update(`id:abc123;request-id:req-1;ts:${ts};`).digest("hex");
    expect(validSignature(`ts=${ts},v1=${v1}`, "req-1", "ABC123")).toBe(true);
    expect(validSignature(`ts=${ts},v1=${v1}`, "req-2", "abc123")).toBe(false); // otro pedido
    expect(validSignature(`ts=${ts},v1=${"0".repeat(64)}`, "req-1", "abc123")).toBe(false);
    expect(validSignature(null, "req-1", "abc123")).toBe(false);
    delete process.env.MP_WEBHOOK_SECRET;
    expect(validSignature(`ts=${ts},v1=${v1}`, "req-1", "abc123")).toBe(false); // sin secreto, nada pasa
  });
});

describe("Cotizaciones automáticas", () => {
  it("calcula cruzadas desde el dólar y la manual siempre gana", async () => {
    const user = await db.user.create({ data: { email: "fx@test.com", name: "FX", passwordHash: "x" } });
    const ws = await createWorkspaceForUser(db, user.id);
    const now = new Date();
    await db.exchangeRate.createMany({ data: [
      { base: "USD", quote: "ARS", kind: "api", sell: "1400", source: "open.er-api.com", fetchedAt: now },
      { base: "USD", quote: "EUR", kind: "api", sell: "0.875", source: "open.er-api.com", fetchedAt: now },
    ] });
    let r = await latestRates(db, ws.id, "ARS");
    expect(r.get("USD")?.rate.toFixed(2)).toBe("1400.00");
    expect(r.get("EUR")?.rate.toFixed(2)).toBe("1600.00"); // 1400 / 0,875
    await saveManualRate(db, ws.id, "USD", "ARS", "1450");
    r = await latestRates(db, ws.id, "ARS");
    expect(r.get("USD")?.rate.toFixed(2)).toBe("1450.00");
    expect(r.get("USD")?.source).toBe("manual");
  });
});

describe("Fechas", () => {
  it("se muestran cortas y el CSV mantiene día/mes/año", () => {
    const y = new Date().getUTCFullYear();
    expect(fmtDate(new Date(Date.UTC(y, 10, 10)))).toBe("10 nov");
    expect(fmtDate(new Date(Date.UTC(2020, 0, 5)))).toBe("5 ene 2020");
    expect(fmtDateNum(new Date(Date.UTC(2026, 10, 6)))).toBe("06/11/2026");
  });
});
