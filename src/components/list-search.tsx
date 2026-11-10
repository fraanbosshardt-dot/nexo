"use client";
// Buscador para listas largas de la app: filtra en el momento lo que ya está en pantalla (sin recargar).
// Cada elemento que se puede encontrar lleva data-q con su texto; la búsqueda no distingue acentos ni mayúsculas.
import { useEffect, useState } from "react";
import { searchText } from "@/lib/search-text";


export function ListSearch({ scope, placeholder, label }: { scope: string; placeholder: string; label: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    const root = document.getElementById(scope);
    if (!root) return;
    const term = searchText(q.trim());
    let n = 0;
    root.querySelectorAll<HTMLElement>("[data-q]").forEach((el) => {
      const hit = !term || (el.dataset.q ?? "").includes(term);
      el.hidden = !hit;
      if (hit) n++;
    });
    // Grupos plegables (por ejemplo "Terminadas"): se abren si adentro hay algo que coincide.
    root.querySelectorAll<HTMLDetailsElement>("details[data-group]").forEach((d) => {
      const any = !!d.querySelector("[data-q]:not([hidden])");
      if (term) { d.hidden = !any; if (any) d.open = true; } else d.hidden = false;
    });
    setShown(term ? n : null);
  }, [q, scope]);
  return (
    <div className="lsearch" role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={label} />
      {shown !== null && <span className="lsearch-n" role="status">{shown === 0 ? "Sin resultados" : `${shown} ${shown === 1 ? "resultado" : "resultados"}`}</span>}
    </div>
  );
}
