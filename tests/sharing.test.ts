// Espacio compartido: invitaciones, límites, permisos y qué pasa al irse o borrar la cuenta.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { acceptInvite, changeRole, createInvite, findInvite, MAX_GUESTS, pickMembership, removeMember, revokeInvite, switchWorkspace } from "@/server/sharing";
import { deleteAccount } from "@/server/admin-accounts";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let owner: { id: string; email: string }, ws: string;
const mkUser = async (email: string) => {
  const u = await db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "" } });
  await createWorkspaceForUser(db, u.id);
  return u;
};
beforeAll(async () => {
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  owner = await mkUser("duenia@test.com");
  ws = (await db.membership.findFirstOrThrow({ where: { userId: owner.id } })).workspaceId;
}, 60_000);
afterAll(async () => { await t.stop(); });

describe("espacio compartido", () => {
  it("invita, y solo acepta la cuenta con ese mismo correo", async () => {
    const ana = await mkUser("ana@test.com");
    const otro = await mkUser("otro@test.com");
    const { token } = await createInvite(db, ws, { email: " Ana@Test.com ", role: "EDITOR", invitedById: owner.id });
    await expect(acceptInvite(db, token, otro)).rejects.toThrow(/es para ana@test.com/);
    expect(await acceptInvite(db, token, ana)).toBe(ws);
    const m = await db.membership.findUniqueOrThrow({ where: { userId_workspaceId: { userId: ana.id, workspaceId: ws } } });
    expect(m.role).toBe("EDITOR");
    // Queda mirando el espacio compartido; el enlace ya no sirve otra vez.
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).activeWorkspaceId).toBe(ws);
    expect(await findInvite(db, token)).toBeNull();
  });

  it("no deja invitar dos veces ni a quien ya está", async () => {
    await expect(createInvite(db, ws, { email: "ana@test.com", role: "VIEWER", invitedById: owner.id })).rejects.toThrow(/ya está en el espacio/);
    await createInvite(db, ws, { email: "beto@test.com", role: "VIEWER", invitedById: owner.id });
    await expect(createInvite(db, ws, { email: "beto@test.com", role: "VIEWER", invitedById: owner.id })).rejects.toThrow(/pendiente/);
  });

  it(`hasta ${MAX_GUESTS} personas contando invitaciones pendientes`, async () => {
    const { invite } = await createInvite(db, ws, { email: "caro@test.com", role: "EDITOR", invitedById: owner.id });
    await expect(createInvite(db, ws, { email: "dani@test.com", role: "EDITOR", invitedById: owner.id })).rejects.toThrow(/hasta 3 personas/);
    await revokeInvite(db, ws, invite.id);
    await createInvite(db, ws, { email: "dani@test.com", role: "EDITOR", invitedById: owner.id });
  });

  it("la invitación vence a los 7 días", async () => {
    const ws2 = (await db.membership.findFirstOrThrow({ where: { user: { email: "otro@test.com" } } })).workspaceId;
    const { token } = await createInvite(db, ws2, { email: "eli@test.com", role: "EDITOR", invitedById: owner.id, now: new Date(Date.now() - 8 * 864e5) });
    expect(await findInvite(db, token)).toBeNull();
  });

  it("elige el espacio activo si sigue siendo miembro; si no, el propio", () => {
    const ms = [{ workspaceId: "propio" }, { workspaceId: "compartido" }];
    expect(pickMembership(ms, "compartido")?.workspaceId).toBe("compartido");
    expect(pickMembership(ms, "otro")?.workspaceId).toBe("propio");
    expect(pickMembership(ms, null)?.workspaceId).toBe("propio");
  });

  it("cambiar permiso, quitar a alguien y volver a su espacio", async () => {
    const ana = await db.user.findUniqueOrThrow({ where: { email: "ana@test.com" } });
    const m = await db.membership.findUniqueOrThrow({ where: { userId_workspaceId: { userId: ana.id, workspaceId: ws } } });
    await changeRole(db, ws, m.id, "VIEWER");
    expect((await db.membership.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("VIEWER");
    const own = await db.membership.findFirstOrThrow({ where: { workspaceId: ws, role: "OWNER" } });
    await expect(removeMember(db, ws, own.id)).rejects.toThrow(/dueño/);
    await removeMember(db, ws, m.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: ana.id } })).activeWorkspaceId).toBeNull();
    await expect(switchWorkspace(db, ana.id, ws)).rejects.toThrow(/No tenés acceso/);
  });

  it("si el dueño borra su cuenta, su espacio compartido se borra entero (los invitados no ven sus datos)", async () => {
    const fede = await mkUser("fede@test.com");
    const fedeWs = (await db.membership.findFirstOrThrow({ where: { userId: fede.id } })).workspaceId;
    const gabi = await mkUser("gabi@test.com");
    const { token } = await createInvite(db, fedeWs, { email: "gabi@test.com", role: "EDITOR", invitedById: fede.id });
    await acceptInvite(db, token, gabi);
    await deleteAccount(db, fede.id);
    expect(await db.workspace.findUnique({ where: { id: fedeWs } })).toBeNull();
    expect(await db.membership.count({ where: { userId: gabi.id } })).toBe(1); // le queda su propio espacio
  });
});
