"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { audit, canUse, requireUser, requireWorkspace } from "@/lib/auth/session";
import { parseAmount } from "@/lib/money";
import { parseDate, todayIn } from "@/lib/dates";
import { MODULES, modulesForUses, readModules, FREE_LIMITS } from "@/lib/modules";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { adjustBalance, cancelObligation, createAccount, reorderAccounts, deleteMovement, deleteObligation, linkToPending, matchingPending, updateObligation, payObligation, recordMovement, recordTransfer, updateMovement, UserError } from "@/server/ledger";
import type { FormState } from "./auth";
import { createRule, materialize } from "@/server/recurring";
import { MATERIALIZE_DAYS } from "@/server/forecast";
import { COUNTRIES, countryByCode, isCurrency } from "@/lib/countries";

const currencyOf = (v: FormDataEntryValue | null, fallback: string) => (isCurrency(String(v ?? "")) ? String(v) : fallback);
const countryOf = (v: FormDataEntryValue | null, fallback: string) => (COUNTRIES.some((c) => c.code === String(v)) ? String(v) : fallback);

const ACCOUNT_TYPES = ["CASH", "SAVINGS", "CHECKING", "WALLET", "FOREIGN", "INVESTMENT", "OTHER"] as const;

function fail(e: unknown): FormState {
  if (e instanceof UserError) return { error: e.message };
  console.error(e);
  return { error: "No pudimos guardar. Probá de nuevo en un momento." };
}
const money = (v: FormDataEntryValue | null, label: string) => {
  if (!String(v ?? "").trim()) throw new UserError(`Escribí ${label}.`);
  const d = parseAmount(String(v ?? ""));
  if (!d) throw new UserError(`Revisá ${label}: tiene que ser un número.`);
  return d;
};
const date = (v: FormDataEntryValue | null, label: string) => {
  if (!String(v ?? "").trim()) throw new UserError(`Elegí ${label}.`);
  const d = parseDate(String(v ?? ""));
  if (!d) throw new UserError(`Revisá ${label} (dd/mm/aaaa).`);
  return d;
};

// ---------- Introducción ----------

export async function finishOnboardingAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace({ allowNotOnboarded: true });
  try {
    const uses = fd.getAll("uses").map(String);
    const chosen = fd.getAll("modules").map(String);
    const mods = chosen.length ? Object.fromEntries(MODULES.map((m) => [m.key, chosen.includes(m.key)])) : modulesForUses(uses);
    const country = countryOf(fd.get("country"), "AR");
    const currency = currencyOf(fd.get("currency"), countryByCode(country).currency);
    const timezone = countryByCode(country).timezone; // la zona sale del país, no se pregunta
    const extraCurrencies = [...new Set(fd.getAll("extraCurrencies").map(String).filter((c) => isCurrency(c) && c !== currency))];
    const db = getDb();
    await db.workspace.update({ where: { id: workspace.id }, data: { modules: mods, country, baseCurrency: currency, extraCurrencies, timezone, onboardedAt: new Date() } });
    try {
      const { rewardReferral } = await import("@/server/referrals");
      const r = await rewardReferral(db, user.id);
      if (r.rewarded) await audit("referral.rewarded", { userId: user.id, workspaceId: workspace.id, meta: { referrerId: r.referrerId, referrerGets: r.referrerGets } });
    } catch (e) { console.error("referido", e); }
    const accName = String(fd.get("accountName") ?? "").trim();
    if (accName) {
      const type = z.enum(ACCOUNT_TYPES).catch("SAVINGS").parse(fd.get("accountType"));
      const initial = String(fd.get("accountBalance") ?? "").trim();
      const account = await createAccount(db, workspace.id, {
        name: accName,
        type,
        currency: currencyOf(fd.get("accountCurrency"), currency),
        initialBalance: initial ? money(initial, "el saldo de la cuenta") : "0",
        initialDate: todayIn(timezone),
      });
      // Ingresos fijos (opcionales): cada uno queda como regla mensual desde su próximo cobro.
      const names = fd.getAll("incomeName").map(String), amounts = fd.getAll("incomeAmount").map(String), days = fd.getAll("incomeDay").map(Number), variable = fd.getAll("incomeVariable").map(String);
      if (amounts.length) {
        const today = todayIn(timezone);
        const y = today.getUTCFullYear(), m = today.getUTCMonth();
        const sueldo = await db.category.findFirst({ where: { workspaceId: workspace.id, name: "Sueldo" } });
        for (let i = 0; i < amounts.length; i++) {
          const day = days[i];
          const label = names[i]?.trim() || "Ingreso";
          if (!(day >= 1 && day <= 31)) throw new UserError(`El día de cobro de ${label} va del 1 al 31.`);
          const at = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, Math.min(day, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate())));
          const first = at(y, m) >= today ? at(y, m) : at(y, m + 1);
          await createRule(db, workspace.id, { direction: "RECEIVABLE", description: label, amount: money(amounts[i], `el monto de ${label}`), currency: account.currency, categoryId: /sueldo/i.test(label) ? sueldo?.id ?? null : null, accountId: account.id, frequency: "MONTHLY", dayOfMonth: day, startDate: first, variableAmount: variable[i] === "1" });
        }
        await materialize(db, workspace.id, new Date(today.getTime() + MATERIALIZE_DAYS * 864e5));
      }
    }
    await audit("workspace.onboarded", { userId: user.id, workspaceId: workspace.id, meta: { uses } });
  } catch (e) {
    return fail(e);
  }
  redirect("/app");
}

// ---------- Cuentas ----------

export async function createAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace, plan } = await requireWorkspace();
  let id: string;
  try {
    const db = getDb();
    if (!(await canUse(plan, "ilimitado")) && (await db.account.count({ where: { workspaceId: workspace.id, active: true } })) >= FREE_LIMITS.accounts) {
      throw new UserError(`El plan Gratis incluye ${FREE_LIMITS.accounts} cuentas activas. Desactivá una o pasá a Pro.`);
    }
    const type = z.enum(ACCOUNT_TYPES).parse(fd.get("type"));
    const currency = currencyOf(fd.get("currency"), workspace.baseCurrency);
    const a = await createAccount(db, workspace.id, {
      name: String(fd.get("name") ?? ""),
      institution: String(fd.get("institution") ?? ""),
      type,
      currency,
      initialBalance: String(fd.get("initialBalance") ?? "").trim() ? money(fd.get("initialBalance"), "el saldo inicial") : "0",
      initialDate: fd.get("initialDate") ? date(fd.get("initialDate"), "la fecha del saldo inicial") : todayIn(workspace.timezone),
      notes: String(fd.get("notes") ?? ""),
    });
    id = a.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/cuentas/${id}`);
}

export async function updateAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  const id = String(fd.get("id"));
  const db = getDb();
  const a = await db.account.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!a) return { error: "No encontramos esa cuenta." };
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Poné un nombre para la cuenta." };
  await db.account.update({ where: { id }, data: { name, institution: String(fd.get("institution") ?? "").trim() || null, notes: String(fd.get("notes") ?? "").trim() || null } });
  revalidatePath(`/app/cuentas/${id}`);
  return { ok: "Cuenta actualizada." };
}

// Orden de las cuentas al arrastrarlas (se guarda sin recargar la pantalla).
export async function reorderAccountsAction(ids: string[]) {
  const { workspace } = await requireWorkspace();
  if (!Array.isArray(ids) || ids.length > 500) return;
  await reorderAccounts(getDb(), workspace.id, ids.map(String));
  revalidatePath("/app", "layout");
}

export async function toggleAccountAction(fd: FormData) {
  const { workspace, plan } = await requireWorkspace();
  const id = String(fd.get("id"));
  const db = getDb();
  const a = await db.account.findFirst({ where: { id, workspaceId: workspace.id } });
  // Reactivar una cuenta también cuenta para el límite de Gratis (si no, se podía pasar de 5 desactivando y reactivando).
  if (a && !a.active && !(await canUse(plan, "ilimitado")) && (await db.account.count({ where: { workspaceId: workspace.id, active: true } })) >= FREE_LIMITS.accounts) {
    redirect("/app/cuentas?limite=1");
  }
  if (a) await db.account.update({ where: { id }, data: { active: !a.active } });
  revalidatePath("/app", "layout");
}

export async function reconcileAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const r = await adjustBalance(getDb(), workspace.id, { accountId: String(fd.get("accountId")), targetBalance: money(fd.get("target"), "el saldo del banco"), date: todayIn(workspace.timezone), userId: user.id });
    revalidatePath("/app", "layout");
    return { ok: r.diff.isZero() ? "Coincide con tu banco: no hay diferencias." : `Listo: se registró un ajuste de ${r.diff.toFixed(2)}.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Movimientos ----------

export async function createMovementAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  let savedId: string | null = null;
  let joined = false;
  try {
    const db = getDb();
    const kind = z.enum(["INCOME", "EXPENSE", "TRANSFER"]).parse(fd.get("kind"));
    const idempotencyKey = String(fd.get("idem") ?? "") || null;
    if (kind === "TRANSFER") {
      const amount = money(fd.get("amount"), "el importe");
      const rate = String(fd.get("fxRate") ?? "").trim() ? money(fd.get("fxRate"), "la cotización") : null;
      const [from, to] = await Promise.all([
        db.account.findFirst({ where: { id: String(fd.get("fromAccountId")), workspaceId: workspace.id } }),
        db.account.findFirst({ where: { id: String(fd.get("toAccountId")), workspaceId: workspace.id } }),
      ]);
      let toAmount;
      if (from && to && from.currency !== to.currency) {
        if (!rate) throw new UserError("Entre monedas distintas, indicá la cotización usada.");
        toAmount = from.currency === workspace.baseCurrency ? amount.dividedBy(rate) : amount.times(rate);
      }
      await recordTransfer(db, workspace.id, { fromAccountId: String(fd.get("fromAccountId")), toAccountId: String(fd.get("toAccountId")), amount, toAmount, fxRate: rate ?? undefined, date: date(fd.get("date"), "la fecha"), description: String(fd.get("description") ?? ""), userId: user.id });
    } else {
      const status = z.enum(["PAID", "PARTIAL", "PENDING"]).parse(fd.get("status"));
      let categoryId = String(fd.get("categoryId") ?? "") || null;
      const newCat = String(fd.get("newCategory") ?? "").trim();
      if (categoryId === "__new") {
        if (!newCat) throw new UserError("Escribí el nombre de la categoría nueva.");
        const k = kind === "INCOME" ? "INCOME" : "EXPENSE";
        const existing = await db.category.findFirst({ where: { workspaceId: workspace.id, kind: k, parentId: null, name: { equals: newCat, mode: "insensitive" } } });
        categoryId = (existing ?? (await db.category.create({ data: { workspaceId: workspace.id, kind: k, name: newCat } }))).id;
      }
      const economicPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(fd.get("economicPeriod") ?? "")) ? String(fd.get("economicPeriod")) : undefined;
      const res = await recordMovement(db, workspace.id, {
        kind,
        description: String(fd.get("description") ?? ""),
        amount: money(fd.get("amount"), "el importe"),
        accountId: String(fd.get("accountId")),
        categoryId,
        status,
        paidAmount: status === "PENDING" ? undefined : String(fd.get("paidAmount") ?? "").trim() ? money(fd.get("paidAmount"), "el importe pagado") : undefined,
        effectiveDate: status === "PENDING" ? undefined : date(fd.get("effectiveDate"), "la fecha de pago"),
        dueDate: status === "PAID" ? undefined : date(fd.get("dueDate"), "el vencimiento"),
        economicPeriod,
        certainty: fd.get("probable") === "on" ? "PROBABLE" : "CONFIRMED",
        notes: String(fd.get("notes") ?? ""),
        tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
        idempotencyKey,
        userId: user.id,
      });
      // Si ya estaba como pendiente (por ej. el sueldo de este mes), se une con ese: no queda duplicado.
      if (status === "PAID" && res.transactionId && !res.duplicate) {
        const acc = await db.account.findFirst({ where: { id: String(fd.get("accountId")), workspaceId: workspace.id }, select: { currency: true } });
        const match = acc && (await matchingPending(db, workspace.id, { kind, description: String(fd.get("description") ?? ""), currency: acc.currency, date: date(fd.get("effectiveDate"), "la fecha de pago") }));
        if (match) { await linkToPending(db, workspace.id, res.transactionId, match.id); joined = true; }
      }
      // ¿Se repite? Desde la próxima vez, lo genera la regla recurrente (esta vez ya quedó cargada).
      savedId = res.transactionId;
      if (fd.get("repeat") === "on" && !res.duplicate) {
        const freq = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]).catch("MONTHLY").parse(fd.get("frequency"));
        const ref = status === "PENDING" ? date(fd.get("dueDate"), "el vencimiento") : date(fd.get("effectiveDate"), "la fecha de pago");
        const step: Record<string, number> = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
        const next = step[freq] ? new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + step[freq], 1)) : new Date(ref.getTime() + (freq === "WEEKLY" ? 7 : 14) * 864e5);
        const day = ref.getUTCDate();
        const start = step[freq] ? new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()))) : next;
        const acc = await db.account.findFirstOrThrow({ where: { id: String(fd.get("accountId")), workspaceId: workspace.id } });
        await createRule(db, workspace.id, {
          direction: kind === "INCOME" ? "RECEIVABLE" : "PAYABLE", description: String(fd.get("description") ?? ""), amount: money(fd.get("amount"), "el importe"), currency: acc.currency,
          categoryId, accountId: acc.id, frequency: freq, dayOfMonth: step[freq] ? day : null, startDate: start,
          endDate: String(fd.get("until") ?? "").trim() ? date(fd.get("until"), "la fecha hasta") : null, variableAmount: fd.get("variable") === "on",
        });
        await materialize(db, workspace.id, new Date(todayIn(workspace.timezone).getTime() + MATERIALIZE_DAYS * 864e5));
      }
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  const back = String(fd.get("back") ?? "");
  redirect(/^\/app(\/|\?|$)/.test(back) ? back : savedId ? `/app/movimientos?guardado=${savedId}${joined ? "&unido=1" : ""}` : "/app/movimientos");
}

// Desde Próximos pagos: "es el mismo que ya cargué" (no se registra otra vez).
export async function linkToPendingAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  const obligationId = String(fd.get("obligationId") ?? "");
  const ob = await linkToPending(getDb(), workspace.id, String(fd.get("transactionId") ?? ""), obligationId);
  await audit("obligation.linked", { userId: user.id, workspaceId: workspace.id, entity: "obligation", entityId: obligationId });
  revalidatePath("/app", "layout");
  redirect(`/app/proximos?listo=${ob.direction === "RECEIVABLE" ? "cobro" : "pago"}`);
}

export async function payObligationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    await payObligation(getDb(), workspace.id, { obligationId: String(fd.get("obligationId")), accountId: String(fd.get("accountId")), amount: money(fd.get("amount"), "el importe"), date: date(fd.get("date"), "la fecha"), userId: user.id, settle: fd.get("settle") === "on", updateFuture: fd.get("updateFuture") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  const back = String(fd.get("back") || "");
  redirect(back.startsWith("/app") ? back : `/app/proximos?listo=${fd.get("kind") === "cobro" ? "cobro" : "pago"}`);
}

// Inicio: "Sí, lo cobré / lo pagué" con el monto esperado, hoy, en la cuenta de siempre.
export async function quickConfirmAction(fd: FormData) {
  const { user, workspace, modules, plan } = await requireWorkspace();
  const db = getDb();
  const ob = await db.obligation.findFirst({ where: { id: String(fd.get("obligationId")), workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] } }, include: { payments: true, recurringRule: { select: { accountId: true } }, category: { select: { name: true } } } });
  if (!ob) redirect("/app");
  const { isEstimatedGrain, loadSaleHref } = await import("@/server/grain");
  if (modules.cereal && isEstimatedGrain({ ...ob, category: ob.category?.name }) && (await canUse(plan, "cereal"))) redirect(loadSaleHref(ob.dueDate));
  const acc = (ob.recurringRule?.accountId && (await db.account.findFirst({ where: { id: ob.recurringRule.accountId, workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } })))
    || (await db.account.findFirst({ where: { workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: { createdAt: "asc" } }));
  if (!acc) redirect(`/app/proximos/${ob.id}`);
  const { remaining, matchingPaid } = await import("@/server/ledger");
  try {
    // Si ya lo cargaste a mano en Movimientos, se une con ese en vez de registrarlo otra vez.
    const already = !ob.sourceType && ob.payments.length === 0 ? await matchingPaid(db, workspace.id, ob) : null;
    if (already) await linkToPending(db, workspace.id, already.id, ob.id);
    else await payObligation(db, workspace.id, { obligationId: ob.id, accountId: acc.id, amount: remaining(ob), date: todayIn(workspace.timezone), userId: user.id, settle: true });
  } catch (e) {
    // Segundo toque: el primero ya lo cerró. No se registra otra vez.
    if (!(e instanceof UserError)) throw e;
  }
  revalidatePath("/app", "layout");
  redirect(`/app?listo=${ob.direction === "RECEIVABLE" ? "cobro" : "pago"}`);
}

export async function cancelObligationAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await cancelObligation(getDb(), workspace.id, String(fd.get("id")));
  revalidatePath("/app", "layout");
}

// ---------- Categorías ----------

export async function createCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  const name = String(fd.get("name") ?? "").trim();
  const kind = z.enum(["INCOME", "EXPENSE"]).parse(fd.get("kind"));
  const parentId = String(fd.get("parentId") ?? "") || null;
  if (!name) return { error: "Escribí el nombre de la categoría." };
  const db = getDb();
  if (parentId && !(await db.category.findFirst({ where: { id: parentId, workspaceId: workspace.id, kind } }))) return { error: "No encontramos la categoría principal." };
  if (await db.category.findFirst({ where: { workspaceId: workspace.id, kind, parentId, name: { equals: name, mode: "insensitive" } } })) return { error: "Ya existe una categoría con ese nombre." };
  await db.category.create({ data: { workspaceId: workspace.id, kind, name, parentId } });
  revalidatePath("/app/categorias");
  return { ok: `Categoría "${name}" creada.` };
}

// ---------- Configuración ----------

// El nombre es de la persona; país y monedas son del espacio y los cambia solo su dueño.
export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Decinos cómo te llamamos." };
  const db = getDb();
  await db.user.update({ where: { id: user.id }, data: { name } });
  const { pickMembership } = await import("@/server/sharing");
  const m = pickMembership(user.memberships, user.activeWorkspaceId);
  if (!m || m.role !== "OWNER") { revalidatePath("/app", "layout"); return { ok: "Guardado. País y monedas los cambia el dueño del espacio." }; }
  const workspace = m.workspace;
  await db.workspace.update({
    where: { id: workspace.id },
    data: (() => {
      const country = countryOf(fd.get("country"), workspace.country);
      const baseCurrency = currencyOf(fd.get("currency"), workspace.baseCurrency);
      return { country, baseCurrency, timezone: countryByCode(country).timezone, extraCurrencies: fd.getAll("extraCurrencies").map(String).filter((c) => isCurrency(c) && c !== baseCurrency) };
    })(),
  });
  revalidatePath("/app", "layout");
  return { ok: "Guardado." };
}

export async function saveModulesAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace, membership } = await requireWorkspace();
  if (membership.role !== "OWNER") return { error: "Las funciones del espacio las cambia su dueño." };
  const on = fd.getAll("modules").map(String);
  const current = readModules(workspace.modules);
  for (const m of MODULES) current[m.key] = on.includes(m.key);
  await getDb().workspace.update({ where: { id: workspace.id }, data: { modules: current } });
  revalidatePath("/app", "layout");
  return { ok: "Funciones actualizadas." };
}

export async function start2faAction() {
  const { user } = await requireUser();
  if (user.totpEnabledAt) return;
  await getDb().user.update({ where: { id: user.id }, data: { totpSecretEnc: encryptSecret(generateTotpSecret()) } });
  revalidatePath("/app/configuracion");
}

export async function twoFactorQr(): Promise<{ qr: string; secret: string } | null> {
  const { user } = await requireUser();
  if (!user.totpSecretEnc || user.totpEnabledAt) return null;
  const secret = decryptSecret(user.totpSecretEnc);
  return { qr: await QRCode.toDataURL(otpauthUrl(secret, user.email), { margin: 1, width: 200 }), secret };
}

export async function confirm2faAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, session } = await requireUser();
  if (!user.totpSecretEnc) return { error: "Primero tocá Activar." };
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), String(fd.get("code") ?? ""))) return { error: "El código no es correcto. Probá con el que se ve ahora en la app." };
  const db = getDb();
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
  await db.session.update({ where: { id: session.id }, data: { twoFactorVerified: true } });
  await audit("auth.2fa_enabled", { userId: user.id });
  try { const { sendSecurityNotice } = await import("@/server/account-mail"); await sendSecurityNotice(user, "2fa_on"); } catch (e) { console.error("aviso 2fa", e); }
  revalidatePath("/app/configuracion");
  return { ok: "Verificación en dos pasos activada." };
}

export async function disable2faAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!user.totpSecretEnc || !user.totpEnabledAt) return { error: "No está activada." };
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), String(fd.get("code") ?? ""))) return { error: "Para desactivarla, escribí un código válido." };
  await getDb().user.update({ where: { id: user.id }, data: { totpEnabledAt: null, totpSecretEnc: null } });
  await audit("auth.2fa_disabled", { userId: user.id });
  try { const { sendSecurityNotice } = await import("@/server/account-mail"); await sendSecurityNotice(user, "2fa_off"); } catch (e) { console.error("aviso 2fa", e); }
  revalidatePath("/app/configuracion");
  return { ok: "Verificación en dos pasos desactivada." };
}

export async function revokeOtherSessionsAction() {
  const { user, session } = await requireUser();
  await getDb().session.updateMany({ where: { userId: user.id, id: { not: session.id }, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/app/configuracion");
}

// ---------- Editar un movimiento ----------
// Concepto, categoría, fecha, mes y notas se pueden cambiar siempre. El importe, solo en un ingreso o gasto suelto
// (sin pago pendiente, transferencia ni anulación vinculada), porque si no, se descuadran los saldos.
export async function updateMovementAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const id = String(fd.get("id") ?? "");
  try {
    const amountRaw = String(fd.get("amount") ?? "").trim();
    await updateMovement(getDb(), workspace.id, id, {
      description: String(fd.get("description") ?? ""),
      categoryId: String(fd.get("categoryId") ?? "") || null,
      effectiveDate: date(fd.get("effectiveDate"), "la fecha"),
      economicPeriod: /^\d{4}-\d{2}$/.test(String(fd.get("economicPeriod"))) ? String(fd.get("economicPeriod")) : String(fd.get("effectiveDate") ?? "").slice(0, 7),
      notes: String(fd.get("notes") ?? "").trim() || null,
      amount: amountRaw ? money(amountRaw, "el importe") : null,
      accountId: String(fd.get("accountId") ?? "") || null,
    });
    await audit("tx.updated", { userId: user.id, workspaceId: workspace.id, entity: "transaction", entityId: id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/movimientos?guardado=1");
}

// Corregir algo a futuro (un pendiente).
export async function updateObligationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const id = String(fd.get("id") ?? "");
  try {
    await updateObligation(getDb(), workspace.id, id, {
      description: String(fd.get("description") ?? ""),
      amount: money(fd.get("amount"), "el importe"),
      dueDate: date(fd.get("dueDate"), "la fecha"),
      categoryId: String(fd.get("categoryId") ?? "") || null,
      notes: String(fd.get("notes") ?? "").trim() || null,
    });
    await audit("obligation.updated", { userId: user.id, workspaceId: workspace.id, entity: "obligation", entityId: id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/proximos?corregido=1");
}

export async function deleteObligationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const id = String(fd.get("id") ?? "");
  try {
    await deleteObligation(getDb(), workspace.id, id);
    await audit("obligation.deleted", { userId: user.id, workspaceId: workspace.id, entity: "obligation", entityId: id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/proximos?borrado=1");
}

// Pagar o cobrar varios pendientes juntos, por lo que falta de cada uno, desde una cuenta y en una fecha.
export async function bulkPayAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const ids = [...new Set(fd.getAll("ids").map(String))].slice(0, 200);
  if (!ids.length) return { error: "Elegí al menos un pago o cobro." };
  const db = getDb();
  const acc = await db.account.findFirst({ where: { id: String(fd.get("accountId") ?? ""), workspaceId: workspace.id, active: true } });
  if (!acc) return { error: "Elegí la cuenta." };
  let when: Date;
  try { when = date(fd.get("date"), "la fecha"); } catch (e) { return fail(e); }
  const { remaining } = await import("@/server/ledger");
  const obs = await db.obligation.findMany({ where: { workspaceId: workspace.id, id: { in: ids }, status: { in: ["PENDING", "PARTIAL"] } }, include: { payments: true } });
  let ok = 0;
  const skipped: string[] = [];
  for (const o of obs) {
    if (o.currency !== acc.currency) { skipped.push(`${o.description} (es en ${o.currency})`); continue; }
    try { await payObligation(db, workspace.id, { obligationId: o.id, accountId: acc.id, amount: remaining(o), date: when, userId: user.id, settle: true }); ok++; }
    catch (e) { if (e instanceof UserError) skipped.push(o.description); else throw e; }
  }
  await audit("obligation.bulk_paid", { userId: user.id, workspaceId: workspace.id, meta: { ok, skipped: skipped.length } });
  revalidatePath("/app", "layout");
  return { ok: `Listo, registramos ${ok} ${ok === 1 ? "pago o cobro" : "pagos y cobros"} desde ${acc.name}.${skipped.length ? ` No se registraron: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}.` : ""}` };
}

// Varios movimientos a la vez: cambiarles la categoría o eliminarlos.
export async function bulkMovementsAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const ids = [...new Set(fd.getAll("ids").map(String))].slice(0, 500);
  if (!ids.length) return { error: "Elegí al menos un movimiento." };
  const db = getDb();
  if (fd.get("do") === "del") {
    let ok = 0;
    const skipped: string[] = [];
    for (const id of ids) {
      try { await deleteMovement(db, workspace.id, id); ok++; } catch (e) { if (e instanceof UserError) skipped.push(e.message); else throw e; }
    }
    await audit("tx.bulk_deleted", { userId: user.id, workspaceId: workspace.id, meta: { ok, skipped: skipped.length } });
    revalidatePath("/app", "layout");
    return skipped.length ? { ok: `Eliminamos ${ok}. ${skipped.length} no se pudieron: ${[...new Set(skipped)][0]}` } : { ok: `Listo, eliminamos ${ok} ${ok === 1 ? "movimiento" : "movimientos"}.` };
  }
  const catId = String(fd.get("categoryId") ?? "");
  const cat = catId ? await db.category.findFirst({ where: { id: catId, workspaceId: workspace.id } }) : null;
  if (catId && !cat) return { error: "No encontramos esa categoría." };
  if (!catId) return { error: "Elegí la categoría nueva." };
  // Solo cambian los del mismo tipo (una categoría de gasto no se pone a un ingreso).
  const r = await db.transaction.updateMany({ where: { workspaceId: workspace.id, id: { in: ids }, type: cat!.kind === "INCOME" ? "INCOME" : "EXPENSE" }, data: { categoryId: cat!.id } });
  await audit("tx.bulk_category", { userId: user.id, workspaceId: workspace.id, meta: { n: r.count } });
  revalidatePath("/app", "layout");
  const other = ids.length - r.count;
  return { ok: `Listo, ${r.count} ${r.count === 1 ? "movimiento pasó" : "movimientos pasaron"} a ${cat!.name}.${other ? ` ${other} no cambiaron porque son de otro tipo (ingreso, gasto o transferencia).` : ""}` };
}

// Borrar un movimiento cargado por error (se va del todo, con lo que dependía de él).
export async function deleteMovementAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  const id = String(fd.get("id") ?? "");
  try {
    await deleteMovement(getDb(), workspace.id, id);
  } catch (e) {
    if (e instanceof UserError) redirect(`/app/movimientos/${id}?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  await audit("tx.deleted", { userId: user.id, workspaceId: workspace.id, entity: "transaction", entityId: id });
  revalidatePath("/app", "layout");
  const back = String(fd.get("back") ?? "");
  redirect(/^\/app(\/|\?|$)/.test(back) ? back : "/app/movimientos?borrado=1");
}

export async function setBigTextAction(on: boolean) {
  const { user } = await requireUser();
  await getDb().user.update({ where: { id: user.id }, data: { bigText: !!on } });
}

// Reenviar el enlace para confirmar el correo: hasta 3 por hora.
export async function resendVerifyAction(_: FormState, __?: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (user.emailVerified) return { ok: "Tu correo ya está confirmado." };
  const db = getDb();
  if ((await db.auditLog.count({ where: { action: "auth.verify_sent", userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } })) >= 3) return { error: "Ya te mandamos varios enlaces. Revisá también en spam o probá en una hora." };
  const { sendVerifyEmail } = await import("@/server/account-mail");
  await sendVerifyEmail(user);
  await audit("auth.verify_sent", { userId: user.id });
  return { ok: `Te mandamos un código nuevo a ${user.email}.` };
}

// Confirmar el correo con el código de 6 números (5 intentos cada 15 minutos).
export async function verifyEmailCodeAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (user.emailVerified) return { ok: "Tu correo ya está confirmado." };
  const db = getDb();
  if ((await db.auditLog.count({ where: { action: "auth.verify_code_failed", userId: user.id, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } })) >= 5) return { error: "Demasiados códigos incorrectos. Probá de nuevo en 15 minutos." };
  const { checkVerifyCode } = await import("@/server/email-verify");
  if (!checkVerifyCode(user.id, user.email, String(fd.get("code") ?? ""))) {
    await audit("auth.verify_code_failed", { userId: user.id });
    return { error: "El código no es correcto o venció. Revisá el último correo o pedí uno nuevo." };
  }
  await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  await audit("auth.email_verified", { userId: user.id, meta: { via: "code" } });
  revalidatePath("/app", "layout");
  return { ok: "Listo, tu correo quedó confirmado." };
}

export async function emailRemindersAction(fd: FormData) {
  const { user } = await requireUser();
  const on = fd.get("on") === "1";
  // Los avisos por correo se prenden solo con el correo confirmado (si no, irían a una dirección que quizás no es tuya).
  const { needsVerifiedEmail } = await import("@/server/email-verify");
  if (on && needsVerifiedEmail(user)) redirect("/app/configuracion?verificar=avisos");
  await getDb().user.update({ where: { id: user.id }, data: { emailReminders: on } });
  revalidatePath("/app/configuracion");
}

export async function deleteCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const { deleteCategory } = await import("@/server/categories");
    const moveTo = String(fd.get("moveTo") ?? "") || null;
    await deleteCategory(getDb(), workspace.id, String(fd.get("id") ?? ""), moveTo);
    await audit("category.deleted", { userId: user.id, workspaceId: workspace.id, entityId: String(fd.get("id") ?? ""), meta: { moveTo } });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  redirect(`/app/categorias${fd.get("kind") === "INCOME" ? "?tipo=INCOME&" : "?"}borrada=1`);
}

// Borrar la propia cuenta: pide la contraseña (si tiene) y el correo escrito. No deja borrar con Pro pago activo.
export async function deleteMyAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  // El plan que importa es el del espacio propio (el que se borra), no el que esté mirando.
  const workspace = user.memberships.find((m) => m.role === "OWNER")?.workspace ?? user.memberships[0].workspace;
  const db = getDb();
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== user.email) return { error: `Escribí tu correo exacto: ${user.email}` };
  if (user.passwordHash) {
    const { verifyPassword } = await import("@/lib/auth/password");
    if (!(await verifyPassword(String(fd.get("password") ?? ""), user.passwordHash))) return { error: "La contraseña no es correcta." };
  }
  const sub = await db.subscription.findUnique({ where: { workspaceId: workspace.id } });
  if (sub?.provider === "mercadopago" && sub.status === "ACTIVE") return { error: "Tenés Pro pago activo: cancelalo primero en Tu plan, así no te siguen cobrando." };
  const { deleteAccount } = await import("@/server/admin-accounts");
  await audit("auth.account_self_deleted", { meta: { email: user.email } });
  await deleteAccount(db, user.id);
  const { cookies } = await import("next/headers");
  (await cookies()).delete("nexo_session");
  redirect("/?cuenta-borrada=1");
}


export async function updateCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const { updateCategory } = await import("@/server/categories");
    const id = String(fd.get("id") ?? "");
    const c = await updateCategory(getDb(), workspace.id, id, { name: String(fd.get("name") ?? ""), parentId: String(fd.get("parentId") ?? "") || null });
    await audit("category.updated", { userId: user.id, workspaceId: workspace.id, entityId: id, meta: { name: c.name, parentId: c.parentId } });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  return { ok: "Listo, categoría actualizada." };
}
