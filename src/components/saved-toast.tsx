"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { reverseAction } from "@/app/actions/app";

// Aviso "Guardado · Deshacer" después de cargar un movimiento. Deshacer lo anula (no borra el historial).
export function SavedToast() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const id = sp.get("guardado");
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!id) return;
    setShow(true);
    const t = setTimeout(() => { setShow(false); const n = new URLSearchParams(sp); n.delete("guardado"); router.replace(n.size ? `${path}?${n}` : path, { scroll: false }); }, 9000);
    return () => clearTimeout(t);
  }, [id, sp, path, router]);
  if (!show || !id) return null;
  return (
    <div className="toast" role="status" style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <span>{id === "1" ? "Cambios guardados" : "Guardado"}</span>
      {id !== "1" && (
        <form action={async (fd) => { await reverseAction(fd); setShow(false); router.replace(path); }}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" style={{ border: 0, background: "none", color: "#A8C7FA", fontWeight: 500, cursor: "pointer", padding: 0 }}>Deshacer</button>
        </form>
      )}
    </div>
  );
}
