import { expect, it } from "vitest";
import { parseMoneyInput } from "@/lib/calc";
import { validPushEndpoint, validPushKeys } from "@/lib/push-endpoint";
import { readXlsx } from "@/lib/xlsx";

it.each(["-1000", "−1000", "(1000)", "1-000", "999999999999999999999999"])("no convierte %s en un saldo disponible positivo", (value) => {
  expect(parseMoneyInput(value)).toBeNull();
});
it.each(["https://127.0.0.1/x", "https://[::1]/x", "https://169.254.169.254/x", "https://fcm.googleapis.com.evil.test/x", "http://fcm.googleapis.com/x", "https://user:pass@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://example.com/x"])("bloquea destino de avisos %s", (value) => {
  expect(validPushEndpoint(value)).toBe(false);
});
it.each(["https://fcm.googleapis.com/fcm/send/test", "https://updates.push.services.mozilla.com/wpush/v2/test", "https://web.push.apple.com/test"])("acepta proveedor conocido %s", (value) => {
  expect(validPushEndpoint(value)).toBe(true);
});
it("rechaza claves push mal formadas", () => {
  expect(validPushKeys("x", "y")).toBe(false);
  expect(validPushKeys(Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString("base64url"), Buffer.alloc(16).toString("base64url"))).toBe(true);
});
it("rechaza un ZIP que declara expansión excesiva antes de descomprimir", () => {
  const local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(100_000_000, 24);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 10); end.writeUInt32LE(30, 16);
  expect(() => readXlsx(Buffer.concat([local, central, end]))).toThrow("tamaño descomprimido");
});
