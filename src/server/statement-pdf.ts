// Lee el texto de un resumen de tarjeta en PDF, en el propio servidor y sin IA (gratis).
// Nunca guarda nada: devuelve lo que encontró para que la persona lo revise y confirme.
import { extractText, getDocumentProxy } from "unpdf";
import { UserError } from "./ledger";

export type ParsedStatement = {
  closingDate: string | null; // AAAA-MM-DD
  dueDate: string | null;
  total: string | null; // "123456.78" (moneda principal)
  minimum: string | null;
  totalUsd: string | null; // la parte en dólares del mismo resumen, si tiene
  minimumUsd: string | null;
  carry: { description: string; amount: string; remaining: number }[];
  purchases: { date: string; description: string; amount: string }[]; // compras del resumen
  missing?: { date: string; description: string; amount: string }[]; // las que no están cargadas en Finan
  found: string[]; // qué datos encontró, para mostrarlo
};

const MESES: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
const DATE = String.raw`(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-zÁÉÍÓÚáéíóú]{3,10})[\/\-. ](\d{2,4})`;
const AMOUNT = String.raw`\$?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d{1,3}(?:,\d{3})*\.\d{2})`;

function toIso(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const mon = /^\d+$/.test(m) ? Number(m) : MESES[m.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3)];
  let year = Number(y);
  if (year < 100) year += 2000;
  if (!mon || mon < 1 || mon > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, mon - 1, day));
  return dt.getUTCDate() === day ? dt.toISOString().slice(0, 10) : null;
}
function toNumber(s: string): string | null {
  const t = s.replace(/\s|\$/g, "");
  const n = /,\d{2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  return /^-?\d+(\.\d{1,2})?$/.test(n) ? Number(n).toFixed(2) : null;
}
// Cada renglón del PDF con la posición horizontal de cada letra: así un dato que está DEBAJO de su título
// (resúmenes armados como tabla: "CIERRE ACTUAL  VENCIMIENTO" y abajo las fechas) se encuentra por columna.
export type PdfLine = { text: string; xs: number[] };
export const linesFromText = (text: string): PdfLine[] => text.replace(/\u00a0/g, " ").split(/\r?\n/).map((t) => ({ text: t, xs: [...t].map((_, k) => k * 6) }));

type Hit = { value: string; x: number; usd: boolean };

function amountsIn(line: PdfLine, from = 0, to = line.text.length): Hit[] {
  const out: Hit[] = [];
  const usdLine = /^\s*(d[oó]lares|u\$s|usd)\b/i.test(line.text);
  for (const m of line.text.slice(from, to).matchAll(new RegExp(AMOUNT, "g"))) {
    const at = from + (m.index ?? 0);
    const before = line.text.slice(Math.max(0, at - 8), at + m[0].indexOf(m[1]));
    const n = toNumber(m[1]);
    if (n) out.push({ value: n, x: line.xs[at] ?? at * 6, usd: /(u\$s|us\$|u\$d|usd|d[oó]lares)\s*\$?\s*$/i.test(before) || usdLine });
  }
  return out;
}
function datesIn(line: PdfLine, from = 0, to = line.text.length): { value: string; x: number }[] {
  const out: { value: string; x: number }[] = [];
  for (const m of line.text.slice(from, to).matchAll(new RegExp(DATE, "g"))) {
    const iso = toIso(m[1], m[2], m[3]);
    const at = from + (m.index ?? 0);
    if (iso) out.push({ value: iso, x: line.xs[at] ?? at * 6 });
  }
  return out;
}
// Busca el valor de un título: primero a la derecha (mismo renglón); si no, en los renglones de abajo, en su columna.
function near<T extends { x: number }>(lines: PdfLine[], labels: string[], pick: (l: PdfLine, from?: number, to?: number) => T[]): T[] {
  for (const label of labels) {
    const re = new RegExp(label, "i");
    for (let i = 0; i < lines.length; i++) {
      const m = re.exec(lines[i].text);
      if (!m) continue;
      const end = m.index + m[0].length;
      const right = pick(lines[i], end, Math.min(lines[i].text.length, end + 90)).filter((h) => h.x >= (lines[i].xs[end - 1] ?? 0));
      if (right.length) return right;
      const x0 = lines[i].xs[m.index] ?? m.index * 6, x1 = lines[i].xs[end - 1] ?? end * 6;
      // Debajo, en la misma columna: puede haber un renglón en pesos y otro en dólares.
      const below: T[] = [];
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
        below.push(...pick(lines[j]).filter((h) => h.x >= x0 - 30 && h.x <= x1 + 60).sort((a, b) => Math.abs(a.x - x0) - Math.abs(b.x - x0)));
      }
      if (below.length) return below;
    }
  }
  return [];
}

// Separado de la lectura del PDF para poder probarlo con texto.
export function parseStatementText(text: string, positioned?: PdfLine[]): ParsedStatement {
  const lines = positioned ?? linesFromText(text);
  const t = lines.map((l) => l.text).join("\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const closingDate = near(lines, ["cierre actual", "fecha de cierre", "cierre"], datesIn)[0]?.value ?? null;
  const dueDate = near(lines, ["vencimiento actual", "fecha de vencimiento", "vencimiento", "vto\\.?"], datesIn)[0]?.value ?? null;
  const totals = near(lines, ["saldo actual", "total a pagar", "saldo a pagar", "pago total", "saldo total", "total del resumen"], amountsIn);
  const mins = near(lines, ["pago m[ií]nimo", "m[ií]nimo a pagar"], amountsIn);
  const total = totals.find((h) => !h.usd)?.value ?? null, totalUsd = totals.find((h) => h.usd)?.value ?? null;
  const minimum = mins.find((h) => !h.usd)?.value ?? null, minimumUsd = mins.find((h) => h.usd)?.value ?? null;
  // Compras en cuotas: "DESCRIPCIÓN ... C.03/06 ... 12.345,67" o "Cuota 3 de 6".
  const carry: ParsedStatement["carry"] = [];
  const re = new RegExp(String.raw`^(?:\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\s+)?(.+?)\s+(?:c(?:uota)?\.?\s*)(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b.*?${AMOUNT}\s*$`, "gim");
  for (const m of t.matchAll(re)) {
    const cur = Number(m[2]), of = Number(m[3]), amount = toNumber(m[4]);
    if (!amount || of < 2 || cur < 1 || cur > of || of > 60) continue;
    const left = of - cur;
    if (left < 1) continue;
    const description = m[1].replace(/\s{2,}/g, " ").replace(/[*#]+/g, "").trim().slice(0, 80);
    if (description.length < 2) continue;
    carry.push({ description, amount, remaining: left });
  }
  // Compras: "DD/MM/AA  DESCRIPCIÓN  12.345,67" (sin cuotas: esas van aparte).
  const purchases: ParsedStatement["purchases"] = [];
  const pre = new RegExp(String.raw`^\s*${DATE}\s+(.+?)\s+${AMOUNT}\s*$`, "gim");
  const year = Number((closingDate ?? "").slice(0, 4)) || new Date().getUTCFullYear();
  for (const m of t.matchAll(pre)) {
    const desc = m[4].replace(/\s{2,}/g, " ").replace(/[*#]+/g, "").trim();
    if (/\bc(?:uota)?\.?\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/i.test(desc)) continue;
    if (/saldo|total|pago|m[ií]nimo|vencimiento|cierre|su pago|intereses|impuesto|iva\b|percepci|sellos/i.test(desc)) continue;
    const iso = toIso(m[1], m[2], m[3].length <= 2 && Number(m[3]) > 31 ? m[3] : m[3]) ?? null;
    const amount = toNumber(m[5]);
    if (!iso || !amount || desc.length < 2) continue;
    if (Math.abs(Number(iso.slice(0, 4)) - year) > 1) continue;
    purchases.push({ date: iso, description: desc.slice(0, 80), amount });
  }
  const found = [closingDate && "cierre", dueDate && "vencimiento", total && "total", minimum && "pago mínimo", totalUsd && "total en dólares", carry.length && `${carry.length} compras en cuotas`].filter(Boolean) as string[];
  if (purchases.length) found.push(`${purchases.length} compras`);
  return { closingDate, dueDate, total, minimum, totalUsd, minimumUsd, carry: carry.slice(0, 40), purchases: purchases.slice(0, 200), found };
}

export async function readStatementPdf(bytes: Uint8Array): Promise<ParsedStatement> {
  const lines = await pdfLines(bytes, { maxPages: 30, what: "el resumen" });
  return parseStatementText(lines.map((l) => l.text).join("\n"), lines);
}

export async function pdfText(bytes: Uint8Array, opt: { maxPages: number; what: string }): Promise<string> {
  return (await pdfLines(bytes, opt)).map((l) => l.text).join("\n");
}

// Renglones de un PDF (sin IA), armados por posición. Avisa con palabras simples si tiene contraseña o es una foto.
export async function pdfLines(bytes: Uint8Array, opt: { maxPages: number; what: string }): Promise<PdfLine[]> {
  if (bytes.length > 5_000_000) throw new UserError("El PDF supera 5 MB.");
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new UserError("El archivo no es un PDF.");
  const out: PdfLine[] = [];
  try {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > opt.maxPages) throw new UserError("El PDF tiene demasiadas páginas.");
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      type It = { str: string; x: number; y: number; w: number };
      const items: It[] = (content.items as { str?: string; transform?: number[]; width?: number }[])
        .filter((i) => typeof i.str === "string" && i.str.length && i.transform)
        .map((i) => ({ str: i.str!, x: i.transform![4], y: i.transform![5], w: i.width ?? i.str!.length * 5 }));
      // Mismo renglón: misma altura (con 3 puntos de tolerancia).
      const rows: It[][] = [];
      for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
        const row = rows.find((r) => Math.abs(r[0].y - it.y) <= 3);
        if (row) row.push(it); else rows.push([it]);
      }
      for (const r of rows) {
        r.sort((a, b) => a.x - b.x);
        let text = "", xs: number[] = [], end = -Infinity;
        for (const it of r) {
          if (text && it.x - end > 1.5) { const gap = Math.max(1, Math.min(6, Math.round((it.x - end) / 4))); text += " ".repeat(gap); for (let k = 0; k < gap; k++) xs.push(end + k); }
          const cw = it.w / Math.max(1, it.str.length);
          for (let k = 0; k < it.str.length; k++) xs.push(it.x + k * cw);
          text += it.str;
          end = it.x + it.w;
        }
        out.push({ text, xs });
      }
    }
    void extractText;
  } catch (e) {
    if (e instanceof UserError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (/password/i.test(msg)) throw new UserError(`El PDF tiene contraseña. Abrilo, guardalo sin contraseña o cargá ${opt.what} a mano.`);
    throw new UserError(`No pudimos leer ese PDF. Cargá ${opt.what} a mano.`);
  }
  if (out.map((l) => l.text).join("").replace(/\s/g, "").length < 40) throw new UserError(`El PDF no tiene texto (parece una foto o un escaneo). Cargá ${opt.what} a mano.`);
  return out;
}
