"use client";
// Carga rápida del celular: una hoja que sube desde abajo con teclado numérico propio y categorías con íconos.
// Se abre desde el + de la barra de abajo o desde los botones redondos de Inicio (evento "nexo:quick").
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createMovementAction } from "@/app/actions/app";
import type { quickAddData } from "@/server/quick-add";
import { Icon, type IconName } from "@/components/icons";
import { ICON_TONE, type CatIcon } from "@/lib/category-icon";

type Kind = "EXPENSE" | "INCOME";
type Data = Awaited<ReturnType<typeof quickAddData>>;

export function openQuickAdd(kind: Kind = "EXPENSE") {
  window.dispatchEvent(new CustomEvent("nexo:quick", { detail: { kind } }));
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"];

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("");
  const [account, setAccount] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [idem, setIdem] = useState("");
  const [state, run, pending] = useActionState(createMovementAction, null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const k = ((e as CustomEvent).detail?.kind as Kind) ?? "EXPENSE";
      setKind(k); setAmount(""); setCat(""); setOpen(true);
      setIdem(crypto.randomUUID?.() ?? String(Date.now()));
      fetch("/api/rapido", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d: Data | null) => { if (d) { setData(d); setAccount((a) => a || d.defaultAccount); } }).catch(() => setData(null));
    };
    window.addEventListener("nexo:quick", onOpen);
    return () => window.removeEventListener("nexo:quick", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (/^[0-9]$/.test(e.key)) setAmount((a) => (a + e.key).replace(/^0+/, "").slice(0, 11));
      else if (e.key === "Backspace") setAmount((a) => a.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => sheet.current?.focus(), 0);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  const cats = useMemo(() => (data?.categories ?? []).filter((c) => c.kind === kind).slice(0, 10), [data, kind]);
  const chosen = cats.find((c) => c.id === cat) ?? null;
  const acc = data?.accounts.find((a) => a.id === account);
  if (!open) return null;

  const press = (k: string) => setAmount((a) => (k === "del" ? a.slice(0, -1) : (a + k).replace(/^0+/, "").slice(0, 11)));
  const shown = amount ? Number(amount).toLocaleString("es-AR") : "0";
  const income = kind === "INCOME";

  return (
    <div className="qa-wrap">
      <button className="qa-back" aria-label="Cerrar" onClick={() => setOpen(false)} />
      <div className="qa-sheet" role="dialog" aria-modal="true" aria-label="Cargar un movimiento" tabIndex={-1} ref={sheet}>
        <span className="qa-grip" aria-hidden="true" />
        <form action={run} className="qa-form">
          <div className="qa-kinds" role="group" aria-label="Tipo">
            {([["EXPENSE", "Gasto"], ["INCOME", "Ingreso"]] as const).map(([k, l]) => (
              <button key={k} type="button" className={kind === k ? "on" : ""} aria-pressed={kind === k} onClick={() => { setKind(k); setCat(""); }}>{l}</button>
            ))}
            <Link href="/app/movimientos/nuevo?estado=pendiente" className="qa-kind-link" onClick={() => setOpen(false)}>A pagar</Link>
          </div>
          <div className="qa-amount" aria-live="polite">
            <span>{income ? "¿Cuánto entró?" : "¿Cuánto gastaste?"}</span>
            <b className={income ? "pos" : ""}>{acc ? `${acc.currency === "ARS" ? "$" : acc.currency} ` : "$ "}{shown}</b>
          </div>
          <div className="qa-cats" role="group" aria-label="Categoría">
            {!data && <span className="qa-loading">Cargando categorías…</span>}
            {cats.map((c) => (
              <button key={c.id} type="button" className={`qa-cat t-${ICON_TONE[c.icon as CatIcon] ?? "s"} ${cat === c.id ? "on" : ""}`} aria-pressed={cat === c.id} onClick={() => setCat(cat === c.id ? "" : c.id)}>
                <Icon name={c.icon as IconName} />{c.name}
              </button>
            ))}
          </div>
          {data && data.accounts.length > 1 && (
            <label className="qa-acc">Cuenta
              <select value={account} onChange={(e) => setAccount(e.target.value)}>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>
            </label>
          )}
          <div className="qa-keys">
            {KEYS.map((k) => <button key={k} type="button" aria-label={k === "del" ? "Borrar" : k} onClick={() => press(k)}>{k === "del" ? <Icon name="back" /> : k}</button>)}
          </div>
          {state?.error && <p className="qa-err" role="alert">{state.error}</p>}
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="status" value="PAID" />
          <input type="hidden" name="amount" value={amount} />
          <input type="hidden" name="categoryId" value={cat} />
          <input type="hidden" name="description" value={chosen?.name ?? (income ? "Ingreso" : "Gasto")} />
          <input type="hidden" name="accountId" value={account} />
          <input type="hidden" name="effectiveDate" value={data?.today ?? ""} />
          <input type="hidden" name="idem" value={idem} />
          <button type="submit" className="qa-save" disabled={pending || !amount || !account}>{pending ? "Guardando…" : income ? "Guardar ingreso" : "Guardar gasto"}</button>
          <Link href={`/app/movimientos/nuevo${income ? "?tipo=INCOME" : ""}`} className="qa-more" onClick={() => setOpen(false)}>Más opciones (fecha, notas, en cuotas…)</Link>
        </form>
      </div>
    </div>
  );
}
