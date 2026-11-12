import "server-only";
// Acceso al panel interno: sesión propia (cookie nexo_admin), solo con Google y lista blanca.
// No depende de la cuenta de la app: alguien del equipo puede administrar sin tener cuenta en Guafra.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { roleFor, can, type AdminRole, type Perm } from "@/server/admin-team";

export const ADMIN_COOKIE = "nexo_admin";
const HOURS = 8;

export async function createAdminSession(email: string, name: string | null) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + HOURS * 3600 * 1000);
  await getDb().adminSession.create({
    data: { tokenHash: sha256(token), email, name, expiresAt, ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null, userAgent: h.get("user-agent")?.slice(0, 300) ?? null },
  });
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin", expires: expiresAt });
}

export type Admin = { sessionId: string; email: string; name: string | null; role: AdminRole };

// El rol se vuelve a leer en cada pedido: si te sacan de la lista, el acceso se corta al instante.
export async function getAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const s = await db.adminSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  const role = await roleFor(db, s.email);
  if (!role) return null;
  return { sessionId: s.id, email: s.email, name: s.name, role };
}

export async function requireAdmin(perm: Perm = "view"): Promise<Admin> {
  const a = await getAdmin();
  if (!a) redirect("/admin/ingresar");
  if (!can(a.role, perm)) redirect("/admin?sinpermiso=1");
  return a;
}

export async function destroyAdminSession() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await getDb().adminSession.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  jar.delete({ name: ADMIN_COOKIE, path: "/admin" });
}

// Auditoría de lo que hace el equipo: quién (correo del panel) y sobre qué.
export async function adminAudit(admin: Admin, action: string, data: { userId?: string | null; workspaceId?: string | null; entity?: string; entityId?: string; meta?: object } = {}) {
  const h = await headers();
  await getDb().auditLog.create({
    data: {
      action,
      userId: data.userId ?? null,
      workspaceId: data.workspaceId ?? null,
      entity: data.entity ?? null,
      entityId: data.entityId ?? null,
      meta: { ...(data.meta ?? {}), admin: admin.email },
      ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    },
  });
}
