// Planes: qué incluye Gratis y qué incluye Pro. El dueño lo cambia desde el panel interno.
import type { Db } from "./ledger";

export type FeatureKey = "flujo5" | "simulador" | "asistente" | "cereal" | "informes" | "compartido" | "ilimitado" | "soporte" | "pdf";

// Por defecto, casi todo es gratis. Pro suma lo avanzado.
export const PRO_FEATURES: { key: FeatureKey; name: string; beta?: boolean }[] = [
  { key: "flujo5", name: "Flujo de caja a 2, 3 y 5 años" },
  { key: "simulador", name: "Simulador de escenarios" },
  { key: "asistente", name: "Asistente con IA", beta: true },
  { key: "cereal", name: "Módulo Agro: ventas de granos" },
  { key: "informes", name: "Informes avanzados y respaldo completo" },
  { key: "compartido", name: "Espacio compartido (hasta 3 personas)", beta: true },
  { key: "ilimitado", name: "Cuentas y objetivos sin límite" },
  { key: "soporte", name: "Soporte prioritario" },
  { key: "pdf", name: "Leer el resumen de la tarjeta desde el PDF (hasta 5 por mes)" },
];
export const FREE_INCLUDES = [
  "Cuentas, movimientos, ingresos, gastos y transferencias",
  "Tarjetas de crédito y compras en cuotas",
  "Deudas y préstamos, con cancelación total",
  "Próximos pagos, calendario y reglas recurrentes",
  "Flujo de caja a 1 año",
  "¿Puedo comprarlo en cuotas?",
  "Presupuestos y objetivos de ahorro",
  "Inversiones, bienes y patrimonio neto",
  "Alertas y consejos",
  "Importar y exportar movimientos en CSV",
  "Verificación en dos pasos",
];
export const PRICES_DEFAULT = { monthly: 5, yearly: 48 };
export const FREE_LIMITS = { accounts: 5, goals: 3 };

// pricesArs: el precio en pesos que se muestra en la web y en la app (si está cargado, reemplaza al de dólares).
type PlanSettings = { freeAlso: FeatureKey[]; prices: { monthly: number; yearly: number }; pricesArs?: { monthly: number; yearly: number } | null };

export async function planSettings(db: Db): Promise<PlanSettings> {
  const s = await db.appSetting.findUnique({ where: { key: "plans" } });
  const v = (s?.value ?? {}) as Partial<PlanSettings>;
  const ars = v.pricesArs && v.pricesArs.monthly > 0 && v.pricesArs.yearly > 0 ? v.pricesArs : null;
  return { freeAlso: Array.isArray(v.freeAlso) ? v.freeAlso : [], prices: { ...PRICES_DEFAULT, ...(v.prices ?? {}) }, pricesArs: ars };
}

// Precio para mostrar: en pesos si está cargado; si no, en dólares.
export function priceLabel(s: Pick<PlanSettings, "prices" | "pricesArs">, cycle: "monthly" | "yearly") {
  if (s.pricesArs) return { text: `$ ${s.pricesArs[cycle].toLocaleString("es-AR")}`, amount: s.pricesArs[cycle], currency: "ARS" };
  return { text: `US$ ${s.prices[cycle].toLocaleString("es-AR")}`, amount: s.prices[cycle], currency: "USD" };
}

export async function savePlanSettings(db: Db, value: PlanSettings) {
  await db.appSetting.upsert({ where: { key: "plans" }, create: { key: "plans", value }, update: { value } });
}

// Plan efectivo: Pro pago, o prueba gratis vigente. Si se canceló o el pago quedó pendiente, Pro sigue hasta el fin
// del período ya pagado.
export function effectivePlan(sub: { plan: string; status: string; trialEndsAt: Date | null; currentPeriodEnd?: Date | null } | null | undefined, now = new Date()): "FREE" | "PRO" {
  if (!sub) return "FREE";
  if (sub.status === "TRIALING") return sub.trialEndsAt && sub.trialEndsAt > now ? "PRO" : "FREE";
  if (sub.plan !== "PRO") return "FREE";
  if (sub.status === "ACTIVE") return "PRO";
  return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? "PRO" : "FREE";
}

// Hasta cuándo cubre un pago: un mes o un año desde que se pagó.
export function paidUntil(paidAt: Date, cycle: string | null | undefined) {
  const d = new Date(paidAt);
  d.setUTCMonth(d.getUTCMonth() + (cycle === "yearly" ? 12 : 1));
  return d;
}

export async function hasFeature(db: Db, plan: "FREE" | "PRO", key: FeatureKey) {
  if (plan === "PRO") return true;
  return (await planSettings(db)).freeAlso.includes(key);
}
