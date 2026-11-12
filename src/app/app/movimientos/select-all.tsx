"use client";
// Elegir o soltar todos los movimientos de la lista de una vez.
import { useState } from "react";

export function SelectAll({ form }: { form: string }) {
  const [all, setAll] = useState(false);
  return (
    <button type="button" className="btn sm ghost" onClick={() => {
      const next = !all;
      document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"]`).forEach((c) => { c.checked = next; });
      setAll(next);
    }}>{all ? "Soltar todos" : "Elegir todos"}</button>
  );
}
