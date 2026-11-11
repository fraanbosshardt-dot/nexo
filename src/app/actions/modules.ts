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
import { applyImport, autoMap, previewImport, revertImport } from "@/server/io";
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
    const day = int(fd, "dayOfMonth");
    if (day !== null && !(day >= 1 && day <= 31)) throw new UserError("El día del mes va del 1 al 31.");
    await changeRuleFrom(getDb(), workspace.id, str(fd, "id"), date(fd, "from", "desde cuándo"), { amount: money(fd, "amount", "el importe nuevo"), ...(day !== null ? { dayOfMonth: day } : {}) });
    await refreshRules(workspace.id, workspace.timezone);
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: "Listo: cambia desde esa fecha. Lo anterior quedó igual." };
}

export async function saveRuleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  try {
    const db = getDb();
    const r = await db.recurringRule.findFirst({ where: { id: str(fd, "id"), workspaceId: workspace.id } });
    if (!r) throw new UserError("No encontramos ese pago que se repite.");
    const amount = money(fd, "amount", "el importe");
    if (!amount.gt(0)) throw new UserError("El importe tiene que ser mayor a cero.");
    const day = int(fd, "dayOfMonth");
    if (day !== null && !(day >= 1 && day <= 31)) throw new UserError("El día del mes va del 1 al 31.");
    const rawEnd = str(fd, "endDate");
    const endDate = rawEnd ? date(fd, "endDate", "la fecha hasta") : null;
    const oldDay = r.dayOfMonth ?? r.startDate.getUTCDate();
    const amountChanged = !amount.eq(r.amount.toString());
    const dayChanged = day !== null && day !== oldDay;
    const endChanged = (endDate?.getTime() ?? null) !== (r.endDate?.getTime() ?? null);
    if (!amountChanged && !dayChanged && !endChanged) return { ok: "No había nada para cambiar." };
    let ruleId = r.id;
    if (amountChanged || dayChanged) {
      const next = await changeRuleFrom(db, workspace.id, r.id, date(fd, "from", "desde cuándo"), { amount, ...(dayChanged ? { dayOfMonth: day } : {}) });
      ruleId = next.id;
    }
    if (endChanged) {
      const { setRuleEnd } = await import("@/server/recurring");
      await setRuleEnd(db, workspace.id, ruleId, endDate);
    }
    await refreshRules(workspace.id, workspace.timezone);
    await audit("rule.saved", { userId: user.id, workspaceId: workspace.id, entityId: ruleId, meta: { amountChanged, dayChanged, endChanged } });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/recurrentes?guardada=1");
}

export async function setRuleEndAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace } = await requireWorkspace();
  try {
    const { setRuleEnd } = await import("@/server/recurring");
    const raw = str(fd, "endDate");
    await setRuleEnd(getDb(), workspace.id, str(fd, "id"), raw ? date(fd, "endDate", "la fecha hasta") : null);
    await refreshRules(workspace.id, workspace.timezone);
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  return { ok: str(fd, "endDate") ? "Listo: se repite hasta esa fecha." : "Listo: se repite sin fecha de fin." };
}

export async function deleteRuleAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  const { deleteRule } = await import("@/server/recurring");
  const r = await deleteRule(getDb(), workspace.id, str(fd, "id"));
  await audit("rule.deleted", { userId: user.id, workspaceId: workspace.id, entityId: str(fd, "id"), meta: r });
  revalidatePath("/app", "layout");
  redirect("/app/recurrentes?borrada=1");
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
  redirect("/app/recurrentes?terminada=1");
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

// Lee el formulario de una venta (el mismo para cargar y para editar).
function grainForm(fd: FormData, baseCurrency: string, userId: string) {
  const qty = money(fd, "quantity", "la cantidad");
  const tonnes = fd.get("unit") === "qq" ? qty.dividedBy(10) : qty;
  return {
    saleDate: date(fd, "saleDate", "la fecha de venta"), grain: str(fd, "grain") || "Soja", tonnes, pricePerTonne: money(fd, "price", "el precio por tonelada"),
    priceCurrency: isCurrency(str(fd, "priceCurrency")) ? str(fd, "priceCurrency") : baseCurrency, fxRate: optMoney(fd, "fxRate", "la cotización"),
    taxPct: optMoney(fd, "taxPct", "el impuesto") ?? "1.2", otherDeductions: optMoney(fd, "other", "otros descuentos") ?? "0",
    collectDate: date(fd, "collectDate", "la fecha de cobro"), accountId: str(fd, "accountId"), collected: fd.get("collected") === "on", userId,
  };
}

export async function grainSaleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    await createGrainSale(getDb(), workspace.id, { ...grainForm(fd, workspace.baseCurrency, user.id), replacePlanned: fd.get("replacePlanned") === "on" });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect(done("/app/cereal"));
}

export async function updateGrainSaleAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireWorkspace();
  const id = str(fd, "id");
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    const { updateGrainSale } = await import("@/server/grain");
    await updateGrainSale(getDb(), workspace.id, id, grainForm(fd, workspace.baseCurrency, user.id));
    await audit("grain.updated", { userId: user.id, workspaceId: workspace.id, entity: "grainSale", entityId: id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/cereal?listo=editada");
}

export async function deleteGrainSaleAction(fd: FormData) {
  const { user, workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) redirect("/app/cereal");
  const id = str(fd, "id");
  const { deleteGrainSale } = await import("@/server/grain");
  const r = await deleteGrainSale(getDb(), workspace.id, id, user.id);
  await audit("grain.deleted", { userId: user.id, workspaceId: workspace.id, entity: "grainSale", entityId: id, meta: { reversed: r.reversed.toFixed(2) } });
  revalidatePath("/app", "layout");
  redirect(`/app/cereal?listo=${r.reversed.gt(0) ? "borrada-cobrada" : "borrada"}`);
}

export async function changeMonthlyGrainAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    const { changeMonthlyGrain } = await import("@/server/grain");
    await changeMonthlyGrain(getDb(), workspace.id, str(fd, "ruleId"), { day: int(fd, "day") ?? 0, amount: money(fd, "amount", "el monto aproximado"), accountId: str(fd, "accountId"), today: todayIn(workspace.timezone) });
    await refreshRules(workspace.id, workspace.timezone);
    await audit("grain.monthly_changed", { userId: user.id, workspaceId: workspace.id });
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/cereal?listo=mensual-cambiada");
}

export async function stopMonthlyGrainAction(fd: FormData) {
  const { user, workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) redirect("/app/cereal");
  const { stopMonthlyGrain } = await import("@/server/grain");
  await stopMonthlyGrain(getDb(), workspace.id, str(fd, "ruleId"), todayIn(workspace.timezone));
  await audit("grain.monthly_stopped", { userId: user.id, workspaceId: workspace.id });
  revalidatePath("/app", "layout");
  redirect("/app/cereal?listo=mensual-terminada");
}

// Stock de cereal sin vender (suma al patrimonio).
export async function grainStockAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    const { setGrainStock } = await import("@/server/grain");
    const qty = money(fd, "quantity", "la cantidad");
    const tonnes = fd.get("unit") === "t" ? qty : qty.dividedBy(10);
    await setGrainStock(getDb(), workspace.id, { grain: str(fd, "grain"), tonnes, pricePerTonne: money(fd, "price", "el precio por tonelada"), currency: workspace.baseCurrency });
  } catch (e) { return fail(e); }
  revalidatePath("/app/cereal");
  return { ok: "Stock guardado. Ya suma en tu patrimonio." };
}

export async function deleteGrainStockAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  const { deleteGrainStock } = await import("@/server/grain");
  await deleteGrainStock(getDb(), workspace.id, str(fd, "id"));
  revalidatePath("/app/cereal");
}

// Venta mensual estimada: un cobro que se repite todos los meses, con monto aproximado.
export async function monthlyGrainAction(_: FormState, fd: FormData): Promise<FormState> {
  const { workspace, plan } = await requireWorkspace();
  try {
    if (!(await canUse(plan, "cereal"))) throw new UserError("El módulo Agro es parte de Pro.");
    const { setupMonthlyGrain } = await import("@/server/grain");
    await setupMonthlyGrain(getDb(), workspace.id, { day: int(fd, "day") ?? 0, amount: money(fd, "amount", "el monto aproximado"), accountId: str(fd, "accountId"), today: todayIn(workspace.timezone) });
    await refreshRules(workspace.id, workspace.timezone);
  } catch (e) { return fail(e); }
  revalidatePath("/app", "layout");
  redirect("/app/cereal?mensual=1");
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
  const { user, plan } = await requireWorkspace();
  const subject = str(fd, "subject"), body = str(fd, "body");
  if (!subject || !body) return { error: "Contanos el asunto y el detalle." };
  if (body.length > 4000) return { error: "El mensaje es demasiado largo." };
  // Soporte prioritario: las consultas de Pro entran con prioridad alta.
  await getDb().supportTicket.create({ data: { userId: user.id, subject: subject.slice(0, 140), body, priority: plan === "PRO" ? "HIGH" : "NORMAL" } });
  revalidatePath("/app/ayuda");
  return { ok: "Recibimos tu consulta. Te respondemos acá mismo." };
}

// ---------- Cobro de Pro ----------

export async function checkoutAction(fd: FormData) {
  const { user, workspace } = await requireWorkspace();
  const { startCheckout } = await import("@/server/billing");
  const { appUrl } = await import("@/lib/email");
  const cycle = fd.get("cycle") === "yearly" ? "yearly" : "monthly";
  const rawCoupon = String(fd.get("coupon") ?? "").trim();
  let discount: { code: string; percentOff: number } | undefined;
  if (rawCoupon) {
    const { checkCoupon } = await import("@/server/admin-accounts");
    const c = await checkCoupon(getDb(), rawCoupon);
    if (!c.ok) redirect(`/app/configuracion?tab=plan&cupon=${encodeURIComponent(c.error)}`);
    discount = { code: c.coupon.code, percentOff: c.coupon.percentOff };
  }
  const link = await startCheckout(getDb(), workspace.id, user.email, cycle, `${appUrl()}/app/configuracion?tab=plan&pago=1`, discount);
  await audit("billing.checkout_started", { userId: user.id, workspaceId: workspace.id, meta: { cycle, coupon: discount?.code } });
  redirect(link);
}

export async function cancelPlanAction() {
  const { user, workspace } = await requireWorkspace();
  const { cancelSubscription } = await import("@/server/billing");
  await cancelSubscription(getDb(), workspace.id);
  await audit("billing.canceled", { userId: user.id, workspaceId: workspace.id });
  redirect(done("/app/configuracion?tab=plan&cancelado=1"));
}

// ---------- Resumen de la tarjeta ----------

export async function loadStatementAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, workspace } = await requireWorkspace();
  const cardId = str(fd, "cardId");
  try {
    const names = fd.getAll("carryDescription").map(String), amounts = fd.getAll("carryAmount").map(String), lefts = fd.getAll("carryRemaining").map(String);
    const carry = names.map((d, i) => {
      const raw = (amounts[i] ?? "").trim();
      if (!d.trim() && !raw) return null; // fila vacía
      const amount = parseAmount(raw);
      if (!amount) throw new UserError(`Revisá el importe de la cuota de "${d || "una compra"}": tiene que ser un número.`);
      return { description: d, amount, remaining: Number(lefts[i]) };
    }).filter((c): c is NonNullable<typeof c> => !!c);
    const { loadStatement } = await import("@/server/cards");
    await loadStatement(getDb(), workspace.id, {
      cardId, closingDate: date(fd, "closingDate", "la fecha de cierre"), dueDate: date(fd, "dueDate", "el vencimiento"),
      total: money(fd, "total", "el total a pagar"), minimum: optMoney(fd, "minimum", "el pago mínimo"), carry, userId: user.id,
    });
    await audit("card.statement_loaded", { userId: user.id, workspaceId: workspace.id, entity: "card", entityId: cardId, meta: { source: str(fd, "source") || "manual" } });
  } catch (e) { return fail(e); }
  redirect(done(`/app/tarjetas/${cardId}?guardado=1`));
}

// Lee el PDF del resumen (solo Pro, hasta PDF_MONTHLY_LIMIT por mes). No guarda el archivo ni el resultado:
// devuelve los datos para completar el formulario, que la persona revisa antes de guardar.
export async function readStatementPdfAction(fd: FormData): Promise<{ error?: string; data?: import("@/server/statement-pdf").ParsedStatement; left?: number }> {
  const { user, workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "pdf"))) return { error: "Leer el PDF es una función Pro. Podés cargar el resumen a mano." };
  const { pdfMonthlyLimit } = await import("@/server/settings");
  const limit = await pdfMonthlyLimit(getDb());
  const now = new Date();
  const used = await getDb().auditLog.count({ where: { workspaceId: workspace.id, action: "card.pdf_read", createdAt: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } } });
  if (used >= limit) return { error: `Ya leíste ${limit} resúmenes este mes. Cargá este a mano o esperá al mes que viene.` };
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Elegí el PDF del resumen." };
  try {
    const { readStatementPdf } = await import("@/server/statement-pdf");
    const data = await readStatementPdf(new Uint8Array(await file.arrayBuffer()));
    await audit("card.pdf_read", { userId: user.id, workspaceId: workspace.id, meta: { found: data.found } });
    return { data, left: limit - used - 1 };
  } catch (e) {
    const r = fail(e);
    return { error: r?.error ?? "No pudimos leer ese PDF." };
  }
}

// Proyectados (pagos que se repiten más adelante): pagar por adelantado o cancelar solo esa vez.
export async function projectedAction(fd: FormData) {
  const { workspace } = await requireWorkspace();
  const { materializeOccurrence } = await import("@/server/recurring");
  const { cancelObligation } = await import("@/server/ledger");
  const occ = new Date(`${str(fd, "occurrence")}T00:00:00Z`);
  if (Number.isNaN(occ.getTime())) redirect("/app/proximos");
  const id = await materializeOccurrence(getDb(), workspace.id, str(fd, "ruleId"), occ);
  if (str(fd, "do") === "cancelar") {
    await cancelObligation(getDb(), workspace.id, id);
    revalidatePath("/app", "layout");
    const back = str(fd, "back");
    redirect(/^\/app(\/|\?|$)/.test(back) ? back : "/app/proximos");
  }
  redirect(`/app/proximos/${id}`);
}
