// Prueba local: muestra los renglones del PDF tal como los arma la lectura (por posición).
import { readFileSync } from "node:fs";
import { pdfLines } from "../src/server/statement-pdf";
pdfLines(new Uint8Array(readFileSync(process.argv[2])), { maxPages: 30, what: "x" })
  .then((ls) => { ls.slice(0, Number(process.argv[3] ?? 60)).forEach((l, i) => console.log(String(i).padStart(3), "|" + l.text)); process.exit(0); }, (e) => { console.error(e.message); process.exit(1); });
