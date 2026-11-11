// Excel, OFX y las calculadoras públicas nuevas.
import { describe, expect, it } from "vitest";
import { readXlsx, writeXlsx } from "@/lib/xlsx";
import { ofxToCsv, parseCsv, xlsxToCsv } from "@/server/io";
import { convert, fondoEmergencia, plazoFijo, presupuesto503020 } from "@/components/tools/more-calcs";

describe("Excel (.xlsx)", () => {
  it("lo que se escribe se vuelve a leer igual (texto, números, fechas y caracteres especiales)", () => {
    const buf = writeXlsx("Movimientos", ["Fecha", "Concepto", "Importe"], [
      [new Date(Date.UTC(2026, 10, 3)), "Supermercado & más <ok>", -1234.5],
      [new Date(Date.UTC(2026, 10, 4)), "Sueldo", 850000],
    ]);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(readXlsx(buf)).toEqual([["Fecha", "Concepto", "Importe"], ["03/11/2026", "Supermercado & más <ok>", "-1234.5"], ["04/11/2026", "Sueldo", "850000"]]);
  });
  it("se convierte a CSV para el importador", () => {
    const csv = xlsxToCsv(writeXlsx("Hoja", ["Fecha", "Detalle", "Monto"], [[new Date(Date.UTC(2026, 0, 31)), "Luz", -9000]]));
    expect(parseCsv(csv).rows).toEqual([["31/01/2026", "Luz", "-9000"]]);
  });
});

describe("OFX", () => {
  it("lee los movimientos del banco (SGML sin cierres y XML)", () => {
    const sgml = "OFXHEADER:100\n<OFX><BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261103120000[-3:ART]\n<TRNAMT>-1500.25\n<NAME>Farmacia\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20261105\n<TRNAMT>200000.00\n<MEMO>Transferencia recibida\n</BANKTRANLIST></OFX>";
    expect(parseCsv(ofxToCsv(sgml)).rows).toEqual([["03/11/2026", "Farmacia", "-1500.25"], ["05/11/2026", "Transferencia recibida", "200000.00"]]);
    const xml = "<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260102</DTPOSTED><TRNAMT>-10</TRNAMT><NAME>Café</NAME><MEMO>Centro</MEMO></STMTTRN></BANKTRANLIST></OFX>";
    expect(parseCsv(ofxToCsv(xml)).rows).toEqual([["02/01/2026", "Café · Centro", "-10"]]);
  });
  it("avisa si no hay movimientos", () => {
    expect(() => ofxToCsv("<OFX></OFX>")).toThrow(/No encontramos movimientos/);
  });
});

describe("calculadoras", () => {
  it("plazo fijo: interés por el plazo, renovado y TEA", () => {
    const r = plazoFijo(10_000_000, 36, 30, 0); // $100.000 en centavos
    expect(r.interes).toBe(295_890);
    expect(r.alVencer).toBe(10_295_890);
    expect(plazoFijo(10_000_000, 36, 30, 11).renovado).toBeGreaterThan(r.alVencer * 1.3);
    expect(r.tea).toBeCloseTo(42.6, 0);
  });
  it("conversor: cruza monedas a través del dólar", () => {
    const rates = { ARS: 1500, EUR: 0.9 };
    expect(convert(100, "USD", "ARS", rates)).toBe(150_000);
    expect(convert(1500, "ARS", "USD", rates)).toBe(1);
    expect(convert(90, "EUR", "ARS", rates)).toBeCloseTo(150_000, 6);
    expect(convert(1, "USD", "XYZ", rates)).toBeNull();
  });
  it("fondo de emergencia: meta, lo que falta y en cuánto llegás", () => {
    expect(fondoEmergencia(100, 6, 150, 50)).toEqual({ meta: 600, falta: 450, mesesParaLlegar: 9, cubre: 1.5 });
    expect(fondoEmergencia(100, 3, 400, 0).mesesParaLlegar).toBe(0);
    expect(fondoEmergencia(100, 3, 0, 0).mesesParaLlegar).toBeNull();
  });
  it("50/30/20: reparte sin perder centavos", () => {
    expect(presupuesto503020(100_001)).toEqual({ necesidades: 50_001, deseos: 30_000, ahorro: 20_000 });
  });
});
