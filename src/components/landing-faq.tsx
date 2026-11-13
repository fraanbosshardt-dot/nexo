"use client";
// Preguntas frecuentes: una abierta por vez. Al abrir, la respuesta se despliega suave (alto que crece y texto que
// aparece) y el + gira hasta ser una ×. Las respuestas siempre están en la página (también para buscadores).
import { useId, useState } from "react";

export function FaqList({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="lx-faq-list">
      {items.map(([q, a], k) => {
        const on = open === k, id = `${base}-${k}`;
        return (
          <div key={q} className={`lx-faq-item ${on ? "on" : ""}`}>
            <h3>
              <button type="button" aria-expanded={on} aria-controls={id} onClick={() => setOpen(on ? null : k)}>
                <span className="lx-faq-n">{String(k + 1).padStart(2, "0")}</span>
                <span className="lx-faq-q">{q}</span>
                <span className="lx-faq-ic" aria-hidden="true"><i /><i /></span>
              </button>
            </h3>
            <div id={id} className="lx-faq-a" role="region" aria-label={q}>
              <div><p>{a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
