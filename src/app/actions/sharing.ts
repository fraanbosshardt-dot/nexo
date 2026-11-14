"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { audit, canUse, requireOwner, requireUser } from "@/lib/auth/session";
import { UserError } from "@/server/ledger";
import { acceptInvite, changeRole, createInvite, INVITE_COOKIE, removeMember, revokeInvite, switchWorkspace, type GuestRole } from "@/server/sharing";
import type { FormState } from "./auth";

const fail = (e: unknown): FormState => {
  if (e instanceof UserError) return { error: e.message };
  throw e;
};

export async function inviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireOwner();
  try {
    if (!(await canUse(plan, "compartido"))) throw new UserError("Compartir tu espacio es parte de Pro.");
    const { needsVerifiedEmail } = await import("@/server/email-verify");
    if (needsVerifiedEmail(user)) throw new UserError("Antes de invitar a alguien, confirmá tu correo con el código del aviso de arriba.");
    const email = String(fd.get("email") ?? "");
    const { invite, token } = await createInvite(getDb(), workspace.id, { email, role: String(fd.get("role")) as GuestRole, invitedById: user.id });
    const { appUrl } = await import("@/lib/email");
    await audit("sharing.invited", { userId: user.id, workspaceId: workspace.id, meta: { role: invite.role } });
    revalidatePath("/app/configuracion");
    return { ok: `Invitación creada. Compartí este enlace con ${invite.email}: ${appUrl()}/invitacion/${token}` };
  } catch (e) { return fail(e); }
}

export async function revokeInviteAction(fd: FormData) {
  const { workspace } = await requireOwner();
  await revokeInvite(getDb(), workspace.id, String(fd.get("id")));
  revalidatePath("/app/configuracion");
}

export async function changeRoleAction(fd: FormData) {
  const { workspace } = await requireOwner();
  try { await changeRole(getDb(), workspace.id, String(fd.get("id")), String(fd.get("role")) as GuestRole); } catch (e) { if (!(e instanceof UserError)) throw e; }
  revalidatePath("/app/configuracion");
}

export async function removeMemberAction(fd: FormData) {
  const { user, workspace } = await requireOwner();
  await removeMember(getDb(), workspace.id, String(fd.get("id")));
  await audit("sharing.removed", { userId: user.id, workspaceId: workspace.id });
  revalidatePath("/app/configuracion");
}

// Irse de un espacio compartido (quien no es dueño). Vuelve a su propio espacio.
// Usa requireUser: quien "solo mira" también tiene que poder irse.
export async function leaveWorkspaceAction(fd: FormData) {
  const { user } = await requireUser();
  const db = getDb();
  const m = await db.membership.findFirst({ where: { userId: user.id, workspaceId: String(fd.get("workspaceId")) } });
  if (m && m.role !== "OWNER") {
    await removeMember(db, m.workspaceId, m.id);
    await audit("sharing.left", { userId: user.id, workspaceId: m.workspaceId });
  }
  redirect("/app");
}

// Cambiar el espacio que estás viendo. Usa requireUser: quien "solo mira" también puede cambiar de espacio.
export async function switchWorkspaceAction(fd: FormData) {
  const { user } = await requireUser();
  try { await switchWorkspace(getDb(), user.id, String(fd.get("workspaceId"))); } catch (e) { if (!(e instanceof UserError)) throw e; }
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  try {
    const ws = await acceptInvite(getDb(), String(fd.get("token") ?? ""), user);
    await audit("sharing.accepted", { userId: user.id, workspaceId: ws });
    // Se avisa al dueño del espacio: si no invitó a nadie, lo ve enseguida.
    try {
      const owner = await getDb().membership.findFirst({ where: { workspaceId: ws, role: "OWNER" }, include: { user: { select: { email: true, name: true } } } });
      if (owner) { const { sendSecurityNotice } = await import("@/server/account-mail"); await sendSecurityNotice(owner.user, "member_joined", `${user.name} (${user.email})`); }
    } catch (e) { console.error("aviso compartir", e); }
  } catch (e) { return fail(e); }
  (await cookies()).delete(INVITE_COOKIE);
  revalidatePath("/app", "layout");
  redirect("/app?compartido=1");
}
