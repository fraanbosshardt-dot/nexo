// Contacto del sitio: correos por área, redes sociales y las consultas que llegan desde el formulario.
import type { PrismaClient } from "@/generated/prisma/client";
import { AREAS, SOCIALS, type AreaKey, type SocialKey } from "@/lib/brand";
import { writeSetting } from "./settings";

export type ContactSettings = { emails: Partial<Record<AreaKey, string>>; socials: Partial<Record<SocialKey, string>> };

export async function contactSettings(db: PrismaClient): Promise<ContactSettings> {
  try {
    const s = await db.appSetting.findUnique({ where: { key: "contact" } });
    const v = (s?.value ?? {}) as Partial<ContactSettings>;
    return { emails: v.emails ?? {}, socials: v.socials ?? {} };
  } catch {
    // Si la base no responde, el sitio público se sigue viendo (sin redes ni correos).
    return { emails: {}, socials: {} };
  }
}

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const isUrl = (u: string) => /^https:\/\/[^\s]+$/.test(u) && u.length <= 300;

export async function saveContactSettings(db: PrismaClient, input: { emails: Record<string, string>; socials: Record<string, string> }) {
  const emails: ContactSettings["emails"] = {};
  const socials: ContactSettings["socials"] = {};
  const bad: string[] = [];
  for (const a of AREAS) {
    const v = (input.emails[a.key] ?? "").trim().toLowerCase();
    if (!v) continue;
    if (isEmail(v)) emails[a.key] = v; else bad.push(a.name);
  }
  for (const r of SOCIALS) {
    const v = (input.socials[r.key] ?? "").trim();
    if (!v) continue;
    if (isUrl(v)) socials[r.key] = v; else bad.push(r.name);
  }
  if (bad.length) return { error: `Revisá: ${bad.join(", ")}. Los correos tienen que ser válidos y las redes, links que empiecen con https://` };
  await writeSetting(db, "contact", { emails, socials });
  return { ok: true as const };
}

export const isArea = (a: string): a is AreaKey => AREAS.some((x) => x.key === a);
export const areaName = (a: string) => AREAS.find((x) => x.key === a)?.name ?? a;

// Número de trámite corto y fácil de dictar (sin letras que se confunden).
export function ticketCode(rand: () => number = Math.random) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += abc[Math.floor(rand() * abc.length)];
  return `C-${c}`;
}

export type ContactInput = { area: string; name: string; email: string; subject: string; body: string; ip: string | null; userId: string | null };

export function validateContact(i: Omit<ContactInput, "ip" | "userId">): string | null {
  if (!isArea(i.area)) return "Elegí el área de tu consulta.";
  if (i.name.length < 2) return "Escribí tu nombre.";
  if (!isEmail(i.email)) return "Revisá el correo: así te podemos responder.";
  if (i.subject.length < 3) return "Contanos en pocas palabras de qué se trata.";
  if (i.body.length < 10) return "Contanos un poco más, así te respondemos bien.";
  return null;
}

// Hasta 5 consultas por hora desde la misma conexión, para frenar el spam.
export const HOURLY_LIMIT = 5;

export async function createContactMessage(db: PrismaClient, i: ContactInput) {
  if (i.ip) {
    const recent = await db.contactMessage.count({ where: { ip: i.ip, createdAt: { gt: new Date(Date.now() - 3600e3) } } });
    if (recent >= HOURLY_LIMIT) return { error: "Recibimos varias consultas seguidas desde tu conexión. Probá de nuevo en un rato." } as const;
  }
  for (let tries = 0; tries < 4; tries++) {
    try {
      const m = await db.contactMessage.create({
        data: {
          code: ticketCode(), area: i.area, name: i.name.slice(0, 120), email: i.email.toLowerCase().slice(0, 200),
          subject: i.subject.slice(0, 160), body: i.body.slice(0, 5000), ip: i.ip, userId: i.userId,
        },
      });
      return { message: m } as const;
    } catch (e) {
      if (!String(e).includes("Unique")) throw e;
    }
  }
  throw new Error("No se pudo generar el número de trámite");
}
