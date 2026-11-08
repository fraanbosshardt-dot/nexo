import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PageHead, Tabs, SettingsTabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createCategoryAction, deleteCategoryAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata: Metadata = { title: "Categorías" };

export default async function Categories({ searchParams }: { searchParams: Promise<{ tipo?: string; borrada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const kind = sp.tipo === "INCOME" ? "INCOME" : "EXPENSE";
  const db = getDb();
  const [cats, used] = await Promise.all([
    db.category.findMany({ where: { workspaceId: workspace.id, kind, archived: false }, orderBy: { name: "asc" } }),
    db.transaction.groupBy({ by: ["categoryId"], where: { workspaceId: workspace.id, categoryId: { not: null } }, _count: { _all: true } }),
  ]);
  const count = (id: string) => used.find((u) => u.categoryId === id)?._count._all ?? 0;
  const parents = cats.filter((c) => !c.parentId);
  return (
    <>
      <PageHead crumb="Configuración" title="Categorías" desc="También podés crear una categoría desde el formulario de un gasto o un ingreso." />
      <SettingsTabs current="categorias" />
      <Tabs current={kind} items={[{ key: "EXPENSE", label: "Gastos", href: "/app/categorias" }, { key: "INCOME", label: "Ingresos", href: "/app/categorias?tipo=INCOME" }]} />
      {sp.borrada && <p className="notice g" role="status">Categoría borrada. Sus movimientos quedaron donde elegiste.</p>}
      <div className="grid g3">
        {parents.map((p) => {
          const subs = cats.filter((c) => c.parentId === p.id);
          const n = count(p.id) + subs.reduce((t, s) => t + count(s.id), 0);
          const others = cats.filter((c) => c.id !== p.id && c.parentId !== p.id);
          return (
            <div className="card catc" key={p.id}>
              <div className="chead" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}><span className="cav">{p.name.slice(0, 2)}</span><div style={{ minWidth: 0 }}><h3>{p.name}</h3><p className="sub">{subs.length ? `${subs.length} ${subs.length === 1 ? "subcategoría" : "subcategorías"}` : "Sin subcategorías"} · {n} {n === 1 ? "movimiento" : "movimientos"}</p></div></div>
              </div>
              {subs.length > 0 && <div className="chips">{subs.map((s) => <span className="tag" key={s.id}>{s.name}</span>)}</div>}
              <details className="cat-del">
                <summary>Borrar</summary>
                <ActionForm action={deleteCategoryAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
                  <input type="hidden" name="kind" value={kind} />
                  <label className="field">Qué querés borrar<select name="id" defaultValue={p.id}>
                    <option value={p.id}>{subs.length ? `${p.name} y sus subcategorías` : p.name}</option>
                    {subs.map((s) => <option key={s.id} value={s.id}>Solo {s.name} ({count(s.id)})</option>)}
                  </select></label>
                  <label className="field">Sus movimientos pasan a<select name="moveTo" defaultValue="">
                    <option value="">Sin categoría</option>
                    {others.filter((o) => !o.parentId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    {others.filter((o) => o.parentId).map((o) => <option key={o.id} value={o.id}>{parents.find((x) => x.id === o.parentId)?.name} › {o.name}</option>)}
                  </select></label>
                  <p className="sub" style={{ margin: 0 }}>Nada se pierde: los movimientos, pagos y presupuestos de esta categoría quedan en la que elijas.</p>
                  <div><ConfirmSubmit className="btn danger" question={`¿Borrar ${p.name}?`} yes="Sí, borrar">Borrar</ConfirmSubmit></div>
                </ActionForm>
              </details>
            </div>
          );
        })}
      </div>
      <div className="card">
        <details className="more"><summary>+ Nueva categoría</summary>
          <ActionForm action={createCategoryAction} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10, maxWidth: 520 }}>
            <input type="hidden" name="kind" value={kind} />
            <label className="field">Nombre<input name="name" placeholder="Ej.: Mascotas" /></label>
            <label className="field">Dentro de<select name="parentId" defaultValue=""><option value="">Ninguna (categoría principal)</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div><Submit>Crear categoría</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
