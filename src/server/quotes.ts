// Cotizaciones automáticas de inversiones, de fuentes públicas y gratuitas (sin claves):
// - data912.com: mercado argentino (acciones, CEDEARs, bonos, ON, letras). Los bonos cotizan cada 100 nominales.
// - Yahoo Finance: acciones y ETF del exterior.
// - CoinGecko: criptomonedas.
// Los FCI no tienen fuente abierta: se carga el valor de la cuotaparte a mano.
// Si una fuente no responde, se usa el último precio guardado. Nunca se inventa un precio.
import type { Db } from "./ledger";
import { UserError } from "./ledger";

export type AssetClass = "AR_STOCK" | "CEDEAR" | "BOND" | "ON" | "LETRA" | "US_STOCK" | "CRYPTO" | "FCI";
export const ASSET_CLASSES: { key: AssetClass; label: string; hint: string; unit: string }[] = [
  { key: "AR_STOCK", label: "Acción argentina", hint: "Ej.: GGAL, YPFD, PAMP", unit: "acciones" },
  { key: "CEDEAR", label: "CEDEAR", hint: "Ej.: AAPL, SPY, MELI (agregá D si es en dólares: AAPLD)", unit: "CEDEARs" },
  { key: "BOND", label: "Bono", hint: "Ej.: AL30, GD30 (en pesos) o AL30D (en dólares)", unit: "nominales" },
  { key: "ON", label: "Obligación negociable", hint: "Ej.: YCA6O (pesos) o YCA6D (dólares)", unit: "nominales" },
  { key: "LETRA", label: "Letra o LECAP", hint: "Ej.: S30J6", unit: "nominales" },
  { key: "US_STOCK", label: "Acción o ETF del exterior", hint: "Ej.: AAPL, MSFT, SPY", unit: "acciones" },
  { key: "CRYPTO", label: "Criptomoneda", hint: "Ej.: BTC, ETH, USDT", unit: "unidades" },
  { key: "FCI", label: "Fondo común (FCI)", hint: "El nombre del fondo", unit: "cuotapartes" },
];
const D912: Partial<Record<AssetClass, string>> = { AR_STOCK: "arg_stocks", CEDEAR: "arg_cedears", BOND: "arg_bonds", ON: "arg_corp", LETRA: "arg_notes" };
export const per100 = (c: string | null | undefined) => c === "BOND" || c === "ON" || c === "LETRA";
export const sourceOf = (c: string | null | undefined) => (c && D912[c as AssetClass] ? "data912" : c === "US_STOCK" ? "yahoo" : c === "CRYPTO" ? "coingecko" : null);
// En data912 los que terminan en D (dólar MEP) o C (cable) cotizan en dólares; el resto en pesos.
export const currencyFor = (c: string, ticker: string) => (c === "US_STOCK" || c === "CRYPTO" ? "USD" : D912[c as AssetClass] && /[DC]$/.test(ticker) && c !== "AR_STOCK" ? "USD" : c === "FCI" ? null : "ARS");

const STALE = 15 * 60_000;
const UA = { "User-Agent": "Finan/1.0" };
const get = async (url: string) => {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

async function save(db: Db, source: string, symbol: string, price: number, currency: string, changePct: number | null) {
  if (!(price > 0)) return;
  await db.quote.upsert({ where: { source_symbol: { source, symbol } }, create: { source, symbol, price: price.toFixed(8), currency, changePct: changePct != null ? changePct.toFixed(4) : null, fetchedAt: new Date() }, update: { price: price.toFixed(8), currency, changePct: changePct != null ? changePct.toFixed(4) : null, fetchedAt: new Date() } });
}

// Una lista de data912 trae todas las especies de ese tipo de una vez.
async function fetchD912(db: Db, list: string) {
  const rows = (await get(`https://data912.com/live/${list}`)) as { symbol: string; c: number; px_bid?: number; px_ask?: number; pct_change?: number }[];
  const now = new Date();
  const data = rows.map((r) => {
    const price = r.c > 0 ? r.c : r.px_bid && r.px_ask ? (r.px_bid + r.px_ask) / 2 : 0;
    const usd = list !== "arg_stocks" && /[DC]$/.test(r.symbol);
    return { source: "data912", symbol: `${list}:${r.symbol}`, price: price.toFixed(8), currency: usd ? "USD" : "ARS", changePct: r.pct_change != null ? Number(r.pct_change).toFixed(4) : null, fetchedAt: now };
  }).filter((r) => Number(r.price) > 0);
  if (!data.length) return 0;
  // Se reemplaza la lista entera de una vez (rápido y sin duplicados).
  await db.$transaction([db.quote.deleteMany({ where: { source: "data912", symbol: { startsWith: `${list}:` } } }), db.quote.createMany({ data, skipDuplicates: true })]);
  return data.length;
}
async function fetchYahoo(db: Db, ticker: string) {
  const j = (await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`)) as { chart?: { result?: { meta: { regularMarketPrice: number; currency: string; regularMarketChangePercent?: number } }[] } };
  const m = j.chart?.result?.[0]?.meta;
  if (!m) return false;
  await save(db, "yahoo", ticker, m.regularMarketPrice, (m.currency || "USD").toUpperCase(), m.regularMarketChangePercent ?? null);
  return true;
}
async function fetchCoins(db: Db, ids: string[]) {
  if (!ids.length) return;
  const j = (await get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`)) as Record<string, { usd: number; usd_24h_change?: number }>;
  for (const id of ids) if (j[id]) await save(db, "coingecko", id, j[id].usd, "USD", j[id].usd_24h_change ?? null);
}

// Clave con la que se guarda cada especie.
export const quoteKey = (inv: { assetClass: string | null; ticker: string | null; quoteId: string | null }) => {
  const src = sourceOf(inv.assetClass);
  if (!src || !inv.ticker) return null;
  if (src === "data912") return { source: src, symbol: `${D912[inv.assetClass as AssetClass]}:${inv.ticker}` };
  if (src === "coingecko") return inv.quoteId ? { source: src, symbol: inv.quoteId } : null;
  return { source: src, symbol: inv.ticker };
};

// Actualiza lo que haga falta (como mucho cada 15 minutos). Si algo falla, se sigue con lo guardado.
export async function refreshQuotes(db: Db, invs: { assetClass: string | null; ticker: string | null; quoteId: string | null }[]) {
  const keys = invs.map(quoteKey).filter((k): k is { source: string; symbol: string } => !!k);
  if (!keys.length) return;
  const have = await db.quote.findMany({ where: { OR: keys.map((k) => ({ source: k.source, symbol: k.symbol })) } });
  const fresh = (k: { source: string; symbol: string }) => have.some((q) => q.source === k.source && q.symbol === k.symbol && Date.now() - q.fetchedAt.getTime() < STALE);
  const stale = keys.filter((k) => !fresh(k));
  const lists = [...new Set(stale.filter((k) => k.source === "data912").map((k) => k.symbol.split(":")[0]))];
  const jobs: Promise<unknown>[] = [
    ...lists.map((l) => fetchD912(db, l)),
    ...[...new Set(stale.filter((k) => k.source === "yahoo").map((k) => k.symbol))].map((t) => fetchYahoo(db, t)),
    fetchCoins(db, [...new Set(stale.filter((k) => k.source === "coingecko").map((k) => k.symbol))]),
  ];
  await Promise.allSettled(jobs);
}

// Al cargar una especie: confirma que existe en su fuente y devuelve moneda y precio actual.
export async function lookupTicker(db: Db, assetClass: AssetClass, raw: string): Promise<{ ticker: string; quoteId: string | null; currency: string; price: number | null }> {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) throw new UserError("Poné la especie (ej.: AL30, GGAL, AAPL, BTC).");
  const src = sourceOf(assetClass);
  if (src === "data912") {
    const list = D912[assetClass]!;
    try { await fetchD912(db, list); } catch { /* sin conexión: se usa lo guardado */ }
    const q = await db.quote.findUnique({ where: { source_symbol: { source: "data912", symbol: `${list}:${ticker}` } } });
    if (!q) throw new UserError(`No encontramos ${ticker} entre ${ASSET_CLASSES.find((a) => a.key === assetClass)!.label.toLowerCase()}s del mercado argentino. Revisá cómo se escribe (ej.: ${ASSET_CLASSES.find((a) => a.key === assetClass)!.hint.replace("Ej.: ", "")}).`);
    return { ticker, quoteId: null, currency: q.currency, price: Number(q.price) };
  }
  if (src === "yahoo") {
    let ok = false;
    try { ok = await fetchYahoo(db, ticker); } catch { ok = !!(await db.quote.findUnique({ where: { source_symbol: { source: "yahoo", symbol: ticker } } })); }
    if (!ok) throw new UserError(`No encontramos ${ticker} en el mercado del exterior. Revisá cómo se escribe (ej.: AAPL, SPY).`);
    const q = await db.quote.findUnique({ where: { source_symbol: { source: "yahoo", symbol: ticker } } });
    return { ticker, quoteId: null, currency: q?.currency ?? "USD", price: q ? Number(q.price) : null };
  }
  if (src === "coingecko") {
    let id: string | null = null;
    try {
      const j = (await get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`)) as { coins?: { id: string; symbol: string }[] };
      id = j.coins?.find((c) => c.symbol.toUpperCase() === ticker)?.id ?? null;
    } catch { /* sin conexión */ }
    if (!id) throw new UserError(`No encontramos la cripto ${ticker}. Revisá cómo se escribe (ej.: BTC, ETH).`);
    try { await fetchCoins(db, [id]); } catch { /* sin conexión */ }
    const q = await db.quote.findUnique({ where: { source_symbol: { source: "coingecko", symbol: id } } });
    return { ticker, quoteId: id, currency: "USD", price: q ? Number(q.price) : null };
  }
  return { ticker: raw.trim(), quoteId: null, currency: "", price: null };
}
