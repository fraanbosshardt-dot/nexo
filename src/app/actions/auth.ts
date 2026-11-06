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
  const code = String(fd.get("code") ?? "");
  if (!verifyTotp(decryptSecret(s.user.totpSecretEnc), code)) {
    await audit("auth.2fa_failed", { userId: s.userId });
    return { error: "El código no es correcto o ya venció. Probá con el que se ve ahora." };
  }
  await markTwoFactorVerified(s.id);
  await audit("auth.2fa_ok", { userId: s.userId });
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
