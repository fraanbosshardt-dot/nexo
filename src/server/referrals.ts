// Referidos: cada persona tiene un link para invitar. Cuando alguien se registra con ese link y termina la
// bienvenida, los dos reciben 1 mes de Pro. Hay un tope de premios por persona para evitar abusos.
import type { PrismaClient } from "@/generated/prisma/client";
import { giftPro } from "./grants";

export const REFERRAL_DAYS = 30;
export const REFERRAL_MAX_REWARDS = 12;
export const REF_COOKIE = "nexo_ref";

const ABC = "abcdefghjkmnpqrstuvwxyz23456789";
export function newReferralCode(rand: () => number = Math.random) {
  let c = "";
  for (let i = 0; i < 8; i++) c += ABC[Math.floor(rand() * ABC.length)];
  return c;
}
export const isReferralCode = (c: unknown): c is string => typeof c === "string" && /^[a-z2-9]{8}$/.test(c);

// El código propio se crea la primera vez que se pide.
export async function ensureReferralCode(db: PrismaClient, userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newReferralCode();
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (e) {
      if (!String(e).includes("Unique")) throw e;
    }
  }
  throw new Error("No se pudo crear el código de invitación");
}

// Al crear la cuenta: se anota quién invitó (si el código existe y no es la misma persona).
export async function attachReferral(db: PrismaClient, newUserId: string, code: string | undefined | null) {
  if (!isReferralCode(code)) return false;
  const ref = await db.user.findUnique({ where: { referralCode: code }, select: { id: true, deletedAt: true } });
  if (!ref || ref.deletedAt || ref.id === newUserId) return false;
  await db.user.updateMany({ where: { id: newUserId, referredById: null }, data: { referredById: ref.id } });
  return true;
}

const workspaceOf = async (db: PrismaClient, userId: string) =>
  (await db.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { workspaceId: true } }))?.workspaceId ?? null;

// Al terminar la bienvenida: premio para los dos (una sola vez por persona invitada).
export async function rewardReferral(db: PrismaClient, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { referredById: true, referralRewardedAt: true } });
  if (!u?.referredById || u.referralRewardedAt) return { rewarded: false as const };
  // Se marca primero, así dos pedidos a la vez no premian dos veces.
  const mark = await db.user.updateMany({ where: { id: userId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
  if (!mark.count) return { rewarded: false as const };
  const given = await db.user.count({ where: { referredById: u.referredById, referralRewardedAt: { not: null }, id: { not: userId } } });
  const [mine, theirs] = await Promise.all([workspaceOf(db, userId), workspaceOf(db, u.referredById)]);
  if (mine) await giftPro(db, mine, REFERRAL_DAYS);
  // Quien invita recibe premio hasta el tope; la persona invitada siempre recibe el suyo.
  const referrerGets = given < REFERRAL_MAX_REWARDS && !!theirs;
  if (referrerGets && theirs) await giftPro(db, theirs, REFERRAL_DAYS);
  return { rewarded: true as const, referrerId: u.referredById, referrerGets };
}

export async function referralStats(db: PrismaClient, userId: string) {
  const [invited, rewarded] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
  ]);
  return { invited, rewarded, left: Math.max(0, REFERRAL_MAX_REWARDS - rewarded) };
}
