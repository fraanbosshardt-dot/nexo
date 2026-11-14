import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { sendBillingNotice, drainEmailOutbox } from "@/server/billing-mail";
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email", () => ({ sendEmail: send, appUrl: () => "https://somosguafra.com" }));
let t: Awaited<ReturnType<typeof startTestDb>>, ws: string;
beforeAll(async () => {
  t = await startTestDb();
  const user = await t.db.user.create({ data: { email: "billing@example.com", name: "Ana", passwordHash: "" } });
  ws = (await createWorkspaceForUser(t.db, user.id)).id;
});
afterAll(async () => { await t.stop(); });
afterEach(() => { vi.unstubAllEnvs(); send.mockReset(); });
describe("avisos de suscripción", () => {
  it("envía una sola vez el mismo resultado de pago", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); send.mockResolvedValue({ sent: true });
    await sendBillingNotice(t.db, ws, "payment-1-approved", "Pago aprobado", "Pro renovado.");
    await sendBillingNotice(t.db, ws, "payment-1-approved", "Pago aprobado", "Pro renovado.");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ purpose: "billing", to: "billing@example.com", idempotencyKey: `billing/${ws}/payment-1-approved` });
  });
  it("un error del proveedor permite reintentar sin dar el correo por enviado", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); send.mockResolvedValueOnce({ sent: false, reason: "http-500" }).mockResolvedValueOnce({ sent: true });
    await expect(sendBillingNotice(t.db, ws, "payment-2-rejected", "Pago rechazado", "Revisá el pago.")).resolves.toBeUndefined();
    expect(await t.db.auditLog.count({ where: { entityId: "payment-2-rejected" } })).toBe(0);
    const pending = await t.db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `billing/${ws}/payment-2-rejected` } });
    expect(pending.sentAt).toBeNull(); expect(pending.lastError).toBe("http-500");
    await t.db.emailOutbox.update({ where: { id: pending.id }, data: { nextAttemptAt: new Date(0) } });
    await drainEmailOutbox(t.db);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await t.db.emailOutbox.findUniqueOrThrow({ where: { id: pending.id } })).sentAt).not.toBeNull();
  });
});
