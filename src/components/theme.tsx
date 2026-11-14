"use client";
// Modo claro / oscuro: automático (sigue al dispositivo), claro u oscuro. Se guarda en este dispositivo.
import { useEffect, useState } from "react";

type Mode = "auto" | "light" | "dark";
const KEY = "somosguafra-theme";

function apply(mode: Mode) {
  const el = document.documentElement;
  if (mode === "auto") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", mode);
  try { localStorage.setItem(KEY, mode); } catch { /* sin almacenamiento: vale solo por ahora */ }
  window.dispatchEvent(new CustomEvent("somosguafra:theme", { detail: mode }));
}
const current = (): Mode => (document.documentElement.getAttribute("data-theme") as Mode | null) ?? "auto";
const isDarkNow = (m: Mode) => m === "dark" || (m === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

function useMode() {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    setMode(current());
    const on = (e: Event) => setMode((e as CustomEvent).detail as Mode);
    window.addEventListener("somosguafra:theme", on);
    return () => window.removeEventListener("somosguafra:theme", on);
  }, []);
  return mode;
}

// Botón de la barra de arriba: alterna claro y oscuro con un toque.
export function ThemeButton() {
  const mode = useMode();
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(isDarkNow(mode)); }, [mode]);
  return (
    <button type="button" className="ibtn" aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"} onClick={() => apply(dark ? "light" : "dark")}>
      <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
        {dark
          ? <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          : <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />}
      </svg>
    </button>
  );
}

// Elección completa (Configuración).
export function ThemeChoice() {
  const mode = useMode();
  const opts: [Mode, string][] = [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]];
  return (
    <div className="card">
      <div className="chead"><div><h3>Modo claro u oscuro</h3><p className="sub">Automático sigue lo que tengas elegido en el celular o la computadora.</p></div></div>
      <div className="seg" role="group" aria-label="Modo de color" style={{ alignSelf: "flex-start" }}>
        {opts.map(([m, l]) => <button key={m} type="button" className={`segl ${mode === m ? "on" : ""}`} aria-pressed={mode === m} onClick={() => apply(m)}>{l}</button>)}
      </div>
    </div>
  );
}
