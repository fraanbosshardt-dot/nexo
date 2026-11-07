// Carga datos de ejemplo en un espacio LOCAL para revisar pantallas (nunca contra Railway).
// Uso: npx tsx scripts/seed-demo.mts email@de.prueba
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { createAccount, recordMovement } from "../src/server/ledger.ts";
import { createDebt } from "../src/server/debts.ts";
import { saveBudget } from "../src/server/planning.ts";
import { createInvestment, investmentMove } from "../src/server/wealth.ts";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) { console.error("Solo se usa con la base local."); process.exit(1); }
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const email = process.argv[2];
const user = await db.user.findUnique({ where: { email }, include: { memberships: true } });
if (!user) { console.error("No existe", email); process.exit(1); }
const ws = user.memberships[0].workspaceId;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const cats = await db.category.findMany({ where: { workspaceId: ws } });
const cat = (n: string) => cats.find((c) => c.name === n)?.id ?? null;
let bank = await db.account.findFirst({ where: { workspaceId: ws, type: { not: "CREDIT_CARD" } } });
if (!bank) bank = await createAccount(db, ws, { name: "Banco Nación", type: "SAVINGS", currency: "ARS", initialBalance: "850000", initialDate: d("2026-10-01") });
const cash = await createAccount(db, ws, { name: "Efectivo de la billetera", type: "CASH", currency: "ARS", initialBalance: "45000", initialDate: d("2026-10-01") });
const usd = await createAccount(db, ws, { name: "Ahorro en dólares", type: "FOREIGN", currency: "USD", initialBalance: "1200", initialDate: d("2026-10-01") });
const mv = (description: string, amount: string, date: string, c: string | null, kind: "INCOME" | "EXPENSE" = "EXPENSE", status: "PAID" | "PENDING" = "PAID", acc = bank!.id) =>
  recordMovement(db, ws, { kind, description, amount, accountId: acc, categoryId: c, status, effectiveDate: status === "PAID" ? d(date) : undefined, dueDate: status === "PENDING" ? d(date) : undefined });
await mv("Supermercado Coto, compra grande del mes", "128450.75", "2026-11-02", cat("Supermercado"));
await mv("Farmacia", "18900", "2026-11-03", cat("Farmacia"), "EXPENSE", "PAID", cash.id);
await mv("Nafta", "42000", "2026-11-04", cat("Combustible"));
await mv("Luz Edenor", "36500", "2026-11-12", cat("Luz"), "EXPENSE", "PENDING");
await mv("Expensas del departamento de la calle Rivadavia", "185000", "2026-11-10", cat("Expensas"), "EXPENSE", "PENDING");
await mv("Venta de muebles usados", "95000", "2026-11-05", null, "INCOME");
await createDebt(db, ws, { creditor: "Banco Nación · préstamo personal", kind: "Préstamo personal", principal: "1500000", currency: "ARS", system: "FRENCH", installments: 18, tna: "55", startDate: d("2026-09-01"), firstDue: d("2026-10-10") });
const p = "2026-11";
await saveBudget(db, ws, p, "ARS", cats.filter((c) => c.kind === "EXPENSE" && !c.parentId).slice(0, 4).map((c, i) => ({ categoryId: c.id, limit: String(80000 + i * 40000) })));
await db.goal.create({ data: { workspaceId: ws, name: "Vacaciones en la costa", targetAmount: "900000", currency: "ARS", targetDate: d("2027-01-15") } });
const inv = await createInvestment(db, ws, { name: "Plazo fijo 30 días", kind: "Plazo fijo", currency: "ARS" });
await investmentMove(db, ws, { investmentId: inv.id, kind: "CONTRIBUTION", accountId: bank!.id, amount: "300000", date: d("2026-10-20") });
console.log("listo:", { ws, usd: usd.id });
await db.$disconnect();
