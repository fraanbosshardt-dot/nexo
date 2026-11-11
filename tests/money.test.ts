import { describe, expect, it } from "vitest";
import { allocate, convert, formatMoney, parseAmount, round2, sumMoney } from "@/lib/money";
import { addMonths, parseDate, period, todayIn } from "@/lib/dates";

describe("dinero exacto", () => {
  it("lee importes en formato argentino y en formato con punto decimal", () => {
    expect(parseAmount("1.234.567,89")?.toFixed(2)).toBe("1234567.89");
    expect(parseAmount("$ 1.000")?.toFixed(2)).toBe("1000.00");
    expect(parseAmount("1234,5")?.toFixed(2)).toBe("1234.50");
    expect(parseAmount("1234.56")?.toFixed(2)).toBe("1234.56");
    expect(parseAmount("-50")?.toFixed(2)).toBe("-50.00");
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });

  it("no pierde centavos donde el punto flotante sí", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney(["0.1", "0.2"]).toFixed(2)).toBe("0.30");
    expect(sumMoney(Array(10).fill("0.10")).toFixed(2)).toBe("1.00");
  });

  it("redondea con la regla half-even", () => {
    expect(round2("2.345").toFixed(2)).toBe("2.34");
    expect(round2("2.355").toFixed(2)).toBe("2.36");
    expect(round2("-2.345").toFixed(2)).toBe("-2.34");
  });

  it("reparte cuotas que suman exacto el total", () => {
    const parts = allocate("100", 3);
    expect(parts.map((p) => p.toFixed(2))).toEqual(["33.34", "33.33", "33.33"]);
    expect(sumMoney(parts).toFixed(2)).toBe("100.00");
    expect(() => allocate("10", 0)).toThrow();
  });

  it("formatea en pesos argentinos", () => {
    expect(formatMoney("1234567.5")).toBe("$ 1.234.567,50");
    expect(formatMoney("1000")).toBe("$ 1.000");
    expect(formatMoney("-27800")).toBe("−$ 27.800");
    expect(formatMoney("205.5", "USD")).toBe("US$ 205,50");
    expect(formatMoney("650000", "ARS", { sign: true })).toBe("+$ 650.000");
  });

  it("convierte entre monedas sin tocar el importe original", () => {
    const original = parseAmount("100")!;
    const ars = convert(original, "1415.50");
    expect(ars.toFixed(2)).toBe("141550.00");
    expect(original.toFixed(2)).toBe("100.00");
  });
});

describe("fechas", () => {
  it("acepta dd/mm/aaaa y rechaza fechas inexistentes", () => {
    expect(parseDate("05/11/2026")?.toISOString().slice(0, 10)).toBe("2026-11-05");
    expect(parseDate("2026-11-05")?.toISOString().slice(0, 10)).toBe("2026-11-05");
    expect(parseDate("31/02/2026")).toBeNull();
  });
  it("calcula meses y el día de hoy en Buenos Aires", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    // 02:00 UTC del 6/11 todavía es 5/11 en Buenos Aires (GMT−3).
    expect(period(todayIn("America/Argentina/Buenos_Aires", new Date("2026-11-06T02:00:00Z")))).toBe("2026-11");
    expect(todayIn("America/Argentina/Buenos_Aires", new Date("2026-11-06T02:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-05");
  });
});
