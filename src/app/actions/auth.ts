"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { audit, createSession, destroySession, getSession, markTwoFactorVerified } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import { createWorkspaceForUser } from "@/server/workspace";

export type FormState = { error?: string; ok?: string } | null;

const email = z.string().trim().toLowerCase().email("Revisá el correo: falta algo, como la @.").max(200);

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Decinos cómo te llamamos.").max(80), email, password: z.string(), terms: z.literal("on", { error: "Para seguir, aceptá los términos y la política de privacidad." }) })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };
  const db = getDb();
  const { headers } = await import("next/headers");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim();
  if (ip && (await db.auditLog.count({ where: { action: "auth.signup", ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } })) >= 10) return { error: "Se crearon muchas cuentas desde esta conexión. Probá de nuevo en una hora." };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "Ya hay una cuenta con ese correo. Iniciá sesión." };
  const user = await db.user.create({ data: { email: parsed.data.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) } });
  const ws = await createWorkspaceForUser(db, user.id, "Personal");
  await audit("auth.signup", { userId: user.id, workspaceId: ws.id });
  await createSession(user.id, { twoFactorVerified: true, remember: true });
  redirect("/bienvenida");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Escribí tu contraseña.") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  // Freno simple a intentos repetidos: 8 fallos en 15 minutos por correo.
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const fails = await db.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: since }, entityId: parsed.data.email } });
  if (fails >= 8) return { error: "Demasiados intentos. Probá de nuevo en 15 minutos." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && !user.deletedAt && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (user && !user.deletedAt && !user.passwordHash && user.googleSub) return { error: "Esta cuenta entra con Google. Tocá «Continuar con Google»." };
  if (!user || !ok) {
    await audit("auth.login_failed", { entity: "email", entityId: parsed.data.email });
    return { error: "El correo o la contraseña no coinciden." };
  }
  await createSession(user.id, { twoFactorVerified: !user.totpEnabledAt, remember: fd.get("remember") === "on" });
  await audit("auth.login", { userId: user.id });
  redirect(user.totpEnabledAt ? "/verificar" : "/app");
}

export async function verifyLoginCodeAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (!s.user.totpSecretEnc || !s.user.totpEnabledAt) redirect("/app");
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  const db = getDb();
  const fails = await db.auditLog.count({ where: { action: "auth.2fa_failed", userId: s.userId, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } } });
  if (fails >= 5) {
    await destroySession();
    return { error: "Demasiados códigos incorrectos. Ingresá de nuevo en 15 minutos." };
  }
  if (!verifyTotp(decryptSecret(s.user.totpSecretEnc), code)) {
    await audit("auth.2fa_failed", { userId: s.userId });
    return { error: fails >= 3 ? "El código no es correcto. Te queda un intento antes de que cerremos la sesión." : "El código no es correcto o ya venció. Probá con el que se ve ahora." };
  }
  await markTwoFactorVerified(s.id);
  await audit("auth.2fa_ok", { userId: s.userId });
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ---------- Recuperar contraseña ----------
// Siempre responde lo mismo, exista o no la cuenta, para no revelar qué correos están registrados.
export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await db.auditLog.count({ where: { action: "auth.reset_requested", createdAt: { gte: since }, entityId: parsed.data } });
  const ok: FormState = { ok: "Si hay una cuenta con ese correo, te mandamos un enlace para elegir una contraseña nueva. Vence en 1 hora." };
  if (recent >= 3) return ok;
  await audit("auth.reset_requested", { entity: "email", entityId: parsed.data });
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (!user || user.deletedAt || user.suspendedAt) return ok;
  const { randomBytes, createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const { sendEmail, appUrl } = await import("@/lib/email");
  await sendEmail({
    to: user.email,
    subject: "Elegí una contraseña nueva para NEXO",
    text: `Hola ${user.name.split(" ")[0]}:\n\nPara elegir una contraseña nueva, entrá a este enlace (vence en 1 hora):\n${appUrl()}/recuperar/${token}\n\nSi no lo pediste vos, ignorá este correo: tu contraseña no cambia.\n\nNEXO`,
  });
  return ok;
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const { createHash } = await import("node:crypto");
  const db = getDb();
  const r = await db.passwordReset.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return { error: "El enlace venció o ya se usó. Pedí uno nuevo." };
  await db.$transaction([
    db.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: r.userId } }), // cierra todas las sesiones abiertas
  ]);
  await audit("auth.password_reset", { userId: r.userId });
  redirect("/ingresar?nueva=1");
}
