// Borrar una categoría sin perder historia: lo que la usaba pasa a otra categoría (o queda sin categoría).
// Si es una categoría principal, se borran también sus subcategorías.
import type { PrismaClient } from "@/generated/prisma/client";
import { UserError } from "./ledger";

export async function categoryUsage(db: PrismaClient, ws: string, id: string) {
  const ids = [id, ...(await db.category.findMany({ where: { workspaceId: ws, parentId: id }, select: { id: true } })).map((c) => c.id)];
  const [moves, pending, rules] = await Promise.all([
    db.transaction.count({ where: { workspaceId: ws, categoryId: { in: ids } } }),
    db.obligation.count({ where: { workspaceId: ws, categoryId: { in: ids } } }),
    db.recurringRule.count({ where: { workspaceId: ws, categoryId: { in: ids } } }),
  ]);
  return { ids, moves, pending, rules, total: moves + pending + rules };
}

export async function deleteCategory(db: PrismaClient, ws: string, id: string, moveTo: string | null) {
  const cat = await db.category.findFirst({ where: { id, workspaceId: ws } });
  if (!cat) throw new UserError("No encontramos esa categoría.");
  const { ids } = await categoryUsage(db, ws, id);
  if (moveTo) {
    if (ids.includes(moveTo)) throw new UserError("Elegí otra categoría para pasar los movimientos.");
    const target = await db.category.findFirst({ where: { id: moveTo, workspaceId: ws, archived: false } });
    if (!target) throw new UserError("No encontramos la categoría a la que querés pasar los movimientos.");
    if (target.kind !== cat.kind) throw new UserError("Elegí una categoría del mismo tipo (gasto o ingreso).");
  }
  const where = { workspaceId: ws, categoryId: { in: ids } };
  await db.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where, data: { categoryId: moveTo } });
    await tx.obligation.updateMany({ where, data: { categoryId: moveTo } });
    await tx.recurringRule.updateMany({ where, data: { categoryId: moveTo } });
    await tx.installmentPlan.updateMany({ where: { categoryId: { in: ids }, card: { workspaceId: ws } }, data: { categoryId: moveTo } });
    // Presupuestos: el límite pasa a la otra categoría si en ese mes no tenía uno; si ya tenía, se descarta.
    const lines = await tx.budgetLine.findMany({ where: { categoryId: { in: ids }, budget: { workspaceId: ws } } });
    for (const l of lines) {
      const taken = moveTo ? await tx.budgetLine.findFirst({ where: { budgetId: l.budgetId, categoryId: moveTo } }) : null;
      if (moveTo && !taken) await tx.budgetLine.update({ where: { id: l.id }, data: { categoryId: moveTo } });
      else await tx.budgetLine.delete({ where: { id: l.id } });
    }
    await tx.category.deleteMany({ where: { workspaceId: ws, parentId: id } });
    await tx.category.delete({ where: { id } });
  });
}
