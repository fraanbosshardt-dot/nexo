import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { readModules } from "@/lib/modules";

const COOKIE = "nexo_session";
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
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await getDb().session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.revokedAt || s.expiresAt < new Date() || s.user.deletedAt) return null;
  return s;
}

export async function markTwoFactorVerified(sessionId: string) {
  await getDb().session.update({ where: { id: sessionId }, data: { twoFactorVerified: true } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().session.updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } });
  jar.delete(COOKIE);
}

// Exige sesión completa (con el segundo paso hecho si está activado).
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (s.user.totpEnabledAt && !s.twoFactorVerified) redirect("/verificar");
  return { session: s, user: s.user };
}

// Exige usuario y devuelve su espacio. Si no terminó la introducción, lo manda ahí.
export async function requireWorkspace(opts: { allowNotOnboarded?: boolean } = {}) {
  const { session, user } = await requireUser();
  const membership = await getDb().membership.findFirst({ where: { userId: user.id }, include: { workspace: { include: { subscription: true } } }, orderBy: { createdAt: "asc" } });
  if (!membership) redirect("/ingresar");
  const workspace = membership.workspace;
  if (!workspace.onboardedAt && !opts.allowNotOnboarded) redirect("/bienvenida");
  return { session, user, membership, workspace, modules: readModules(workspace.modules), plan: workspace.subscription?.plan ?? "FREE" };
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
