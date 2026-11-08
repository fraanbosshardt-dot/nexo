"use client";
// Botones redondos de Inicio en el celular: Gasto, Ingreso, Transferir y (si usás Agro) Cereal.
import Link from "next/link";
import { Icon } from "@/components/icons";
import { openQuickAdd } from "@/components/quick-add";

export function QuickButtons({ cereal }: { cereal: boolean }) {
  return (
    <div className="qb m-only" role="group" aria-label="Acciones rápidas">
      <button type="button" onClick={() => openQuickAdd("EXPENSE")}><span><Icon name="minus" /></span>Gasto</button>
      <button type="button" onClick={() => openQuickAdd("INCOME")}><span><Icon name="plus" /></span>Ingreso</button>
      <Link href="/app/movimientos/nuevo?tipo=TRANSFER"><span><Icon name="swap" /></span>Transferir</Link>
      {cereal
        ? <Link href="/app/cereal"><span><Icon name="grain" /></span>Cereal</Link>
        : <Link href="/app/proximos"><span><Icon name="clock" /></span>Próximos</Link>}
    </div>
  );
}
