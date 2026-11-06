import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { reverseAction, updateMovementAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Movimiento" };

export default async function MovementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const db = getDb();
  const t = await db.transaction.findFirst({ where: { id, workspaceId: workspace.id }, include: { account: true, category: true, reversedBy: true, reversalOf: true, obligation: true } });
  if (!t) notFound();
  const kind = t.type === "INCOME" ? "INCOME" : "EXPENSE";
  const cats = await db.category.findMany({ where: { workspaceId: workspace.id, archived: false, kind }, orderBy: [{ parentId: "asc" }, { name: "asc" }] });
  const parents = cats.filter((c) => !c.parentId);
  const options = parents.flatMap((p) => [{ id: p.id, label: p.name }, ...cats.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  const locked = !!(t.reversedBy || t.reversalOfId);
  const simple = (t.type === "INCOME" || t.type === "EXPENSE") && !t.obligationId && !t.transferGroupId;
  const isIn = t.direction === "IN";
  return (
    <div className="narrow">
      <Link className="lk" href="/app/movimientos">← Movimientos</Link>
      <PageHead crumb="Mi dinero" title={t.description} desc={`${fmtDate(t.effectiveDate)} · ${t.account.name}`} />
      <div className="card">
        <div className={`hero ${""}`} style={{ padding: 0, gridTemplateColumns: "1fr" }}>
          <div className={`big ${t.type === "TRANSFER" ? "" : isIn ? "pos" : "neg"}`} style={{ fontSize: 32 }}>{isIn ? "+" : "−"}{formatMoney(t.amount, t.currency)}</div>
        </div>
        {t.obligation && <p className="sub">Es un pago de “{t.obligation.description}”.</p>}
        {t.reversedBy && <div className="notice" style={{ marginTop: 10 }}>Este movimiento está anulado. El saldo ya se corrigió.</div>}
        {t.reversalOf && <div className="notice" style={{ marginTop: 10 }}>Anula a “{t.reversalOf.description}”.</div>}
      </div>
      {!locked && (
        <div className="card">
          <div className="chead"><h3>Editar</h3></div>
          <ActionForm action={updateMovementAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input type="hidden" name="id" value={t.id} />
            <div className="frow">
              <label className="field">Concepto<input name="description" defaultValue={t.description} maxLength={140} /></label>
              <label className="field">Importe{simple ? <input name="amount" inputMode="decimal" defaultValue={t.amount.toFixed(2).replace(".", ",")} /> : <input disabled value={formatMoney(t.amount, t.currency)} title="El importe de un pago, una transferencia o una cuota no se edita: anulalo y cargalo de nuevo." />}</label>
            </div>
            {t.type !== "TRANSFER" && (
              <label className="field">Categoría<select name="categoryId" defaultValue={t.categoryId ?? ""}><option value="">Sin categoría</option>{options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            )}
            <div className="frow">
              <label className="field">Fecha<input name="effectiveDate" type="date" defaultValue={isoDate(t.effectiveDate)} /></label>
              <label className="field">Corresponde al mes<input name="economicPeriod" type="month" defaultValue={t.economicPeriod} /></label>
            </div>
            <label className="field">Notas<input name="notes" defaultValue={t.notes ?? ""} /></label>
            {!simple && <p className="sub" style={{ margin: 0 }}>El importe de un pago, una transferencia o una cuota no se edita. Si está mal, anulalo y cargalo de nuevo.</p>}
            <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Guardar cambios</Submit></div>
          </ActionForm>
        </div>
      )}
      {!locked && (
        <form action={reverseAction} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={t.id} />
          <p className="sub" style={{ margin: 0, maxWidth: "52ch" }}>Anular crea un movimiento al revés con fecha de hoy. No borra nada: el historial queda completo.</p>
          <button className="btn" type="submit">Anular movimiento</button>
        </form>
      )}
    </div>
  );
}
