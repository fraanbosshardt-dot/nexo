"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { Icon, type IconName } from "@/components/icons";
import { finishOnboardingAction } from "@/app/actions/app";
import { COUNTRIES, CURRENCIES, countryByCode } from "@/lib/countries";
import type { ModuleKey } from "@/lib/modules";

type Use = { key: string; title: string; description: string; modules: ModuleKey[] };
type Mod = { key: ModuleKey; name: string; description: string; pro?: boolean };

const STEPS = ["Tu país", "Tu uso", "Tu primera cuenta", "Listo"];
const USE_ICON: Record<string, IconName> = { dia: "list", deudas: "card", ahorro: "target", futuro: "flow", invertir: "chart", agro: "grain", indep: "wallet" };
const ACCOUNT_TYPES = [["SAVINGS", "Caja de ahorro"], ["CHECKING", "Cuenta corriente"], ["WALLET", "Billetera virtual"], ["CASH", "Efectivo"], ["FOREIGN", "Cuenta en otra moneda"], ["INVESTMENT", "Cuenta de inversión"], ["OTHER", "Otra"]];
const tzLabel = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");

export function Onboarding({ firstName, uses, modules, guessCountry }: { firstName: string; uses: Use[]; modules: Mod[]; guessCountry: string }) {
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState(guessCountry);
  const [currency, setCurrency] = useState(countryByCode(guessCountry).currency);
  const [extra, setExtra] = useState<Set<string>>(new Set(countryByCode(guessCountry).currency === "USD" ? [] : ["USD"]));
  const [picked, setPicked] = useState<Set<string>>(new Set(["dia"]));
  const [mods, setMods] = useState<Set<ModuleKey> | null>(null);
  const [acc, setAcc] = useState({ name: "", type: "SAVINGS", balance: "", currency: "" });
  const tz = countryByCode(country).timezone;

  const suggested = useMemo(() => {
    const m = new Set<ModuleKey>(["alertas", "reglas", "tipos", "flujo", "calendario"]);
    picked.forEach((u) => uses.find((x) => x.key === u)?.modules.forEach((k) => m.add(k)));
    return m;
  }, [picked, uses]);
  const active = mods ?? suggested;
  const accCurrency = acc.currency || (acc.type === "FOREIGN" ? [...extra][0] ?? "USD" : currency);

  const chooseCountry = (code: string) => {
    setCountry(code);
    const c = countryByCode(code).currency;
    setCurrency(c);
    setExtra((prev) => { const n = new Set(prev); n.delete(c); return n; });
  };
  const toggleUse = (k: string) => {
    const n = new Set(picked);
    n.has(k) ? n.delete(k) : n.add(k);
    setPicked(n);
    setMods(null);
  };
  const toggleExtra = (c: string) => setExtra((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const canNext = step !== 1 || picked.size > 0;

  return (
    <div className="ob">
      <header className="ob-top">
        <span className="lp-brand"><span className="brand-mark">N</span><b>NEXO</b></span>
        <ol className="ob-dots" aria-label="Pasos">{STEPS.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}><span>{i + 1}</span><em>{s}</em></li>)}</ol>
      </header>
      <main className="ob-main">
        <ActionForm action={finishOnboardingAction} className="ob-card-w">
          <div className="ob-step" key={step}>
            {step === 0 && (
              <>
                <h1>Hola{firstName ? `, ${firstName}` : ""}. ¿Dónde vivís?</h1>
                <p className="sub">Con tu país ajustamos la moneda y la hora. Lo podés cambiar cuando quieras.</p>
                <div className="frow">
                  <label className="field">País<select value={country} onChange={(e) => chooseCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                  <label className="field">Moneda principal<select value={currency} onChange={(e) => { setCurrency(e.target.value); setExtra((p) => { const n = new Set(p); n.delete(e.target.value); return n; }); }}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
                </div>
                <p className="sub">Zona horaria: <b style={{ color: "var(--fg)" }}>{tzLabel(tz)}</b>, se ajusta sola según el país.</p>
                <div className="field">¿Usás otras monedas?
                  <div className="chips">{CURRENCIES.filter((c) => c.code !== currency).slice(0, 10).map((c) => <button type="button" key={c.code} className={`chip ${extra.has(c.code) ? "on" : ""}`} aria-pressed={extra.has(c.code)} onClick={() => toggleExtra(c.code)}>{c.code}</button>)}</div>
                  <span className="sub" style={{ fontWeight: 400 }}>Cada cuenta tiene su moneda. No se mezclan en los totales sin una cotización.</span>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1>¿Para qué vas a usar NEXO?</h1>
                <p className="sub">Elegí todas las que quieras. Con esto armamos tu menú.</p>
                <div className="ob-grid">
                  {uses.map((u) => (
                    <button type="button" key={u.key} className={`ob-card ${picked.has(u.key) ? "on" : ""}`} aria-pressed={picked.has(u.key)} onClick={() => toggleUse(u.key)}>
                      <span className="ob-ic"><Icon name={USE_ICON[u.key] ?? "list"} /></span>
                      <span className="ob-tx"><b>{u.title}</b><span>{u.description}</span></span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1>Tu primera cuenta</h1>
                <p className="sub">Puede ser tu cuenta del banco, una billetera o el efectivo. Si querés, lo hacés después.</p>
                <label className="field">Nombre<input value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder="Ej.: Cuenta sueldo" autoFocus /></label>
                <div className="frow">
                  <label className="field">Tipo<select value={acc.type} onChange={(e) => setAcc({ ...acc, type: e.target.value, currency: "" })}>{ACCOUNT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                  <label className="field">Moneda<select value={accCurrency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>{[currency, ...extra].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                </div>
                <label className="field">Saldo de hoy<input value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} inputMode="decimal" placeholder="0,00" /></label>
              </>
            )}
            {step === 3 && (
              <>
                <h1>Listo, tu NEXO está armado</h1>
                <dl className="kv ob-sum">
                  <dt>País</dt><dd>{countryByCode(country).name}</dd>
                  <dt>Moneda principal</dt><dd>{currency}{extra.size ? ` · también ${[...extra].join(", ")}` : ""}</dd>
                  <dt>Primera cuenta</dt><dd>{acc.name || "La cargás después"}</dd>
                  <dt>Plan</dt><dd>Gratis</dd>
                </dl>
                <div className="chips">{modules.filter((m) => active.has(m.key)).map((m) => <span className="tag" key={m.key}>{m.name}</span>)}</div>
                <details className="more">
                  <summary>Ajustar funciones</summary>
                  <div className="list ob-list">
                    {modules.map((m) => (
                      <div className="li" key={m.key}>
                        <div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{m.name} {m.pro && <span className="pill">Pro</span>}</div><div className="s">{m.description}</div></div>
                        <label className="sw-t"><input type="checkbox" checked={active.has(m.key)} aria-label={m.name} onChange={() => { const n = new Set(active); n.has(m.key) ? n.delete(m.key) : n.add(m.key); setMods(n); }} /><span /></label>
                      </div>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>

          {[...picked].map((u) => <input key={u} type="hidden" name="uses" value={u} />)}
          {[...active].map((m) => <input key={m} type="hidden" name="modules" value={m} />)}
          {[...extra].map((c) => <input key={c} type="hidden" name="extraCurrencies" value={c} />)}
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="accountName" value={acc.name} />
          <input type="hidden" name="accountType" value={acc.type} />
          <input type="hidden" name="accountCurrency" value={accCurrency} />
          <input type="hidden" name="accountBalance" value={acc.balance} />

          <div className="acts ob-acts">
            {step > 0 ? <button type="button" className="btn" onClick={() => setStep(step - 1)}>Atrás</button> : <span />}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn pri" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 2 && !acc.name ? "Lo hago después" : "Siguiente"}</button>
            ) : (
              <Submit pending="Armando tu NEXO…">Entrar a NEXO</Submit>
            )}
          </div>
        </ActionForm>
      </main>
    </div>
  );
}
