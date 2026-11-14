// Excel (.xlsx) sin dependencias: escribe una hoja simple y lee la primera hoja de un archivo.
// Un .xlsx es un ZIP con archivos XML. Al escribir se guarda sin comprimir; al leer se usa zlib de Node.
import { inflateRawSync } from "node:zlib";

// ---------- ZIP ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files: { name: string; data: Buffer }[]) {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), crc = crc32(f.data), size = f.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(size, 20); c.writeUInt32LE(size, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += 30 + name.length + size;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

function unzip(buf: Buffer) {
  const MAX_EXPANDED = 20_000_000;
  let expanded = 0;
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("No es un archivo Excel válido.");
  const count = buf.readUInt16LE(eocd + 10);
  if (count > 100) throw new Error("El Excel contiene demasiados archivos internos.");
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    if (![0, 8].includes(method) || usize > MAX_EXPANDED - expanded) throw new Error("El Excel supera el tamaño descomprimido permitido.");
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lofs = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    const start = lofs + 30 + buf.readUInt16LE(lofs + 26) + buf.readUInt16LE(lofs + 28);
    const raw = buf.subarray(start, start + csize);
    if (start + csize > buf.length || out.has(name)) throw new Error("El Excel tiene una estructura inválida.");
    const data = method === 8 ? inflateRawSync(raw, { maxOutputLength: MAX_EXPANDED - expanded }) : Buffer.from(raw);
    expanded += data.length;
    if (expanded > MAX_EXPANDED || data.length !== usize) throw new Error("El Excel supera el tamaño descomprimido permitido.");
    out.set(name, data);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---------- Escribir ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const col = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export type Cell = string | number | Date | null | undefined;

// Una hoja con encabezado en negrita. Las fechas se guardan como fecha de Excel y los números como número.
export function writeXlsx(sheetName: string, header: string[], rows: Cell[][]) {
  const cell = (v: Cell, r: number, c: number, bold = false) => {
    const ref = `${col(c)}${r}`;
    if (v == null || v === "") return "";
    if (v instanceof Date) return `<c r="${ref}" s="2"><v>${(v.getTime() / 864e5 + 25569).toFixed(5)}</v></c>`;
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="3"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
  };
  const sheetRows = [`<row r="1">${header.map((h, c) => cell(h, 1, c, true)).join("")}</row>`, ...rows.map((r, i) => `<row r="${i + 2}">${r.map((v, c) => cell(v, i + 2, c)).join("")}</row>`)];
  const widths = header.map((h, c) => Math.min(60, Math.max(h.length, ...rows.slice(0, 500).map((r) => (r[c] instanceof Date ? 10 : String(r[c] ?? "").length))) + 2));
  const sheet = `${XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;
  const name = esc(sheetName.slice(0, 31));
  const f = (n: string, s: string) => ({ name: n, data: Buffer.from(s, "utf8") });
  return zip([
    f("[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    f("_rels/.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f("xl/workbook.xml", `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    f("xl/_rels/workbook.xml.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    f("xl/styles.xml", `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs></styleSheet>`),
    f("xl/worksheets/sheet1.xml", sheet),
  ]);
}

// ---------- Leer ----------

const unesc = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
const colIndex = (ref: string) => { const letters = ref.replace(/\d+/g, ""); let n = 0; for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// Devuelve la primera hoja como filas de texto. Las celdas con formato de fecha salen como dd/mm/aaaa.
export function readXlsx(buf: Buffer): string[][] {
  const files = unzip(buf);
  const text = (n: string) => files.get(n)?.toString("utf8") ?? "";
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  // Estilos con formato de fecha (14-22 son fechas en Excel; también formatos propios con d/m/y).
  const styles = text("xl/styles.xml");
  const custom = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((m) => [Number(m[1]), m[2]]));
  const xfs = [...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "").matchAll(/<xf\b([^>]*)>/g)].map((m) => Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0));
  const isDate = (s: number) => { const id = xfs[s]; return id != null && ((id >= 14 && id <= 22) || /[dy]/i.test((custom.get(id) ?? "").replace(/\[[^\]]*\]/g, ""))); };
  const rels = text("xl/_rels/workbook.xml.rels");
  const firstId = text("xl/workbook.xml").match(/<sheet [^>]*r:id="([^"]+)"/)?.[1];
  const target = firstId ? rels.match(new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1] : null;
  const sheet = text(target ? `xl/${target.replace(/^\/?xl\//, "")}` : "xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= 10000) throw new Error("El Excel supera las 10.000 filas permitidas.");
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inner = c[2] ?? "";
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      if (ref && colIndex(ref) >= 256) throw new Error("El Excel supera las 256 columnas permitidas.");
      const t = attrs.match(/t="(\w+)"/)?.[1];
      const s = Number(attrs.match(/s="(\d+)"/)?.[1] ?? 0);
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (t === "s" && v != null) val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
      else if (v != null && isDate(s) && t !== "str") { const d = new Date(Math.round((Number(v) - 25569) * 864e5)); val = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`; }
      else if (v != null) val = unesc(v);
      row[ref ? colIndex(ref) : row.length] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}
