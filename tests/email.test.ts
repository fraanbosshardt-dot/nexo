import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { sendEmail, type Email } from "@/lib/email";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("correo transaccional de la empresa", () => {
  it("bloquea propósitos ajenos, aun con una clave configurada", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await sendEmail({ purpose: "marketing", to: "test@example.com", subject: "Campaña", text: "No enviar" } as unknown as Email);
    expect(result).toEqual({ sent: false, reason: "not-transactional" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("envía soporte desde su dirección y conserva la clave de idempotencia", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("SUPPORT_EMAIL_FROM", "Somos Guafra <soporte@somosguafra.com>");
    const fetch = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetch);
    expect(await sendEmail({ purpose: "support", idempotencyKey: "ticket/1", to: "test@example.com", subject: "Respuesta", text: "Listo" })).toEqual({ sent: true });
    const request = fetch.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({ from: "Somos Guafra <soporte@somosguafra.com>", to: ["test@example.com"] });
    expect(request.headers["Idempotency-Key"]).toBe("ticket/1");
  });
  it("reporta el rechazo del proveedor sin fingir que envió el correo", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    expect(await sendEmail({ purpose: "verification", to: "test@example.com", subject: "Verificar", text: "Código" })).toEqual({ sent: false, reason: "http-403" });
  });
});
