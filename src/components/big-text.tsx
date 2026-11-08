"use client";
import { useEffect, useState } from "react";

// "Letra más grande": agranda toda la app en este dispositivo. Se guarda en el navegador.
export function BigTextToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(document.documentElement.hasAttribute("data-big")); }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    if (next) document.documentElement.setAttribute("data-big", ""); else document.documentElement.removeAttribute("data-big");
    try { localStorage.setItem("nexo-big", next ? "1" : "0"); } catch { /* sin almacenamiento: vale solo por ahora */ }
  };
  return (
    <div className="card">
      <div className="chead"><div><h3>Letra más grande</h3><p className="sub">Agranda textos y botones de toda la app en este dispositivo.</p></div>
        <button type="button" className={`btn sm ${on ? "" : "pri"}`} aria-pressed={on} onClick={toggle}>{on ? "Volver al tamaño normal" : "Agrandar"}</button>
      </div>
    </div>
  );
}
