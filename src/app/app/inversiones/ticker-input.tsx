"use client";
// Campo de especie con sugerencias: escribís "gal", "apple" o "btc" y elegís de la lista (con nombre y precio).
import { useEffect, useRef, useState } from "react";

type Hit = { symbol: string; name: string | null; price: number | null; currency: string | null };
const money = (n: number, c: string | null) => `${c === "USD" ? "US$" : "$"} ${n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 4 : 2 })}`;

export function TickerInput({ assetClass, placeholder, per100 }: { assetClass: string; placeholder: string; per100: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Al cambiar de tipo se empieza de nuevo.
  useEffect(() => { setQ(""); setHits([]); setPicked(null); }, [assetClass]);
  useEffect(() => {
    if (!q.trim() || picked?.symbol === q) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/inversiones/buscar?tipo=${assetClass}&q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        setHits(r.ok ? await r.json() : []); setOpen(true); setActive(-1);
      } catch { /* se canceló o sin conexión */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, assetClass, picked]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (h: Hit) => { setQ(h.symbol); setPicked(h); setOpen(false); };
  return (
    <div className="tk" ref={box}>
      <input name="ticker" value={q} placeholder={placeholder} autoComplete="off" autoCapitalize="characters" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="tk-list" aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setPicked(null); }}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && (hits.length > 0 || loading) && (
        <ul className="tk-list" id="tk-list" role="listbox">
          {loading && !hits.length && <li className="tk-empty">Buscando…</li>}
          {hits.map((h, i) => (
            <li key={h.symbol + i} role="option" aria-selected={i === active} className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(h); }}>
              <span><b>{h.symbol}</b>{h.name && <span className="sub">{h.name}</span>}</span>
              {h.price != null && <span className="num">{money(h.price, h.currency)}{per100 ? " c/100" : ""}</span>}
            </li>
          ))}
        </ul>
      )}
      {picked?.price != null && <span className="sub tk-note">Hoy: {money(picked.price, picked.currency)}{per100 ? " cada 100 nominales" : ""}{picked.currency === "USD" ? " · en dólares" : ""}</span>}
    </div>
  );
}
