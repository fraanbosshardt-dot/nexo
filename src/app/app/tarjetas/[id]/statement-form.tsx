"use client";
import { useState, useTransition } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { loadStatementAction, readStatementPdfAction } from "@/app/actions/modules";

type Row = { description: string; amount: string; remaining: string };
const es = (n: string | null) => (n ? n.replace(".", ",") : "");

// Cargar un resumen: a mano, o leyendo el PDF (Pro). Nada se guarda hasta que la persona lo confirma.
export function StatementForm({ cardId, closing, due, pdf, pdfLeft }: { cardId: string; closing: string; due: string; pdf: boolean; pdfLeft: number }) {
  const [v, setV] = useState({ closingDate: closing, dueDate: due, total: "", minimum: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<"manual" | "pdf">("manual");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reading, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const setRow = (i: number, k: keyof Row, val: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));

  const readPdf = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    setMsg(null);
    start(async () => {
      const r = await readStatementPdfAction(fd);
      if (r.error || !r.data) { setMsg({ kind: "err", text: r.error ?? "No pudimos leer ese PDF." }); return; }
      const d = r.data;
      setV({ closingDate: d.closingDate ?? v.closingDate, dueDate: d.dueDate ?? v.dueDate, total: es(d.total), minimum: es(d.minimum) });
      setRows(d.carry.map((c) => ({ description: c.description, amount: es(c.amount), remaining: String(c.remaining) })));
      setSource("pdf");
      const missing = [!d.closingDate && "el cierre", !d.dueDate && "el vencimiento", !d.total && "el total"].filter(Boolean);
      setMsg({ kind: missing.length ? "err" : "ok", text: `${d.found.length ? `Encontramos: ${d.found.join(", ")}.` : "No encontramos datos en el PDF."}${missing.length ? ` Falta ${missing.join(", ")}: completalo a mano.` : ""} Revisá cada dato contra tu resumen antes de guardar.${typeof r.left === "number" ? ` Te quedan ${r.left} lecturas este mes.` : ""}` });
    });
  };

  return (
    <ActionForm action={loadStatementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="source" value={source} />
      {pdf ? (
        <label className="drop" style={{ cursor: "pointer", display: "block" }}>
          <input type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => readPdf(e.target.files?.[0])} disabled={reading} />
          <b style={{ color: "var(--fg)", fontWeight: 500 }}>{reading ? "Leyendo el PDF…" : "Elegí el PDF de tu resumen"}</b>
          <span style={{ display: "block", fontSize: 13, marginTop: 4 }}>Lo leemos en el momento y no lo guardamos. Te quedan {pdfLeft} lecturas este mes.</span>
        </label>
      ) : (
        <p className="sub" style={{ margin: 0 }}>Con Pro podés subir el PDF del resumen y completamos esto por vos.</p>
      )}
      {msg && <div className={`notice ${msg.kind === "ok" ? "g" : "r"}`} role="status">{msg.text}</div>}
      <div className="frow">
        <label className="field">Fecha de cierre<input name="closingDate" type="date" value={v.closingDate} onChange={set("closingDate")} required /></label>
        <label className="field">Vencimiento<input name="dueDate" type="date" value={v.dueDate} onChange={set("dueDate")} required /></label>
      </div>
      <div className="frow">
        <label className="field">Total a pagar del resumen<input name="total" inputMode="decimal" placeholder="0,00" value={v.total} onChange={set("total")} required /></label>
        <label className="field">Pago mínimo (opcional)<input name="minimum" inputMode="decimal" placeholder="0,00" value={v.minimum} onChange={set("minimum")} /></label>
      </div>
      <div className="field">
        <span>Compras en cuotas que siguen después de este resumen</span>
        {rows.map((r, i) => (
          <div className="frow" key={i} style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 110px auto", alignItems: "end" }}>
            <label className="field">Qué compraste<input name="carryDescription" value={r.description} onChange={(e) => setRow(i, "description", e.target.value)} maxLength={120} /></label>
            <label className="field">Cuota<input name="carryAmount" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, "amount", e.target.value)} /></label>
            <label className="field">Faltan<input name="carryRemaining" inputMode="numeric" value={r.remaining} onChange={(e) => setRow(i, "remaining", e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
            <button type="button" className="btn ghost sm" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={`Quitar ${r.description || "fila"}`}>Quitar</button>
          </div>
        ))}
        <div><button type="button" className="btn sm" onClick={() => setRows((x) => [...x, { description: "", amount: "", remaining: "" }])}>+ Agregar una compra en cuotas</button></div>
        <span className="sub" style={{ fontWeight: 400 }}>Por ejemplo, si este resumen trae la cuota 3 de 6 de una heladera, ponés la cuota y “3” en Faltan. Así aparecen solas en los próximos resúmenes.</span>
      </div>
      <p className="sub" style={{ margin: 0 }}>La deuda que traés se carga como saldo de la tarjeta, no como un gasto nuevo: esas compras ya las hiciste antes de usar Finan.</p>
      <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar resumen</Submit></div>
    </ActionForm>
  );
}
