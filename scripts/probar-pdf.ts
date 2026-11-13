// Prueba local: muestra qué entiende la lectura de resúmenes de un PDF (no guarda nada).
// Uso: npx tsx scripts/probar-pdf.ts ruta/al/resumen.pdf [--texto]
import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { readStatementPdf } from "../src/server/statement-pdf";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pasá la ruta del PDF.");
  const buf = new Uint8Array(readFileSync(file));
  if (process.argv.includes("--texto")) {
    const pdf = await getDocumentProxy(buf.slice());
    const { text } = await extractText(pdf, { mergePages: false });
    (Array.isArray(text) ? text : [text]).forEach((t, i) => console.log(`--- página ${i + 1} ---\n${t}`));
    return;
  }
  const r = await readStatementPdf(buf);
  console.log(JSON.stringify({ ...r, purchases: r.purchases.length, primeras: r.purchases.slice(0, 5) }, null, 1));
}
main().then(() => process.exit(0), (e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
