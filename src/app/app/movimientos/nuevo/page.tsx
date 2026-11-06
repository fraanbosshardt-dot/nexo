import Link from "next/link";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isoDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { MovementForm } from "./movement-form";

export const metadata: Metadata = { title: "Nuevo movimiento" };

export default async function NewMovement({ searchParams }: { searchParams: Promise<{ tipo?: string; cuenta?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const [accounts, categories] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, archived: false }, orderBy: [{ parentId: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true, parentId: true } }),
  ]);
  if (!accounts.length) {
    return (
      <>
        <PageHead crumb="Mi dinero" title="Nuevo movimiento" />
        <div className="empty">Primero necesitás una cuenta. <Link className="lk" href="/app/cuentas?nueva=1">Crear cuenta</Link></div>
      </>
    );
  }
  const kind = sp.tipo === "INCOME" || sp.tipo === "TRANSFER" ? sp.tipo : "EXPENSE";
  return (
    <>
      <Link className="lk" href="/app/movimientos">← Movimientos</Link>
      <PageHead crumb="Mi dinero" title="Nuevo movimiento" />
      <div className="card" style={{ maxWidth: 640 }}>
        <MovementForm accounts={accounts} categories={categories} today={isoDate(todayIn(workspace.timezone))} initialKind={kind} initialAccount={sp.cuenta} baseCurrency={workspace.baseCurrency} idem={randomUUID()} />
      </div>
    </>
  );
}
