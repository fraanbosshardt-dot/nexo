// Avisos en el celular con Web Push, sin dependencias.
// El aviso viaja vacío: al llegar, el celular le pide a /api/push/aviso qué mostrar (con la sesión abierta).
// Así no hace falta cifrar contenido y ningún dato financiero pasa por los servidores de Google o Apple.
// Se activa cargando VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (se generan con: npm run vapid).
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/dates";
import { remaining } from "./ledger";

const b64u = (b: Buffer) => b.toString("base64url");

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "", privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  return { enabled: !!publicKey && !!privateKey, publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:avisos@example.com" };
}

// Claves VAPID nuevas: la pública (65 bytes, sin comprimir) y la privada (32 bytes), en base64url.
export function generateVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pub = publicKey.export({ format: "jwk" }), priv = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]);
  return { publicKey: b64u(raw), privateKey: priv.d! };
}

// Firma JWT ES256 que pide el servicio de avisos (Google, Apple, Mozilla) para saber que somos nosotros.
export function vapidAuth(endpoint: string, cfg = pushConfig(), now = Date.now()) {
  const pub = Buffer.from(cfg.publicKey, "base64url");
  const key = createPrivateKey({ key: { kty: "EC", crv: "P-256", d: cfg.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: "jwk" });
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: cfg.subject })));
  const sig = sign("sha256", Buffer.from(`${header}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${body}.${b64u(sig)}, k=${cfg.publicKey}`;
}

// Manda un aviso vacío a cada dispositivo de la persona. Los que ya no existen (404/410) se borran.
export async function pushToUser(db: PrismaClient, userId: string) {
  const cfg = pushConfig();
  if (!cfg.enabled) return 0;
  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      const r = await fetch(s.endpoint, { method: "POST", headers: { TTL: "86400", Urgency: "normal", Authorization: vapidAuth(s.endpoint, cfg), "Content-Length": "0" }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404 || r.status === 410) await db.pushSubscription.delete({ where: { id: s.id } });
      else if (r.ok) sent++;
    } catch { /* sin conexión con el servicio de avisos: se reintenta mañana */ }
  }
  return sent;
}

// Qué mostrar en el aviso: lo que vence hoy o mañana en los espacios de la persona.
export async function pushMessage(db: PrismaClient, userId: string) {
  const ms = await db.membership.findMany({ where: { userId }, include: { workspace: { select: { id: true, timezone: true } } } });
  const items: { description: string; amount: string; rec: boolean; when: "hoy" | "mañana" }[] = [];
  for (const m of ms) {
    const today = todayIn(m.workspace.timezone);
    const tomorrow = new Date(today.getTime() + 864e5);
    const due = await db.obligation.findMany({ where: { workspaceId: m.workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { gte: today, lte: tomorrow } }, include: { payments: true }, orderBy: { dueDate: "asc" }, take: 10 });
    for (const o of due) items.push({ description: o.description, amount: formatMoney(remaining(o), o.currency), rec: o.direction === "RECEIVABLE", when: o.dueDate.getTime() === today.getTime() ? "hoy" : "mañana" });
  }
  if (!items.length) return { title: "Todo al día", body: "No tenés pagos ni cobros para hoy ni mañana.", url: "/app" };
  const first = items[0];
  const title = items.length === 1 ? `${first.when === "hoy" ? "Hoy" : "Mañana"} ${first.rec ? "cobrás" : "vence"} ${first.description}` : `Tenés ${items.length} pagos y cobros para hoy y mañana`;
  const body = items.slice(0, 4).map((i) => `${i.rec ? "+" : "−"}${i.amount} · ${i.description} (${i.when})`).join("\n");
  return { title, body, url: "/app/proximos" };
}
