import Link from "next/link";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isoDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { MovementForm } from "./movement-form";

export const metadata: Metadata = { title: "Nuevo movimiento" };

export default async function NewMovement({ searchParams }: { searchParams: Promise<{ tipo?: string; cuenta?: string; estado?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const [accounts, categories, recent] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, currency: true, type: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false }, orderBy: [{ parentId: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true, parentId: true } }),
    db.transaction.findMany({ where: { workspaceId: workspace.id, type: { in: ["INCOME", "EXPENSE"] }, reversalOfId: null }, orderBy: { createdAt: "desc" }, take: 300, select: { description: true, categoryId: true, accountId: true } }),
  ]);
  if (!accounts.length) {
    return (
      <>
        <PageHead crumb="Mi dinero" title="Nuevo movimiento" />
        <div className="empty">Primero necesitás una cuenta. <Link className="lk" href="/app/cuentas?nueva=1">Crear cuenta</Link></div>
      </>
    );
  }
  // Para cargar rápido: la última cuenta usada y los conceptos ya usados con su categoría.
  const lastAccount = sp.cuenta ?? recent[0]?.accountId;
  const history = recent.filter((t) => t.categoryId).map((t) => ({ d: t.description, c: t.categoryId! }));
  const kind = sp.tipo === "INCOME" || sp.tipo === "TRANSFER" ? sp.tipo : "EXPENSE";
  return (
    <div className="narrow">
      <Link className="lk" href="/app/movimientos">← Movimientos</Link>
      <PageHead crumb="Mi dinero" title="Nuevo movimiento" />
      <div className="card">
        <MovementForm accounts={accounts} categories={categories} today={isoDate(todayIn(workspace.timezone))} initialKind={kind} initialAccount={lastAccount} initialStatus={sp.estado === "pendiente" ? "PENDING" : undefined} history={history} baseCurrency={workspace.baseCurrency} idem={randomUUID()} back={sp.estado === "pendiente" ? "/app/proximos?guardado=1" : undefined} />
      </div>
    </div>
  );
}
