// Roles del equipo del panel interno y qué puede hacer cada uno.
import type { PrismaClient } from "@/generated/prisma/client";

export type AdminRole = "OWNER" | "SUPPORT" | "VIEWER";
export const ROLE_NAMES: Record<AdminRole, string> = { OWNER: "Dueño", SUPPORT: "Soporte", VIEWER: "Solo mirar" };
export const ROLE_HELP: Record<AdminRole, string> = {
  OWNER: "Todo: precios, cobros, equipo, borrar cuentas y exportar.",
  SUPPORT: "Responde consultas, regala días de Pro, cierra sesiones y suspende.",
  VIEWER: "Ve números y listas. No cambia nada.",
};

// view: mirar. support: atender clientes. owner: dinero, equipo, datos y configuración.
export type Perm = "view" | "support" | "owner";
const RANK: Record<AdminRole, number> = { VIEWER: 0, SUPPORT: 1, OWNER: 2 };
const NEED: Record<Perm, number> = { view: 0, support: 1, owner: 2 };
export const can = (role: AdminRole, perm: Perm) => RANK[role] >= NEED[perm];

export const ownerEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function roleFor(db: PrismaClient, email: string): Promise<AdminRole | null> {
  const e = email.trim().toLowerCase();
  if (ownerEmails().includes(e)) return "OWNER";
  const m = await db.adminMember.findUnique({ where: { email: e } });
  return m && (m.role === "OWNER" || m.role === "SUPPORT" || m.role === "VIEWER") ? m.role : null;
}
