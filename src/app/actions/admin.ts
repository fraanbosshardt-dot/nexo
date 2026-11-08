"use server";
// Acciones del panel interno. Cada una exige su permiso (ver src/server/admin-team.ts) y queda en la auditoría
// con el correo de quien la hizo.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { adminAudit, destroyAdminSession, requireAdmin, createAdminSession } from "@/lib/auth/admin";
import { ownerEmails, roleFor } from "@/server/admin-team";
import { PRO_FEATURES, planSettings, savePlanSettings, type FeatureKey } from "@/server/plans";
import { savedReplies, systemSettings, writeSetting } from "@/server/settings";
import { giftPro } from "@/server/grants";
import { deleteAccount, normCode } from "@/server/admin-accounts";
import { appUrl, sendEmail } from "@/lib/email";
import type { FormState } from "./auth";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => Number(s(fd, k).replace(",", "."));
const refresh = () => revalidatePath("/admin", "layout");
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

// ---------- Sesión del panel ----------
export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/ingresar");
}

// Solo en desarrollo y en tu computadora: entrar sin Google para probar el panel.
export async function adminDevLoginAction(fd: FormData) {
  if (process.env.NODE_ENV !== "development") redirect("/admin/ingresar");
  const { headers } = await import("next/headers");
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) redirect("/admin/ingresar");
  const email = s(fd, "email").toLowerCase();
  if (!(await roleFor(getDb(), email))) redirect("/admin/ingresar?google=nolista");
  await createAdminSession(email, "Prueba local");
  redirect("/admin");
}

// ---------- Usuarios ----------
export async function adminSetPlanAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const workspaceId = s(fd, "workspaceId");
  const plan = s(fd, "plan") === "PRO" ? "PRO" : "FREE";
  await getDb().subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, plan, status: "ACTIVE", provider: "manual" },
    update: { plan, status: "ACTIVE", trialEndsAt: null, provider: "manual" },
  });
  await adminAudit(a, "admin.plan_changed", { workspaceId, meta: { plan } });
  refresh();
}

export async function adminGiftProAction(fd: FormData) {
  const forever = s(fd, "days") === "0";
  const a = await requireAdmin(forever ? "owner" : "support");
  const workspaceId = s(fd, "workspaceId");
  const days = forever ? null : Math.min(365, Math.max(1, Math.round(n(fd, "days")) || 14));
  const r = await giftPro(getDb(), workspaceId, days);
  await adminAudit(a, "admin.pro_gifted", { workspaceId, meta: { days, result: r } });
  refresh();
}

export async function adminSuspendAction(fd: FormData) {
  const a = await requireAdmin("support");
  const id = s(fd, "userId");
  const db = getDb();
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return;
  const suspend = !target.suspendedAt;
  await db.user.update({ where: { id }, data: { suspendedAt: suspend ? new Date() : null } });
  if (suspend) await db.session.deleteMany({ where: { userId: id } });
  await adminAudit(a, suspend ? "admin.user_suspended" : "admin.user_restored", { entity: "user", entityId: id });
  refresh();
}

export async function adminReset2faAction(fd: FormData) {
  const a = await requireAdmin("support");
  const id = s(fd, "userId");
  await getDb().user.update({ where: { id }, data: { totpSecretEnc: null, totpEnabledAt: null } });
  await adminAudit(a, "admin.2fa_reset", { entity: "user", entityId: id });
  refresh();
}

export async function adminCloseSessionsAction(fd: FormData) {
  const a = await requireAdmin("support");
  const id = s(fd, "userId");
  const r = await getDb().session.deleteMany({ where: { userId: id } });
  await adminAudit(a, "admin.sessions_closed", { entity: "user", entityId: id, meta: { count: r.count } });
  refresh();
}

export async function adminDeleteAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const db = getDb();
  const id = s(fd, "userId");
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return { error: "La cuenta ya no existe." };
  if (s(fd, "confirm").toLowerCase() !== u.email) return { error: `Para borrar, escribí el correo exacto: ${u.email}` };
  const r = await deleteAccount(db, id);
  await adminAudit(a, "admin.account_deleted", { entity: "user", entityId: id, meta: { email: u.email, spaces: r.deletedSpaces } });
  refresh();
  redirect("/admin/usuarios?borrada=1");
}

// ---------- Pro reservado por correo ----------
export async function adminAddGrantAction(_: FormState, fd: FormData): Promise<FormState> {
  const forever = s(fd, "days") === "0";
  const a = await requireAdmin(forever ? "owner" : "support");
  const email = s(fd, "email").toLowerCase();
  if (!isEmail(email)) return { error: "Revisá el correo." };
  const db = getDb();
  const days = forever ? null : Math.min(365, Math.max(1, Math.round(n(fd, "days")) || 30));
  // Si la cuenta ya existe, se aplica ahora mismo.
  const user = await db.user.findUnique({ where: { email }, include: { memberships: { orderBy: { createdAt: "asc" } } } });
  if (user?.memberships[0]) {
    await giftPro(db, user.memberships[0].workspaceId, days);
    await adminAudit(a, "admin.pro_gifted", { workspaceId: user.memberships[0].workspaceId, meta: { email, days } });
    refresh();
    return { ok: `${email} ya tenía cuenta: le diste Pro ${days ? `por ${days} días` : "sin vencimiento"}.` };
  }
  await db.proGrant.upsert({ where: { email }, create: { email, days, note: s(fd, "note") || null, addedBy: a.email }, update: { days, note: s(fd, "note") || null, addedBy: a.email, usedAt: null } });
  await adminAudit(a, "admin.pro_reserved", { meta: { email, days } });
  refresh();
  return { ok: `Listo: cuando ${email} cree su cuenta, arranca con Pro ${days ? `por ${days} días` : "sin vencimiento"}.` };
}

export async function adminDeleteGrantAction(fd: FormData) {
  const a = await requireAdmin("support");
  const id = s(fd, "id");
  await getDb().proGrant.deleteMany({ where: { id, usedAt: null } });
  await adminAudit(a, "admin.pro_reserve_removed", { entityId: id });
  refresh();
}

// ---------- Cobros ----------
export async function adminCreateCouponAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const code = normCode(s(fd, "code"));
  const pct = Math.round(n(fd, "percent"));
  if (code.length < 3) return { error: "El código necesita al menos 3 letras o números." };
  if (!(pct >= 1 && pct <= 100)) return { error: "El descuento va de 1% a 100%." };
  const maxUses = s(fd, "maxUses") ? Math.max(1, Math.round(n(fd, "maxUses"))) : null;
  const until = s(fd, "until");
  const db = getDb();
  if (await db.coupon.findUnique({ where: { code } })) return { error: "Ya hay un cupón con ese código." };
  await db.coupon.create({ data: { code, percentOff: pct, maxUses, expiresAt: until ? new Date(`${until}T23:59:59Z`) : null, note: s(fd, "note") || null } });
  await adminAudit(a, "admin.coupon_created", { meta: { code, pct, maxUses, until } });
  refresh();
  return { ok: `Cupón ${code} creado: ${pct}% de descuento.` };
}

export async function adminToggleCouponAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const c = await getDb().coupon.findUnique({ where: { id: s(fd, "id") } });
  if (!c) return;
  await getDb().coupon.update({ where: { id: c.id }, data: { active: !c.active } });
  await adminAudit(a, c.active ? "admin.coupon_paused" : "admin.coupon_resumed", { meta: { code: c.code } });
  refresh();
}

export async function adminCancelSubAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const workspaceId = s(fd, "workspaceId");
  const { cancelSubscription } = await import("@/server/billing");
  try {
    await cancelSubscription(getDb(), workspaceId);
  } catch {
    await getDb().subscription.update({ where: { workspaceId }, data: { status: "CANCELED", canceledAt: new Date() } });
  }
  await adminAudit(a, "admin.subscription_canceled", { workspaceId });
  refresh();
}

// ---------- Soporte ----------
export async function adminReplyTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("support");
  const id = s(fd, "id"), reply = s(fd, "reply");
  if (!reply) return { error: "Escribí la respuesta." };
  const db = getDb();
  const t = await db.supportTicket.update({ where: { id }, data: { reply: reply.slice(0, 4000), status: "ANSWERED" }, include: { user: true } });
  const mail = await sendEmail({
    to: t.user.email,
    subject: `Respuesta a tu consulta: ${t.subject}`,
    text: `Hola ${t.user.name.split(" ")[0]}:\n\n${reply}\n\nTu consulta: "${t.subject}"\nPodés verla en ${appUrl()}/app/ayuda\n\nNEXO`,
  });
  await adminAudit(a, "admin.ticket_answered", { entity: "ticket", entityId: id, meta: { emailed: mail.sent } });
  refresh();
  return { ok: mail.sent ? "Respuesta enviada y avisada por correo." : "Respuesta guardada. El correo no salió (falta la clave de Resend), pero la ve en Ayuda." };
}

export async function adminCloseTicketAction(fd: FormData) {
  const a = await requireAdmin("support");
  const id = s(fd, "id");
  await getDb().supportTicket.update({ where: { id }, data: { status: "CLOSED" } });
  await adminAudit(a, "admin.ticket_closed", { entity: "ticket", entityId: id });
  refresh();
}

export async function adminTicketPriorityAction(fd: FormData) {
  const a = await requireAdmin("support");
  const p = s(fd, "priority");
  const priority = p === "HIGH" || p === "LOW" ? p : "NORMAL";
  await getDb().supportTicket.update({ where: { id: s(fd, "id") }, data: { priority } });
  await adminAudit(a, "admin.ticket_priority", { entity: "ticket", entityId: s(fd, "id"), meta: { priority } });
  refresh();
}

export async function adminSaveReplyAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("support");
  const title = s(fd, "title").slice(0, 60), text = s(fd, "text").slice(0, 2000);
  if (!title || !text) return { error: "Poné un nombre y el texto de la respuesta." };
  const db = getDb();
  const items = [...(await savedReplies(db)).filter((r) => r.title !== title), { title, text }].slice(-30);
  await writeSetting(db, "savedReplies", { items });
  await adminAudit(a, "admin.saved_reply", { meta: { title } });
  refresh();
  return { ok: "Respuesta guardada." };
}

export async function adminDeleteReplyAction(fd: FormData) {
  const a = await requireAdmin("support");
  const db = getDb();
  await writeSetting(db, "savedReplies", { items: (await savedReplies(db)).filter((r) => r.title !== s(fd, "title")) });
  await adminAudit(a, "admin.saved_reply_removed", { meta: { title: s(fd, "title") } });
  refresh();
}

// ---------- Comunicaciones ----------
export async function adminSaveAnnouncementAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const text = s(fd, "text").slice(0, 240);
  if (!text) return { error: "Escribí el aviso." };
  const link = s(fd, "link");
  if (link && !/^(\/|https:\/\/)/.test(link)) return { error: "El enlace tiene que empezar con / o con https://" };
  const audience = ["free", "pro"].includes(s(fd, "audience")) ? s(fd, "audience") : "all";
  await writeSetting(getDb(), "announcement", { text, tone: s(fd, "tone") === "warn" ? "warn" : "info", audience, until: s(fd, "until") || null, link: link || null });
  await adminAudit(a, "admin.announcement_saved", { meta: { text, audience } });
  revalidatePath("/app", "layout");
  refresh();
  return { ok: "Aviso publicado en la app." };
}

export async function adminClearAnnouncementAction() {
  const a = await requireAdmin("owner");
  await writeSetting(getDb(), "announcement", {});
  await adminAudit(a, "admin.announcement_removed");
  revalidatePath("/app", "layout");
  refresh();
}

export async function adminSendCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const subject = s(fd, "subject").slice(0, 120), body = s(fd, "body").slice(0, 6000), audience = s(fd, "audience") || "all";
  if (!subject || !body) return { error: "Falta el asunto o el texto." };
  const db = getDb();
  const { audienceUsers } = await import("@/server/admin-comms");
  const users = await audienceUsers(db, audience);
  if (s(fd, "test") === "1") {
    const r = await sendEmail({ to: a.email, subject: `[Prueba] ${subject}`, text: body });
    return r.sent ? { ok: `Te mandamos una prueba a ${a.email}. Iría a ${users.length} personas.` } : { error: `No salió la prueba (falta la clave de Resend). Iría a ${users.length} personas.` };
  }
  if (!users.length) return { error: "No hay nadie en ese grupo que acepte correos." };
  if (users.length > 500) return { error: `Son ${users.length} personas: por ahora el máximo por envío es 500. Elegí un grupo más chico.` };
  let sent = 0, failed = 0;
  for (const u of users) {
    const r = await sendEmail({ to: u.email, subject, text: `Hola ${u.name.split(" ")[0]}:\n\n${body}\n\n—\nNEXO · Si no querés recibir correos, apagalos en ${appUrl()}/app/configuracion` });
    if (r.sent) sent++; else failed++;
  }
  await db.emailCampaign.create({ data: { subject, body, audience, sent, failed, createdBy: a.email } });
  await adminAudit(a, "admin.campaign_sent", { meta: { subject, audience, sent, failed } });
  refresh();
  return sent ? { ok: `Enviado a ${sent} ${sent === 1 ? "persona" : "personas"}${failed ? ` (${failed} no salieron)` : ""}.` } : { error: "No salió ningún correo. Revisá la clave de Resend." };
}

export async function adminAddNewsAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const title = s(fd, "title").slice(0, 120), body = s(fd, "body").slice(0, 4000);
  if (!title || !body) return { error: "Falta el título o el texto." };
  await getDb().productNews.create({ data: { title, body } });
  await adminAudit(a, "admin.news_published", { meta: { title } });
  revalidatePath("/novedades");
  refresh();
  return { ok: "Novedad publicada en /novedades." };
}

export async function adminDeleteNewsAction(fd: FormData) {
  const a = await requireAdmin("owner");
  await getDb().productNews.deleteMany({ where: { id: s(fd, "id") } });
  await adminAudit(a, "admin.news_removed", { entityId: s(fd, "id") });
  revalidatePath("/novedades");
  refresh();
}

// ---------- Finanzas ----------
export async function adminAddCostAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const name = s(fd, "name").slice(0, 80), amount = n(fd, "amount");
  if (!name) return { error: "Poné el nombre del gasto (por ejemplo: Railway)." };
  if (!(amount > 0)) return { error: "El importe tiene que ser mayor a cero." };
  const currency = /^[A-Z]{3}$/.test(s(fd, "currency")) ? s(fd, "currency") : "USD";
  await getDb().companyCost.create({ data: { name, amount: amount.toFixed(2), currency, period: s(fd, "period") === "yearly" ? "yearly" : "monthly" } });
  await adminAudit(a, "admin.cost_added", { meta: { name, amount, currency } });
  refresh();
  return { ok: "Gasto agregado." };
}

export async function adminDeleteCostAction(fd: FormData) {
  const a = await requireAdmin("owner");
  await getDb().companyCost.deleteMany({ where: { id: s(fd, "id") } });
  await adminAudit(a, "admin.cost_removed", { entityId: s(fd, "id") });
  refresh();
}

// ---------- Ajustes ----------
export async function adminSavePlansAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const monthly = n(fd, "monthly"), yearly = n(fd, "yearly");
  if (!(monthly > 0) || !(yearly > 0)) return { error: "Los precios tienen que ser mayores a cero." };
  const keys = new Set(PRO_FEATURES.map((f) => f.key));
  const freeAlso = fd.getAll("freeAlso").map(String).filter((k): k is FeatureKey => keys.has(k as FeatureKey));
  await savePlanSettings(getDb(), { freeAlso, prices: { monthly, yearly } });
  await adminAudit(a, "admin.plans_saved", { meta: { monthly, yearly, freeAlso } });
  refresh();
  revalidatePath("/");
  return { ok: "Guardado. Ya se ve en la web y en la app." };
}

export async function adminSaveSystemAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const db = getDb();
  const cur = await systemSettings(db);
  const pdfLimit = Math.round(n(fd, "pdfLimit"));
  if (!(pdfLimit >= 0 && pdfLimit <= 100)) return { error: "El límite de PDF va de 0 a 100 por mes." };
  const next = { maintenance: fd.get("maintenance") === "on", maintenanceMsg: s(fd, "maintenanceMsg").slice(0, 300) || cur.maintenanceMsg, pdfLimit };
  await writeSetting(db, "system", next);
  await adminAudit(a, "admin.system_saved", { meta: next });
  revalidatePath("/app", "layout");
  refresh();
  return { ok: next.maintenance ? "Guardado. La app está en mantenimiento: los clientes ven el aviso." : "Guardado." };
}

// ---------- Equipo ----------
export async function adminAddMemberAction(_: FormState, fd: FormData): Promise<FormState> {
  const a = await requireAdmin("owner");
  const email = s(fd, "email").toLowerCase();
  if (!isEmail(email)) return { error: "Revisá el correo." };
  if (ownerEmails().includes(email)) return { error: "Ese correo ya es dueño (está en ADMIN_EMAILS)." };
  const role = ["OWNER", "SUPPORT", "VIEWER"].includes(s(fd, "role")) ? s(fd, "role") : "VIEWER";
  await getDb().adminMember.upsert({ where: { email }, create: { email, role, addedBy: a.email }, update: { role } });
  await adminAudit(a, "admin.member_added", { meta: { email, role } });
  refresh();
  return { ok: `${email} ya puede entrar al panel con Google.` };
}

export async function adminSetRoleAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const email = s(fd, "email").toLowerCase();
  const role = ["OWNER", "SUPPORT", "VIEWER"].includes(s(fd, "role")) ? s(fd, "role") : "VIEWER";
  if (email === a.email) return;
  await getDb().adminMember.updateMany({ where: { email }, data: { role } });
  await adminAudit(a, "admin.member_role", { meta: { email, role } });
  refresh();
}

export async function adminRemoveMemberAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const email = s(fd, "email").toLowerCase();
  if (email === a.email) return;
  const db = getDb();
  await db.adminMember.deleteMany({ where: { email } });
  await db.adminSession.updateMany({ where: { email, revokedAt: null }, data: { revokedAt: new Date() } });
  await adminAudit(a, "admin.member_removed", { meta: { email } });
  refresh();
}

export async function adminRevokeSessionAction(fd: FormData) {
  const a = await requireAdmin("owner");
  const id = s(fd, "id");
  if (id === a.sessionId) return;
  await getDb().adminSession.updateMany({ where: { id }, data: { revokedAt: new Date() } });
  await adminAudit(a, "admin.session_revoked", { entityId: id });
  refresh();
}
