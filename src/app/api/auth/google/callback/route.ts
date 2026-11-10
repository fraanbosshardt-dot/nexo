// Paso 2: Google vuelve acá con un código. Se cambia por los datos de la cuenta y se abre la sesión.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { checkIdToken, exchangeCode, GOOGLE_COOKIE, googleEnabled, readStart } from "@/lib/auth/google";
import { audit, createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { findOrCreateGoogleUser } from "@/server/google-auth";
import { applyProGrant } from "@/server/grants";
import { createAdminSession } from "@/lib/auth/admin";
import { roleFor } from "@/server/admin-team";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const st = readStart(jar.get(GOOGLE_COOKIE)?.value);
  jar.delete({ name: GOOGLE_COOKIE, path: "/api/auth/google" });
  const back = st?.desde === "admin" ? "/admin/ingresar" : st?.desde === "registro" ? "/registro" : "/ingresar";
  const q = req.nextUrl.searchParams;
  if (!googleEnabled()) redirect(`${back}?google=off`);
  if (q.get("error")) redirect(`${back}?google=${q.get("error") === "access_denied" ? "cancelado" : "fallo"}`);
  const code = q.get("code");
  if (!st || !code || q.get("state") !== st.state) redirect(`${back}?google=fallo`);

  const base = appUrl();
  let idToken: string | null = null;
  try {
    idToken = await exchangeCode(code, st.verifier, base);
  } catch {
    idToken = null;
  }
  const profile = idToken ? checkIdToken(idToken, { clientId: process.env.GOOGLE_CLIENT_ID ?? "", nonce: st.nonce }) : null;
  if (!profile) redirect(`${back}?google=fallo`);

  const db = getDb();

  // Panel interno: solo correos de la lista blanca. No crea cuentas de la app.
  if (st.desde === "admin") {
    const role = await roleFor(db, profile.email);
    if (!role) {
      await audit("admin.login_denied", { entity: "email", entityId: profile.email });
      redirect("/admin/ingresar?google=nolista");
    }
    await createAdminSession(profile.email, profile.name);
    await db.adminMember.updateMany({ where: { email: profile.email }, data: { lastLoginAt: new Date() } });
    await audit("admin.login", { meta: { admin: profile.email, role } });
    redirect("/admin");
  }

  const exists = await db.user.findFirst({ where: { OR: [{ googleSub: profile.sub }, { email: profile.email }] }, select: { id: true } });
  if (!exists) {
    // Mismo freno que el registro con correo: 10 cuentas por hora por conexión.
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim();
    if (ip && (await db.auditLog.count({ where: { action: "auth.signup", ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } })) >= 10) redirect(`${back}?google=muchas`);
  }

  const r = await findOrCreateGoogleUser(db, profile);
  if (!r.ok) redirect(`${back}?google=${r.why}`);
  if (r.created) {
    await audit("auth.signup", { userId: r.userId, workspaceId: r.workspaceId, meta: { via: "google" } });
    if (r.workspaceId) await applyProGrant(db, profile.email, r.workspaceId);
    try {
      const { attachReferral, REF_COOKIE } = await import("@/server/referrals");
      const code = jar.get(REF_COOKIE)?.value;
      if (code) { await attachReferral(db, r.userId, code); jar.delete(REF_COOKIE); }
    } catch (e) { console.error("referido", e); }
  }
  if (r.linked) await audit("auth.google_linked", { userId: r.userId, meta: { passwordCleared: r.passwordCleared } });

  const user = await db.user.findUniqueOrThrow({ where: { id: r.userId } });
  await createSession(user.id, { twoFactorVerified: !user.totpEnabledAt, remember: true });
  await audit("auth.login", { userId: user.id, meta: { via: "google" } });
  redirect(r.created ? "/bienvenida" : user.totpEnabledAt ? "/verificar" : "/app");
}
