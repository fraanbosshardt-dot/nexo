"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { audit, canUse, requireWorkspace } from "@/lib/auth/session";
import { parseAmount } from "@/lib/money";
import { parseDate, todayIn } from "@/lib/dates";
import { isCurrency } from "@/lib/countries";
import { UserError } from "@/server/ledger";
import { changeRuleFrom, createRule, endRule, materialize, pauseRule } from "@/server/recurring";
import { MATERIALIZE_DAYS } from "@/server/forecast";
import { cardPurchase, createCard } from "@/server/cards";
import { cancelDebt, createDebt, payDebtOnAccount } from "@/server/debts";
import { addContribution, copyBudget, saveBudget } from "@/server/planning";
import { addValuation, createAsset, createInvestment, investmentMove, saveManualRate } from "@/server/wealth";
import { createGrainSale } from "@/server/grain";
import { applyImport, previewImport, revertImport } from "@/server/io";
import { FREE_LIMITS } from "@/server/plans";
import type { FormState } from "./auth";

const fail = (e: unknown): FormState => {
  if (e instanceof UserError) return { error: e.message };
  console.error(e);
  return { error: "No pudimos guardar. Probá de nuevo en un momento." };
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const money = (fd: FormData, k: string, label: string) => {
  const d = parseAmount(str(fd, k));
  if (!d) throw new UserError(`Revisá ${label}: tiene que ser un número.`);
  return d;
};
const optMoney = (fd: FormData, k: string, label: string) => (str(fd, k) ? money(fd, k, label) : null);
const date = (fd: FormData, k: string, label: string) => {
  const d = parseDate(str(fd, k));
  if (!d) throw new UserError(`Revisá ${label} (dd/mm/aaaa).`);
  return d;
};
const int = (fd: FormData, k: string) => (str(fd, k) ? Number.parseInt(str(fd, k), 10) : null);
const FREQ = z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]);
const done = (path: string) => { revalidatePath("/app", "layout"); return path; };

async function refreshRules(ws: string, tz: string) {
  const today = todayIn(tz);
  await materialize(getDb(), ws, new Date(today.getTime() + MATERIALIZE_DAYS * 864e5));
}

// ---------- Reglas recurrentes ----------

export async function createRuleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    const accountId = str(fd, "accountId") || null;
    const acc = accountId ? await getDb().account.findFirst({ where: { id: accountId, workspaceId: workspace.id } }) : null;
    await createRule(getDb(), workspace.id, {
      direction: z.enum(["RECEIVABLE", "PAYABLE"]).parse(fd.get("direction")),
      description: str(fd, "description"),
      amount: money(fd, "amount", "el importe"),
      currency: acc?.currency ?? workspace.baseCurrency,
      categoryId: str(fd, "categoryId") || null,
      accountId,
      frequency: FREQ.parse(fd.get("frequency")),
      dayOfMonth: int(fd, "dayOfMonth"),
      startDate: date(fd, "startDate", "la primera fecha"),
      endDate: str(fd, "endDate") ? date(fd, "endDate", "la fecha de fin") : null,
      weekendRule: z.enum(["NONE", "PREVIOUS_BUSINESS_DAY", "NEXT_BUSINESS_DAY"]).catch("NONE").parse(fd.get("weekendRule")),
      variableAmount: fd.get("variable") === "on",
      increasePct: optMoney(fd, "increasePct", "el aumento"),
      increaseEveryMonths: int(fd, "increaseEvery"),
    });
    await refreshRules(workspace.id, workspace.timezone);
  } catch (e) { return fail(e); }
  redirect(done("/app/recurrentes"));
}

export async function changeRuleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    await changeRuleFrom(getDb(), workspace.id, str(fd, "id"), date(fd, "from", "desde cuándo"), { amount: money(fd, "amount", "el importe nuevo") });
    await refreshRules(workspace.id, workspace.timezone);
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Listo: cambia desde esa fecha. Lo anterior quedó igual." };
}

export async function pauseRuleAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await pauseRule(getDb(), workspace.id, str(fd, "id"), fd.get("pause") === "1", todayIn(workspace.timezone));
  if (fd.get("pause") !== "1") await refreshRules(workspace.id, workspace.timezone);
  revalidatePath("/app", "layout");
}

export async function endRuleAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await endRule(getDb(), workspace.id, str(fd, "id"), todayIn(workspace.timezone));
  revalidatePath("/app", "layout");
}

// ---------- Tarjetas ----------

export async function createCardAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  let id = "";
  try {
    const c = await createCard(getDb(), workspace.id, {
      issuer: str(fd, "issuer"), name: str(fd, "name"), last4: str(fd, "last4") || null, limit: money(fd, "limit", "el límite"),
      currency: isCurrency(str(fd, "currency")) ? str(fd, "currency") : workspace.baseCurrency,
      closingDay: int(fd, "closingDay") ?? 0, dueDay: int(fd, "dueDay") ?? 0, payAccountId: str(fd, "payAccountId") || null, startDate: todayIn(workspace.timezone),
    });
    id = c.id;
  } catch (e) { return fail(e); }
  redirect(done(`/app/tarjetas/${id}`));
}

export async function cardPurchaseAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const cardId = str(fd, "cardId");
  try {
    const n = int(fd, "installments") ?? 1;
    await cardPurchase(getDb(), workspace.id, {
      cardId, description: str(fd, "description"), amount: money(fd, "amount", "el precio"),
      financedTotal: fd.get("interest") === "con" ? optMoney(fd, "financedTotal", "el total financiado") : null,
      categoryId: str(fd, "categoryId") || null, date: date(fd, "date", "la fecha"), installments: n, userId: user.id,
    });
  } catch (e) { return fail(e); }
  redirect(done(`/app/tarjetas/${cardId}`));
}

// ---------- Deudas ----------

export async function createDebtAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  let id = "";
  try {
    const system = z.enum(["FRENCH", "GERMAN", "AMERICAN", "NO_INTEREST", "MANUAL", "NONE"]).parse(fd.get("system"));
    const accountId = str(fd, "accountId") || null;
    const acc = accountId ? await getDb().account.findFirst({ where: { id: accountId, workspaceId: workspace.id } }) : null;
    const d = await createDebt(getDb(), workspace.id, {
      creditor: str(fd, "creditor"), kind: str(fd, "kind") || "Préstamo", principal: money(fd, "principal", "el importe"),
      currency: acc?.currency ?? (isCurrency(str(fd, "currency")) ? str(fd, "currency") : workspace.baseCurrency), system,
      installments: int(fd, "installments"), tna: optMoney(fd, "tna", "la TNA"), tea: optMoney(fd, "tea", "la TEA"), cft: optMoney(fd, "cft", "el CFT"),
      installmentAmount: optMoney(fd, "installmentAmount", "la cuota"), startDate: str(fd, "startDate") ? date(fd, "startDate", "la fecha") : todayIn(workspace.timezone),
      firstDue: str(fd, "firstDue") ? date(fd, "firstDue", "la primera cuota") : null, accountId: fd.get("credited") === "on" ? accountId : null,
      paidInstallments: int(fd, "paidInstallments") ?? 0, notes: str(fd, "notes"), userId: user.id,
    });
    id = d.id;
  } catch (e) { return fail(e); }
  redirect(done(`/app/deudas/${id}`));
}

export async function cancelDebtAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  let saved = "";
  try {
    const r = await cancelDebt(getDb(), workspace.id, { debtId: str(fd, "debtId"), accountId: str(fd, "accountId"), amount: money(fd, "amount", "el importe"), date: date(fd, "date", "la fecha"), userId: user.id });
    saved = r.saved.toFixed(2);
    await audit("debt.cancelled", { userId: user.id, workspaceId: workspace.id, entity: "debt", entityId: str(fd, "debtId"), meta: { saved } });
  } catch (e) { return fail(e); }
  redirect(done(`/app/deudas/${str(fd, "debtId")}?cancelada=1`));
}

export async function payDebtOnAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    await payDebtOnAccount(getDb(), workspace.id, { debtId: str(fd, "debtId"), accountId: str(fd, "accountId"), amount: money(fd, "amount", "el importe"), date: date(fd, "date", "la fecha"), userId: user.id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Pago registrado." };
}

// ---------- Presupuestos y objetivos ----------

export async function saveBudgetAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    const p = str(fd, "period");
    const lines = [...fd.entries()].filter(([k]) => k.startsWith("limit:")).map(([k, v]) => ({ categoryId: k.slice(6), limit: String(v).trim() ? parseAmount(String(v)) : null }));
    if (lines.some((l) => l.limit === null && fd.get(`limit:${l.categoryId}`) && String(fd.get(`limit:${l.categoryId}`)).trim())) throw new UserError("Revisá los importes: tienen que ser números.");
    await saveBudget(getDb(), workspace.id, p, workspace.baseCurrency, lines);
  } catch (e) { return fail(e); }
  revalidatePath("/app/presupuestos");
  return { ok: "Presupuesto guardado." };
}

export async function copyBudgetAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  try { await copyBudget(getDb(), workspace.id, str(fd, "from"), str(fd, "to"), workspace.baseCurrency); } catch { /* sin presupuesto previo: no hace nada */ }
  revalidatePath("/app/presupuestos");
}

export async function createGoalAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "ilimitado")) && (await getDb().goal.count({ where: { workspaceId: workspace.id } })) >= FREE_LIMITS.goals) throw new UserError(`El plan Gratis incluye ${FREE_LIMITS.goals} objetivos. Pasá a Pro para tener más.`);
    if (!str(fd, "name")) throw new UserError("Poné un nombre al objetivo.");
    await getDb().goal.create({
      data: { workspaceId: workspace.id, name: str(fd, "name"), targetAmount: money(fd, "target", "la meta").toFixed(2), currency: isCurrency(str(fd, "currency")) ? str(fd, "currency") : workspace.baseCurrency, targetDate: str(fd, "targetDate") ? date(fd, "targetDate", "la fecha") : null, monthlyContribution: optMoney(fd, "monthly", "el aporte")?.toFixed(2) ?? null },
    });
    const start = optMoney(fd, "saved", "lo que ya tenés");
    if (start && start.gt(0)) {
      const g = await getDb().goal.findFirstOrThrow({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } });
      await addContribution(getDb(), workspace.id, g.id, start, todayIn(workspace.timezone));
    }
  } catch (e) { return fail(e); }
  redirect(done("/app/objetivos"));
}

export async function contributeAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try { await addContribution(getDb(), workspace.id, str(fd, "goalId"), money(fd, "amount", "el aporte"), todayIn(workspace.timezone)); } catch (e) { return fail(e); }
  revalidatePath("/app/objetivos");
  return { ok: "Aporte registrado." };
}

export async function updateGoalPlanAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  const g = await getDb().goal.findFirst({ where: { id: str(fd, "goalId"), workspaceId: workspace.id } });
  const m = parseAmount(str(fd, "monthly"));
  if (g && m) await getDb().goal.update({ where: { id: g.id }, data: { monthlyContribution: m.toFixed(2) } });
  revalidatePath("/app/objetivos");
}

export async function deleteGoalAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await getDb().goal.deleteMany({ where: { id: str(fd, "goalId"), workspaceId: workspace.id } });
  revalidatePath("/app/objetivos");
}

// ---------- Inversiones, bienes y cotizaciones ----------

export async function createInvestmentAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const inv = await createInvestment(getDb(), workspace.id, { name: str(fd, "name"), kind: str(fd, "kind") || "Otra", currency: isCurrency(str(fd, "currency")) ? str(fd, "currency") : workspace.baseCurrency });
    const first = optMoney(fd, "amount", "el aporte");
    if (first && str(fd, "accountId")) await investmentMove(getDb(), workspace.id, { investmentId: inv.id, kind: "CONTRIBUTION", accountId: str(fd, "accountId"), amount: first, date: todayIn(workspace.timezone), userId: user.id });
  } catch (e) { return fail(e); }
  redirect(done("/app/inversiones"));
}

export async function investmentMoveAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    await investmentMove(getDb(), workspace.id, { investmentId: str(fd, "investmentId"), kind: z.enum(["CONTRIBUTION", "WITHDRAWAL"]).parse(fd.get("kind")), accountId: str(fd, "accountId"), amount: money(fd, "amount", "el importe"), date: todayIn(workspace.timezone), userId: user.id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Movimiento registrado." };
}

export async function valuationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    await addValuation(getDb(), workspace.id, { investmentId: str(fd, "investmentId") || undefined, assetId: str(fd, "assetId") || undefined, value: money(fd, "value", "la valuación"), date: todayIn(workspace.timezone) });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Valuación guardada. No cambia tu dinero disponible." };
}

export async function createAssetAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    await createAsset(getDb(), workspace.id, { name: str(fd, "name"), kind: str(fd, "kind") || "Otro", currency: isCurrency(str(fd, "currency")) ? str(fd, "currency") : workspace.baseCurrency, value: money(fd, "value", "el valor"), date: todayIn(workspace.timezone), notes: str(fd, "notes") });
  } catch (e) { return fail(e); }
  redirect(done("/app/patrimonio"));
}

export async function rateAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try { await saveManualRate(getDb(), workspace.id, str(fd, "from"), workspace.baseCurrency, money(fd, "rate", "la cotización")); } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Cotización guardada." };
}

// ---------- Ventas de cereal ----------

export async function grainSaleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    const qty = money(fd, "quantity", "la cantidad");
    const tonnes = fd.get("unit") === "qq" ? qty.dividedBy(10) : qty;
    await createGrainSale(getDb(), workspace.id, {
      saleDate: date(fd, "saleDate", "la fecha de venta"), grain: str(fd, "grain") || "Soja", tonnes, pricePerTonne: money(fd, "price", "el precio por tonelada"),
      priceCurrency: isCurrency(str(fd, "priceCurrency")) ? str(fd, "priceCurrency") : workspace.baseCurrency, fxRate: optMoney(fd, "fxRate", "la cotización"),
      taxPct: optMoney(fd, "taxPct", "el impuesto") ?? "1.2", otherDeductions: optMoney(fd, "other", "otros descuentos") ?? "0",
      collectDate: date(fd, "collectDate", "la fecha de cobro"), accountId: str(fd, "accountId"), collected: fd.get("collected") === "on", userId: user.id,
    });
  } catch (e) { return fail(e); }
  redirect(done("/app/cereal"));
}

// ---------- Importar ----------

export async function importAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Elegí un archivo CSV.");
    if (file.size > 5_000_000) throw new UserError("El archivo supera 5 MB.");
    const text = await file.text();
    const map: Record<number, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("col:")) map[Number(k.slice(4))] = String(v);
    const accountId = str(fd, "accountId");
    const acc = await getDb().account.findFirst({ where: { id: accountId, workspaceId: workspace.id } });
    if (!acc) throw new UserError("Elegí la cuenta de los movimientos.");
    const preview = await previewImport(getDb(), workspace.id, acc.id, text, Object.keys(map).length ? map : autoMap(text));
    if (fd.get("confirm") !== "1") return { ok: `Listo para importar ${preview.ok.length} movimientos. ${preview.duplicates} ya estaban cargados y ${preview.errors.length} tienen errores${preview.errors.length ? ` (líneas ${preview.errors.slice(0, 5).map((e) => e.line).join(", ")})` : ""}. Tocá "Importar" para confirmar.` };
    const b = await applyImport(getDb(), workspace.id, acc.id, file.name, preview, user.id);
    await audit("import.applied", { userId: user.id, workspaceId: workspace.id, entity: "importBatch", entityId: b.id, meta: { rows: b.rows } });
  } catch (e) { return fail(e); }
  redirect(done("/app/importar?ok=1"));
}

function autoMap(text: string) {
  const first = text.replace(/^﻿/, "").split(/\r?\n/)[0] ?? "";
  const delim = [";", "\t", ","].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const m: Record<number, string> = {};
  first.split(delim).forEach((h, i) => {
    const s = h.toLowerCase();
    m[i] = /fech|date/.test(s) ? "fecha" : /concep|descr|detalle/.test(s) ? "concepto" : /import|monto|amount|valor|total/.test(s) ? "importe" : /categ/.test(s) ? "categoria" : "ignorar";
  });
  return m;
}

export async function revertImportAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  await revertImport(getDb(), workspace.id, str(fd, "id"));
  revalidatePath("/app", "layout");
}

// ---------- Plan y soporte ----------

export async function startTrialAction() {
  const { user, workspace } = await requireWorkspace();
  const sub = workspace.subscription;
  if (sub?.trialEndsAt) redirect("/app/configuracion?tab=plan&prueba=usada");
  await getDb().subscription.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, plan: "PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 14 * 864e5) },
    update: { plan: "PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 14 * 864e5) },
  });
  await audit("plan.trial_started", { userId: user.id, workspaceId: workspace.id });
  redirect(done("/app/configuracion?tab=plan"));
}

export async function supportTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireWorkspace();
  const subject = str(fd, "subject"), body = str(fd, "body");
  if (!subject || !body) return { error: "Contanos el asunto y el detalle." };
  if (body.length > 4000) return { error: "El mensaje es demasiado largo." };
  await getDb().supportTicket.create({ data: { userId: user.id, subject: subject.slice(0, 140), body } });
  revalidatePath("/app/ayuda");
  return { ok: "Recibimos tu consulta. Te respondemos acá mismo." };
}
