"use client";
import { useState } from "react";

// Botón que pide confirmación antes de enviar: el primer toque pregunta, el segundo hace la acción.
// Sirve dentro de cualquier <form action={...}> (borrar, cancelar, anular).
export function ConfirmSubmit({ children, question, yes = "Sí", className = "btn sm", ariaLabel, title }: { children: React.ReactNode; question: string; yes?: string; className?: string; ariaLabel?: string; title?: string }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className={className} aria-label={ariaLabel} title={title} onClick={() => setAsk(true)}>{children}</button>;
  return (
    <span className="confirm" role="alertdialog" aria-label={question}>
      <span className="confirm-q">{question}</span>
      <button type="submit" className="btn sm danger" autoFocus>{yes}</button>
      <button type="button" className="btn sm" onClick={() => setAsk(false)}>No</button>
    </span>
  );
}
