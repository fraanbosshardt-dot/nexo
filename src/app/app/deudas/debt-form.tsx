"use client";
// Formulario de una deuda o préstamo, pensado para cualquiera:
// 1) lo ideal: subir el contrato en PDF y revisar lo que encontramos;
// 2) a mano: 5 datos fáciles (cuánto, cuántas cuotas, cuánto pagás por mes, cuándo vence la primera);
// 3) si las cuotas no son todas iguales: pegar el cronograma o corregirlas una por una;
// 4) lo técnico (sistema, tasas, etc.) queda en "Más detalles".
import { Help } from "@/components/help";
import { useMemo, useState, useTransition } from "react";
import { readDebtPdfAction } from "@/app/actions/modules";
import { parseSchedule } from "@/lib/debt-text";

const KINDS = ["Préstamo personal", "Préstamo de billetera virtual", "Financiación bancaria", "Deuda informal", "Deuda comercial", "Plan de pagos de impuestos", "Deuda con proveedor", "Refinanciación"];

const SYSTEMS: [string, string, string][] = [
  ["FRENCH", "Francés (cuota fija)", "La cuota es la misma todos los meses. Es el más común en préstamos personales."],
  ["GERMAN", "Alemán (cuota que baja)", "Devolvés la misma parte de capital cada mes. La cuota empieza alta y baja."],
  ["AMERICAN", "Americano", "Pagás solo intereses cada mes y todo el capital en la última cuota."],
  ["NO_INTEREST", "Sin interés", "El importe se divide en partes iguales."],
  ["NONE", "Sin cuotas fijas", "Para deudas informales: registrás los pagos cuando los hacés."],
];

export type ScheduleRowInput = { due: string; total: string }; // AAAA-MM-DD, "1234.56"
// Valores para editar una deuda (en el alta van vacíos).
export type DebtDefaults = { creditor?: string; kind?: string; system?: string; principal?: string; installments?: string; firstDue?: string; installmentAmount?: string; tna?: string; tea?: string; cft?: string; startDate?: string; paidInstallments?: string; notes?: string; rows?: ScheduleRowInput[] };

const fmt = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const es = (n: string | null | undefined) => (n ? fmt(Number(n)) : undefined);
const pctEs = (n: string | null | undefined) => (n ? n.replace(".", ",") : undefined);
// "120.500,50" · "120500,5" · "120500.50" → número
const num = (s: string) => {
  const t = s.replace(/\$|\s/g, "");
  if (!t) return NaN;
  if (/,/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
};
const addMonth = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()))); return dt.toISOString().slice(0, 10); };

export function DebtFormFields({ accounts, today, baseCurrency, d: initial = {}, edit = false }: { accounts: { id: string; name: string; currency: string }[]; today: string; baseCurrency: string; d?: DebtDefaults; edit?: boolean }) {
  const [d, setD] = useState<DebtDefaults>(initial);
  const [ver, setVer] = useState(0); // al leer el PDF, los campos se vuelven a armar con lo encontrado
  const [sys, setSys] = useState(initial.system && initial.system !== "MANUAL" ? initial.system : "FRENCH");
  const [rows, setRows] = useState<{ due: string; total: string }[]>((initial.rows ?? []).map((r) => ({ due: r.due, total: fmt(Number(r.total)) })));
  const [custom, setCustom] = useState(!!initial.rows?.length);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reading, start] = useTransition();
  const free = !custom && sys === "NONE";
  const withRate = !custom && ["FRENCH", "GERMAN", "AMERICAN"].includes(sys);

  const readPdf = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    setMsg(null);
    start(async () => {
      const r = await readDebtPdfAction(fd);
      if (r.error || !r.data) { setMsg({ kind: "err", text: r.error ?? "No pudimos leer ese PDF." }); return; }
      const c = r.data;
      setD((o) => ({ ...o, creditor: c.creditor ?? o.creditor, principal: es(c.principal) ?? o.principal, installments: c.installments ?? o.installments, installmentAmount: es(c.installmentAmount) ?? o.installmentAmount, tna: pctEs(c.tna) ?? o.tna, tea: pctEs(c.tea) ?? o.tea, cft: pctEs(c.cft) ?? o.cft, firstDue: c.firstDue ?? o.firstDue, startDate: c.startDate ?? o.startDate }));
      if (c.system) setSys(c.system);
      if (c.rows.length) { setRows(c.rows.map((x) => ({ due: x.due, total: fmt(Number(x.total)) }))); setCustom(true); }
      setVer((v) => v + 1);
      const missing = [!c.principal && "el monto", !c.rows.length && !c.installments && "la cantidad de cuotas", !c.rows.length && !c.installmentAmount && !c.tna && "la cuota"].filter(Boolean);
      setMsg({ kind: c.found.length && !missing.length ? "ok" : "err", text: `${c.found.length ? `Encontramos: ${c.found.join(", ")}.` : "No encontramos datos en el PDF."}${missing.length ? ` Falta ${missing.join(", ")}: completalo a mano.` : ""} Revisá todo contra tu contrato antes de guardar.` });
    });
  };

  const readPaste = () => {
    const found = parseSchedule(paste);
    if (!found.length) { setMsg({ kind: "err", text: "No encontramos cuotas en lo que pegaste. Cada renglón tiene que tener una fecha y un importe." }); return; }
    setRows(found.map((x) => ({ due: x.due, total: fmt(Number(x.total)) })));
    setPaste("");
    setMsg({ kind: "ok", text: `Encontramos ${found.length} cuotas. Revisalas y corregí lo que haga falta.` });
  };

  const json = useMemo(() => JSON.stringify(rows.filter((r) => r.due && num(r.total) > 0).map((r) => ({ due: r.due, total: num(r.total).toFixed(2) }))), [rows]);
  const sum = rows.reduce((s, r) => s + (num(r.total) || 0), 0);
  const setRow = (i: number, k: "due" | "total", v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <>
      {!edit && (
        <label className="drop" style={{ cursor: "pointer", display: "block" }}>
          <input type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => { readPdf(e.target.files?.[0]); e.target.value = ""; }} disabled={reading} />
          <b style={{ color: "var(--fg)", fontWeight: 500 }}>{reading ? "Leyendo el contrato…" : "📄 Subí el contrato del préstamo (PDF)"}</b>
          <span style={{ display: "block", fontSize: 13, marginTop: 4 }}>Lo ideal: completamos todo por vos y lo revisás antes de guardar. No guardamos el archivo.</span>
        </label>
      )}
      {msg && <div className={`notice ${msg.kind === "ok" ? "g" : "r"}`} role="status">{msg.text}</div>}
      {!edit && <p className="sub" style={{ margin: 0 }}>O cargalo a mano:</p>}

      <div key={ver} style={{ display: "contents" }}>
        <label className="field">¿A quién le debés?<input name="creditor" placeholder="Ej.: Banco, billetera, familiar" defaultValue={d.creditor} /></label>
        <div className="frow">
          <label className="field">¿Cuánto te prestaron?<input name="principal" inputMode="decimal" placeholder="0,00" defaultValue={d.principal} /></label>
          {!free && !custom && <label className="field">¿En cuántas cuotas?<input name="installments" inputMode="numeric" placeholder="Ej.: 12" defaultValue={d.installments} /></label>}
        </div>
        {!free && !custom && (
          <div className="frow">
            <label className="field">¿Cuánto pagás por mes?<input name="installmentAmount" inputMode="decimal" placeholder="0,00" defaultValue={d.installmentAmount} /></label>
            <label className="field">¿Cuándo vence la primera cuota?<input name="firstDue" type="date" defaultValue={d.firstDue} /></label>
          </div>
        )}
      </div>

      {!free && (
        custom ? (
          <div className="card" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="chead" style={{ margin: 0 }}><div><h3>Tus cuotas</h3><p className="sub" style={{ margin: 0 }}>Cada una con su fecha y su importe, como en el banco.</p></div>
              <button type="button" className="btn sm" onClick={() => setCustom(false)}>Todas las cuotas son iguales</button></div>
            <label className="field">Pegá el cronograma (copiado del homebanking o del PDF)
              <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Ej.:\n1  05/12/2026  $ 120.500,00\n2  05/01/2027  $ 118.900,10"} />
            </label>
            {paste.trim() && <div><button type="button" className="btn sm pri" onClick={readPaste}>Leer cuotas</button></div>}
            {rows.length > 0 && (
              <div className="tw" style={{ maxHeight: 360, overflow: "auto" }}>
                <table><thead><tr><th>#</th><th>Vence</th><th className="n">Cuota</th><th aria-label="Quitar" /></tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i}><td>{i + 1}</td>
                      <td><input type="date" aria-label={`Vencimiento de la cuota ${i + 1}`} value={r.due} onChange={(e) => setRow(i, "due", e.target.value)} /></td>
                      <td className="n"><input inputMode="decimal" aria-label={`Importe de la cuota ${i + 1}`} value={r.total} onChange={(e) => setRow(i, "total", e.target.value)} style={{ textAlign: "right", maxWidth: 140 }} /></td>
                      <td><button type="button" className="dots" aria-label={`Quitar la cuota ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button></td></tr>
                  ))}</tbody>
                  <tfoot><tr><td colSpan={2}>{rows.length} cuotas</td><td className="n"><b>{fmt(sum)}</b></td><td /></tr></tfoot>
                </table>
              </div>
            )}
            <div><button type="button" className="btn sm" onClick={() => setRows((rs) => { const last = rs.at(-1); return [...rs, { due: last?.due ? addMonth(last.due) : today, total: last?.total ?? "" }]; })}>+ Agregar cuota</button></div>
            <input type="hidden" name="rows" value={rows.length ? json : ""} />
          </div>
        ) : (
          <div><button type="button" className="btn sm" onClick={() => setCustom(true)}>Mis cuotas cambian</button>
            <span className="sub" style={{ marginLeft: 8 }}>Pegá el cronograma o cargalas una por una.</span></div>
        )
      )}

      <details className="more" open={edit || !!(d.tna || d.tea || d.cft)}><summary>Más detalles (opcional)</summary>
        <div key={ver} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
          <label className="field">Tipo<select name="kind" defaultValue={d.kind ?? "Préstamo personal"}>{[...(d.kind && !KINDS.includes(d.kind) ? [d.kind] : []), ...KINDS].map((k) => <option key={k}>{k}</option>)}</select></label>
          {custom ? <input type="hidden" name="system" value="MANUAL" /> : (
            <label className="field">Cómo se calculan las cuotas<select name="system" value={sys} onChange={(e) => setSys(e.target.value)}>{SYSTEMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><span className="sub" style={{ fontWeight: 400 }}>{SYSTEMS.find((s) => s[0] === sys)?.[2]}</span></label>
          )}
          {(withRate || custom) && (
            <>
              <div className="frow" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}><label className="field"><span>TNA % <Help term="TNA" /></span><input name="tna" inputMode="decimal" defaultValue={d.tna} /></label><label className="field"><span>TEA % <Help term="TEA" /></span><input name="tea" inputMode="decimal" defaultValue={d.tea} /></label><label className="field"><span>CFT % <Help term="CFT" /></span><input name="cft" inputMode="decimal" defaultValue={d.cft} /></label></div>
              <p className="sub" style={{ margin: 0 }}>Si sabés cuánto pagás por mes, no hacen falta: la cuota manda y la tasa sale de ahí.</p>
            </>
          )}
          <div className="frow"><label className="field">Fecha del préstamo<input name="startDate" type="date" defaultValue={d.startDate ?? today} /></label>{!free && <label className="field">Cuotas ya pagadas<input name="paidInstallments" inputMode="numeric" placeholder="0" defaultValue={d.paidInstallments} /></label>}</div>
          {!edit && <><div className="frow"><label className="field">Cuenta<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label><label className="field">Moneda (si no elegís cuenta)<input name="currency" defaultValue={baseCurrency} /></label></div>
          <label className="simtg"><input type="checkbox" name="credited" /><span>El dinero entró en esa cuenta ahora (no cuenta como ingreso)</span></label></>}
          <label className="field">Notas<input name="notes" defaultValue={d.notes} /></label>
        </div>
      </details>
    </>
  );
}
