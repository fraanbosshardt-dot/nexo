// Calculadoras públicas: ¿puedo comprarlo en cuotas? y préstamos.
import { describe, expect, it } from "vitest";
import { canAffordSimple, loanSchedule, parseMoneyInput, teaFromTna } from "@/lib/calc";

describe("Calculadoras públicas", () => {
  it("entiende montos escritos de distintas formas", () => {
    expect(parseMoneyInput("1.000.000")).toBe(100000000);
    expect(parseMoneyInput("1234,5")).toBe(123450);
    expect(parseMoneyInput("$ 45.300")).toBe(4530000);
    expect(parseMoneyInput("")).toBeNull();
  });
  it("dice si te alcanza y el mes más justo", () => {
    const ok = canAffordSimple({ now: 50000000, monthlyFree: 12000000, price: 90000000, installments: 6 });
    expect(ok.ok).toBe(true);
    expect(ok.cuota).toBe(15000000);
    expect(ok.min).toBe(32000000); // 500.000 − 6 × 30.000
    const no = canAffordSimple({ now: 10000000, monthlyFree: 5000000, price: 120000000, installments: 6 });
    expect(no.ok).toBe(false);
    expect(no.minMonth).toBe(6);
  });
  it("sistema francés con la cuota correcta y cierre exacto", () => {
    const rows = loanSchedule(100000000, 12, 60, "frances");
    expect(rows[0].payment).toBe(11282541); // $ 112.825,41
    expect(rows.at(-1)!.balance).toBe(0);
    expect(rows.reduce((s, r) => s + r.capital, 0)).toBe(100000000);
  });
  it("alemán baja la cuota y americano devuelve todo al final", () => {
    const de = loanSchedule(1200000, 12, 24, "aleman");
    expect(de[0].payment).toBeGreaterThan(de[11].payment);
    const us = loanSchedule(1200000, 12, 24, "americano");
    expect(us[0].capital).toBe(0);
    expect(us[11].capital).toBe(1200000);
  });
  it("TEA a partir de la TNA", () => {
    expect(teaFromTna(60).toFixed(1)).toBe("79.6");
  });
});
