"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { createMovementAction } from "@/app/actions/app";
import { formatMoney, parseAmount } from "@/lib/money";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentId: string | null };
type Kind = "EXPENSE" | "INCOME" | "TRANSFER";
type Status = "PAID" | "PARTIAL" | "PENDING";

const MONTHS = (today: string) => {
  const [y, m] = today.split("-").map(Number);
  return [-1, 0, 1].map((o) => {
    const d = new Date(Date.UTC(y, m - 1 + o, 1));
    const v = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const l = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
    return [v, l] as const;
  });
};

export function MovementForm({ accounts, categories, today, initialKind, initialAccount, baseCurrency, idem }: { accounts: Account[]; categories: Category[]; today: string; initialKind: Kind; initialAccount?: string; baseCurrency: string; idem: string }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [status, setStatus] = useState<Status>("PAID");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("");
  const [cat, setCat] = useState("");
  const [account, setAccount] = useState(accounts.find((a) => a.id === initialAccount)?.id ?? accounts[0].id);
  const [toAccount, setToAccount] = useState(accounts.find((a) => a.id !== account)?.id ?? "");
  const g = kind === "EXPENSE";
  const cur = accounts.find((a) => a.id === account)?.currency ?? baseCurrency;
  const toCur = accounts.find((a) => a.id === toAccount)?.currency;
  const cats = useMemo(() => {
    const k = g ? "EXPENSE" : "INCOME";
    const parents = categories.filter((c) => c.kind === k && !c.parentId);
    return parents.flatMap((p) => [{ id: p.id, label: p.name }, ...categories.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  }, [categories, g]);

  const hint = (() => {
    const tot = parseAmount(amount);
    if (kind === "TRANSFER") return "Una transferencia no cuenta como ingreso ni como gasto: el dinero solo cambia de cuenta.";
    if (!tot) return "Ingresá el importe para ver cómo queda.";
    const verb = g ? "Salen" : "Entran", prep = g ? "de" : "a";
    if (status === "PENDING") return `Queda ${g ? "por pagar" : "por cobrar"} ${formatMoney(tot, cur)}. Tu saldo no cambia hasta que lo registres.`;
    const p = parseAmount(status === "PAID" ? paid || amount : paid);
    if (!p) return `Ingresá cuánto ${g ? "pagaste" : "cobraste"}.`;
    if (status === "PARTIAL") return p.gte(tot) ? `Eso cubre el total: elegí "${g ? "Pagado" : "Cobrado"}".` : `${verb} ${formatMoney(p, cur)} ${prep} tu cuenta y quedan ${formatMoney(tot.minus(p), cur)} pendientes.`;
    if (!p.eq(tot)) return `${verb} ${formatMoney(p, cur)} ${prep} tu cuenta. Se guarda que fue distinto de lo previsto (${formatMoney(p.minus(tot), cur, { sign: true })}).`;
    return `${verb} ${formatMoney(p, cur)} ${prep} tu cuenta.`;
  })();

  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="seg" style={{ display: "flex" }}>{opts.map(([k, l]) => <button type="button" key={k} className={value === k ? "on" : ""} style={{ flex: 1 }} onClick={() => set(k)}>{l}</button>)}</div>
  );

  return (
    <ActionForm action={createMovementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="idem" value={idem} />
      {seg(kind, (k) => { setKind(k); setCat(""); }, [["EXPENSE", "Gasto"], ["INCOME", "Ingreso"], ["TRANSFER", "Transferencia"]])}

      {kind === "TRANSFER" ? (
        <>
          <div className="frow">
            <label className="field">Desde<select name="fromAccountId" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
            <label className="field">Hacia<select name="toAccountId" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          </div>
          <div className="frow">
            <label className="field">Importe ({cur})<input name="amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field">Fecha<input name="date" type="date" defaultValue={today} /></label>
          </div>
          {toCur && toCur !== cur && <label className="field">Cotización usada ({baseCurrency} por {cur === baseCurrency ? toCur : cur})<input name="fxRate" inputMode="decimal" placeholder="Ej.: 1.415" /></label>}
          <label className="field">Concepto (opcional)<input name="description" placeholder="Ej.: Fondos para gastos diarios" /></label>
        </>
      ) : (
        <>
          <label className="field">Concepto<input name="description" placeholder={g ? "Ej.: Supermercado" : "Ej.: Sueldo"} autoFocus /></label>
          <div className="frow">
            <label className="field">Importe total<input name="amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field">Categoría
              <select name="categoryId" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Sin categoría</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                <option value="__new">+ Nueva categoría…</option>
              </select>
            </label>
          </div>
          {cat === "__new" && <label className="field">Nombre de la categoría nueva<input name="newCategory" placeholder="Ej.: Mascotas" autoFocus /></label>}
          <label className="field">{g ? "Cuenta" : "Cuenta donde entra"}<select name="accountId" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
          <div className="field">Estado{seg(status, setStatus, [["PAID", g ? "Pagado" : "Cobrado"], ["PARTIAL", g ? "Pago parcial" : "Cobro parcial"], ["PENDING", "Pendiente"]])}</div>
          {status !== "PENDING" && (
            <div className="frow">
              <label className="field">{status === "PARTIAL" ? (g ? "¿Cuánto pagaste?" : "¿Cuánto cobraste?") : g ? "Importe pagado" : "Importe cobrado"}<input name="paidAmount" inputMode="decimal" placeholder={amount || "0,00"} value={paid} onChange={(e) => setPaid(e.target.value)} /></label>
              <label className="field">{g ? "Fecha de pago" : "Fecha de cobro"}<input name="effectiveDate" type="date" defaultValue={today} /></label>
            </div>
          )}
          {status !== "PAID" && <label className="field">{status === "PARTIAL" ? "El resto vence el" : "Vence el"}<input name="dueDate" type="date" defaultValue={today} /></label>}
        </>
      )}
      <div className="calc" aria-live="polite">{hint}</div>

      {kind !== "TRANSFER" && (
        <details className="more">
          <summary>Más opciones</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
            <label className="field">Corresponde al mes<select name="economicPeriod" defaultValue={today.slice(0, 7)}>{MONTHS(today).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {kind === "INCOME" && status !== "PAID" && <label className="simtg"><input type="checkbox" name="probable" /><span>No está confirmado (se muestra como probable)</span></label>}
            <label className="field">Etiquetas<input name="tags" placeholder="Ej.: vacaciones, auto" /></label>
            <label className="field">Notas<input name="notes" /></label>
            <p className="sub">Repetir todos los meses llega con las reglas recurrentes (Fase 3).</p>
          </div>
        </details>
      )}
      <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar</Submit></div>
    </ActionForm>
  );
}
