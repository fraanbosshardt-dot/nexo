import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { PageHead, Tabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createCategoryAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Categorías" };

export default async function Categories({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { workspace } = await requireWorkspace();
  const kind = (await searchParams).tipo === "INCOME" ? "INCOME" : "EXPENSE";
  const cats = await getDb().category.findMany({ where: { workspaceId: workspace.id, kind, archived: false }, orderBy: { name: "asc" } });
  const parents = cats.filter((c) => !c.parentId);
  return (
    <>
      <PageHead crumb="Ajustes" title="Categorías" desc="También podés crear una categoría desde el formulario de un gasto o un ingreso." />
      <Tabs current={kind} items={[{ key: "EXPENSE", label: "Gastos", href: "/app/categorias" }, { key: "INCOME", label: "Ingresos", href: "/app/categorias?tipo=INCOME" }]} />
      <div className="grid g3">
        {parents.map((p) => {
          const subs = cats.filter((c) => c.parentId === p.id);
          return (
            <div className="card catc" key={p.id}>
              <div className="chead" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}><span className="cav">{p.name.slice(0, 2)}</span><div style={{ minWidth: 0 }}><h3>{p.name}</h3><p className="sub">{subs.length ? `${subs.length} ${subs.length === 1 ? "subcategoría" : "subcategorías"}` : "Sin subcategorías"}</p></div></div>
              </div>
              {subs.length > 0 && <div className="chips">{subs.map((s) => <span className="tag" key={s.id}>{s.name}</span>)}</div>}
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
