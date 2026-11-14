import type { Db } from "./ledger";

// El dato de la URL solo elige un espacio propio. Nunca acredita un pago ni otorga Pro.
export async function selectBillingWorkspace(db: Db, userId: string, workspaceId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(workspaceId)) return false;
  const membership = await db.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
  if (membership?.role !== "OWNER") return false;
  await db.user.update({ where: { id: userId }, data: { activeWorkspaceId: workspaceId } });
  return true;
}
