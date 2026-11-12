// Lectura de contratos y cronogramas de préstamos (texto de PDF o pegado).
import { describe, expect, it } from "vitest";
import { parseContract, parseSchedule } from "@/lib/debt-text";

const CONTRATO = `BANCO GALICIA
Solicitud de Préstamo Personal - Banco Galicia
Fecha de liquidación: 15/10/2026
Monto del préstamo: $ 1.800.000,00
Plazo: 18 meses   Cantidad de cuotas: 18
Sistema de amortización: Francés
T.N.A.: 89,00%   T.E.A.: 134,77%   C.F.T.E.A. con IVA: 178,45%
Valor de la primera cuota: $ 215.320,55
Primer vencimiento: 15/11/2026
Cronograma de pagos
N° Vencimiento Capital Interés IVA Cuota Saldo
1 15/11/2026 81.820,55 133.500,00 28.035,00 243.355,55 1.718.179,45
2 15/12/2026 87.889,00 127.431,55 26.760,63 242.081,18 1.630.290,45
3 15/01/2027 94.408,00 120.912,55 25.391,64 240.712,19 1.535.882,45`;

describe("contrato", () => {
  it("encuentra los datos principales y el cronograma", () => {
    const c = parseContract(CONTRATO);
    expect(c.creditor).toMatch(/Galicia/i);
    expect([c.principal, c.installments, c.tna, c.tea, c.cft, c.firstDue, c.startDate, c.system]).toEqual(["1800000.00", "18", "89", "134.77", "178.45", "2026-11-15", "2026-10-15", "FRENCH"]);
    expect(c.installmentAmount).toBe("215320.55");
    expect(c.rows).toEqual([{ due: "2026-11-15", total: "243355.55" }, { due: "2026-12-15", total: "242081.18" }, { due: "2027-01-15", total: "240712.19" }]);
  });
  it("no inventa lo que no está", () => {
    const c = parseContract("Préstamo otorgado por Mercado Pago en 12 cuotas");
    expect([c.creditor, c.installments, c.principal, c.tna]).toEqual(["Mercado Pago", "12", null, null]);
  });
});

describe("cronograma pegado", () => {
  it("toma la fecha y la cuota de cada renglón", () => {
    expect(parseSchedule("Cuota 1\t05/12/2026\t$ 120.500,00\nCuota 2\t05/01/2027\t$ 118.900,10")).toEqual([{ due: "2026-12-05", total: "120500.00" }, { due: "2027-01-05", total: "118900.10" }]);
  });
  it("con cuota y saldo, se queda con la cuota", () => {
    expect(parseSchedule("10/03/2027 50.000,00 900.000,00")[0].total).toBe("50000.00");
  });
  it("fechas escritas con el mes", () => {
    expect(parseSchedule("5 de marzo de 2027 — $ 10.000")[0]).toEqual({ due: "2027-03-05", total: "10000.00" });
  });
});

describe("cuotas en el servidor", () => {
  it("francés con la cuota del banco: todas las cuotas dan esa cuota y el saldo llega a cero", async () => {
    const { buildSchedule } = await import("@/server/debts");
    const rows = buildSchedule({ system: "FRENCH", principal: "1000000", installments: 12, installmentAmount: "100000", tna: "50", firstDue: new Date("2026-12-10T00:00:00Z") });
    expect(rows.every((r) => r.total.toFixed(2) === "100000.00")).toBe(true);
    expect(rows.at(-1)!.balance.toNumber()).toBe(0);
    expect(rows[0].interest.toNumber()).toBeGreaterThan(rows[11].interest.toNumber());
  });
  it("cuotas a medida: respeta cada importe y separa capital e interés", async () => {
    const { buildCustomSchedule } = await import("@/server/debts");
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    const rows = buildCustomSchedule("300", [{ due: d("2027-01-05"), total: "105" }, { due: d("2026-12-05"), total: "110" }, { due: d("2027-02-05"), total: "100" }]);
    expect(rows.map((r) => r.total.toFixed(2))).toEqual(["110.00", "105.00", "100.00"]);
    expect(rows.reduce((s, r) => s + r.capital.toNumber(), 0)).toBeCloseTo(300, 2);
    expect(rows.at(-1)!.balance.toNumber()).toBe(0);
  });
  it("avisa si las cuotas no alcanzan para devolver el préstamo", async () => {
    const { buildCustomSchedule } = await import("@/server/debts");
    expect(() => buildCustomSchedule("1000", [{ due: new Date("2027-01-05T00:00:00Z"), total: "100" }])).toThrow(/suman menos/);
  });
});
