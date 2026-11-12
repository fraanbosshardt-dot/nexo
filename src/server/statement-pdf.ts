// Lee el texto de un resumen de tarjeta en PDF, en el propio servidor y sin IA (gratis).
// Nunca guarda nada: devuelve lo que encontró para que la persona lo revise y confirme.
import { extractText, getDocumentProxy } from "unpdf";
import { UserError } from "./ledger";

export type ParsedStatement = {
  closingDate: string | null; // AAAA-MM-DD
  dueDate: string | null;
  total: string | null; // "123456.78"
  minimum: string | null;
  carry: { description: string; amount: string; remaining: number }[];
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
function firstDate(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = new RegExp(`${l}[^\\d\\n]{0,40}${DATE}`, "i").exec(text);
    if (m) { const iso = toIso(m[1], m[2], m[3]); if (iso) return iso; }
  }
  return null;
}
function firstAmount(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = new RegExp(`${l}[^\\d\\n$-]{0,40}${AMOUNT}`, "i").exec(text);
    if (m) { const n = toNumber(m[1]); if (n) return n; }
  }
  return null;
}

// Separado de la lectura del PDF para poder probarlo con texto.
export function parseStatementText(text: string): ParsedStatement {
  const t = text.replace(/ /g, " ").replace(/[ \t]+/g, " ");
  const closingDate = firstDate(t, ["cierre actual", "fecha de cierre", "cierre"]);
  const dueDate = firstDate(t, ["vencimiento actual", "fecha de vencimiento", "vencimiento", "vto\\.?"]);
  const total = firstAmount(t, ["saldo actual", "total a pagar", "saldo a pagar", "pago total", "saldo total"]);
  const minimum = firstAmount(t, ["pago m[ií]nimo", "m[ií]nimo a pagar"]);
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
  const found = [closingDate && "cierre", dueDate && "vencimiento", total && "total", minimum && "pago mínimo", carry.length && `${carry.length} compras en cuotas`].filter(Boolean) as string[];
  return { closingDate, dueDate, total, minimum, carry: carry.slice(0, 40), found };
}

export async function readStatementPdf(bytes: Uint8Array): Promise<ParsedStatement> {
  return parseStatementText(await pdfText(bytes, { maxPages: 30, what: "el resumen" }));
}

// Texto de un PDF (sin IA). Avisa con palabras simples si tiene contraseña o es una foto.
export async function pdfText(bytes: Uint8Array, opt: { maxPages: number; what: string }): Promise<string> {
  if (bytes.length > 5_000_000) throw new UserError("El PDF supera 5 MB.");
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new UserError("El archivo no es un PDF.");
  let text = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > opt.maxPages) throw new UserError("El PDF tiene demasiadas páginas.");
    const r = await extractText(pdf, { mergePages: false });
    text = (Array.isArray(r.text) ? r.text : [r.text]).join("\n");
  } catch (e) {
    if (e instanceof UserError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (/password/i.test(msg)) throw new UserError(`El PDF tiene contraseña. Abrilo, guardalo sin contraseña o cargá ${opt.what} a mano.`);
    throw new UserError(`No pudimos leer ese PDF. Cargá ${opt.what} a mano.`);
  }
  if (text.replace(/\s/g, "").length < 40) throw new UserError(`El PDF no tiene texto (parece una foto o un escaneo). Cargá ${opt.what} a mano.`);
  return text;
}
