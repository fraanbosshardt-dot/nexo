"use client";
import { useEffect, useState } from "react";
import { setBigTextAction } from "@/app/actions/app";

const apply = (on: boolean) => {
  if (on) document.documentElement.setAttribute("data-big", ""); else document.documentElement.removeAttribute("data-big");
  try { localStorage.setItem("somosguafra-big", on ? "1" : "0"); } catch { /* sin almacenamiento: vale solo por ahora */ }
};

// Al entrar a la app, aplica lo guardado en la cuenta (así vale en todos tus dispositivos).
export function BigTextSync({ saved }: { saved: boolean | null }) {
  useEffect(() => { if (saved !== null && saved !== document.documentElement.hasAttribute("data-big")) apply(saved); }, [saved]);
  return null;
}

// "Letra más grande": agranda toda la app. Se guarda en la cuenta y en el navegador (para que cargue sin parpadeo).
export function BigTextToggle({ compact = false }: { compact?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(document.documentElement.hasAttribute("data-big")); }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    apply(next);
    setBigTextAction(next).catch(() => { /* sin conexión: queda en este dispositivo */ });
  };
  if (compact) return (
    <button type="button" className="big-switch" aria-pressed={on} onClick={toggle}>
      <span>Letra más grande</span><span className={`sw-mini ${on ? "on" : ""}`} aria-hidden="true"><i /></span>
    </button>
  );
  return (
    <div className="card">
      <div className="chead"><div><h3>Letra más grande</h3><p className="sub">Agranda textos y botones de toda la app, en todos tus dispositivos.</p></div>
        <button type="button" className={`btn sm ${on ? "" : "pri"}`} aria-pressed={on} onClick={toggle}>{on ? "Volver al tamaño normal" : "Agrandar"}</button>
      </div>
    </div>
  );
}
