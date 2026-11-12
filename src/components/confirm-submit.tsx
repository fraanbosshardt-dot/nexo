"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Botón que pide confirmación antes de enviar: abre un cuadro centrado con la pregunta y dos botones claros.
// Sirve dentro de cualquier <form action={...}> (eliminar, cancelar, adelantar).
// La pregunta puede traer una explicación después del "?": se muestra abajo, más chica.
export function ConfirmSubmit({ children, question, yes = "Sí", className = "btn sm", ariaLabel, title }: { children: React.ReactNode; question: string; yes?: string; className?: string; ariaLabel?: string; title?: string }) {
  const [ask, setAsk] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const cut = question.indexOf("?");
  const head = cut >= 0 ? question.slice(0, cut + 1) : question;
  const detail = cut >= 0 ? question.slice(cut + 1).trim() : "";
  const danger = /danger/.test(className) || /eliminar|borrar|baja|cancelar|quitar/i.test(yes);
  const close = () => { setAsk(false); btn.current?.focus(); };
  const go = () => { const f = btn.current?.form; setAsk(false); f?.requestSubmit(); };
  useEffect(() => {
    if (!ask) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [ask]);
  return (
    <>
      <button ref={btn} type="button" className={className} aria-label={ariaLabel} title={title} aria-haspopup="dialog" onClick={() => setAsk(true)}>{children}</button>
      {ask && typeof document !== "undefined" && createPortal(
        <div className="cdlg-back" onMouseDown={close}>
          <div className="cdlg" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={detail ? `${id}-d` : undefined} onMouseDown={(e) => e.stopPropagation()}>
            <span className={`cdlg-ic ${danger ? "r" : ""}`} aria-hidden="true">{danger ? "!" : "?"}</span>
            <h3 id={`${id}-t`}>{head}</h3>
            {detail && <p id={`${id}-d`}>{detail}</p>}
            <div className="cdlg-acts">
              <button type="button" className="btn" onClick={close}>Cancelar</button>
              <button type="button" className={`btn ${danger ? "danger" : "pri"}`} onClick={go} autoFocus>{yes}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
