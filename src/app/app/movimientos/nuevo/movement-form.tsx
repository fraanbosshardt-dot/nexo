"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { createMovementAction } from "@/app/actions/app";
import { formatMoney, parseAmount } from "@/lib/money";

type Account = { id: string; name: string; currency: string; type?: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null };
type Kind = "EXPENSE" | "INCOME" | "TRANSFER";
type Status = "PAID" | "PARTIAL" | "PENDING";
export type History = { d: string; c: string }[]; // concepto ya usado → categoría elegida

const MONTHS = (today: string) => {
  const [y, m] = today.split("-").map(Number);
  return [-1, 0, 1].map((o) => {
    const d = new Date(Date.UTC(y, m - 1 + o, 1));
    const v = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const l = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
    return [v, l] as const;
  });
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
// Palabras frecuentes → nombre de categoría (se usa si nunca cargaste ese concepto).
const HINTS: [RegExp, string][] = [
  [/super|almacen|verduleria|carniceria|mercado|chino|kiosco/, "supermercado"],
  [/nafta|combustible|uber|taxi|colectivo|subte|sube|peaje|estacionamiento|cabify/, "transporte"],
  [/luz|gas|agua|internet|telefono|celular|cable|expensa|edesur|edenor|metrogas/, "servicios"],
  [/alquiler/, "alquiler"],
  [/farmacia|medico|prepaga|obra social|dentista|osde|swiss/, "salud"],
  [/colegio|escuela|universidad|curso|facultad|libro/, "educaci"],
  [/restaurant|resto|bar|cafe|delivery|pedidosya|rappi|cine|salida/, "salida"],
  [/ropa|zapatilla|indumentaria/, "ropa"],
  [/netflix|spotify|disney|hbo|youtube|amazon prime|suscrip/, "suscrip"],
  [/sueldo|salario|haberes/, "sueldo"],
  [/afip|arba|impuesto|monotributo|abl|patente/, "impuesto"],
];

export function MovementForm({ accounts, categories, today, initialKind, initialAccount, initialStatus, baseCurrency, idem, history }: { accounts: Account[]; categories: Category[]; today: string; initialKind: Kind; initialAccount?: string; initialStatus?: Status; baseCurrency: string; idem: string; history: History }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [status, setStatus] = useState<Status>(initialStatus ?? "PAID");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [cat, setCat] = useState("");
  const [catTouched, setCatTouched] = useState(false);
  const [account, setAccount] = useState(accounts.find((a) => a.id === initialAccount)?.id ?? accounts[0].id);
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState("MONTHLY");
  const [more, setMore] = useState(initialStatus === "PENDING");
  const [toAccount, setToAccount] = useState(accounts.find((a) => a.id !== account)?.id ?? "");
  const g = kind === "EXPENSE";
  const cur = accounts.find((a) => a.id === account)?.currency ?? baseCurrency;
  const toCur = accounts.find((a) => a.id === toAccount)?.currency;
  const accName = accounts.find((a) => a.id === account)?.name ?? "";
  const cats = useMemo(() => {
    const k = g ? "EXPENSE" : "INCOME";
    const parents = categories.filter((c) => c.kind === k && !c.parentId);
    return parents.flatMap((p) => [{ id: p.id, label: p.name }, ...categories.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  }, [categories, g]);

  // Categoría sugerida: la que usaste la última vez con ese concepto; si no, por palabras clave.
  const suggest = (text: string) => {
    const t = norm(text);
    if (t.length < 3) return "";
    const ok = new Set(cats.map((c) => c.id));
    const h = history.find((x) => norm(x.d) === t) ?? history.find((x) => norm(x.d).startsWith(t));
    if (h && ok.has(h.c)) return h.c;
    const hint = HINTS.find(([re]) => re.test(t))?.[1];
    const byName = cats.find((c) => (hint && norm(c.label).includes(hint)) || norm(c.label).split(" › ").some((n) => n.length > 3 && t.includes(n)));
    return byName?.id ?? "";
  };
  const onDesc = (v: string) => { setDesc(v); if (!catTouched) setCat(suggest(v)); };

  const statusLabel = status === "PAID" ? (g ? "Pagado" : "Cobrado") : status === "PENDING" ? "Pendiente" : "En parte";
  const hint = (() => {
    const tot = parseAmount(amount);
    if (kind === "TRANSFER") return "Una transferencia no cuenta como ingreso ni como gasto: el dinero solo cambia de cuenta.";
    if (!tot) return null;
    if (status === "PENDING") return `Queda ${g ? "a pagar" : "a cobrar"} ${formatMoney(tot, cur)}. Tu saldo no cambia hasta que lo registres.`;
    const p = parseAmount(status === "PAID" ? paid || amount : paid);
    if (!p) return `Escribí cuánto ${g ? "pagaste" : "cobraste"}.`;
    if (status === "PARTIAL") return p.gte(tot) ? `Eso cubre el total: elegí "${g ? "Pagado" : "Cobrado"}".` : `${g ? "Salen" : "Entran"} ${formatMoney(p, cur)} y quedan ${formatMoney(tot.minus(p), cur)} ${g ? "a pagar" : "a cobrar"}.`;
    return null;
  })();

  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="seg" style={{ display: "flex" }}>{opts.map(([k, l]) => <button type="button" key={k} className={value === k ? "on" : ""} style={{ flex: 1 }} onClick={() => set(k)}>{l}</button>)}</div>
  );

  return (
    <ActionForm action={createMovementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="idem" value={idem} />
      {seg(kind, (k) => { setKind(k); setCat(""); setCatTouched(false); }, [["EXPENSE", "Gasto"], ["INCOME", "Ingreso"], ["TRANSFER", "Transferencia"]])}

      {kind === "TRANSFER" ? (
        <>
          <label className="field">Importe ({cur})<input name="amount" className="amount-in" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></label>
          <div className="frow">
            <label className="field">Desde<select name="fromAccountId" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
            <label className="field">Hacia<select name="toAccountId" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          </div>
          {toCur && toCur !== cur && <label className="field">Cotización usada ({baseCurrency} por {cur === baseCurrency ? toCur : cur})<input name="fxRate" inputMode="decimal" placeholder="Ej.: 1.415" /></label>}
          <details className="more"><summary>Más opciones</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
              <label className="field">Fecha<input name="date" type="date" defaultValue={today} /></label>
              <label className="field">Concepto<input name="description" placeholder="Ej.: Fondos para gastos diarios" /></label>
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="frow" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)" }}>
            <label className="field">Importe<input name="amount" className="amount-in" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></label>
            <label className="field">Concepto<input name="description" placeholder={g ? "Ej.: Supermercado" : "Ej.: Sueldo"} value={desc} onChange={(e) => onDesc(e.target.value)} list="mv-history" autoComplete="off" /></label>
          </div>
          <datalist id="mv-history">{[...new Set(history.map((h) => h.d))].slice(0, 40).map((d) => <option key={d} value={d} />)}</datalist>
          <label className="field">Categoría
            <select name="categoryId" value={cat} onChange={(e) => { setCat(e.target.value); setCatTouched(true); }}>
              <option value="">Sin categoría</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              <option value="__new">+ Nueva categoría…</option>
            </select>
          </label>
          {cat === "__new" && <label className="field">Nombre de la categoría nueva<input name="newCategory" placeholder="Ej.: Mascotas" autoFocus /></label>}
          {!more && <p className="sub" style={{ margin: 0 }}>{statusLabel} hoy · {g ? "desde" : "en"} {accName} · una sola vez</p>}
          <details className="more" open={more} onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}>
            <summary>{more ? "Menos opciones" : "Más opciones: otra fecha, cuenta, pendiente o que se repita"}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 10 }}>
              <label className="field">{g ? "Cuenta" : "Cuenta donde entra"}<select name="accountId" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
              <div className="field">Estado{seg(status, setStatus, [["PAID", g ? "Pagado" : "Cobrado"], ["PARTIAL", "En parte"], ["PENDING", "Pendiente"]])}</div>
              {status !== "PENDING" && (
                <div className="frow">
                  <label className="field">{g ? "Fecha de pago" : "Fecha de cobro"}<input name="effectiveDate" type="date" defaultValue={today} /></label>
                  <label className="field">{status === "PARTIAL" ? (g ? "¿Cuánto pagaste?" : "¿Cuánto cobraste?") : g ? "Pagaste (si fue distinto)" : "Cobraste (si fue distinto)"}<input name="paidAmount" inputMode="decimal" placeholder={amount || "0,00"} value={paid} onChange={(e) => setPaid(e.target.value)} /></label>
                </div>
              )}
              {status !== "PAID" && <label className="field">{status === "PARTIAL" ? "El resto vence el" : "Vence el"}<input name="dueDate" type="date" defaultValue={today} /></label>}
              <div className="field">¿Se repite?
                <div className="seg" style={{ display: "flex" }}>
                  {[["no", "Una sola vez"], ["MONTHLY", "Todos los meses"], ["other", "Otra frecuencia"]].map(([k, l]) => (
                    <button type="button" key={k} className={(k === "no" ? !repeat : k === "MONTHLY" ? repeat && freq === "MONTHLY" : repeat && freq !== "MONTHLY") ? "on" : ""} style={{ flex: 1 }}
                      onClick={() => { setRepeat(k !== "no"); setFreq(k === "other" ? (freq === "MONTHLY" ? "WEEKLY" : freq) : "MONTHLY"); }}>{l}</button>
                  ))}
                </div>
              </div>
              {repeat && (
                <>
                  <input type="hidden" name="repeat" value="on" />
                  <input type="hidden" name="frequency" value={freq} />
                  <div className="frow">
                    {freq !== "MONTHLY" && (
                      <label className="field">Frecuencia<select value={freq} onChange={(e) => setFreq(e.target.value)}>
                        {[["WEEKLY", "Cada semana"], ["BIWEEKLY", "Cada 2 semanas"], ["BIMONTHLY", "Cada 2 meses"], ["QUARTERLY", "Cada 3 meses"], ["SEMIANNUAL", "Cada 6 meses"], ["ANNUAL", "Una vez por año"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select></label>
                    )}
                    <label className="field">Hasta (opcional)<input name="until" type="date" /></label>
                  </div>
                  <label className="simtg"><input type="checkbox" name="variable" /><span>El importe cambia cada vez (por ejemplo, luz o gas)</span></label>
                </>
              )}
              <label className="field">Corresponde al mes<select name="economicPeriod" defaultValue={today.slice(0, 7)}>{MONTHS(today).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {kind === "INCOME" && status !== "PAID" && <label className="simtg"><input type="checkbox" name="probable" /><span>No está confirmado (se muestra como probable)</span></label>}
              <label className="field">Notas<input name="notes" /></label>
            </div>
          </details>
        </>
      )}
      {hint && <div className="calc" aria-live="polite">{hint}</div>}
      <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar</Submit></div>
    </ActionForm>
  );
}
