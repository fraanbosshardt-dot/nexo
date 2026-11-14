import { beforeEach, expect, it, vi } from "vitest";
import { selectBillingWorkspace } from "@/server/billing-return";
import type { Db } from "@/server/ledger";

// Only in-memory doubles: no database, provider calls, credentials or charges.
const membership = vi.fn();
const update = vi.fn();
const db = { membership: { findUnique: membership }, user: { update } } as unknown as Db;

beforeEach(() => { vi.clearAllMocks(); });

it("returns to the workspace owned by the signed-in payer", async () => {
  membership.mockResolvedValue({ role: "OWNER" });
  expect(await selectBillingWorkspace(db, "payer", "paid-space")).toBe(true);
  expect(membership).toHaveBeenCalledWith({ where: { userId_workspaceId: { userId: "payer", workspaceId: "paid-space" } } });
  expect(update).toHaveBeenCalledWith({ where: { id: "payer" }, data: { activeWorkspaceId: "paid-space" } });
});

it.each([null, { role: "VIEWER" }, { role: "EDITOR" }])("cannot select another owner's subscription: %j", async (value) => {
  membership.mockResolvedValue(value);
  expect(await selectBillingWorkspace(db, "payer", "other-space")).toBe(false);
  expect(update).not.toHaveBeenCalled();
});

it.each(["", "../app", "space?approved=1", "x".repeat(101)])("rejects malformed return workspace: %s", async (workspace) => {
  expect(await selectBillingWorkspace(db, "payer", workspace)).toBe(false);
  expect(membership).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
