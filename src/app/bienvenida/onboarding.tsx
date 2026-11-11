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
type Income = { name: string; amount: string; day: string; variable: boolean };

const STEPS = ["Hola", "Tu plata", "Tus ingresos", "Para qué"];
const USE_ICON: Record<string, IconName> = { dia: "list", deudas: "card", ahorro: "target", futuro: "flow", invertir: "chart", agro: "grain", indep: "user" };
const ACC_TYPES: [string, string, IconName, string][] = [["SAVINGS", "Banco", "bank", "Banco"], ["WALLET", "Billetera virtual", "card", "Mercado Pago"], ["CASH", "Efectivo", "wallet", "Efectivo"], ["OTHER", "Otra", "db", ""]];
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
  const [bad, setBad] = useState("");
  const fail = (msg: string, field: string) => { setErr(msg); setBad(field); setTimeout(() => (document.getElementById(field) as HTMLElement | null)?.focus(), 0); };
  const go = (n: number) => { setErr(""); setBad(""); setStep(n); window.scrollTo({ top: 0 }); };
  const [country, setCountry] = useState(guessCountry);
  const [currency, setCurrency] = useState(countryByCode(guessCountry).currency);
  const [extra, setExtra] = useState<string[]>([]);
  const [editPlace, setEditPlace] = useState(!detected);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mods, setMods] = useState<Set<ModuleKey> | null>(null);
  const [acc, setAcc] = useState({ name: "", type: "", balance: "", currency: "" });
  const [skipAcc, setSkipAcc] = useState(false);
  const [incMode, setIncMode] = useState<"" | "fijo" | "varia" | "no">("");
  const [incomes, setIncomes] = useState<Income[]>([{ name: "Sueldo", amount: "", day: "", variable: false }]);
  const setInc = (i: number, patch: Partial<Income>) => setIncomes((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const c = countryByCode(country);
  const hasAcc = !skipAcc && !!acc.type && !!acc.name.trim();

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

  const chooseCountry = (code: string) => {
    setCountry(code);
    const cur = countryByCode(code).currency;
    setCurrency(cur);
    setExtra((p) => p.filter((x) => x !== cur));
  };
  const toggleExtra = (x: string) => setExtra((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  const toggleUse = (k: string) => { setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); setMods(null); };
  const pickType = (v: string, suggestion: string) => {
    setSkipAcc(false);
    setAcc((a) => ({ ...a, type: v, name: !a.name || ACC_TYPES.some((t) => t[3] === a.name) ? suggestion : a.name }));
  };
  const chooseIncMode = (m: "fijo" | "varia" | "no") => {
    setIncMode(m);
    setIncomes((p) => p.map((x) => ({ ...x, variable: m === "varia", name: x.name === "Sueldo" && m === "varia" ? "Mis ingresos" : x.name === "Mis ingresos" && m === "fijo" ? "Sueldo" : x.name })));
  };

  const incOn = hasAcc && (incMode === "fijo" || incMode === "varia");
  const next = () => {
    if (step === 1 && !skipAcc) {
      if (!acc.type) { setSkipAcc(true); return go(3); }
      if (!acc.name.trim()) return fail("Ponele un nombre a la cuenta.", "ob-acc-name");
      if (acc.balance && !parseAmount(acc.balance)) return fail("No entendemos el monto. Escribilo como 150000 o 150.000,50.", "ob-acc-bal");
    }
    if (step === 2 && incOn) {
      for (let i = 0; i < incomes.length; i++) {
        const x = incomes[i];
        const a = parseAmount(x.amount), d = Number(x.day);
        const who = x.name.trim() || "cada ingreso";
        if (!a || !a.gt(0)) return fail(`Escribí ${x.variable ? "más o menos cuánto cobrás en" : "el monto de"} ${who}.`, `ob-inc-amount-${i}`);
        if (!(d >= 1 && d <= 31)) return fail(`El día de cobro de ${who} va del 1 al 31.`, `ob-inc-day-${i}`);
      }
    }
    go(step + 1);
  };
  const back = () => go(step - 1);
  const nextLabel = step === 0 ? "Empezar" : step === 1 ? (acc.type ? "Seguir" : "Lo cargo después") : step === 2 ? (incMode === "" ? "Lo cargo después" : "Seguir") : "";

  // Vista previa: cómo queda el Inicio con lo cargado.
  const balance = hasAcc ? parseAmount(acc.balance) ?? parseAmount("0")! : parseAmount("0")!;
  const pays = incOn ? incomes.filter((x) => parseAmount(x.amount) && Number(x.day) >= 1 && Number(x.day) <= 31).map((x) => ({ name: x.name.trim() || "Ingreso", amount: parseAmount(x.amount)!, date: nextPayday(Number(x.day)), variable: x.variable })) : [];
  const nextPay = [...pays].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const sumCur = hasAcc ? accCurrency : currency;
  const featureNames = modules.filter((m) => active.has(m.key) && !HIDDEN_IN_LIST.includes(m.key)).map((m) => m.name);

  return (
    <div className="nx obx">
      <header className="obx-top">
        <span className="lp-brand"><span className="brand-mark">F</span><b>Finan</b></span>
      </header>
      <ActionForm action={finishOnboardingAction}>
        <div className="obx-wrap">
          <section className="obx-mhero" aria-label="Así va a quedar tu Inicio">
            <span className="obx-mhero-l">{nextPay ? `Te queda hasta tu próximo cobro, el ${nextPay.date.getDate()} de ${MES[nextPay.date.getMonth()]}` : "Así va a quedar tu Inicio"}</span>
            <b className="obx-mhero-n">{formatMoney(balance, sumCur, { cents: "auto" })}</b>
            <span className="obx-mhero-s">{hasAcc ? `En ${acc.name}` : "Cargá dónde tenés la plata y lo ves acá"}{pays.length ? ` · ${pays.length === 1 ? "1 cobro" : `${pays.length} cobros`} por mes` : ""}</span>
            <span className="obx-mhero-bar" aria-hidden="true"><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></span>
          </section>
          <main key={step} className="obx-body obx-step" onKeyDown={(e) => { if (e.key === "Enter" && step < 3 && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}>
            <nav className="obx-track" aria-label="Pasos de la bienvenida">
              <span className="obx-track-now">Paso {step + 1} de {STEPS.length} · <b>{STEPS[step]}</b></span>
              <ol>
                {STEPS.map((s, i) => (
                  <li key={s} className={i === step ? "on" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
                    {i < step
                      ? <button type="button" onClick={() => go(i)} aria-label={`Volver a ${s}`}><i /><span>{s}</span></button>
                      : <><i /><span>{s}</span></>}
                  </li>
                ))}
              </ol>
            </nav>
            {step === 0 && (
              <>
                <div>
                  <h1>Hola{firstName ? `, ${firstName}` : ""}</h1>
                  <p className="lead">En dos minutos dejamos Finan listo para que sepas cuánto podés gastar hasta tu próximo cobro.</p>
                </div>
                <div className="obx-card obx-card-b">
                  <span className="obx-ico"><Icon name="wallet" /></span>
                  <div className="grow">
                    <b>Vas a ver todo en {currencyName(currency).toLowerCase()} ({symbolOf(currency)})</b>
                    <small>{c.name} · por ejemplo {formatMoney("1250000.50", currency, { cents: "always" })}</small>
                  </div>
                  {!editPlace && <button type="button" className="btn ghost sm" onClick={() => setEditPlace(true)}>Cambiar</button>}
                </div>
                {editPlace && (
                  <div className="obx-two">
                    <label className="field">País<select value={country} onChange={(e) => chooseCountry(e.target.value)}>{COUNTRIES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select></label>
                    <label className="field">Moneda principal<select value={currency} onChange={(e) => { setCurrency(e.target.value); setExtra((p) => p.filter((x) => x !== e.target.value)); }}>{CURRENCIES.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.code})</option>)}</select></label>
                  </div>
                )}
                <div className="field">
                  <span>¿Ahorrás o cobrás en otra moneda? <span className="hint" style={{ fontWeight: 400 }}>(opcional)</span></span>
                  <div className="chips">
                    {extraList.map((x) => <button type="button" key={x} className={`chip ${extra.includes(x) ? "on" : ""}`} aria-pressed={extra.includes(x)} onClick={() => toggleExtra(x)}>{extra.includes(x) && <Icon name="check" />}{currencyName(x)}</button>)}
                    <select aria-label="Agregar otra moneda" className="chip-sel" value="" onChange={(e) => e.target.value && setExtra((p) => [...new Set([...p, e.target.value])])}>
                      <option value="">Otra…</option>
                      {CURRENCIES.filter((x) => x.code !== currency && !extraList.includes(x.code)).map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <h1>¿Dónde tenés tu plata hoy?</h1>
                  <p className="lead">Empezá por la que más usás. Las demás (y las tarjetas de crédito) las sumás después.</p>
                </div>
                <div className="obx-tiles" id="ob-tiles" tabIndex={-1}>
                  {ACC_TYPES.map(([v, l, i, sug]) => (
                    <button type="button" key={v} className={`obx-tile ${acc.type === v && !skipAcc ? "on" : ""}`} aria-pressed={acc.type === v && !skipAcc} onClick={() => pickType(v, sug)}>
                      <span className="obx-tile-ic"><Icon name={i} /></span><span>{l}</span>
                    </button>
                  ))}
                </div>
                {acc.type && !skipAcc && (
                  <div className="obx-two">
                    <label className="field">Nombre<input id="ob-acc-name" aria-invalid={bad === "ob-acc-name"} value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder="Ej.: Banco Nación" maxLength={40} autoFocus /></label>
                    <label className="field">¿Cuánto tenés ahí hoy?
                      <span className={`obx-money ${bad === "ob-acc-bal" ? "bad" : ""}`}><em>{symbolOf(accCurrency)}</em><input id="ob-acc-bal" aria-invalid={bad === "ob-acc-bal"} value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} inputMode="decimal" placeholder="0" /></span>
                    </label>
                    {extra.length > 0 && <label className="field">Moneda de la cuenta<select value={accCurrency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>{[currency, ...extra].map((x) => <option key={x} value={x}>{currencyName(x)}</option>)}</select></label>}
                  </div>
                )}
                {acc.type && <button type="button" className="lnk obx-skip" onClick={() => { setSkipAcc(true); setAcc({ ...acc, type: "" }); go(3); }}>Prefiero cargarla después</button>}
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h1>¿Cuándo te entra plata?</h1>
                  <p className="lead">Con esto calculamos cuánto podés gastar hasta tu próximo cobro.</p>
                </div>
                <div className="obx-choices">
                  {([["fijo", "Cobro lo mismo todos los meses", "Sueldo, jubilación, un alquiler que cobrás.", "check"], ["varia", "Cobro, pero el monto cambia", "Por horas, comisiones, trabajos independientes. El día que cobrás te preguntamos cuánto entró.", "repeat"], ["no", "No tengo un cobro fijo", "Lo cargás como ingreso cada vez que entra plata.", "plus"]] as const).map(([k, t, d, i]) => (
                    <button type="button" key={k} className={`obx-choice ${incMode === k ? "on" : ""}`} aria-pressed={incMode === k} onClick={() => chooseIncMode(k)}>
                      <span className="obx-ico"><Icon name={i} /></span><span className="grow"><b>{t}</b><small>{d}</small></span>
                    </button>
                  ))}
                </div>
                {incOn && (
                  <div className="obx-incs">
                    {incomes.map((x, i) => (
                      <div className="obx-inc" key={i}>
                        <label className="field">Qué es<input value={x.name} onChange={(e) => setInc(i, { name: e.target.value })} placeholder="Ej.: Sueldo" maxLength={40} /></label>
                        <label className="field">{x.variable ? "Más o menos" : "Monto"}<span className={`obx-money ${bad === `ob-inc-amount-${i}` ? "bad" : ""}`}><em>{symbolOf(accCurrency)}</em><input id={`ob-inc-amount-${i}`} aria-invalid={bad === `ob-inc-amount-${i}`} value={x.amount} onChange={(e) => setInc(i, { amount: e.target.value })} inputMode="decimal" placeholder="0" /></span></label>
                        <label className="field">Día del mes<input id={`ob-inc-day-${i}`} aria-invalid={bad === `ob-inc-day-${i}`} value={x.day} onChange={(e) => setInc(i, { day: e.target.value.replace(/\D/g, "").slice(0, 2) })} inputMode="numeric" placeholder="1 a 31" /></label>
                        <label className="simtg obx-var"><input type="checkbox" checked={x.variable} onChange={(e) => setInc(i, { variable: e.target.checked })} /><span>El monto cambia</span></label>
                        {incomes.length > 1 && <button type="button" className="btn ghost sm" aria-label={`Quitar ${x.name || "ingreso"}`} onClick={() => setIncomes((p) => p.filter((_, j) => j !== i))}>Quitar</button>}
                      </div>
                    ))}
                    <div><button type="button" className="btn sm" onClick={() => setIncomes((p) => [...p, { name: "", amount: "", day: "", variable: incMode === "varia" }])}>+ Otro ingreso</button></div>
                  </div>
                )}
                {!hasAcc && (incMode === "fijo" || incMode === "varia") && <p className="hint">Para guardar tus ingresos necesitás una cuenta: volvé al paso anterior o cargalos después desde Próximos pagos.</p>}
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <h1>¿Qué querés ordenar?</h1>
                  <p className="lead">Elegí las que quieras. Mostramos solo lo que te sirve; lo demás no aparece en el menú.</p>
                </div>
                <div className="uses">
                  {uses.map((u) => (
                    <button type="button" key={u.key} className={`use ${picked.has(u.key) ? "on" : ""}`} aria-pressed={picked.has(u.key)} onClick={() => toggleUse(u.key)}>
                      <span className="h"><span className="obx-ico sm"><Icon name={USE_ICON[u.key] ?? "list"} /></span>{u.title}{picked.has(u.key) && <span className="obx-tick"><Icon name="check" /></span>}</span>
                      <small>{u.description}</small>
                    </button>
                  ))}
                </div>
                <details className="more box">
                  <summary>Ver y ajustar las {featureNames.length} funciones que vas a tener</summary>
                  {modules.map((m) => (
                    <div className="mod" key={m.key}>
                      <div className="grow"><b>{m.name} {m.pro && <span className="pill">Pro</span>}</b><small>{m.description}</small></div>
                      <label className="sw"><input type="checkbox" aria-label={m.name} checked={active.has(m.key)} onChange={() => { const n = new Set(active); n.has(m.key) ? n.delete(m.key) : n.add(m.key); setMods(n); }} /><i /></label>
                    </div>
                  ))}
                </details>
                <p className="hint">Todo se cambia cuando quieras en Configuración.</p>
              </>
            )}
            {err && <p className="obx-err" role="alert"><Icon name="info" />{err}</p>}
          </main>

          {/* Vista previa en vivo del Inicio */}
          <aside className="obx-preview" aria-label="Así va a quedar tu Inicio">
            <span className="obx-pv-lbl">Así va a quedar tu Inicio</span>
            <div className="obx-pv-head"><h2>Tu Inicio, en vivo</h2><p>Se arma con lo que vas cargando. Después podés cambiar todo.</p></div>
            <div className="obx-phone">
              <div className="obx-phone-hi" aria-hidden="true"><span>{firstName ? `Hola, ${firstName}` : "Hola"}</span><i>{(firstName || "N").slice(0, 1).toUpperCase()}</i></div>
              <small>{nextPay ? `Te queda hasta tu próximo cobro, el ${nextPay.date.getDate()} de ${MES[nextPay.date.getMonth()]}` : "Disponible hoy"}</small>
              <b className="obx-big">{formatMoney(balance, sumCur, { cents: "auto" })}</b>
              <div className="obx-rows">
                <div><span>{hasAcc ? acc.name : "Tus cuentas"}</span><span>{hasAcc ? formatMoney(balance, sumCur) : "—"}</span></div>
                {pays.length ? pays.map((p, i) => <div key={i}><span>{p.name}{p.variable ? " (aprox.)" : ""} · {p.date.getDate()} {MES[p.date.getMonth()].slice(0, 3)}</span><span className="pos">{formatMoney(p.amount, sumCur, { sign: true })}</span></div>) : <div><span>Próximo cobro</span><span>—</span></div>}
              </div>
              {nextPay?.variable && <p className="obx-note"><Icon name="info" />El {nextPay.date.getDate()} te preguntamos cuánto cobraste y lo ajustás.</p>}
            </div>
            {step === 3 && featureNames.length > 0 && <p className="obx-feats">Vas a tener: {featureNames.join(", ")}.</p>}
            <ul className="obx-trust">
              <li><Icon name="lock" />Nunca te pedimos la clave del banco.</li>
              <li><Icon name="check" />Es gratis y no pide tarjeta.</li>
            </ul>
          </aside>
        </div>

        {[...picked].map((u) => <input key={u} type="hidden" name="uses" value={u} />)}
        {[...active].map((m) => <input key={m} type="hidden" name="modules" value={m} />)}
        {extra.map((x) => <input key={x} type="hidden" name="extraCurrencies" value={x} />)}
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="accountName" value={hasAcc ? acc.name : ""} />
        <input type="hidden" name="accountType" value={acc.type || "SAVINGS"} />
        <input type="hidden" name="accountCurrency" value={accCurrency} />
        <input type="hidden" name="accountBalance" value={acc.balance} />
        {incOn && incomes.map((x, i) => (
          <span key={i} hidden><input type="hidden" name="incomeName" value={x.name} /><input type="hidden" name="incomeAmount" value={x.amount} /><input type="hidden" name="incomeDay" value={x.day} /><input type="hidden" name="incomeVariable" value={x.variable ? "1" : "0"} /></span>
        ))}

        <footer className="obx-bar">
          <div className="in">
            {step > 0 ? <button type="button" className="btn" onClick={back}>Atrás</button> : <span />}
            <span className="obx-mini" aria-live="polite">{step > 0 ? <>Hoy <b>{formatMoney(balance, sumCur)}</b></> : null}</span>
            {step < 3 ? <button type="button" className="btn pri obx-next" onClick={next}>{nextLabel}</button> : <Submit className="btn pri obx-next" pending="Armando tu Finan…">Entrar a Finan</Submit>}
          </div>
        </footer>
      </ActionForm>
    </div>
  );
}
