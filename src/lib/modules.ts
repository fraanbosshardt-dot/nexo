// Funciones que cada espacio puede prender o apagar, y qué incluye cada plan.
export type ModuleKey =
  | "tipos" | "tarjetas" | "deudas" | "calendario" | "flujo" | "presupuestos" | "objetivos" | "simulador"
  | "inversiones" | "activos" | "informes" | "alertas" | "reglas" | "cereal";

export const MODULES: { key: ModuleKey; name: string; description: string; default: boolean; pro?: boolean }[] = [
  { key: "tipos", name: "Pestañas de ingresos, gastos y transferencias", description: "Dentro de Movimientos, una pestaña para cada tipo.", default: true },
  { key: "tarjetas", name: "Tarjetas de crédito", description: "Resúmenes, pago mínimo y compras en cuotas.", default: true },
  { key: "deudas", name: "Deudas y préstamos", description: "Cronogramas, cancelación anticipada y orden de pago.", default: true },
  { key: "calendario", name: "Calendario", description: "Vista mensual de cobros y pagos.", default: true },
  { key: "flujo", name: "Flujo de caja", description: "Cuánto vas a tener mes a mes.", default: true },
  { key: "presupuestos", name: "Presupuestos", description: "Límites de gasto por categoría.", default: true },
  { key: "objetivos", name: "Objetivos de ahorro", description: "Metas con el aporte mensual que necesitás.", default: true },
  { key: "simulador", name: "Simulador", description: "¿Puedo comprarlo en cuotas? y escenarios (Pro), sin tocar tus datos.", default: true },
  { key: "inversiones", name: "Inversiones y patrimonio", description: "Cartera, rendimientos y patrimonio neto.", default: true },
  { key: "activos", name: "Bienes", description: "Inmuebles, vehículos y otros bienes, dentro de Patrimonio.", default: false },
  { key: "informes", name: "Informes y estadísticas", description: "Reportes y comparativos.", default: false, pro: true },
  { key: "alertas", name: "Alertas y consejos", description: "Avisos de vencimientos, meses en rojo y deudas caras.", default: true },
  { key: "reglas", name: "Reglas recurrentes", description: "Sueldos, servicios y cuotas que se repiten solos.", default: true },
  { key: "cereal", name: "Agro: ventas de granos", description: "Quintales, precio por tonelada e impuesto al cheque.", default: false, pro: true },
];

export type ModuleState = Record<ModuleKey, boolean>;

export function defaultModules(): ModuleState {
  return Object.fromEntries(MODULES.map((m) => [m.key, m.default])) as ModuleState;
}

export function readModules(json: unknown): ModuleState {
  const base = defaultModules();
  if (json && typeof json === "object") {
    for (const m of MODULES) {
      const v = (json as Record<string, unknown>)[m.key];
      if (typeof v === "boolean") base[m.key] = v;
    }
  }
  return base;
}

// Para qué usa la app cada persona → qué funciones conviene prender.
export const USES: { key: string; title: string; description: string; modules: ModuleKey[] }[] = [
  { key: "dia", title: "Ordenar los gastos del día a día", description: "Saber en qué se va la plata.", modules: ["presupuestos", "calendario"] },
  { key: "deudas", title: "Pagar tarjetas y deudas", description: "Cuotas, vencimientos y cancelaciones.", modules: ["tarjetas", "deudas", "calendario"] },
  { key: "ahorro", title: "Ahorrar para algo", description: "Metas con el aporte mensual que necesitás.", modules: ["objetivos"] },
  { key: "futuro", title: "Saber cuánto voy a tener", description: "Flujo de caja y simulador.", modules: ["flujo", "simulador"] },
  { key: "invertir", title: "Seguir mis inversiones", description: "Cartera, rendimientos y patrimonio.", modules: ["inversiones", "activos"] },
  { key: "agro", title: "Soy productor agropecuario", description: "Ventas de granos con impuesto al cheque.", modules: ["cereal", "flujo"] },
  { key: "indep", title: "Trabajo por mi cuenta", description: "Cobros que varían mes a mes.", modules: ["flujo", "informes"] },
];

export function modulesForUses(uses: string[]): ModuleState {
  const m = Object.fromEntries(MODULES.map((x) => [x.key, false])) as ModuleState;
  m.alertas = m.reglas = m.tipos = m.flujo = true;
  for (const u of uses) USES.find((x) => x.key === u)?.modules.forEach((k) => (m[k] = true));
  return m;
}

export const PRICE_USD = { monthly: 5, yearly: 48 };

export const PLAN_FEATURES: { name: string; plan: "free" | "pro" }[] = [
  { name: "Cuentas, movimientos, ingresos y gastos", plan: "free" },
  { name: "Tarjetas, cuotas y deudas", plan: "free" },
  { name: "Próximos pagos y calendario", plan: "free" },
  { name: "Presupuestos y objetivos de ahorro", plan: "free" },
  { name: "Flujo de caja a 1 año", plan: "free" },
  { name: "Alertas y consejos", plan: "free" },
  { name: "Inversiones y patrimonio", plan: "free" },
  { name: "Cotización del dólar en vivo", plan: "free" },
  { name: "Importar y exportar CSV", plan: "free" },
  { name: "Verificación en dos pasos", plan: "free" },
  { name: "Flujo de caja a 5 años y saldo día a día", plan: "pro" },
  { name: "Simulador de escenarios", plan: "pro" },
  { name: "Asistente con IA", plan: "pro" },
  { name: "Módulo Agro: ventas de granos", plan: "pro" },
  { name: "Informes avanzados y exportación a Excel y PDF", plan: "pro" },
  { name: "Importar Excel, OFX y bases de datos", plan: "pro" },
  { name: "Espacio compartido (hasta 3 personas)", plan: "pro" },
  { name: "Cuentas y objetivos sin límite", plan: "pro" },
  { name: "Soporte prioritario", plan: "pro" },
];

export const FREE_LIMITS = { accounts: 5, goals: 3 };
