"use server";
// Acciones del panel interno. Todas exigen ser administrador y quedan en la auditoría.
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/auth/session";
import { PRO_FEATURES, planSettings, savePlanSettings, type FeatureKey } from "@/server/plans";
import type { FormState } from "./auth";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const refresh = () => revalidatePath("/admin", "layout");

export async function adminSetPlanAction(fd: FormData) {
  const { user } = await requireAdmin();
  const workspaceId = s(fd, "workspaceId");
  const plan = s(fd, "plan") === "PRO" ? "PRO" : "FREE";
  await getDb().subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, plan, status: "ACTIVE", provider: "manual" },
    update: { plan, status: "ACTIVE", trialEndsAt: plan === "FREE" ? null : undefined, provider: "manual" },
  });
  await audit("admin.plan_changed", { userId: user.id, workspaceId, meta: { plan } });
  refresh();
}

export async function adminSuspendAction(fd: FormData) {
  const { user } = await requireAdmin();
  const id = s(fd, "userId");
  if (id === user.id) return;
  const target = await getDb().user.findUnique({ where: { id } });
  if (!target) return;
  const suspend = !target.suspendedAt;
  await getDb().user.update({ where: { id }, data: { suspendedAt: suspend ? new Date() : null } });
  if (suspend) await getDb().session.deleteMany({ where: { userId: id } });
  await audit(suspend ? "admin.user_suspended" : "admin.user_restored", { userId: user.id, entity: "user", entityId: id });
  refresh();
}

export async function adminReset2faAction(fd: FormData) {
  const { user } = await requireAdmin();
  const id = s(fd, "userId");
  await getDb().user.update({ where: { id }, data: { totpSecretEnc: null, totpEnabledAt: null } });
  await audit("admin.2fa_reset", { userId: user.id, entity: "user", entityId: id });
  refresh();
}

export async function adminSavePlansAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const monthly = Number(s(fd, "monthly").replace(",", ".")), yearly = Number(s(fd, "yearly").replace(",", "."));
  if (!(monthly > 0) || !(yearly > 0)) return { error: "Los precios tienen que ser mayores a cero." };
  const keys = new Set(PRO_FEATURES.map((f) => f.key));
  const freeAlso = fd.getAll("freeAlso").map(String).filter((k): k is FeatureKey => keys.has(k as FeatureKey));
  await savePlanSettings(getDb(), { freeAlso, prices: { monthly, yearly } });
  await audit("admin.plans_saved", { userId: user.id, meta: { monthly, yearly, freeAlso } });
  refresh();
  revalidatePath("/");
  return { ok: "Guardado. Ya se ve en la web y en la app." };
}

export async function adminReplyTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireAdmin();
  const id = s(fd, "id"), reply = s(fd, "reply");
  if (!reply) return { error: "Escribí la respuesta." };
  await getDb().supportTicket.update({ where: { id }, data: { reply: reply.slice(0, 4000), status: "ANSWERED" } });
  await audit("admin.ticket_answered", { userId: user.id, entity: "ticket", entityId: id });
  refresh();
  return { ok: "Respuesta enviada." };
}

export async function adminCloseTicketAction(fd: FormData) {
  const { user } = await requireAdmin();
  const id = s(fd, "id");
  await getDb().supportTicket.update({ where: { id }, data: { status: "CLOSED" } });
  await audit("admin.ticket_closed", { userId: user.id, entity: "ticket", entityId: id });
  refresh();
}

export async function currentPlans() {
  await requireAdmin();
  return planSettings(getDb());
}
