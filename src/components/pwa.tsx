"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();

// Registra el service worker. En desarrollo no, para no interferir con los cambios en vivo
// (se puede probar con ?sw=1).
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const dev = process.env.NODE_ENV !== "production";
    if (dev && !location.search.includes("sw=1")) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => { deferred = null; listeners.forEach((l) => l()); };
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

const standalone = () => typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const ios = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

// Botón "Instalar app". En Android/Chrome instala con un toque; en iPhone muestra cómo hacerlo.
// Si la app ya está instalada, no se muestra.
export function InstallApp({ variant = "card" }: { variant?: "card" | "button" }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  if (!ready || standalone()) return null;
  const canPrompt = !!deferred;
  if (!canPrompt && !ios()) return null; // escritorio u otro navegador sin instalación
  const install = async () => {
    if (deferred) { await deferred.prompt(); await deferred.userChoice.catch(() => null); deferred = null; force((n) => n + 1); }
    else setHelp(true);
  };
  if (variant === "button") return <button type="button" className="btn" onClick={install}>Instalar app</button>;
  return (
    <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <h3 style={{ margin: 0 }}>Instalá Somos Guafra en tu celular</h3>
        <p className="sub" style={{ margin: "4px 0 0" }}>Queda con su ícono en la pantalla de inicio y se abre a pantalla completa, como una app.</p>
        {help && <p className="sub" style={{ margin: "10px 0 0", color: "var(--fg)" }}>En iPhone: tocá <b>Compartir</b> (el cuadrado con la flecha) y después <b>Agregar a inicio</b>.</p>}
      </div>
      <button type="button" className="btn pri" onClick={install}>{canPrompt ? "Instalar app" : "Cómo instalarla"}</button>
    </div>
  );
}
