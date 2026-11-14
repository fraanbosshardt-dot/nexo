// Espacio compartido (Pro): el dueño invita hasta 3 personas por correo. Cada una entra con su propia cuenta y
// puede "cargar y editar" o "solo mirar". Cada persona elige qué espacio está viendo (el suyo o uno compartido).
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { UserError } from "./ledger";

export const MAX_GUESTS = 3;
const INVITE_DAYS = 7;
export const INVITE_COOKIE = "somosguafra_invite";
export type GuestRole = "EDITOR" | "VIEWER";
export const ROLE_LABEL: Record<string, string> = { OWNER: "Dueño", EDITOR: "Carga y edita", VIEWER: "Solo mira" };

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const normEmail = (e: string) => e.trim().toLowerCase();

// Espacio que ve la persona: el que eligió (si sigue siendo miembro) o el primero, que es el propio.
export function pickMembership<M extends { workspaceId: string }>(memberships: M[], activeWorkspaceId: string | null | undefined): M | undefined {
  return memberships.find((m) => m.workspaceId === activeWorkspaceId) ?? memberships[0];
}

export async function sharingOverview(db: PrismaClient, ws: string) {
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { workspaceId: ws }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.workspaceInvite.findMany({ where: { workspaceId: ws, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } }),
  ]);
  const guests = members.filter((m) => m.role !== "OWNER").length;
  return { members, invites, left: Math.max(0, MAX_GUESTS - guests - invites.length) };
}

export async function createInvite(db: PrismaClient, ws: string, input: { email: string; role: GuestRole; invitedById: string; now?: Date }) {
  const email = normEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Revisá el correo.");
  if (input.role !== "EDITOR" && input.role !== "VIEWER") throw new UserError("Elegí qué puede hacer.");
  const { members, invites, left } = await sharingOverview(db, ws);
  if (members.some((m) => m.user.email.toLowerCase() === email)) throw new UserError("Esa persona ya está en el espacio.");
  if (invites.some((i) => i.email === email)) throw new UserError("Ya hay una invitación pendiente para ese correo. Podés cancelarla y mandar otra.");
  if (left <= 0) throw new UserError(`Podés compartir con hasta ${MAX_GUESTS} personas. Quitá a alguien o cancelá una invitación.`);
  const token = randomBytes(24).toString("base64url");
  const now = input.now ?? new Date();
  const invite = await db.workspaceInvite.create({ data: { workspaceId: ws, email, role: input.role, tokenHash: hash(token), invitedById: input.invitedById, expiresAt: new Date(now.getTime() + INVITE_DAYS * 864e5) } });
  return { invite, token };
}

export async function findInvite(db: PrismaClient, token: string, now = new Date()) {
  const inv = await db.workspaceInvite.findUnique({ where: { tokenHash: hash(token) }, include: { workspace: { include: { members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { name: true } } } } } } } });
  if (!inv || inv.acceptedAt || inv.expiresAt < now) return null;
  return inv;
}

// Acepta con la cuenta que tiene ese mismo correo, así un enlace reenviado no le sirve a otra persona.
export async function acceptInvite(db: PrismaClient, token: string, user: { id: string; email: string }, now = new Date()) {
  const inv = await findInvite(db, token, now);
  if (!inv) throw new UserError("La invitación venció, ya se usó o fue cancelada. Pedile a quien te invitó que te mande otra.");
  if (normEmail(user.email) !== inv.email) throw new UserError(`Esta invitación es para ${inv.email}. Entrá con ese correo para aceptarla.`);
  const already = await db.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: inv.workspaceId } } });
  const guests = await db.membership.count({ where: { workspaceId: inv.workspaceId, role: { not: "OWNER" } } });
  if (!already && guests >= MAX_GUESTS) throw new UserError("El espacio ya llegó al máximo de personas.");
  await db.$transaction([
    ...(already ? [] : [db.membership.create({ data: { userId: user.id, workspaceId: inv.workspaceId, role: inv.role } })]),
    db.workspaceInvite.update({ where: { id: inv.id }, data: { acceptedAt: now } }),
    db.user.update({ where: { id: user.id }, data: { activeWorkspaceId: inv.workspaceId } }),
  ]);
  return inv.workspaceId;
}

export async function revokeInvite(db: PrismaClient, ws: string, id: string) {
  await db.workspaceInvite.deleteMany({ where: { id, workspaceId: ws, acceptedAt: null } });
}

export async function changeRole(db: PrismaClient, ws: string, memberId: string, role: GuestRole) {
  if (role !== "EDITOR" && role !== "VIEWER") throw new UserError("Elegí qué puede hacer.");
  const m = await db.membership.findFirst({ where: { id: memberId, workspaceId: ws } });
  if (!m || m.role === "OWNER") throw new UserError("No encontramos a esa persona.");
  await db.membership.update({ where: { id: m.id }, data: { role } });
}

// El dueño quita a alguien, o alguien se va. El dueño no se puede ir de su propio espacio.
export async function removeMember(db: PrismaClient, ws: string, memberId: string) {
  const m = await db.membership.findFirst({ where: { id: memberId, workspaceId: ws } });
  if (!m) throw new UserError("No encontramos a esa persona.");
  if (m.role === "OWNER") throw new UserError("El dueño no puede salir de su propio espacio.");
  await db.$transaction([
    db.membership.delete({ where: { id: m.id } }),
    db.user.updateMany({ where: { id: m.userId, activeWorkspaceId: ws }, data: { activeWorkspaceId: null } }),
  ]);
}

export async function switchWorkspace(db: PrismaClient, userId: string, ws: string) {
  const m = await db.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId: ws } } });
  if (!m) throw new UserError("No tenés acceso a ese espacio.");
  await db.user.update({ where: { id: userId }, data: { activeWorkspaceId: ws } });
}
