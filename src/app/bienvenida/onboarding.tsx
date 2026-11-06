"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { finishOnboardingAction } from "@/app/actions/app";
import type { ModuleKey } from "@/lib/modules";

type Use = { key: string; title: string; description: string; modules: ModuleKey[] };
type Mod = { key: ModuleKey; name: string; description: string; pro?: boolean };

const STEPS = ["Para qué", "Moneda", "Funciones", "Primera cuenta", "Listo"];
const TIMEZONES = [
  ["America/Argentina/Buenos_Aires", "Buenos Aires, Argentina (GMT−3)"],
  ["America/Argentina/Cordoba", "Córdoba, Argentina (GMT−3)"],
  ["America/Montevideo", "Montevideo, Uruguay (GMT−3)"],
  ["America/Santiago", "Santiago, Chile (GMT−4)"],
];
const ACCOUNT_TYPES = [
  ["SAVINGS", "Caja de ahorro"], ["CHECKING", "Cuenta corriente"], ["WALLET", "Billetera virtual"], ["CASH", "Efectivo"], ["FOREIGN", "Cuenta en dólares"], ["INVESTMENT", "Cuenta de inversión"], ["OTHER", "Otra"],
];

export function Onboarding({ firstName, uses, modules }: { firstName: string; uses: Use[]; modules: Mod[] }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set(["dia", "deudas"]));
  const [currency, setCurrency] = useState("ARS");
  const [tz, setTz] = useState(TIMEZONES[0][0]);
  const suggested = useMemo(() => {
    const m = new Set<ModuleKey>(["alertas", "reglas", "tipos", "flujo"]);
    picked.forEach((u) => uses.find((x) => x.key === u)?.modules.forEach((k) => m.add(k)));
    return m;
  }, [picked, uses]);
  const [mods, setMods] = useState<Set<ModuleKey> | null>(null);
  const active = mods ?? suggested;
  const [acc, setAcc] = useState({ name: "", type: "SAVINGS", balance: "" });

  const toggle = (k: string) => {
    const n = new Set(picked);
    n.has(k) ? n.delete(k) : n.add(k);
    setPicked(n);
    setMods(null);
  };

  return (
    <div className="ob">
      <header className="ob-top"><span className="lp-brand"><span className="brand-mark">N</span><b>NEXO</b></span></header>
      <main className="ob-main">
        <ActionForm action={finishOnboardingAction} className="ob-card-w" key={step}>
          <div className="ob-prog"><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
          <p className="sub">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>

          {step === 0 && (
            <>
              <h1>Hola{firstName ? `, ${firstName}` : ""}. ¿Para qué vas a usar NEXO?</h1>
              <p className="sub">Elegí todas las que quieras. Con esto armamos tu menú; después lo cambiás cuando quieras.</p>
              <div className="ob-grid">
                {uses.map((u) => (
                  <button type="button" key={u.key} className={`ob-card ${picked.has(u.key) ? "on" : ""}`} aria-pressed={picked.has(u.key)} onClick={() => toggle(u.key)}>
                    <b>{u.title}</b><span>{u.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Tu moneda y tu zona</h1>
              <p className="sub">Los totales se muestran en tu moneda principal. Las cuentas en otras monedas se ven aparte.</p>
              <div className="field">Moneda principal
                <div className="seg">{[["ARS", "Pesos"], ["USD", "Dólares"]].map(([k, l]) => <button type="button" key={k} className={currency === k ? "on" : ""} style={{ flex: 1 }} onClick={() => setCurrency(k)}>{l}</button>)}</div>
              </div>
              <label className="field">Zona horaria
                <select value={tz} onChange={(e) => setTz(e.target.value)}>{TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Estas son tus funciones</h1>
              <p className="sub">Las elegimos según lo que marcaste. Prendé o apagá lo que quieras.</p>
              <div className="list ob-list">
                {modules.map((m) => (
                  <div className="li" key={m.key}>
                    <div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{m.name} {m.pro && <span className="pill">Pro</span>}</div><div className="s">{m.description}</div></div>
                    <label className="sw-t">
                      <input type="checkbox" checked={active.has(m.key)} aria-label={m.name} onChange={() => { const n = new Set(active); n.has(m.key) ? n.delete(m.key) : n.add(m.key); setMods(n); }} />
                      <span />
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Tu primera cuenta</h1>
              <p className="sub">Puede ser tu caja de ahorro, una billetera o el efectivo. Podés saltear este paso.</p>
              <label className="field">Nombre<input value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} placeholder="Ej.: Caja de ahorro sueldo" /></label>
              <div className="frow">
                <label className="field">Tipo<select value={acc.type} onChange={(e) => setAcc({ ...acc, type: e.target.value })}>{ACCOUNT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="field">Saldo de hoy<input value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} inputMode="decimal" placeholder="0,00" /></label>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>Listo, tu NEXO está armado</h1>
              <p className="sub">Así queda tu menú. Lo podés cambiar en Configuración → Funciones.</p>
              <div className="chips">{modules.filter((m) => active.has(m.key)).map((m) => <span className="tag" key={m.key}>{m.name}</span>)}</div>
              <dl className="kv">
                <dt>Moneda principal</dt><dd>{currency === "ARS" ? "Pesos" : "Dólares"}</dd>
                <dt>Zona horaria</dt><dd>{TIMEZONES.find((t) => t[0] === tz)?.[1]}</dd>
                <dt>Primera cuenta</dt><dd>{acc.name || "La cargás después"}</dd>
                <dt>Plan</dt><dd>Gratis</dd>
              </dl>
            </>
          )}

          {/* Lo elegido viaja con el formulario al terminar. */}
          {[...picked].map((u) => <input key={u} type="hidden" name="uses" value={u} />)}
          {[...active].map((m) => <input key={m} type="hidden" name="modules" value={m} />)}
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="timezone" value={tz} />
          <input type="hidden" name="accountName" value={acc.name} />
          <input type="hidden" name="accountType" value={acc.type} />
          <input type="hidden" name="accountBalance" value={acc.balance} />

          <div className="acts ob-acts">
            {step > 0 ? <button type="button" className="btn" onClick={() => setStep(step - 1)}>Atrás</button> : <span />}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn pri" disabled={step === 0 && picked.size === 0} onClick={() => setStep(step + 1)}>
                {step === 3 && !acc.name ? "Saltear y seguir" : "Siguiente"}
              </button>
            ) : (
              <Submit pending="Armando tu NEXO…">Entrar a NEXO</Submit>
            )}
          </div>
        </ActionForm>
      </main>
    </div>
  );
}
