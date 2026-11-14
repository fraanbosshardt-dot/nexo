"use client";
import { useState, useTransition } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { loadStatementAction, readStatementPdfAction } from "@/app/actions/modules";

type Row = { description: string; amount: string; remaining: string };
const es = (n: string | null) => (n ? n.replace(".", ",") : "");

// Cargar un resumen: a mano, o leyendo el PDF (Pro). Nada se guarda hasta que la persona lo confirma.
// Si la tarjeta tiene otra moneda (ej.: dólares), ese resumen se carga en el mismo paso.
export function StatementForm({ cardId, closing, due, pdf, pdfLeft, currency, second, simple = false, closingDay, estimate = null, loadedClosings = [] }: { cardId: string; closing: string; due: string; pdf: boolean; pdfLeft: number; currency: string; second?: { cardId: string; currency: string } | null; simple?: boolean; closingDay?: number; estimate?: number | null; loadedClosings?: string[] }) {
  const [v, setV] = useState({ closingDate: closing, dueDate: due, total: "", minimum: "", totalUsd: "", minimumUsd: "" });
  const [usdOnly, setUsdOnly] = useState<string | null>(null); // dólares encontrados en una tarjeta sin esa moneda
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState<"manual" | "pdf">("manual");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Compras del PDF que no están en Somos Guafra: se eligen y se suman al guardar el resumen.
  const [missing, setMissing] = useState<{ date: string; description: string; amount: string; on: boolean }[]>([]);
  const [reading, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const setRow = (i: number, k: keyof Row, val: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: val } : x)));

  const readPdf = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("cardId", cardId);
    setMsg(null);
    start(async () => {
      const r = await readStatementPdfAction(fd);
      if (r.error || !r.data) { setMsg({ kind: "err", text: r.error ?? "No pudimos leer ese PDF." }); return; }
      const d = r.data;
      setV({ closingDate: d.closingDate ?? v.closingDate, dueDate: d.dueDate ?? v.dueDate, total: es(d.total), minimum: es(d.minimum), totalUsd: es(d.totalUsd), minimumUsd: es(d.minimumUsd) });
      setUsdOnly(!second && d.totalUsd && Number(d.totalUsd) > 0 ? es(d.totalUsd) : null);
      setRows(d.carry.map((c) => ({ description: c.description, amount: es(c.amount), remaining: String(c.remaining) })));
      setSource("pdf");
      setMissing((d.missing ?? []).map((m) => ({ ...m, on: true })));
      const missing = [!d.closingDate && "el cierre", !d.dueDate && "el vencimiento", !d.total && "el total"].filter(Boolean);
      setMsg({ kind: missing.length ? "err" : "ok", text: `${d.found.length ? `Encontramos: ${d.found.join(", ")}.` : "No encontramos datos en el PDF."}${missing.length ? ` Falta ${missing.join(", ")}: completalo a mano.` : ""} Revisá cada dato contra tu resumen antes de guardar.${typeof r.left === "number" ? ` Te quedan ${r.left} lecturas este mes.` : ""}` });
    });
  };

  // Avisos para no cargar algo mal (no frenan: avisan y explican).
  const n = (x: string) => { const t = x.replace(/\$|\s/g, ""); return Number(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t) || 0; };
  const fmt = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const warn: string[] = [];
  const cd = v.closingDate ? Number(v.closingDate.slice(8, 10)) : 0;
  const gap = v.closingDate && v.dueDate ? (Date.parse(v.dueDate) - Date.parse(v.closingDate)) / 864e5 : null;
  if (gap != null && gap <= 0) warn.push("El vencimiento es antes del cierre: revisá las fechas (el vencimiento siempre es después).");
  else if (gap != null && (gap < 3 || gap > 25)) warn.push(`Entre el cierre y el vencimiento hay ${Math.round(gap)} días. Lo normal es entre 7 y 15: ¿están bien las fechas?`);
  if (closingDay && cd && Math.min(Math.abs(cd - closingDay), 31 - Math.abs(cd - closingDay)) > 5) warn.push(`Tu tarjeta suele cerrar el ${closingDay} y pusiste el ${cd}. Si el banco lo movió este mes, está bien.`);
  if (loadedClosings.includes(v.closingDate)) warn.push("Ese resumen ya lo cargaste: si lo guardás de nuevo, se corrige (no se duplica).");
  if (v.total && n(v.minimum) > n(v.total)) warn.push("El pago mínimo es mayor que el total: revisalo.");
  if (!simple && estimate != null && estimate > 0 && v.total && Math.abs(n(v.total) - estimate) / estimate > 0.3) warn.push(`Con las compras que cargaste, Somos Guafra calculaba ${fmt(estimate)}. Si la diferencia son compras que no cargaste, sumalas antes (o elegí las del PDF); si no, la diferencia queda como ajuste del resumen.`);

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
        <label className="field">Total a pagar{second ? ` en ${currency}` : ""}<input name="total" inputMode="decimal" placeholder="0,00" value={v.total} onChange={set("total")} required /></label>
        <label className="field">Pago mínimo{second ? ` en ${currency}` : ""} (opcional)<input name="minimum" inputMode="decimal" placeholder="0,00" value={v.minimum} onChange={set("minimum")} /></label>
      </div>
      {second && (
        <div className="frow">
          <input type="hidden" name="secondCardId" value={second.cardId} />
          <label className="field">Total a pagar en {second.currency}<input name="totalUsd" inputMode="decimal" placeholder="0,00" value={v.totalUsd} onChange={set("totalUsd")} /></label>
          <label className="field">Pago mínimo en {second.currency} (opcional)<input name="minimumUsd" inputMode="decimal" placeholder="0,00" value={v.minimumUsd} onChange={set("minimumUsd")} /></label>
        </div>
      )}
      {usdOnly && <p className="notice" role="status" style={{ margin: 0 }}>Este resumen también tiene US$ {usdOnly} en dólares. Para cargarlo, activá “También tiene consumos en otra moneda” en Editar tarjeta y volvé a subir el PDF.</p>}
      {!simple && <>
      <details className="more stm-carry" open={rows.length > 0}>
        <summary>¿Este resumen trae compras en cuotas que siguen? (opcional)</summary>
        <div className="stm-carry-body">
          <p className="sub" style={{ margin: 0 }}>Por ejemplo, si trae la cuota 3 de 6 de una heladera, ponés lo que pagás por mes y “3” en Faltan. Así aparecen solas en los próximos resúmenes.</p>
        {rows.map((r, i) => (
          <div className="carry-row" key={i}>
            <label className="field">Qué compraste<input name="carryDescription" value={r.description} onChange={(e) => setRow(i, "description", e.target.value)} maxLength={120} /></label>
            <label className="field">Cuota<input name="carryAmount" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, "amount", e.target.value)} /></label>
            <label className="field">Faltan<input name="carryRemaining" inputMode="numeric" value={r.remaining} onChange={(e) => setRow(i, "remaining", e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
            <button type="button" className="btn ghost sm" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={`Quitar ${r.description || "fila"}`}>Quitar</button>
          </div>
        ))}
        <div><button type="button" className="btn sm" onClick={() => setRows((x) => [...x, { description: "", amount: "", remaining: "" }])}>+ Agregar una compra en cuotas</button></div>
        </div>
      </details>
      {simple && <p className="sub" style={{ margin: 0 }}>El total se anota como un gasto de ese mes (categoría “Tarjeta de crédito”) y aparece en Próximos pagos para pagarlo. No lo cargues además como gasto en Movimientos: se contaría dos veces.</p>}
      {warn.length > 0 && <div className="notice" role="status" style={{ display: "flex", flexDirection: "column", gap: 4 }}>{warn.map((w) => <span key={w}>⚠️ {w}</span>)}</div>}
      {!simple && missing.length > 0 && (
        <div className="field">
          <span>Compras del resumen que no están cargadas en Somos Guafra ({missing.filter((m) => m.on).length} de {missing.length} elegidas)</span>
          <div className="list">{missing.map((m, i) => (
            <label className="li simtg" key={i} style={{ alignItems: "center" }}><input type="checkbox" checked={m.on} onChange={(e) => setMissing((x) => x.map((y, j) => (j === i ? { ...y, on: e.target.checked } : y)))} />
              <span className="grow"><span className="t">{m.description}</span><br /><span className="s">{m.date.split("-").reverse().join("/")}</span></span><b className="num">{Number(m.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</b></label>
          ))}</div>
          <span className="sub" style={{ fontWeight: 400 }}>Las elegidas se suman como compras (después les ponés categoría desde Movimientos). Las demás ya están en Somos Guafra o no las querés.</span>
          <input type="hidden" name="addPurchases" value={JSON.stringify(missing.filter((m) => m.on).map(({ date, description, amount }) => ({ date, description, amount })))} />
        </div>
      )}

      </>}
      <div className="stm-foot">
        <p className="sub">{simple ? "Se guarda como el gasto de la tarjeta de ese mes." : "Lo que debías antes de usar Somos Guafra se carga como saldo de la tarjeta, no como un gasto nuevo."}</p>
        <Submit>Guardar resumen</Submit>
      </div>
    </ActionForm>
  );
}
