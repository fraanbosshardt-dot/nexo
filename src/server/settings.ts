// Ajustes de la plataforma guardados en la base (se cambian desde el panel, sin tocar código).
import type { PrismaClient } from "@/generated/prisma/client";

export type SystemSettings = { maintenance: boolean; maintenanceMsg: string; pdfLimit: number };
export type Announcement = { text: string; tone: "info" | "warn"; audience: "all" | "free" | "pro"; until: string | null; link: string | null } | null;

const SYSTEM_DEFAULT = (): SystemSettings => ({
  maintenance: false,
  maintenanceMsg: "Estamos haciendo mejoras. Volvé en un rato: tus datos están a salvo.",
  pdfLimit: Number(process.env.PDF_MONTHLY_LIMIT || 5),
});

async function read<T>(db: PrismaClient, key: string): Promise<T | null> {
  const s = await db.appSetting.findUnique({ where: { key } });
  return (s?.value ?? null) as T | null;
}
export async function writeSetting(db: PrismaClient, key: string, value: object | null) {
  const v = (value ?? {}) as object;
  await db.appSetting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

export async function systemSettings(db: PrismaClient): Promise<SystemSettings> {
  return { ...SYSTEM_DEFAULT(), ...((await read<Partial<SystemSettings>>(db, "system")) ?? {}) };
}

export async function pdfMonthlyLimit(db: PrismaClient) {
  return (await systemSettings(db)).pdfLimit;
}

export async function announcement(db: PrismaClient): Promise<Announcement> {
  const a = await read<NonNullable<Announcement>>(db, "announcement");
  if (!a?.text) return null;
  return a;
}

// El aviso se muestra si está vigente y corresponde al plan de quien mira.
export function announcementFor(a: Announcement, plan: "FREE" | "PRO", now = new Date()) {
  if (!a?.text) return null;
  if (a.until && new Date(`${a.until}T23:59:59Z`) < now) return null;
  if (a.audience === "free" && plan !== "FREE") return null;
  if (a.audience === "pro" && plan !== "PRO") return null;
  return a;
}

export async function savedReplies(db: PrismaClient): Promise<{ title: string; text: string }[]> {
  const v = await read<{ items?: { title: string; text: string }[] }>(db, "savedReplies");
  return Array.isArray(v?.items) ? v.items : [];
}
