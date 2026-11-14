import type { Db } from "./ledger";

// Todos los enlaces de una cuenta comparten el mismo bloqueo: solo un cambio puede ganar.
export async function consumePasswordReset(db: Db, resetId: string, userId: string, passwordHash: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.suspendedAt) return false;
    const claimed = await tx.passwordReset.updateMany({ where: { id: resetId, userId, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (!claimed.count) return false;
    await tx.user.update({ where: { id: userId }, data: { passwordHash, emailVerified: user.emailVerified ?? new Date() } });
    await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId } });
    return true;
  });
}
