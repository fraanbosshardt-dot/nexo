// Fechas de calendario (sin hora) en la zona de Argentina por defecto.
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

// "Hoy" como fecha UTC a medianoche, según la zona horaria del espacio.
export function todayIn(tz = DEFAULT_TZ, now = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const period = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
export const periodStart = (p: string) => new Date(`${p}-01T00:00:00Z`);
export function periodEnd(p: string): Date {
  const s = periodStart(p);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
}
export function addMonths(p: string, n: number): string {
  const s = periodStart(p);
  return period(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + n, 1)));
}

// Acepta "dd/mm/aaaa" o "aaaa-mm-dd" (input type="date").
export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const t = input.trim();
  let y: number, m: number, d: number;
  const ar = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/); // también con hora (Mercado Pago)
  if (ar) [d, m, y] = [Number(ar[1]), Number(ar[2]), Number(ar[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fmtDate = (d: Date) => `${d.getUTCDate()} ${MES[d.getUTCMonth()].slice(0, 3)}${d.getUTCFullYear() !== new Date().getUTCFullYear() ? ` ${d.getUTCFullYear()}` : ""}`;
export const fmtDateNum = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
export const fmtDayMonth = (d: Date) => `${d.getUTCDate()} ${MES[d.getUTCMonth()].slice(0, 3)}`;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export function fmtPeriod(p: string): string {
  const s = periodStart(p);
  const t = `${MES[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
