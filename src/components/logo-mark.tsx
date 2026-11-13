// La marca de Guafra (el dibujo del logo) para el encabezado y las pantallas de la app. Sin fondo: el verde oscuro
// cambia a uno claro en modo oscuro (variable --logo-dark) para que se vea sobre cualquier fondo.
import { LOGO, LOGO_PARTS } from "@/lib/logo";

export function LogoMark({ className = "brand-mark logo" }: { className?: string }) {
  const [x, y, w, h] = LOGO.viewBox.split(" ").map(Number);
  const side = Math.max(w, h) / 0.94;
  const ox = x - (side - w) / 2, oy = y - (side - h) / 2;
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox={`${ox} ${oy} ${side} ${side}`} focusable="false">
        {LOGO_PARTS.map((p, i) => <path key={i} d={p.d} style={{ fill: p.fill === LOGO.dark ? "var(--logo-dark, " + LOGO.dark + ")" : p.fill }} fillRule={p.evenodd ? "evenodd" : undefined} />)}
      </svg>
    </span>
  );
}
