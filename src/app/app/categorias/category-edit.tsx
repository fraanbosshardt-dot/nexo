"use client";
// Editar una categoría o una de sus subcategorías: nombre y dónde va.
import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { updateCategoryAction } from "@/app/actions/app";

type Item = { id: string; name: string; parentId: string | null; hasChildren: boolean };

export function CategoryEdit({ items, parents }: { items: Item[]; parents: { id: string; name: string }[] }) {
  const [id, setId] = useState(items[0].id);
  const cur = items.find((i) => i.id === id) ?? items[0];
  return (
    <ActionForm action={updateCategoryAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
      {items.length > 1 && (
        <label className="field">Qué querés editar<select name="id" value={id} onChange={(e) => setId(e.target.value)}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.parentId ? `Subcategoría: ${i.name}` : i.name}</option>)}
        </select></label>
      )}
      {items.length === 1 && <input type="hidden" name="id" value={id} />}
      {/* key: al cambiar de categoría se cargan sus valores */}
      <label className="field">Nombre<input key={`n-${id}`} name="name" defaultValue={cur.name} maxLength={60} /></label>
      <label className="field">Dentro de<select key={`p-${id}`} name="parentId" defaultValue={cur.parentId ?? ""} disabled={cur.hasChildren}>
        <option value="">Ninguna (categoría principal)</option>
        {parents.filter((p) => p.id !== cur.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      {cur.hasChildren && <p className="sub" style={{ margin: 0 }}>Tiene subcategorías, así que queda como principal.</p>}
      <p className="sub" style={{ margin: 0 }}>Los movimientos, pagos y presupuestos siguen en esta categoría con el nombre nuevo.</p>
      <div><Submit>Guardar cambios</Submit></div>
    </ActionForm>
  );
}
