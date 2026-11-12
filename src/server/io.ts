// Informes, exportación e importación de movimientos.
import { createHash } from "node:crypto";
import type { Db } from "./ledger";
import { recordMovement, UserError } from "./ledger";
import { readXlsx, writeXlsx } from "@/lib/xlsx";
import { dec, parseAmount, ZERO } from "@/lib/money";
import { addMonths, fmtDateNum, parseDate, period } from "@/lib/dates";
import type Decimal from "decimal.js";

// ---------- Informes ----------

export async function categoryReport(db: Db, ws: string, currency: string, endPeriod: string, months = 6) {
  const periods = Array.from({ length: months }, (_, i) => addMonths(endPeriod, i - months + 1));
  const [cats, tx] = await Promise.all([
    db.category.findMany({ where: { workspaceId: ws }, select: { id: true, name: true, parentId: true, kind: true } }),
    db.transaction.findMany({ where: { workspaceId: ws, currency, type: { in: ["INCOME", "EXPENSE", "DEBT_PAYMENT"] }, economicPeriod: { in: periods } }, select: { amount: true, direction: true, type: true, categoryId: true, economicPeriod: true } }),
  ]);
  const top = new Map(cats.map((c) => [c.id, c.parentId ? cats.find((p) => p.id === c.parentId)?.name ?? c.name : c.name]));
  const grid = new Map<string, Map<string, Decimal>>();
  const totals = periods.map(() => ({ income: ZERO, expense: ZERO }));
  for (const t of tx) {
    const i = periods.indexOf(t.economicPeriod);
    const v = dec(t.amount);
    if (t.type === "INCOME") { totals[i].income = t.direction === "IN" ? totals[i].income.plus(v) : totals[i].income.minus(v); continue; }
    const signed = t.direction === "OUT" ? v : v.neg();
    totals[i].expense = totals[i].expense.plus(signed);
    const name = t.type === "DEBT_PAYMENT" ? "Deudas" : top.get(t.categoryId ?? "") ?? "Sin categoría";
    if (!grid.has(name)) grid.set(name, new Map());
    const row = grid.get(name)!;
    row.set(t.economicPeriod, (row.get(t.economicPeriod) ?? ZERO).plus(signed));
  }
  const rows = [...grid.entries()].map(([name, m]) => ({ name, values: periods.map((p) => m.get(p) ?? ZERO) })).sort((a, b) => b.values.reduce((s, v) => s.plus(v), ZERO).cmp(a.values.reduce((s, v) => s.plus(v), ZERO)));
  return { periods, rows, totals };
}

// ---------- Exportar ----------

// Un texto que empieza con =, +, @ o - (sin ser un número) Excel lo ejecuta como fórmula: se le antepone un apóstrofo.
export const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  const safe = /^[=+@\t\r]/.test(s) || /^-(?![\d.,]+$)/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

const MOVE_HEAD = ["Fecha", "Concepto", "Tipo", "Corresponde a", "Cuenta", "Categoría", "Moneda", "Importe"];
const TYPE_ES: Record<string, string> = { INCOME: "Ingreso", EXPENSE: "Gasto", TRANSFER: "Transferencia", ADJUSTMENT: "Corrección de saldo", DEBT_PAYMENT: "Cuota de deuda", CARD_PAYMENT: "Pago de tarjeta", INVESTMENT: "Inversión", DEBT_DISBURSEMENT: "Préstamo recibido" };
async function movementList(db: Db, ws: string) {
  return db.transaction.findMany({ where: { workspaceId: ws }, include: { account: true, category: true }, orderBy: { effectiveDate: "asc" } });
}

export async function exportMovementsCsv(db: Db, ws: string) {
  const tx = await movementList(db, ws);
  const lines = tx.map((t) => [fmtDateNum(t.effectiveDate), t.description, t.type, t.economicPeriod, t.account.name, t.category?.name ?? "", t.currency, (t.direction === "IN" ? "" : "-") + dec(t.amount).toFixed(2).replace(".", ",")].map(csvCell).join(";"));
  return "﻿" + [MOVE_HEAD.map(csvCell).join(";"), ...lines].join("\r\n");
}

// Excel de verdad (.xlsx): fechas como fecha y montos como número, listos para sumar o filtrar.
export async function exportMovementsXlsx(db: Db, ws: string) {
  const tx = await movementList(db, ws);
  const rows = tx.map((t) => [t.effectiveDate, t.description, TYPE_ES[t.type] ?? t.type, t.economicPeriod, t.account.name, t.category?.name ?? "", t.currency, (t.direction === "IN" ? 1 : -1) * Number(t.amount)]);
  return writeXlsx("Movimientos", MOVE_HEAD, rows);
}

// ---------- Otros formatos de importación: Excel y OFX ----------
// Se pasan a CSV y siguen el mismo camino (columnas, duplicados y deshacer).

const toCsv = (rows: string[][]) => rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");

export function xlsxToCsv(buf: Buffer) {
  const rows = readXlsx(buf);
  if (rows.length < 2) throw new UserError("La planilla está vacía o solo tiene encabezados.");
  return toCsv(rows);
}

// OFX/QFX (lo exportan muchos bancos): cada <STMTTRN> trae fecha (DTPOSTED), importe (TRNAMT) y concepto (NAME o MEMO).
export function ofxToCsv(text: string) {
  const tag = (block: string, t: string) => block.match(new RegExp(`<${t}>([^<\r\n]*)`, "i"))?.[1]?.trim() ?? "";
  const rows: string[][] = [["Fecha", "Concepto", "Importe"]];
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1];
    const d = tag(b, "DTPOSTED").match(/^(\d{4})(\d{2})(\d{2})/);
    const amount = tag(b, "TRNAMT");
    if (!d || !amount) continue;
    const name = tag(b, "NAME"), memo = tag(b, "MEMO");
    rows.push([`${d[3]}/${d[2]}/${d[1]}`, [name, memo].filter(Boolean).join(" · ") || "Movimiento importado", amount]);
  }
  if (rows.length < 2) throw new UserError("No encontramos movimientos en el archivo OFX.");
  return toCsv(rows);
}

export async function exportBackup(db: Db, ws: string) {
  const [workspace, accounts, categories, transactions, obligations, rules, debts, cards, budgets, goals, investments, assets, grain] = await Promise.all([
    db.workspace.findUnique({ where: { id: ws } }),
    db.account.findMany({ where: { workspaceId: ws } }),
    db.category.findMany({ where: { workspaceId: ws } }),
    db.transaction.findMany({ where: { workspaceId: ws } }),
    db.obligation.findMany({ where: { workspaceId: ws } }),
    db.recurringRule.findMany({ where: { workspaceId: ws } }),
    db.debt.findMany({ where: { workspaceId: ws }, include: { schedule: true } }),
    db.creditCard.findMany({ where: { workspaceId: ws }, include: { statements: true, plans: true } }),
    db.budget.findMany({ where: { workspaceId: ws }, include: { lines: true } }),
    db.goal.findMany({ where: { workspaceId: ws }, include: { contributions: true } }),
    db.investment.findMany({ where: { workspaceId: ws }, include: { movements: true, valuations: true } }),
    db.asset.findMany({ where: { workspaceId: ws }, include: { valuations: true } }),
    db.grainSale.findMany({ where: { workspaceId: ws } }),
  ]);
  return JSON.stringify({ app: "Guafra", version: 1, exportedAt: new Date().toISOString(), workspace, accounts, categories, transactions, obligations, rules, debts, cards, budgets, goals, investments, assets, grain }, null, 2);
}

// ---------- Importar CSV ----------

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, "").replace(/\r/g, "");
  const first = clean.split("\n")[0] ?? "";
  const delim = [";", "\t", ","].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n") { row.push(cell.trim()); if (row.some((c) => c)) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return { headers: rows[0] ?? [], rows: rows.slice(1) };
}

// Reconoce las columnas de bancos, planillas y el extracto de Mercado Pago (DATE, DESCRIPTION, NET_CREDIT_AMOUNT,
// NET_DEBIT_AMOUNT, TRANSACTION_NET_AMOUNT…). El saldo de cada fila se ignora.
export type ColumnKind = "fecha" | "concepto" | "importe" | "credito" | "debito" | "categoria" | "ignorar";
export function guessColumn(h: string): ColumnKind {
  const s = h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/saldo|balance/.test(s)) return "ignorar";
  if (/fech|date/.test(s)) return "fecha";
  if (/net_credit|credito|entrada/.test(s)) return "credito";
  if (/net_debit|debito|salida/.test(s)) return "debito";
  if (/concep|descr|detalle|memo|transaction_type|tipo de operacion/.test(s)) return "concepto";
  if (/import|monto|amount|valor|total/.test(s)) return "importe";
  if (/categ/.test(s)) return "categoria";
  return "ignorar";
}

export function autoMap(text: string): Record<number, ColumnKind> {
  const { headers } = parseCsv(text);
  return Object.fromEntries(headers.map((h, i) => [i, guessColumn(h)]));
}

export type ImportPreview = { ok: { date: Date; description: string; amount: Decimal; category: string; key: string }[]; errors: { line: number; reason: string }[]; duplicates: number };

export async function previewImport(db: Db, ws: string, accountId: string, text: string, map: Record<number, string>): Promise<ImportPreview> {
  const { rows } = parseCsv(text);
  const col = (k: string) => Number(Object.entries(map).find(([, v]) => v === k)?.[0] ?? -1);
  const [cf, cc, ci, ck, cin, cout] = [col("fecha"), col("concepto"), col("importe"), col("categoria"), col("credito"), col("debito")];
  // Entradas y salidas en columnas separadas (como Mercado Pago): el importe es entrada menos salida.
  const split = cin >= 0 || cout >= 0;
  if (cf < 0 || (ci < 0 && !split)) throw new UserError("Indicá qué columna es la fecha y cuál el importe.");
  const ok: ImportPreview["ok"] = [], errors: ImportPreview["errors"] = [];
  rows.forEach((r, i) => {
    const date = parseDate(r[cf]);
    const amount = split ? (parseAmount(r[cin] || "0") ?? ZERO).minus(parseAmount(r[cout] || "0") ?? ZERO) : parseAmount(r[ci]);
    if (!date) return errors.push({ line: i + 2, reason: "Fecha inválida (dd/mm/aaaa)" });
    if (amount?.isZero()) return; // filas sin movimiento (saldo inicial, totales)
    if (!amount) return errors.push({ line: i + 2, reason: "Importe inválido" });
    const description = (cc >= 0 ? r[cc] : "") || "Movimiento importado";
    const key = "imp:" + createHash("sha256").update(`${accountId}|${date.toISOString()}|${amount.toFixed(2)}|${description}`).digest("hex").slice(0, 32);
    ok.push({ date, description, amount, category: ck >= 0 ? r[ck] ?? "" : "", key });
  });
  const existing = await db.transaction.findMany({ where: { workspaceId: ws, idempotencyKey: { in: ok.map((o) => o.key) } }, select: { idempotencyKey: true } });
  const dup = new Set(existing.map((e) => e.idempotencyKey));
  return { ok: ok.filter((o) => !dup.has(o.key)), errors, duplicates: dup.size };
}

export async function applyImport(db: Db, ws: string, accountId: string, fileName: string, preview: ImportPreview, userId?: string) {
  if (!preview.ok.length) throw new UserError("No hay movimientos nuevos para importar.");
  const cats = await db.category.findMany({ where: { workspaceId: ws } });
  const batch = await db.importBatch.create({ data: { workspaceId: ws, source: "csv", fileName, rows: preview.ok.length } });
  for (const r of preview.ok) {
    const kind = r.amount.gt(0) ? "INCOME" : "EXPENSE";
    const cat = cats.find((c) => c.kind === kind && c.name.toLowerCase() === r.category.toLowerCase());
    await recordMovement(db, ws, { kind, description: r.description, amount: r.amount.abs(), accountId, categoryId: cat?.id ?? null, status: "PAID", effectiveDate: r.date, economicPeriod: period(r.date), idempotencyKey: r.key, notes: `import:${batch.id}`, userId });
  }
  return batch;
}

// Revertir una importación completa sin tocar el resto.
export async function revertImport(db: Db, ws: string, batchId: string) {
  const b = await db.importBatch.findFirst({ where: { id: batchId, workspaceId: ws } });
  if (!b) throw new UserError("No encontramos esa importación.");
  if (b.status === "REVERTED") throw new UserError("Ya fue revertida.");
  await db.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { workspaceId: ws, notes: `import:${b.id}` } });
    await tx.importBatch.update({ where: { id: b.id }, data: { status: "REVERTED" } });
  });
}
