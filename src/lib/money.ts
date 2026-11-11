// Dinero exacto: nunca se usan números de punto flotante para importes.
// Redondeo explícito: half-even ("del banquero") a 2 decimales.
import Decimal from "decimal.js";
import { symbolOf } from "./countries";

export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export type Money = Decimal;
export type MoneyValue = Decimal.Value | { toString(): string };

export const dec = (v: MoneyValue): Decimal => new Money(typeof v === "object" ? v.toString() : v);
export const round2 = (v: MoneyValue): Decimal => dec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
export const ZERO = new Money(0);

export function sumMoney(values: MoneyValue[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Money(0));
}

// Acepta "1.234.567,89", "1234,5", "1234.56", "$ 1.000" y "-50". Devuelve null si no es un número.
export function parseAmount(input: string | null | undefined): Decimal | null {
  if (input == null) return null;
  const t = String(input).trim().replace(/US\$|\$|€|\s/g, "");
  if (!t) return null;
  let norm: string | null = null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) norm = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(t)) norm = t.replace(",", ".");
  else if (/^-?\d+(\.\d+)?$/.test(t)) norm = t;
  if (norm == null) return null;
  const d = new Money(norm);
  return d.isFinite() ? d : null;
}

// Formato en español: "$ 1.234,56", con el símbolo de cada moneda. Muestra centavos solo si existen, salvo que se pidan siempre.
export function formatMoney(v: MoneyValue, currency = "ARS", opts: { cents?: "auto" | "always"; sign?: boolean } = {}): string {
  const d = round2(v);
  const abs = d.abs();
  const showCents = opts.cents === "always" || !abs.mod(1).isZero();
  const nf = new Intl.NumberFormat("es-AR", { minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 });
  // Intl acepta el número como texto: formatea sin pasar por float.
  const body = nf.format(abs.toFixed(showCents ? 2 : 0) as unknown as number);
  const sign = d.isNegative() && !d.isZero() ? "−" : opts.sign && d.gt(0) ? "+" : "";
  // Espacio que no se corta: el símbolo y el número nunca quedan en renglones distintos.
  return `${sign}${symbolOf(currency)} ${body}`;
}

// Reparte un total en n partes que suman exacto: los centavos sobrantes van a las primeras cuotas.
export function allocate(total: MoneyValue, parts: number): Decimal[] {
  if (!Number.isInteger(parts) || parts <= 0) throw new Error("La cantidad de partes tiene que ser un entero positivo");
  const cents = round2(total).times(100);
  const base = cents.dividedToIntegerBy(parts);
  const rest = cents.minus(base.times(parts)).toNumber();
  return Array.from({ length: parts }, (_, i) => base.plus(i < rest ? 1 : 0).dividedBy(100));
}

// Conversión entre monedas: guarda la cotización usada, nunca reemplaza el importe original.
export function convert(amount: MoneyValue, rate: MoneyValue): Decimal {
  return round2(dec(amount).times(dec(rate)));
}
