// Cotizaciones automáticas desde una fuente pública y gratuita (open.er-api.com, sin clave).
// Se guardan como "1 USD = X moneda" y las cruzadas se calculan al leer. La cotización manual siempre gana.
import type { Db } from "./ledger";
import { CURRENCIES } from "@/lib/countries";

const SOURCE = "open.er-api.com";
const STALE_MS = 12 * 60 * 60 * 1000;

export async function refreshRates(db: Db): Promise<number> {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!r.ok) return 0;
  const body = (await r.json()) as { result?: string; rates?: Record<string, number> };
  if (body.result !== "success" || !body.rates) return 0;
  const now = new Date();
  const wanted = new Set(CURRENCIES.map((c) => c.code));
  const rows = Object.entries(body.rates).filter(([code, v]) => wanted.has(code) && code !== "USD" && v > 0)
    .map(([code, v]) => ({ workspaceId: null, base: "USD", quote: code, kind: "api", sell: v.toFixed(6), source: SOURCE, fetchedAt: now }));
  if (!rows.length) return 0;
  await db.exchangeRate.createMany({ data: rows });
  // Se guarda solo una semana de historial automático.
  await db.exchangeRate.deleteMany({ where: { source: SOURCE, fetchedAt: { lt: new Date(now.getTime() - 7 * 864e5) } } });
  return rows.length;
}

// Actualiza si lo último tiene más de 12 horas. Si la fuente no responde, sigue con lo que hay.
export async function ensureFreshRates(db: Db) {
  const last = await db.exchangeRate.findFirst({ where: { source: SOURCE }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } });
  if (last && Date.now() - last.fetchedAt.getTime() < STALE_MS) return;
  try { await refreshRates(db); } catch { /* sin conexión: se usan las guardadas o las manuales */ }
}
