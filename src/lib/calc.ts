// Cálculos de las herramientas gratuitas (públicas, sin cuenta). Trabajan en centavos para no perder precisión.

export function parseMoneyInput(raw: string): number | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  // Estas calculadoras admiten montos no negativos. Nunca transformar un déficit en ingreso.
  if (/[-−–—()]/.test(s)) return null;
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const i = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  let ip = s, fp = "";
  if (i >= 0) {
    const after = s.length - i - 1;
    if ((s.includes(",") && s.includes(".")) || (after > 0 && after <= 2)) { ip = s.slice(0, i); fp = s.slice(i + 1); }
  }
  ip = ip.replace(/[.,]/g, "");
  const v = parseInt(ip || "0", 10) * 100 + parseInt((fp + "00").slice(0, 2), 10);
  return Number.isSafeInteger(v) ? v : null;
}

export const money = (cents: number, symbol = "$") =>
  `${cents < 0 ? "−" : ""}${symbol} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: Math.abs(cents) % 100 ? 2 : 0, minimumFractionDigits: Math.abs(cents) % 100 ? 2 : 0 }).format(Math.abs(cents) / 100)}`;

export function split(total: number, n: number) {
  const b = Math.floor(total / n), r = total - b * n;
  return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0));
}

// ¿Me alcanza para comprarlo en cuotas? Saldo mes a mes con lo que te sobra por mes menos la cuota.
export function canAffordSimple(o: { now: number; monthlyFree: number; price: number; installments: number; total?: number | null; cushion?: number }) {
  const total = o.total && o.total >= o.price ? o.total : o.price;
  const parts = split(total, o.installments);
  const months = Math.max(6, o.installments + 1);
  const rows: { month: number; cuota: number; end: number }[] = [];
  let run = o.now, min = o.now, minMonth = 0;
  for (let m = 0; m < months; m++) {
    const cuota = parts[m] ?? 0;
    run += o.monthlyFree - cuota;
    rows.push({ month: m + 1, cuota, end: run });
    if (run < min) { min = run; minMonth = m + 1; }
  }
  const cushion = o.cushion ?? 0;
  return { ok: min >= cushion, cuota: parts[0], total, interest: total - o.price, rows, min, minMonth };
}

export type LoanRow = { n: number; capital: number; interest: number; payment: number; balance: number };
// Cuotas de un préstamo con sistema francés, alemán o americano. TNA en porcentaje.
export function loanSchedule(principal: number, n: number, tnaPct: number, system: "frances" | "aleman" | "americano"): LoanRow[] {
  const i = tnaPct / 100 / 12;
  const rows: LoanRow[] = [];
  let bal = principal;
  const fixed = system === "frances" && i > 0 ? Math.round((principal * i) / (1 - Math.pow(1 + i, -n))) : null;
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    const interest = Math.round(bal * i);
    const capital = system === "americano" ? (last ? bal : 0) : fixed != null ? (last ? bal : fixed - interest) : last ? bal : Math.round(principal / n);
    bal -= capital;
    rows.push({ n: k + 1, capital, interest, payment: capital + interest, balance: bal });
  }
  return rows;
}

// TEA a partir de la TNA (capitalización mensual).
export const teaFromTna = (tnaPct: number) => (Math.pow(1 + tnaPct / 100 / 12, 12) - 1) * 100;
