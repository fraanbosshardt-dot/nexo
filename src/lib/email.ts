import "server-only";

// Envío de emails con Resend (https://resend.com). Sin RESEND_API_KEY no se envía nada:
// en desarrollo el email se muestra en la consola del servidor para poder probar.
export type Email = { to: string; subject: string; text: string };

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(e: Email): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Finan <avisos@nexo.app>";
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.info(`\n[email sin enviar: falta RESEND_API_KEY]\nPara: ${e.to}\nAsunto: ${e.subject}\n${e.text}\n`);
    return { sent: false, reason: "sin-clave" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [e.to], subject: e.subject, text: e.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { sent: false, reason: `http-${r.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: "red" };
  }
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
