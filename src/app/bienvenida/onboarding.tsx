"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Icon, type IconName } from "@/components/icons";
import { finishOnboardingAction } from "@/app/actions/app";
import { COUNTRIES, CURRENCIES, countryByCode, currencyName, symbolOf } from "@/lib/countries";
import { formatMoney, parseAmount } from "@/lib/money";
import type { ModuleKey } from "@/lib/modules";

type Use = { key: string; title: string; description: string; modules: ModuleKey[] };
type Mod = { key: ModuleKey; name: string; description: string; pro?: boolean };

const STEPS = ["País y moneda", "Para qué la usás", "Tu cuenta", "Resumen"];
const USE_ICON: Record<string, IconName> = { dia: "list", deudas: "card", ahorro: "target", futuro: "flow", invertir: "chart", agro: "grain", indep: "user" };
const ACC_TYPES: [string, string, IconName][] = [["SAVINGS", "Banco", "bank"], ["WALLET", "Billetera virtual", "card"], ["CASH", "Efectivo", "wallet"], ["OTHER", "Otra", "db"]];
const BASIC: ModuleKey[] = ["alertas", "reglas", "tipos", "flujo", "calendario"];
const HIDDEN_IN_LIST: ModuleKey[] = ["alertas", "reglas", "tipos"];
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const suggestFor = (cur: string) => (cur === "USD" ? ["EUR", "GBP"] : cur === "EUR" ? ["USD", "GBP"] : ["USD", "EUR"]);

// Próxima fecha de cobro para un día del mes (si ya pasó este mes, el mes que viene).
function nextPayday(day: number) {
  const t = new Date();
  const mk = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  const d = mk(t.getFullYear(), t.getMonth());
  return d.getDate() >= t.getDate() && d.getMonth() === t.getMonth() ? d : mk(t.getFullYear(), t.getMonth() + 1);
}

export function Onboarding({ firstName, uses, modules, guessCountry, detected }: { firstName: string; uses: Use[]; modules: Mod[]; guessCountry: string; detected: boolean }) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [country, setCountry] = useState(guessCountry);
  const [currency, setCurrency] = useState(countryByCode(guessCountry).currency);
  const [extra, setExtra] = useState<string[]>([]);
  const [editCountry, setEditCountry] = useState(!detected);
  const [editCur, setEditCur] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mods, setMods] = useState<Set<ModuleKey> | null>(null);
  const [acc, setAcc] = useState({ name: "", type: "SAVINGS", balance: "", currency: "" });
  const [skipAcc, setSkipAcc] = useState(false);
  const [incOn, setIncOn] = useState(false);
  const [incomes, setIncomes] = useState([{ name: "Sueldo", amount: "", day: "" }]);
  const setInc = (i: number, patch: Partial<{ name: string; amount: string; day: string }>) => setIncomes((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const c = countryByCode(country);

  const suggested = useMemo(() => {
    const m = new Set<ModuleKey>(BASIC);
    picked.forEach((u) => uses.find((x) => x.key === u)?.modules.forEach((k) => m.add(k)));
    if (!picked.size) modules.forEach((x) => { if (!x.pro && ["presupuestos", "objetivos", "tarjetas", "deudas", "simulador", "inversiones"].includes(x.key)) m.add(x.key); });
    return m;
  }, [picked, uses, modules]);
  const active = mods ?? suggested;
  const accCurrency = acc.currency || currency;
  const sugg = suggestFor(currency);
  const extraList = [...sugg, ...extra.filter((x) => !sugg.includes(x))];
  const have = modules.filter((m) => suggested.has(m.key) && !HIDDEN_IN_LIST.includes(m.key)).map((m) => m.name);

  const chooseCountry = (code: string) => {
    setCountry(code);
    const cur = countryByCode(code).currency;
    setCurrency(cur);
    setExtra((p) => p.filter((x) => x !== cur));
  };
  const toggleExtra = (x: string) => setExtra((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  const toggleUse = (k: string) => { setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); setMods(null); };

  const next = () => {
    setErr("");
    if (step === 2 && !skipAcc) {
      if (!acc.name.trim()) return setErr("Ponele un nombre a la cuenta, o tocá “La cargo después”.");
      if (acc.balance && !parseAmount(acc.balance)) return setErr("No entendemos el saldo. Escribilo como 150000 o 150.000,50.");
      if (incOn) {
        for (const x of incomes) {
          const a = parseAmount(x.amount), d = Number(x.day);
          const who = x.name.trim() || "cada ingreso";
          if (!a || !a.gt(0)) return setErr(`Escribí el monto de ${who}, o sacalo de la lista.`);
          if (!(d >= 1 && d <= 31)) return setErr(`El día de cobro de ${who} va del 1 al 31.`);
        }
      }
    }
    setStep(step + 1);
    window.scrollTo(0, 0);
  };
  const back = () => { setErr(""); setStep(step - 1); window.scrollTo(0, 0); };

  const balance = !skipAcc && acc.name ? parseAmount(acc.balance) ?? parseAmount("0")! : parseAmount("0")!;
  const pays = incOn && !skipAcc ? incomes.filter((x) => parseAmount(x.amount) && Number(x.day) >= 1).map((x) => ({ name: x.name.trim() || "Ingreso", amount: parseAmount(x.amount)!, date: nextPayday(Number(x.day)) })) : [];
  const now = new Date();
  const endOfMonth = pays.filter((p) => p.date.getMonth() === now.getMonth()).reduce((t, p) => t.plus(p.amount), balance);
  const sumCur = skipAcc ? currency : accCurrency;

  return (
    <div className="nx ob">
      <header className="ob-top">
        <span className="lp-brand"><span className="brand-mark">N</span><b>NEXO</b></span>
        <span className="ob-count">Paso {step + 1} de {STEPS.length} · <b>{STEPS[step]}</b></span>
      </header>
      <div className="ob-prog" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      <ActionForm action={finishOnboardingAction}>
        <main className="ob-body" onKeyDown={(e) => { if (e.key === "Enter" && step < 3 && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}>
          {step === 0 && (
            <>
              <div>
                <h1>{detected && !editCountry ? `Parece que estás en ${c.name}` : `Hola${firstName ? `, ${firstName}` : ""}. ¿Dónde vivís?`}</h1>
                <p className="lead">Con tu país ponemos tu moneda, cómo se ven los números y la hora de tus vencimientos.</p>
              </div>
              <section className="box">
                <div className="kv">
                  <span>País</span>
                  {editCountry ? (
                    <select aria-label="País" value={country} onChange={(e) => chooseCountry(e.target.value)} style={{ maxWidth: 280 }} autoFocus>{COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><b>{c.name}</b><button type="button" className="btn ghost sm" onClick={() => setEditCountry(true)}>Cambiar</button></span>
                  )}
                </div>
                <div className="kv">
                  <span>Moneda</span>
                  {editCur ? (
                    <select aria-label="Moneda" value={currency} onChange={(e) => { setCurrency(e.target.value); setExtra((p) => p.filter((x) => x !== e.target.value)); }} style={{ maxWidth: 280 }} autoFocus>{CURRENCIES.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}</select>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><b>{currencyName(currency)} ({symbolOf(currency)})</b><button type="button" className="btn ghost sm" onClick={() => setEditCur(true)}>Cambiar</button></span>
                  )}
                </div>
                <div className="kv"><span>Zona horaria</span><span>{c.timezone.replace(/_/g, " ")}</span></div>
              </section>
              <div className="field">
                <span>¿Usás otra moneda también?</span>
                <div className="chips">{extraList.map((x) => <button type="button" key={x} className={`chip ${extra.includes(x) ? "on" : ""}`} aria-pressed={extra.includes(x)} onClick={() => toggleExtra(x)}>{currencyName(x)}</button>)}</div>
                <select aria-label="Agregar otra moneda" value="" onChange={(e) => e.target.value && setExtra((p) => [...new Set([...p, e.target.value])])} style={{ maxWidth: 300, marginTop: 6 }}>
                  <option value="">Agregar otra moneda…</option>
                  {CURRENCIES.filter((x) => x.code !== currency && !extraList.includes(x.code)).map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}
                </select>
                <span className="hint" style={{ fontWeight: 400 }}>Por ejemplo, si ahorrás en dólares.</span>
              </div>
              <div className="note"><Icon name="info" /><div>Así vas a ver tus montos: <b>{formatMoney("1250000.50", currency, { cents: "always" })}</b></div></div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h1>¿Para qué vas a usar NEXO?</h1>
                <p className="lead">Elegí todas las que quieras. Prendemos solo lo que te sirve; lo demás no aparece en el menú.</p>
              </div>
              <div className="uses">
                {uses.map((u) => (
                  <button type="button" key={u.key} className={`use ${picked.has(u.key) ? "on" : ""}`} aria-pressed={picked.has(u.key)} onClick={() => toggleUse(u.key)}>
                    <span className="h"><Icon name={USE_ICON[u.key] ?? "list"} />{u.title}</span>
                    <small>{u.description}</small>
                  </button>
                ))}
              </div>
              <div className="note" aria-live="polite"><Icon name="check" /><div>{picked.size ? <>Vas a tener: <b>{have.join(", ")}</b>.</> : "Si no elegís nada, te prendemos lo básico y lo cambiás cuando quieras."}</div></div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1>Tu primera cuenta</h1>
                <p className="lead">Donde tenés la plata hoy: el banco, una billetera virtual o el efectivo. Desde acá empieza todo.</p>
              </div>
              <label className="field">Nombre<input value={acc.name} onChange={(e) => { setAcc({ ...acc, name: e.target.value }); setSkipAcc(false); }} placeholder="Ej.: Banco, Efectivo, Mercado Pago" maxLength={40} autoFocus /></label>
              <div className="field"><span>Tipo</span>
                <div className="seg">{ACC_TYPES.map(([v, l, i]) => <button type="button" key={v} className={acc.type === v ? "on" : ""} aria-pressed={acc.type === v} onClick={() => setAcc({ ...acc, type: v })}><Icon name={i} />{l}</button>)}</div>
              </div>
              <div className="two">
                {extra.length > 0 && <label className="field">Moneda<select value={accCurrency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>{[currency, ...extra].map((x) => <option key={x} value={x}>{currencyName(x)}</option>)}</select></label>}
                <label className="field">¿Cuánto tenés hoy?<input value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} inputMode="decimal" placeholder="0,00" /></label>
              </div>
              <section className="box" style={{ padding: "14px 20px" }}>
                <label className="simtg"><input type="checkbox" checked={incOn} onChange={(e) => setIncOn(e.target.checked)} /><span><b style={{ fontWeight: 500, color: "var(--nx-ink)" }}>Tengo ingresos fijos todos los meses</b><br /><span className="hint">Sueldo, jubilación, un alquiler que cobrás… Los agregamos solos cada mes.</span></span></label>
                {incOn && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                    {incomes.map((x, i) => (
                      <div className="inc" key={i}>
                        <label className="field">Concepto<input value={x.name} onChange={(e) => setInc(i, { name: e.target.value })} placeholder="Ej.: Sueldo" maxLength={40} /></label>
                        <label className="field">Monto<input value={x.amount} onChange={(e) => setInc(i, { amount: e.target.value })} inputMode="decimal" placeholder="0,00" /></label>
                        <label className="field">Día<input value={x.day} onChange={(e) => setInc(i, { day: e.target.value.replace(/D/g, "").slice(0, 2) })} inputMode="numeric" placeholder="1 a 31" /></label>
                        {incomes.length > 1 ? <button type="button" className="btn ghost sm" aria-label={`Quitar ${x.name || "ingreso"}`} onClick={() => setIncomes((p) => p.filter((_, j) => j !== i))}>Quitar</button> : <span />}
                      </div>
                    ))}
                    <div><button type="button" className="btn sm" onClick={() => setIncomes((p) => [...p, { name: "", amount: "", day: "" }])}>+ Agregar otro ingreso</button></div>
                  </div>
                )}
              </section>
              <p className="hint">Las tarjetas de crédito se cargan después, en Tarjetas, porque funcionan como una deuda.</p>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h1>Listo{firstName ? `, ${firstName}` : ""}</h1>
                <p className="lead">Así arranca tu Inicio con lo que cargaste.</p>
              </div>
              <section className="hero">
                <div>
                  <div className="lbl">Disponible hoy</div>
                  <div className="big">{formatMoney(balance, sumCur, { cents: "always" })}</div>
                  <p className="hint">{skipAcc || !acc.name ? "Todavía sin cuentas. La cargás desde Cuentas." : acc.name}</p>
                </div>
                <div className="hero-r">
                  {pays.length ? pays.map((p, i) => (
                    <div className="kv" key={i}><span>{p.name} · {p.date.getDate()} de {MES[p.date.getMonth()]}</span><b style={{ color: "var(--nx-pos)" }}>{formatMoney(p.amount, sumCur, { sign: true })}</b></div>
                  )) : <div className="kv"><span>Ingresos fijos</span><span className="hint">No cargados</span></div>}
                  <div className="kv tot"><span>Terminarías {MES[now.getMonth()]} con</span><b>{formatMoney(endOfMonth, sumCur, { cents: "always" })}</b></div>
                </div>
              </section>
              <section className="box">
                <div className="kv"><span>País</span><b>{c.name}</b></div>
                <div className="kv"><span>Moneda</span><b>{currencyName(currency)}</b></div>
                {extra.length > 0 && <div className="kv"><span>También usás</span><b>{extra.map(currencyName).join(", ")}</b></div>}
                <div className="kv"><span>Plan</span><b>Gratis</b></div>
              </section>
              <details className="more box">
                <summary>Prendimos {active.size} funciones para vos · Ver cuáles</summary>
                {modules.map((m) => (
                  <div className="mod" key={m.key}>
                    <div className="grow"><b>{m.name} {m.pro && <span className="pill">Pro</span>}</b><small>{m.description}</small></div>
                    <label className="sw"><input type="checkbox" aria-label={m.name} checked={active.has(m.key)} onChange={() => { const n = new Set(active); n.has(m.key) ? n.delete(m.key) : n.add(m.key); setMods(n); }} /><i /></label>
                  </div>
                ))}
              </details>
              <p className="hint">Todo esto se cambia cuando quieras en Configuración.</p>
            </>
          )}
        </main>

        {[...picked].map((u) => <input key={u} type="hidden" name="uses" value={u} />)}
        {[...active].map((m) => <input key={m} type="hidden" name="modules" value={m} />)}
        {extra.map((x) => <input key={x} type="hidden" name="extraCurrencies" value={x} />)}
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="accountName" value={skipAcc ? "" : acc.name} />
        <input type="hidden" name="accountType" value={acc.type} />
        <input type="hidden" name="accountCurrency" value={accCurrency} />
        <input type="hidden" name="accountBalance" value={acc.balance} />
        {incOn && !skipAcc && incomes.map((x, i) => (
          <span key={i} hidden><input type="hidden" name="incomeName" value={x.name} /><input type="hidden" name="incomeAmount" value={x.amount} /><input type="hidden" name="incomeDay" value={x.day} /></span>
        ))}

        <footer className="ob-bar">
          <div className="in">
            {step > 0 ? <button type="button" className="btn" onClick={back}>Atrás</button> : <span />}
            {err && <span className="err" role="alert">{err}</span>}
            <div style={{ display: "flex", gap: 8 }}>
              {step === 2 && <button type="button" className="btn ghost" onClick={() => { setErr(""); setSkipAcc(true); setStep(3); }}>La cargo después</button>}
              {step < 3 ? <button type="button" className="btn pri" onClick={next}>Seguir</button> : <Submit pending="Armando tu NEXO…">Entrar a NEXO</Submit>}
            </div>
          </div>
        </footer>
      </ActionForm>
    </div>
  );
}
