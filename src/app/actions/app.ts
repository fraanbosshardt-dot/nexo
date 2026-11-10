"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { audit, requireUser, requireWorkspace } from "@/lib/auth/session";
import { parseAmount } from "@/lib/money";
import { parseDate, todayIn } from "@/lib/dates";
import { MODULES, modulesForUses, readModules, FREE_LIMITS } from "@/lib/modules";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { adjustBalance, cancelObligation, createAccount, payObligation, recordMovement, recordTransfer, reverseTransaction, UserError } from "@/server/ledger";
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
  const d = parseAmount(String(v ?? ""));
  if (!d) throw new UserError(`Revisá ${label}: tiene que ser un número.`);
  return d;
};
const date = (v: FormDataEntryValue | null, label: string) => {
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
    if (plan === "FREE" && (await db.account.count({ where: { workspaceId: workspace.id, active: true } })) >= FREE_LIMITS.accounts) {
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

export async function toggleAccountAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  const id = String(fd.get("id"));
  const db = getDb();
  const a = await db.account.findFirst({ where: { id, workspaceId: workspace.id } });
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
  redirect(/^\/app(\/|\?|$)/.test(back) ? back : savedId ? `/app/movimientos?guardado=${savedId}` : "/app/movimientos");
}

export async function payObligationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    await payObligation(getDb(), workspace.id, { obligationId: String(fd.get("obligationId")), accountId: String(fd.get("accountId")), amount: money(fd.get("amount"), "el importe"), date: date(fd.get("date"), "la fecha"), userId: user.id, settle: fd.get("settle") === "on", updateFuture: fd.get("updateFuture") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/app", "layout");
  redirect(String(fd.get("back") || "/app/proximos").startsWith("/app") ? String(fd.get("back") || "/app/proximos") : "/app/proximos");
}

// Inicio: "Sí, lo cobré / lo pagué" con el monto esperado, hoy, en la cuenta de siempre.
export async function quickConfirmAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  const db = getDb();
  const ob = await db.obligation.findFirst({ where: { id: String(fd.get("obligationId")), workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] } }, include: { payments: true, recurringRule: { select: { accountId: true } } } });
  if (!ob) redirect("/app");
  const acc = (ob.recurringRule?.accountId && (await db.account.findFirst({ where: { id: ob.recurringRule.accountId, workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } })))
    || (await db.account.findFirst({ where: { workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: { createdAt: "asc" } }));
  if (!acc) redirect(`/app/proximos/${ob.id}`);
  const { remaining } = await import("@/server/ledger");
  await payObligation(db, workspace.id, { obligationId: ob.id, accountId: acc.id, amount: remaining(ob), date: todayIn(workspace.timezone), userId: user.id, settle: true });
  revalidatePath("/app", "layout");
  redirect(`/app?listo=${ob.direction === "RECEIVABLE" ? "cobro" : "pago"}`);
}

export async function cancelObligationAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await cancelObligation(getDb(), workspace.id, String(fd.get("id")));
  revalidatePath("/app", "layout");
}

export async function reverseAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  await reverseTransaction(getDb(), workspace.id, String(fd.get("id")), user.id);
  await audit("tx.reversed", { userId: user.id, workspaceId: workspace.id, entity: "transaction", entityId: String(fd.get("id")) });
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

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Decinos cómo te llamamos." };
  const db = getDb();
  await db.user.update({ where: { id: user.id }, data: { name } });
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
  const { workspace } = await requireWorkspace();
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
  revalidatePath("/app/configuracion");
  return { ok: "Verificación en dos pasos activada." };
}

export async function disable2faAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!user.totpSecretEnc || !user.totpEnabledAt) return { error: "No está activada." };
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), String(fd.get("code") ?? ""))) return { error: "Para desactivarla, escribí un código válido." };
  await getDb().user.update({ where: { id: user.id }, data: { totpEnabledAt: null, totpSecretEnc: null } });
  await audit("auth.2fa_disabled", { userId: user.id });
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
    const db = getDb();
    const t = await db.transaction.findFirst({ where: { id, workspaceId: workspace.id }, include: { reversedBy: true } });
    if (!t) throw new UserError("No encontramos ese movimiento.");
    if (t.reversalOfId || t.reversedBy) throw new UserError("Un movimiento anulado no se puede editar.");
    const description = String(fd.get("description") ?? "").trim();
    if (!description) throw new UserError("Escribí el concepto.");
    const categoryId = String(fd.get("categoryId") ?? "") || null;
    if (categoryId && !(await db.category.findFirst({ where: { id: categoryId, workspaceId: workspace.id } }))) throw new UserError("No encontramos esa categoría.");
    const effectiveDate = date(fd.get("effectiveDate"), "la fecha");
    const economicPeriod = /^\d{4}-\d{2}$/.test(String(fd.get("economicPeriod"))) ? String(fd.get("economicPeriod")) : t.economicPeriod;
    const simple = (t.type === "INCOME" || t.type === "EXPENSE") && !t.obligationId && !t.transferGroupId;
    const amount = simple && String(fd.get("amount") ?? "").trim() ? money(fd.get("amount"), "el importe") : null;
    if (amount && !amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
    await db.transaction.update({
      where: { id: t.id },
      data: { description: description.slice(0, 140), categoryId, effectiveDate, economicPeriod, notes: String(fd.get("notes") ?? "").trim() || null, ...(amount ? { amount: amount.toFixed(2) } : {}) },
    });
    await audit("tx.updated", { userId: user.id, workspaceId: workspace.id, entity: "transaction", entityId: t.id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/movimientos?guardado=1");
}

export async function emailRemindersAction(fd: FormData) {
  const { user } = await requireUser();
  await getDb().user.update({ where: { id: user.id }, data: { emailReminders: fd.get("on") === "1" } });
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
  const { user, workspace } = await requireWorkspace();
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
