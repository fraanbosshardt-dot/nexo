// Avisos en el celular: firma VAPID, qué dice el aviso y limpieza de dispositivos dados de baja.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPublicKey, verify } from "node:crypto";
import { startTestDb } from "./helpers/testdb";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, recordMovement } from "@/server/ledger";
import { generateVapidKeys, pushMessage, pushToUser, vapidAuth } from "@/server/push";
import { todayIn } from "@/lib/dates";

let t: Awaited<ReturnType<typeof startTestDb>>;
let db: PrismaClient;
let userId: string, ws: string;
const keys = generateVapidKeys();
beforeAll(async () => {
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:prueba@test.com";
  t = await startTestDb(); db = t.db as unknown as PrismaClient;
  const u = await db.user.create({ data: { email: "push@test.com", name: "Pía", passwordHash: "" } });
  userId = u.id;
  ws = (await createWorkspaceForUser(db, u.id)).id;
}, 60_000);
afterAll(async () => { vi.unstubAllGlobals(); await t.stop(); });

describe("avisos en el celular", () => {
  it("la firma VAPID es un JWT ES256 válido para el servicio de avisos", () => {
    const auth = vapidAuth("https://fcm.googleapis.com/fcm/send/abc", undefined, Date.UTC(2026, 10, 11));
    const [, tpart, kpart] = auth.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(kpart).toBe(keys.publicKey);
    const [h, b, s] = tpart.split(".");
    expect(JSON.parse(Buffer.from(b, "base64url").toString())).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:prueba@test.com" });
    const raw = Buffer.from(keys.publicKey, "base64url");
    const pub = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${h}.${b}`), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("el aviso dice qué vence hoy y mañana", async () => {
    expect((await pushMessage(db, userId)).title).toBe("Todo al día");
    const acc = (await createAccount(db, ws, { name: "Banco", type: "SAVINGS", currency: "ARS", initialBalance: "0", initialDate: new Date(Date.UTC(2026, 0, 1)) })).id;
    const tomorrow = new Date(todayIn("America/Argentina/Buenos_Aires").getTime() + 864e5);
    await recordMovement(db, ws, { kind: "EXPENSE", description: "Luz", amount: "15000", accountId: acc, status: "PENDING", dueDate: tomorrow });
    const m = await pushMessage(db, userId);
    expect(m.title).toBe("Mañana vence Luz");
    expect(m.body).toContain("Luz (mañana)");
    expect(m.url).toBe("/app/proximos");
  });

  it("manda a cada dispositivo y borra los que ya no existen", async () => {
    await db.pushSubscription.createMany({ data: [
      { userId, endpoint: "https://fcm.googleapis.com/vivo", p256dh: "x", auth: "y" },
      { userId, endpoint: "https://fcm.googleapis.com/dado-de-baja", p256dh: "x", auth: "y" },
    ] });
    const calls: { url: string; auth: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, auth: String((init.headers as Record<string, string>).Authorization) });
      return new Response(null, { status: url.endsWith("dado-de-baja") ? 410 : 201 });
    }));
    expect(await pushToUser(db, userId)).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[0].auth).toMatch(/^vapid t=/);
    expect(await db.pushSubscription.count({ where: { userId } })).toBe(1);
  });
});
