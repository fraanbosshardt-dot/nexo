"use server";
// Las consultas llegan al panel interno. La persona recibe su número de trámite por correo.
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";
import { BRAND } from "@/lib/brand";
import { areaName, createContactMessage, validateContact } from "@/server/contact";

export type ContactState = { error?: string; code?: string; area?: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function contactAction(_: ContactState, fd: FormData): Promise<ContactState> {
  // Trampa para robots: un campo oculto que una persona nunca completa, y un mínimo de 3 segundos en la página.
  const started = Number(s(fd, "t"));
  if (s(fd, "website") || (started && Date.now() - started < 3000)) return { code: "C-RECIBIDA" };

  const input = { area: s(fd, "area"), name: s(fd, "name"), email: s(fd, "email"), subject: s(fd, "subject"), body: s(fd, "body") };
  const err = validateContact(input);
  if (err) return { error: err };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const session = await getSession().catch(() => null);
  const db = getDb();
  const r = await createContactMessage(db, { ...input, ip, userId: session?.user?.id ?? null });
  if ("error" in r) return { error: r.error };
  const m = r.message;

  const area = areaName(m.area);
  await sendEmail({ purpose: "support",
      action: { label: "Volver a Contacto", path: "/contacto" },
      to: m.email,
      subject: `Recibimos tu consulta (${m.code})`,
      text: `Hola ${m.name.split(" ")[0]}:\n\nRecibimos tu consulta sobre "${m.subject}" (${area}). Tu número de trámite es ${m.code}.\nLa respuesta del equipo te va a llegar por correo, normalmente en menos de 48 horas hábiles.\n\n${m.area === "arrepentimiento" ? "Guardá este número: es la constancia de tu pedido de arrepentimiento.\n\n" : ""}${BRAND.name}`,
    });
  return { code: m.code, area };
}
