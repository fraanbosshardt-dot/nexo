"use client";
// Cuentas que se ordenan arrastrando la manija (⠿). Anda con el mouse, con el dedo y con el teclado (flechas).
import { Children, useRef, useState, useTransition, type ReactNode } from "react";
import { reorderAccountsAction } from "@/app/actions/app";

export function SortableAccounts({ ids, names, children }: { ids: string[]; names: string[]; children: ReactNode }) {
  const items = Children.toArray(children);
  const byId = new Map(ids.map((id, i) => [id, { node: items[i], name: names[i] }]));
  const [order, setOrder] = useState(ids);
  const [drag, setDrag] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const before = useRef<string[]>(ids);

  const save = (next: string[]) => {
    if (next.join() === before.current.join()) return;
    before.current = next;
    start(async () => { await reorderAccountsAction(next); setSaved("Orden guardado"); setTimeout(() => setSaved(""), 2000); });
  };
  const move = (id: string, to: number) => setOrder((o) => { const n = o.filter((x) => x !== id); n.splice(Math.max(0, Math.min(to, n.length)), 0, id); return n; });

  const onMove = (e: React.PointerEvent) => {
    if (!drag || !box.current) return;
    // La cuenta que está debajo del dedo o del mouse pasa a ser el nuevo lugar.
    const cells = [...box.current.querySelectorAll<HTMLElement>("[data-acc]")];
    const over = cells.find((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    const id = over?.dataset.acc;
    if (id && id !== drag) setOrder((o) => { const n = o.filter((x) => x !== drag); n.splice(o.indexOf(id), 0, drag); return n; });
  };
  const end = () => { if (drag) { setDrag(null); save(order); } };

  return (
    <div className="grid g3 sortable" ref={box} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
      {order.map((id, i) => {
        const it = byId.get(id);
        if (!it) return null;
        return (
          <div key={id} data-acc={id} className={`sort-cell${drag === id ? " dragging" : ""}`}>
            {it.node}
            <button
              type="button"
              className="sort-handle"
              aria-label={`Mover ${it.name} (posición ${i + 1} de ${order.length}). Usá las flechas.`}
              title="Arrastrá para cambiar el orden"
              onPointerDown={(e) => { e.preventDefault(); (e.currentTarget.closest(".sortable") as HTMLElement | null)?.setPointerCapture(e.pointerId); setDrag(id); }}
              onKeyDown={(e) => {
                const d = e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : 0;
                if (!d) return;
                e.preventDefault();
                const n = order.filter((x) => x !== id); n.splice(Math.max(0, Math.min(i + d, n.length)), 0, id);
                setOrder(n); save(n);
                requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-acc="${id}"] .sort-handle`)?.focus());
              }}
            >⠿</button>
          </div>
        );
      })}
      <span className="sr-only" role="status">{saved}</span>
    </div>
  );
}
