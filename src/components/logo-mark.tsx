// La marca de Guafra (el dibujo del logo) para el encabezado y las pantallas de la app.
import { LOGO, LOGO_PARTS } from "@/lib/logo";

export function LogoMark({ className = "brand-mark logo" }: { className?: string }) {
  const [x, y, w, h] = LOGO.viewBox.split(" ").map(Number);
  const side = Math.max(w, h) / 0.76;
  const ox = x - (side - w) / 2, oy = y - (side - h) / 2;
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox={`${ox} ${oy} ${side} ${side}`} focusable="false">
        <rect x={ox} y={oy} width={side} height={side} rx={side * 0.24} fill={LOGO.cream} />
        {LOGO_PARTS.map((p, i) => <path key={i} d={p.d} fill={p.fill} fillRule={p.evenodd ? "evenodd" : undefined} />)}
      </svg>
    </span>
  );
}
