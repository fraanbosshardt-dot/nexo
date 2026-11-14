import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as any,
  select: vi.fn(), sync: vi.fn(), after: vi.fn(), cookie: vi.fn(),
  count: vi.fn(), audit: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("next/server", () => ({ after: state.after }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: state.cookie }) }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ auditLog: { count: state.count, create: state.audit } }) }));
vi.mock("@/server/billing-return", () => ({ selectBillingWorkspace: state.select }));
vi.mock("@/server/billing", () => ({ reconcileWorkspaceBilling: state.sync }));
import { GET } from "@/app/pagos/volver/route";

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { userId: "signed-in-payer", twoFactorVerified: true, user: { totpEnabledAt: null } };
  state.select.mockResolvedValue(true); state.count.mockResolvedValue(0);
  state.audit.mockResolvedValue({}); state.sync.mockResolvedValue(undefined);
});
const request = (query = "espacio=paid-space") => new Request(`https://example.test/pagos/volver?${query}`);

it("returns to the actual app, using the authenticated payer and the selected workspace", async () => {
  await expect(GET(request())).rejects.toThrow("redirect:/app?pago=recibido");
  expect(state.select).toHaveBeenCalledWith(expect.anything(), "signed-in-payer", "paid-space");
  const work = state.after.mock.calls[0][0];
  await work();
  expect(state.sync).toHaveBeenCalledWith(expect.anything(), "paid-space");
});

it("an approved query parameter cannot mark a payment as paid", async () => {
  await expect(GET(request("espacio=paid-space&status=approved&payment_id=untrusted"))).rejects.toThrow("redirect:/app?pago=recibido");
  expect(state.sync).not.toHaveBeenCalled();
});

it("expired sessions resume the payment return after signing in", async () => {
  state.session = null;
  await expect(GET(request())).rejects.toThrow("redirect:/ingresar");
  expect(state.cookie).toHaveBeenCalledWith("somosguafra_after", "/pagos/volver?espacio=paid-space", expect.objectContaining({ httpOnly: true, maxAge: 1800 }));
  expect(state.select).not.toHaveBeenCalled();
});

it("does not bypass the second authentication factor", async () => {
  state.session.user.totpEnabledAt = new Date(); state.session.twoFactorVerified = false;
  await expect(GET(request())).rejects.toThrow("redirect:/verificar");
  expect(state.select).not.toHaveBeenCalled();
});

it("does not reconcile or select a workspace the payer does not own", async () => {
  state.select.mockResolvedValue(false);
  await expect(GET(request())).rejects.toThrow("redirect:/app");
  expect(state.after).not.toHaveBeenCalled();
});

it("repeated returns do not repeatedly synchronize the provider within a minute", async () => {
  state.count.mockResolvedValue(1);
  await expect(GET(request())).rejects.toThrow("redirect:/app?pago=recibido");
  await state.after.mock.calls[0][0]();
  expect(state.sync).not.toHaveBeenCalled();
});

it("an invalid workspace cannot reach billing processing", async () => {
  await expect(GET(request("espacio=..%2Fother"))).rejects.toThrow("redirect:/app");
  expect(state.select).not.toHaveBeenCalled();
  expect(state.after).not.toHaveBeenCalled();
});
