import { beforeAll, afterAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { consumePasswordReset } from "@/server/password-reset";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t.stop(); });
it("usar un enlace invalida los demás y cierra todas las sesiones", async () => {
  const user = await t.db.user.create({ data: { name: "Test", email: "reset@test.com", passwordHash: "old" } });
  const create = (tokenHash: string) => t.db.passwordReset.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600_000) } });
  const [a, b] = await Promise.all([create("a"), create("b")]);
  await t.db.session.create({ data: { userId: user.id, tokenHash: "session", expiresAt: new Date(Date.now() + 3600_000), twoFactorVerified: true } });
  const results = await Promise.all([consumePasswordReset(t.db, a.id, user.id, "new-a"), consumePasswordReset(t.db, b.id, user.id, "new-b")]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await t.db.passwordReset.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
  expect(await t.db.session.count({ where: { userId: user.id } })).toBe(0);
  expect(await consumePasswordReset(t.db, a.id, user.id, "again")).toBe(false);
});
it("un token vencido no modifica la contraseña", async () => {
  const user = await t.db.user.create({ data: { name: "Test", email: "expired@test.com", passwordHash: "old" } });
  const r = await t.db.passwordReset.create({ data: { userId: user.id, tokenHash: "expired", expiresAt: new Date(0) } });
  expect(await consumePasswordReset(t.db, r.id, user.id, "new")).toBe(false);
  expect((await t.db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBe("old");
});
