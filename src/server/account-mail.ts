// Correos de la cuenta: confirmar el correo, aviso de contraseña cambiada y de ingreso desde un dispositivo nuevo.
// El enlace de confirmación va firmado con AUTH_SECRET (no hace falta guardarlo): sirve 7 días y solo para ese correo.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

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

export async function sendVerifyEmail(user: { id: string; email: string; name: string }) {
  const { appUrl, sendEmail } = await mail();
  return sendEmail({
    to: user.email,
    subject: "Confirmá tu correo en NEXO",
    text: `Hola ${user.name.split(" ")[0]}:\n\nPara confirmar que este correo es tuyo, entrá a este enlace (vence en ${DAYS} días):\n${appUrl()}/verificar-correo/${verifyToken(user.id, user.email)}\n\nSi no creaste una cuenta en NEXO, ignorá este correo.\n\nNEXO`,
  });
}

export async function sendPasswordChanged(user: { email: string; name: string }) {
  const { appUrl, sendEmail } = await mail();
  return sendEmail({
    to: user.email,
    subject: "Cambiaste tu contraseña de NEXO",
    text: `Hola ${user.name.split(" ")[0]}:\n\nLa contraseña de tu cuenta se cambió recién y cerramos todas las sesiones abiertas.\n\nSi no fuiste vos, entrá a ${appUrl()}/recuperar para elegir una nueva y escribinos desde Ayuda.\n\nNEXO`,
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
    to: user.email,
    subject: "Ingreso nuevo a tu cuenta de NEXO",
    text: `Hola ${user.name.split(" ")[0]}:\n\nAlguien entró a tu cuenta desde un dispositivo que no habías usado:\n• Cuándo: ${when}\n• Dispositivo: ${describeAgent(userAgent)}${ip ? `\n• Conexión: ${ip}` : ""}\n\nSi fuiste vos, no hagas nada. Si no, cambiá la contraseña en ${appUrl()}/recuperar y activá la verificación en dos pasos en Configuración.\n\nNEXO`,
  });
}

export function describeAgent(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? "iPhone o iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "otro sistema";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "un navegador";
  return `${br} en ${os}`;
}
