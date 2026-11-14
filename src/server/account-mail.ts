// Correos de la cuenta: confirmar el correo, aviso de contraseña cambiada y de ingreso desde un dispositivo nuevo.
// El enlace de confirmación va firmado con AUTH_SECRET (no hace falta guardarlo): sirve 7 días y solo para ese correo.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { verifyCode } from "./email-verify";

const DAYS = 7;
const sign = (payload: string) => createHmac("sha256", `${process.env.AUTH_SECRET ?? ""}|verify-email`).update(payload).digest("base64url");

export function verifyToken(userId: string, email: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DAYS * 86400;
  return `${Buffer.from(`${userId}.${exp}`).toString("base64url")}.${sign(`${userId}.${exp}.${email.toLowerCase()}`)}`;
}

// Devuelve el usuario si el enlace es válido, no venció y el correo no cambió desde que se mandó.
export async function checkVerifyToken(db: PrismaClient, token: string, now = Date.now()) {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const [userId, exp] = Buffer.from(body, "base64url").toString().split(".");
  if (!userId || !(Number(exp) * 1000 > now)) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return null;
  const want = Buffer.from(sign(`${userId}.${exp}.${user.email.toLowerCase()}`));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? user : null;
}

// El módulo de email es solo de servidor: se carga recién al mandar.
const mail = () => import("@/lib/email");

export async function sendVerifyEmail(user: { id: string; email: string; name: string }, welcome = false) {
  const { appUrl, sendEmail } = await mail();
  return sendEmail({
    purpose: welcome ? "welcome" : "verification",
    to: user.email,
    subject: welcome ? "Bienvenido a Somos Guafra · Confirmá tu correo" : "Confirmá tu correo en Somos Guafra",
    text: `Hola ${user.name.split(" ")[0]}:\n\nTu código para confirmar el correo es: ${verifyCode(user.id, user.email)}\nEscribilo en el aviso de arriba de la app (vence en 30 minutos).\n\nO entrá a este enlace (vence en ${DAYS} días):\n${appUrl()}/verificar-correo/${verifyToken(user.id, user.email)}\n\nSi no creaste una cuenta en Somos Guafra, ignorá este correo.\n\nSomos Guafra`,
  });
}

export async function sendPasswordChanged(user: { email: string; name: string }) {
  const { appUrl, sendEmail } = await mail();
  return sendEmail({
    purpose: "password",
    to: user.email,
    subject: "Cambiaste tu contraseña de Somos Guafra",
    text: `Hola ${user.name.split(" ")[0]}:\n\nLa contraseña de tu cuenta se cambió recién y cerramos todas las sesiones abiertas.\n\nSi no fuiste vos, entrá a ${appUrl()}/recuperar para elegir una nueva y escribinos desde Ayuda.\n\nSomos Guafra`,
  });
}

// Avisos de seguridad de la cuenta (doble factor, espacio compartido). Si no fuiste vos, se ve enseguida.
export async function sendSecurityNotice(user: { email: string; name: string }, what: "2fa_on" | "2fa_off" | "member_joined", extra?: string) {
  const { appUrl, sendEmail } = await mail();
  const t = {
    "2fa_on": ["Activaste la verificación en dos pasos", "Activaste la verificación en dos pasos en tu cuenta de Somos Guafra. Desde ahora, al ingresar te pedimos el código de tu app."],
    "2fa_off": ["Desactivaste la verificación en dos pasos", "Se desactivó la verificación en dos pasos de tu cuenta de Somos Guafra. Te recomendamos volver a activarla en Configuración → Seguridad."],
    "member_joined": ["Alguien se sumó a tu espacio", `${extra ?? "Una persona"} aceptó tu invitación y ya puede ver tu espacio en Somos Guafra. Lo podés quitar cuando quieras en Configuración → Compartir.`],
  }[what];
  return sendEmail({
    purpose: "security",
    to: user.email,
    subject: `${t[0]} · Somos Guafra`,
    text: `Hola ${user.name.split(" ")[0]}:

${t[1]}

Si no fuiste vos, cambiá tu contraseña en ${appUrl()}/recuperar y escribinos desde Ayuda.

Somos Guafra`,
  });
}

// Primer ingreso desde un navegador o dispositivo que esta cuenta nunca usó (no se avisa en el primer ingreso de todos).
export async function notifyNewDevice(db: PrismaClient, user: { id: string; email: string; name: string }, userAgent: string | null, ip: string | null, sessionId?: string) {
  if (!userAgent) return;
  const before = await db.session.findMany({ where: { userId: user.id, ...(sessionId ? { id: { not: sessionId } } : {}) }, select: { userAgent: true }, take: 50, orderBy: { createdAt: "desc" } });
  if (!before.length || before.some((s) => s.userAgent === userAgent)) return;
  const { appUrl, sendEmail } = await mail();
  const when = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "long", timeStyle: "short" }).format(new Date());
  await sendEmail({
    purpose: "security",
    to: user.email,
    subject: "Ingreso nuevo a tu cuenta de Somos Guafra",
    text: `Hola ${user.name.split(" ")[0]}:\n\nAlguien entró a tu cuenta desde un dispositivo que no habías usado:\n• Cuándo: ${when}\n• Dispositivo: ${describeAgent(userAgent)}${ip ? `\n• Conexión: ${ip}` : ""}\n\nSi fuiste vos, no hagas nada. Si no, cambiá la contraseña en ${appUrl()}/recuperar y activá la verificación en dos pasos en Configuración.\n\nSomos Guafra`,
  });
}

export function describeAgent(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? "iPhone o iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "otro sistema";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "un navegador";
  return `${br} en ${os}`;
}

export async function sendWelcomeEmail(user: { email: string; name: string }) {
  const { appUrl, sendEmail } = await mail();
  return sendEmail({ purpose: "welcome", to: user.email, subject: "Bienvenido a Somos Guafra",
    text: `Hola ${user.name.split(" ")[0]}:\n\nTu cuenta ya está lista. Entrá para terminar de configurarla:\n${appUrl()}/bienvenida\n\nSomos Guafra` });
}
