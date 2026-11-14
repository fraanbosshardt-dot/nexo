"use client";
// Referidos en el navegador: guarda el código de quien invitó (si se llega con ?ref=) y el botón para copiar el link propio.
import { useEffect, useState } from "react";

export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[a-z2-9]{8}$/.test(ref)) document.cookie = `somosguafra_ref=${ref}; max-age=${30 * 86400}; path=/; samesite=lax`;
  }, []);
  return null;
}

export function ShareLink({ url, text }: { url: string; text: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2500); } catch { /* sin portapapeles: se puede copiar a mano */ }
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label className="field">Tu link para invitar<input readOnly value={url} onFocus={(e) => e.currentTarget.select()} /></label>
      <div className="acts">
        <button type="button" className="btn pri" onClick={copy}>{ok ? "¡Copiado!" : "Copiar link"}</button>
        <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">Mandar por WhatsApp</a>
      </div>
    </div>
  );
}
