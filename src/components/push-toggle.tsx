"use client";
// Activar o apagar los avisos en este celular o navegador.
import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

const keyBytes = (b64: string) => {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = async () => {
    setState("busy"); setMsg("");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const r = await fetch("/api/push/suscribir", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error();
      setState("on"); setMsg("Listo: te avisamos acá el día antes de cada vencimiento.");
    } catch { setState("off"); setMsg("No pudimos activarlos. Probá de nuevo."); }
  };

  const turnOff = async () => {
    setState("busy"); setMsg("");
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/suscribir", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
  };

  const test = async () => {
    setMsg("Enviando…");
    const r = await fetch("/api/push/prueba", { method: "POST" }).then((x) => x.json()).catch(() => ({ sent: 0 }));
    setMsg(r.sent ? "Te mandamos un aviso de prueba. Puede tardar unos segundos." : "No pudimos mandarlo. Apagalos y volvé a activarlos.");
  };

  const text: Record<State, string> = {
    loading: "Revisando…",
    unsupported: "Este navegador no permite avisos. Probá con Chrome o Edge, o instalá la app.",
    "ios-install": "En iPhone, primero instalá la app (Compartir → Agregar a inicio) y abrila desde ahí.",
    denied: "Bloqueaste los avisos para este sitio. Activalos desde la configuración del navegador.",
    off: "Apagados en este dispositivo.",
    on: "Activados en este dispositivo.",
    busy: "Un momento…",
  };
  return (
    <div className="card">
      <div className="chead"><div><h3>Avisos en el celular</h3><p className="sub">Te avisamos el día antes de cada pago o cobro, aunque no abras la app. El aviso viaja sin datos: tu celular le pide el detalle a la app al recibirlo.</p></div>
        {state === "off" && <button type="button" className="btn sm pri" onClick={turnOn}>Activar</button>}
        {state === "on" && <div className="acts"><button type="button" className="btn sm" onClick={test}>Probar</button><button type="button" className="btn sm ghost" onClick={turnOff}>Apagar</button></div>}
      </div>
      <p className="sub" style={{ margin: 0 }} role="status">{msg || text[state]}</p>
    </div>
  );
}
