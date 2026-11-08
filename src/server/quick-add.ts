// Datos para la carga rápida del celular: cuentas y categorías ordenadas por las que más usás.
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { categoryIcon } from "@/lib/category-icon";
export async function quickAddData(wsId: string, tz: string) {
  const db = getDb();
  const since = new Date(Date.now() - 120 * 864e5);
  const [accounts, cats, usage] = await Promise.all([
    db.account.findMany({ where: { workspaceId: wsId, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true, name: true, currency: true }, orderBy: { createdAt: "asc" } }),
    db.category.findMany({ where: { workspaceId: wsId, archived: false, parentId: null }, select: { id: true, name: true, kind: true } }),
    db.transaction.groupBy({ by: ["categoryId"], where: { workspaceId: wsId, categoryId: { not: null }, effectiveDate: { gte: since } }, _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.categoryId, u._count._all]));
  const sorted = cats.map((c) => ({ ...c, icon: categoryIcon(c.name), n: used.get(c.id) ?? 0 })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const last = await db.transaction.findFirst({ where: { workspaceId: wsId, type: { in: ["EXPENSE", "INCOME"] } }, orderBy: { createdAt: "desc" }, select: { accountId: true } });
  return { accounts, categories: sorted.map(({ n: _n, ...c }) => c), defaultAccount: last?.accountId ?? accounts[0]?.id ?? "", today: todayIn(tz).toISOString().slice(0, 10) };
}
