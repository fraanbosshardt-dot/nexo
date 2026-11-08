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

type PlanSettings = { freeAlso: FeatureKey[]; prices: { monthly: number; yearly: number } };

export async function planSettings(db: Db): Promise<PlanSettings> {
  const s = await db.appSetting.findUnique({ where: { key: "plans" } });
  const v = (s?.value ?? {}) as Partial<PlanSettings>;
  return { freeAlso: Array.isArray(v.freeAlso) ? v.freeAlso : [], prices: { ...PRICES_DEFAULT, ...(v.prices ?? {}) } };
}

export async function savePlanSettings(db: Db, value: PlanSettings) {
  await db.appSetting.upsert({ where: { key: "plans" }, create: { key: "plans", value }, update: { value } });
}

// Plan efectivo: Pro pago, o prueba gratis vigente.
export function effectivePlan(sub: { plan: string; status: string; trialEndsAt: Date | null } | null | undefined): "FREE" | "PRO" {
  if (!sub) return "FREE";
  if (sub.status === "TRIALING") return sub.trialEndsAt && sub.trialEndsAt > new Date() ? "PRO" : "FREE";
  return sub.plan === "PRO" && sub.status === "ACTIVE" ? "PRO" : "FREE";
}

export async function hasFeature(db: Db, plan: "FREE" | "PRO", key: FeatureKey) {
  if (plan === "PRO") return true;
  return (await planSettings(db)).freeAlso.includes(key);
}
