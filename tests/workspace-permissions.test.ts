import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ role: "VIEWER", action: false }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "test-token" }) }), headers: async () => ({ get: (key: string) => key === "next-action" && state.action ? "id" : null }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ session: { findUnique: async () => ({ expiresAt: new Date("2099-01-01"), twoFactorVerified: true, user: { lastSeenAt: new Date("2099-01-01"), memberships: [{ role: state.role, workspaceId: "ws", workspace: { id: "ws", onboardedAt: new Date(), modules: {}, subscription: null } }] } }) } }) }));
import { requireWorkspace, requireWritableWorkspace } from "@/lib/auth/session";
it.each([false, true])("un VIEWER puede leer pero no escribir, next-action=%s", async (action) => {
  state.role = "VIEWER"; state.action = action;
  expect((await requireWorkspace()).membership.role).toBe("VIEWER");
  await expect(requireWritableWorkspace()).rejects.toThrow("redirect:/app?solomirar=1");
});
it.each(["OWNER", "EDITOR"])("%s puede escribir sin depender del transporte", async (role) => {
  state.role = role; state.action = false;
  expect((await requireWritableWorkspace()).membership.role).toBe(role);
});
