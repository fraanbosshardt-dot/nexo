import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { readModules } from "@/lib/modules";
import { effectivePlan, hasFeature, type FeatureKey } from "@/server/plans";
import { pickMembership } from "@/server/sharing";

const COOKIE = "somosguafra_session";
export const HINT_COOKIE = "somosguafra_in"; // solo dice "hay sesión" (sin datos), para que la web pública muestre "Ir a la app"
const LONG = 30 * 24 * 3600 * 1000;
const SHORT = 12 * 3600 * 1000;

export async function createSession(userId: string, opts: { twoFactorVerified: boolean; remember: boolean }) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + (opts.remember ? LONG : SHORT));
  await getDb().session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      twoFactorVerified: opts.twoFactorVerified,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  (await cookies()).set(HINT_COOKIE, "1", { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

// Una sola búsqueda de la sesión por pedido, aunque la pidan el marco de la app y la pantalla.
export const getSession = cache(async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await getDb().session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { memberships: { orderBy: { createdAt: "asc" }, include: { workspace: { include: { subscription: true } } } } } } } });
  if (!s || s.revokedAt || s.expiresAt < new Date() || s.user.deletedAt || s.user.suspendedAt) return null;
  return s;
});

export async function markTwoFactorVerified(sessionId: string) {
  await getDb().session.update({ where: { id: sessionId }, data: { twoFactorVerified: true } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  jar.delete(COOKIE);
  jar.delete(HINT_COOKIE);
}

// Exige sesión completa (con el segundo paso hecho si está activado).
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (s.user.totpEnabledAt && !s.twoFactorVerified) redirect("/verificar");
  // Última actividad, para las métricas del panel (como mucho una escritura por hora).
  if (!s.user.lastSeenAt || Date.now() - s.user.lastSeenAt.getTime() > 3600_000) {
    await getDb().user.update({ where: { id: s.userId }, data: { lastSeenAt: new Date() } });
  }
  return { session: s, user: s.user };
}

// Exige usuario y devuelve el espacio que está viendo (el propio o uno compartido). Si no terminó la introducción, lo manda ahí.
// La lectura permite VIEWER; toda mutación usa requireWritableWorkspace para exigir rol de escritura.
export async function requireWorkspace(opts: { allowNotOnboarded?: boolean } = {}) {
  const { session, user } = await requireUser();
  const membership = pickMembership(user.memberships, user.activeWorkspaceId);
  if (!membership) redirect("/ingresar");
  const workspace = membership.workspace;
  if (!workspace.onboardedAt && !opts.allowNotOnboarded) redirect("/bienvenida");
  return { session, user, membership, workspace, modules: readModules(workspace.modules), plan: effectivePlan(workspace.subscription) };
}

// La autorización depende del rol, también para formularios multipart sin next-action.
export async function requireWritableWorkspace(opts: { allowNotOnboarded?: boolean } = {}) {
  const ctx = await requireWorkspace(opts);
  if (ctx.membership.role !== "OWNER" && ctx.membership.role !== "EDITOR") redirect("/app?solomirar=1");
  return ctx;
}

// Después de ingresar: si estaba aceptando una invitación, vuelve a ella; si no, al destino de siempre.
export async function landingPath(fallback: string) {
  const jar = await cookies();
  const t = jar.get("somosguafra_invite")?.value;
  if (t && /^[\w-]{20,64}$/.test(t)) return `/invitacion/${t}`;
  // Venía a comprar Pro desde el sitio: después de crear la cuenta o ingresar, sigue a pagar.
  const after = jar.get("somosguafra_after")?.value;
  if (after && (/^\/suscribirme\?ciclo=(mensual|anual)$/.test(after) || /^\/pagos\/volver\?espacio=[a-zA-Z0-9_-]{1,100}$/.test(after))) {
    try { jar.delete("somosguafra_after"); } catch { /* en una página no se puede borrar: vence sola */ }
    return after;
  }
  return fallback;
}

// Lo que solo puede hacer el dueño del espacio (compartirlo, el plan).
export async function requireOwner() {
  const ctx = await requireWorkspace();
  if (ctx.membership.role !== "OWNER") redirect("/app/configuracion?soloduenio=1");
  return ctx;
}

export async function audit(action: string, data: { userId?: string | null; workspaceId?: string | null; entity?: string; entityId?: string; meta?: object } = {}) {
  const h = await headers();
  await getDb().auditLog.create({
    data: {
      action,
      userId: data.userId ?? null,
      workspaceId: data.workspaceId ?? null,
      entity: data.entity ?? null,
      entityId: data.entityId ?? null,
      meta: (data.meta ?? undefined) as object | undefined,
      ip: h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    },
  });
}


export async function canUse(plan: "FREE" | "PRO", key: FeatureKey) {
  return hasFeature(getDb(), plan, key);
}
