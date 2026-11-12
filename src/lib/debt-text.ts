// Lee el texto de un contrato de préstamo o de un cronograma pegado (copiado del homebanking o del PDF).
// Sin IA: busca las palabras que usan los bancos. Nunca guarda nada; la persona revisa todo antes.
// Sirve en el servidor (PDF) y en el navegador (texto pegado).

export type ScheduleLine = { due: string; total: string }; // AAAA-MM-DD, "12345.67"
export type ParsedContract = {
  creditor: string | null;
  principal: string | null;
  installments: string | null;
  installmentAmount: string | null;
  tna: string | null;
  tea: string | null;
  cft: string | null;
  firstDue: string | null;
  startDate: string | null;
  system: "FRENCH" | "GERMAN" | "AMERICAN" | null;
  rows: ScheduleLine[];
  found: string[]; // qué encontró, para mostrarlo
};

const MESES: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
const NUM_DATE = String.raw`(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})`;
const LONG_DATE = String.raw`(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]{3,10})\s+(?:de\s+|del\s+)?(\d{4})`;
// 1.234.567,89 · 1234,89 · 1,234,567.89 · 1.234.567 (sin decimales, con puntos de miles)
const AMOUNT = String.raw`(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2}(?!\d)|\d{1,3}(?:\.\d{3})+(?![\d,]))`;

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function toIso(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const mon = /^\d+$/.test(m) ? Number(m) : MESES[plain(m).slice(0, 3)];
  let year = Number(y);
  if (year < 100) year += 2000;
  if (!mon || mon < 1 || mon > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, mon - 1, day));
  return dt.getUTCDate() === day ? dt.toISOString().slice(0, 10) : null;
}

export function toNumber(s: string): string | null {
  const t = s.replace(/\s|\$/g, "");
  let n: string;
  if (/,\d{2}$/.test(t)) n = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{2}$/.test(t) && !/\.\d{3}\./.test(t) && !/^\d{1,3}(\.\d{3})+$/.test(t)) n = t.replace(/,/g, "");
  else n = t.replace(/[.,]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(n) && Number(n) > 0 ? Number(n).toFixed(2) : null;
}

const pct = (s: string) => { const n = Number(s.replace(",", ".")); return n > 0 && n < 1000 ? String(n) : null; };

function dateAfter(text: string, labels: string[]): string | null {
  for (const l of labels) {
    for (const D of [NUM_DATE, LONG_DATE]) {
      const m = new RegExp(`${l}[^\\d\\n]{0,40}${D}`, "i").exec(text);
      if (m) { const iso = toIso(m[1], m[2], m[3]); if (iso) return iso; }
    }
  }
  return null;
}
function amountAfter(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = new RegExp(`${l}[^\\d\\n]{0,40}${AMOUNT}`, "i").exec(text);
    if (m) { const n = toNumber(m[1]); if (n) return n; }
  }
  return null;
}
function percentAfter(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = new RegExp(`(?<![a-z])${l}[^\\d\\n%]{0,60}(\\d{1,3}(?:[.,]\\d{1,4})?)\\s*%`, "i").exec(text);
    if (m) { const n = pct(m[1]); if (n) return n; }
  }
  return null;
}

// Una tabla de cuotas: cada renglón con una fecha y uno o más importes.
// En cada renglón, la cuota es el importe que suma a los anteriores (capital + interés + impuestos);
// si no hay suma, el mayor que no sea el saldo.
export function parseSchedule(text: string): ScheduleLine[] {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ");
    const dm = new RegExp(NUM_DATE).exec(line) ?? new RegExp(LONG_DATE, "i").exec(line);
    if (!dm) continue;
    const due = toIso(dm[1], dm[2], dm[3]);
    if (!due) continue;
    const rest = line.slice(0, dm.index) + " " + line.slice(dm.index + dm[0].length);
    const amounts = [...rest.matchAll(new RegExp(AMOUNT, "g"))].map((m) => toNumber(m[1])).filter((n): n is string => !!n).map(Number);
    if (!amounts.length) continue;
    let total: number | null = null;
    for (let j = 2; j < amounts.length && total == null; j++) {
      const sum = amounts.slice(0, j).reduce((s, v) => s + v, 0);
      if (Math.abs(sum - amounts[j]) <= 0.02 * j) total = amounts[j];
    }
    if (total == null) {
      if (amounts.length === 1) total = amounts[0];
      else {
        const last = amounts[amounts.length - 1];
        const head = amounts.slice(0, -1);
        total = last > Math.max(...head) * 2 ? Math.max(...head) : Math.max(...amounts);
      }
    }
    if (!out.has(due)) out.set(due, total.toFixed(2));
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([due, total]) => ({ due, total }));
}

const BRANDS = ["Mercado Pago", "Ualá", "Naranja X", "Brubank", "Santander", "Galicia", "BBVA", "Macro", "ICBC", "HSBC", "Credicoop", "Supervielle", "Patagonia", "Hipotecario", "Comafi", "Itaú", "Bancolombia", "Interbank", "Scotiabank", "Banco Ciudad", "Banco Provincia", "Banco Nación", "Banco de la Nación Argentina"];

export function parseContract(text: string): ParsedContract {
  const t = text.replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const p = plain(t);
  let creditor: string | null = null;
  const bank = /\b(Banco\s+(?:de\s+(?:la\s+)?)?[A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóúñ]+)?)/.exec(t);
  const brand = BRANDS.map((b) => ({ b, i: p.indexOf(plain(b)) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i)[0];
  if (bank && (!brand || bank.index <= brand.i)) creditor = bank[1].trim();
  else if (brand) creditor = brand.b;

  const principal = amountAfter(t, ["monto (?:del |de )?(?:pr[eé]stamo|cr[eé]dito|solicitado|otorgado|acordado|financiado|neto|bruto)", "importe (?:del |de )?(?:pr[eé]stamo|cr[eé]dito|solicitado|otorgado|acordado|financiado)", "capital (?:solicitado|otorgado|prestado|financiado|del pr[eé]stamo)"]);
  const nCuotas = /(?:cantidad de cuotas|n[uú]mero de cuotas|plazo)[^\d\n]{0,25}(\d{1,3})/i.exec(t) ?? /\b(\d{1,3})\s+cuotas\b/i.exec(t);
  let installments = nCuotas && Number(nCuotas[1]) >= 1 && Number(nCuotas[1]) <= 480 ? nCuotas[1] : null;
  const installmentAmount = amountAfter(t, ["(?:valor|importe|monto) de (?:la )?(?:primera )?cuota(?: total| mensual| pura)?", "cuota (?:total|mensual|pura|inicial|promedio|n[°º]? ?1)", "cuota"]);
  const tna = percentAfter(t, ["t\\.? ?n\\.? ?a\\.?(?![a-z])", "tasa nominal anual"]);
  const tea = percentAfter(t, ["t\\.? ?e\\.? ?a\\.?(?![a-z])", "tasa efectiva anual"]);
  const cft = percentAfter(t, ["c\\.? ?f\\.? ?t\\.?(?: ?e\\.? ?a\\.?)?(?: con iva| c/iva)?", "costo financiero total"]);
  let firstDue = dateAfter(t, ["(?:fecha de )?(?:primer|1er|1°|1º)\\s*(?:vencimiento|vto\\.?)", "vencimiento de la primera cuota", "primera cuota"]);
  const startDate = dateAfter(t, ["fecha de (?:liquidaci[oó]n|acreditaci[oó]n|desembolso|otorgamiento|alta|emisi[oó]n)", "fecha del (?:pr[eé]stamo|cr[eé]dito)"]);
  const sys = /sistema(?: de amortizaci[oó]n)?(?: de tipo)?[:\s]+(franc[eé]s|alem[aá]n|americano)/i.exec(t);
  const system = sys ? (/^franc/i.test(sys[1]) ? "FRENCH" : /^alem/i.test(sys[1]) ? "GERMAN" : "AMERICAN") : null;
  const rows = parseSchedule(text).filter((r) => !startDate || r.due > startDate);
  const schedule = rows.length >= 2 ? rows : [];
  if (schedule.length) {
    installments ??= String(schedule.length);
    firstDue ??= schedule[0].due;
  }
  const found = [creditor && "acreedor", principal && "monto", installments && "cuotas", installmentAmount && "valor de la cuota", tna && "TNA", tea && "TEA", cft && "CFT", firstDue && "primer vencimiento", startDate && "fecha del préstamo", system && "sistema", schedule.length && `cronograma de ${schedule.length} cuotas`].filter(Boolean) as string[];
  return { creditor, principal, installments, installmentAmount, tna, tea, cft, firstDue, startDate, system, rows: schedule, found };
}
