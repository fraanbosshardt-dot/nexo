// Confirmar el correo: reglas y código de 6 números.
// - La app se usa sin confirmar (con un aviso arriba). Solo se pide el correo confirmado para pagar Pro, invitar a
//   alguien al espacio compartido y prender los avisos por correo.
// - Esas exigencias se activan solas cuando los correos están configurados (RESEND_API_KEY): sin correo, nadie podría
//   confirmar y quedarían trabadas.
// - El código vale entre 30 y 60 minutos, va firmado con AUTH_SECRET (no se guarda) y tiene límite de intentos.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

// ¿Hay que pedirle que confirme el correo antes de seguir?
export const needsVerifiedEmail = (user: { emailVerified: Date | null }) => !user.emailVerified && emailEnabled();

const WINDOW = 30 * 60_000;
function codeFor(userId: string, email: string, slot: number) {
  const h = createHmac("sha256", `${process.env.AUTH_SECRET ?? ""}|verify-code`).update(`${userId}.${email.toLowerCase()}.${slot}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function verifyCode(userId: string, email: string, now = Date.now()) {
  return codeFor(userId, email, Math.floor(now / WINDOW));
}

// Acepta el código de esta media hora y el de la anterior (así nunca vence en menos de 30 minutos).
export function checkVerifyCode(userId: string, email: string, input: string, now = Date.now()) {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) return false;
  const slot = Math.floor(now / WINDOW);
  return [slot, slot - 1].some((s) => timingSafeEqual(Buffer.from(codeFor(userId, email, s)), Buffer.from(code)));
}

// Cuentas creadas con correo que nunca se confirmaron y no se usaron en 30 días: se borran solas.
// Nunca se tocan cuentas con Google, con Pro (pago, prueba o regalado), del equipo del panel, ni las que se usaron.
export const UNVERIFIED_DAYS = 30;
export async function abandonedUnverified(db: PrismaClient, now = Date.now(), staff: string[] = []) {
  const cutoff = new Date(now - UNVERIFIED_DAYS * 864e5);
  const users = await db.user.findMany({
    where: {
      emailVerified: null, googleSub: null, deletedAt: null, createdAt: { lt: cutoff },
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
      memberships: { none: { workspace: { subscription: { plan: "PRO" } } } },
    },
    select: { id: true, email: true },
  });
  const team = new Set([...staff.map((e) => e.toLowerCase()), ...(await db.adminMember.findMany({ select: { email: true } })).map((m) => m.email.toLowerCase())]);
  return users.filter((u) => !team.has(u.email.toLowerCase()));
}
