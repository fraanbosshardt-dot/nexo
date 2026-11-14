import "server-only";
import { renderEmail, emailBrandText, type EmailContent } from "./email-template";
export type { EmailPurpose } from "./email-template";

// Envío de emails con Resend (https://resend.com). Sin RESEND_API_KEY no se envía nada:
// en desarrollo el email se muestra en la consola del servidor para poder probar.
export type Email = EmailContent & { idempotencyKey?: string; to: string };

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(e: Email): Promise<{ sent: boolean; reason?: string }> {
  if (!["welcome", "verification", "password", "security", "billing", "support"].includes(e.purpose)) return { sent: false, reason: "not-transactional" };
  e = { ...e, subject: emailBrandText(e.subject), text: emailBrandText(e.text) };
  const key = process.env.RESEND_API_KEY;
  const from = e.purpose === "support"
    ? process.env.SUPPORT_EMAIL_FROM || "Somos Guafra <soporte@somosguafra.com>"
    : process.env.EMAIL_FROM || "Somos Guafra <avisos@somosguafra.com>";
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info(`\n[email sin enviar: falta RESEND_API_KEY]\nPara: ${e.to}\nAsunto: ${e.subject}\n${e.text}\n`);
    return { sent: false, reason: "sin-clave" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(e.idempotencyKey ? { "Idempotency-Key": e.idempotencyKey } : {}) },
      body: JSON.stringify({ from: emailBrandText(from), to: [e.to], subject: e.subject, text: e.text, html: renderEmail(e, appUrl()) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { sent: false, reason: `http-${r.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: "red" };
  }
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
