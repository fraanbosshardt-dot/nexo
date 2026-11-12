"use client";
// Fila que se desliza a la izquierda en el celular para mostrar acciones (pagar, cancelar…).
// En la compu no cambia nada: los botones siguen en la fila. Un toque afuera la vuelve a cerrar.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmSubmit } from "./confirm-submit";

const WIDTH = 168; // ancho del panel de acciones

export function SwipeRow({ children, actions, className = "li" }: { children: ReactNode; actions: ReactNode; className?: string }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = dx < -WIDTH / 2;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setDx(0); };
    document.addEventListener("touchstart", close, { passive: true });
    return () => document.removeEventListener("touchstart", close);
  }, [open]);

  return (
    <div className="swipe" ref={ref}>
      <div className="swipe-acts" aria-hidden={!open} inert={!open}>{actions}</div>
      <div
        className={`${className} swipe-front`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: start.current ? "none" : undefined }}
        onTouchStart={(e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, base: dx, horizontal: null }; }}
        onTouchMove={(e) => {
          const s = start.current; if (!s) return;
          const t = e.touches[0], mx = t.clientX - s.x, my = t.clientY - s.y;
          if (s.horizontal === null && Math.abs(mx) + Math.abs(my) > 8) s.horizontal = Math.abs(mx) > Math.abs(my);
          if (s.horizontal) setDx(Math.max(-WIDTH, Math.min(0, s.base + mx)));
        }}
        onTouchEnd={() => { start.current = null; setDx((v) => (v < -WIDTH / 3 ? -WIDTH : 0)); }}
      >
        {children}
      </div>
    </div>
  );
}

// Botón de envío que pide confirmación nativa (en el panel deslizable no entra la confirmación en línea).
export function ConfirmButton({ question, children }: { question: string; children: ReactNode }) {
  return <ConfirmSubmit className="" question={question} yes="Sí, cancelar">{children}</ConfirmSubmit>;
}
