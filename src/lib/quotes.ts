import { WATCHLIST } from "./aliases";
import { lastSettlementAt } from "./market";
import type { Quote, SearchHit } from "./types";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/\./g, "-");
}

type YahooSparkMeta = {
  currency?: string;
  symbol?: string;
  regularMarketPrice?: number;
  fulldayPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketChangePercent?: number;
  fulldayChange?: number;
  fulldayChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  shortName?: string;
  longName?: string;
};

type YahooSparkItem = {
  symbol?: string;
  response?: Array<{
    meta?: YahooSparkMeta;
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  }>;
};

async function yahooJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": YAHOO_UA,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) {
    throw new Error(`行情接口 ${response.status}`);
  }
  return (await response.json()) as T;
}

function downsample(points: number[], max = 40): number[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => points[Math.round(index * step)] ?? points[0]);
}

function toQuote(symbol: string, meta: YahooSparkMeta, spark: number[]): Quote | null {
  const price = Number(meta.fulldayPrice ?? meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose ?? meta.chartPreviousClose);
  if (!Number.isFinite(price)) return null;
  const change = Number.isFinite(previousClose) ? price - previousClose : 0;
  const changePercent = Number.isFinite(previousClose) && previousClose !== 0
    ? (change / previousClose) * 100
    : Number(meta.fulldayChangePercent ?? meta.regularMarketChangePercent ?? 0);
  const marketTime = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : null;

  return {
    symbol,
    name: meta.shortName || meta.longName || symbol,
    currency: meta.currency || "USD",
    price,
    previousClose: Number.isFinite(previousClose) ? previousClose : price,
    change,
    changePercent,
    dayHigh: Number.isFinite(Number(meta.regularMarketDayHigh))
      ? Number(meta.regularMarketDayHigh)
      : null,
    dayLow: Number.isFinite(Number(meta.regularMarketDayLow))
      ? Number(meta.regularMarketDayLow)
      : null,
    volume: Number.isFinite(Number(meta.regularMarketVolume))
      ? Number(meta.regularMarketVolume)
      : null,
    spark: downsample(spark),
    marketTime,
  };
}

function sparkCloses(item: YahooSparkItem): number[] {
  const closes = item.response?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

const QUOTE_CACHE_MS = 8_000;
const QUOTE_STALE_MS = 60_000;
const lastQuotes = new Map<string, Quote>();
let quoteCache: { key: string; at: number; quotes: Quote[] } | null = null;
let inflightQuotes: { key: string; promise: Promise<Quote[]> } | null = null;

function remembered(symbols: string[]): Quote[] {
  return symbols.map((symbol) => lastQuotes.get(symbol)).filter((quote): quote is Quote => Boolean(quote));
}

function remember(quotes: Quote[]) {
  for (const quote of quotes) lastQuotes.set(quote.symbol, quote);
}

export async function fetchQuotes(
  symbols: string[],
  options: { maxWaitMs?: number } = {},
): Promise<Quote[]> {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  if (unique.length === 0) return [];
  const cacheKey = unique.join(",");
  const now = Date.now();
  if (quoteCache && quoteCache.key === cacheKey && now - quoteCache.at < QUOTE_CACHE_MS) {
    return quoteCache.quotes;
  }

  const stale = remembered(unique);
  const cacheAge = quoteCache && quoteCache.key === cacheKey ? now - quoteCache.at : Infinity;
  if (stale.length === unique.length && cacheAge < QUOTE_STALE_MS) {
    void refreshQuotes(unique, cacheKey);
    return stale;
  }

  const pending = refreshQuotes(unique, cacheKey);
  if (options.maxWaitMs != null && stale.length > 0) {
    const winner = await Promise.race([
      pending,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), options.maxWaitMs)),
    ]);
    return winner ?? stale;
  }

  try {
    return await pending;
  } catch (error) {
    if (stale.length > 0) return stale;
    throw error;
  }
}

function refreshQuotes(unique: string[], cacheKey: string): Promise<Quote[]> {
  if (inflightQuotes?.key === cacheKey) return inflightQuotes.promise;
  const promise = loadQuotes(unique)
    .then((quotes) => {
      remember(quotes);
      quoteCache = { key: cacheKey, at: Date.now(), quotes };
      return quotes;
    })
    .finally(() => {
      if (inflightQuotes?.promise === promise) inflightQuotes = null;
    });
  inflightQuotes = { key: cacheKey, promise };
  return promise;
}

async function loadQuotes(unique: string[]): Promise<Quote[]> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  const bySymbol = new Map<string, Quote>();

  for (const host of hosts) {
    try {
      const url = `${host}/v7/finance/spark?symbols=${encodeURIComponent(unique.join(","))}&range=1d&interval=5m`;
      const payload = await yahooJson<{ spark?: { result?: YahooSparkItem[]; error?: unknown } }>(url);
      const rows = payload.spark?.result ?? [];
      for (const row of rows) {
        const meta = row.response?.[0]?.meta;
        const symbol = normalizeSymbol(row.symbol || meta?.symbol || "");
        if (!meta || !symbol) continue;
        const quote = toQuote(symbol, meta, sparkCloses(row));
        if (quote) bySymbol.set(symbol, quote);
      }
      if (bySymbol.size === unique.length) break;
    } catch {
      // try next host
    }
  }

  const missing = unique.filter((symbol) => !bySymbol.has(symbol));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (symbol) => {
        for (const host of hosts) {
          try {
            const chartUrl = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`;
            const chart = await yahooJson<{
              chart?: {
                result?: Array<{
                  meta?: YahooSparkMeta;
                  timestamp?: number[];
                  indicators?: { quote?: Array<{ close?: Array<number | null> }> };
                }>;
              };
            }>(chartUrl);
            const result = chart.chart?.result?.[0];
            if (!result?.meta) continue;
            const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
              (value): value is number => typeof value === "number" && Number.isFinite(value),
            );
            const quote = toQuote(symbol, result.meta, closes);
            if (quote) {
              bySymbol.set(symbol, quote);
              return;
            }
          } catch {
            // try next host
          }
        }
      }),
    );
  }

  const quotes = unique
    .map((symbol) => bySymbol.get(symbol) ?? lastQuotes.get(symbol))
    .filter((quote): quote is Quote => Boolean(quote));
  return applySettlementBaselines(quotes);
}

type ChartBar = {
  timestamp?: number[];
  close?: Array<number | null>;
};

const BASELINE_CACHE_MS = 5 * 60 * 1000;
let baselineCache: { settlement: number; until: number; prices: Map<string, number> } | null = null;

function closeAtOrBefore(bars: ChartBar, settlementSec: number): number | null {
  const timestamps = bars.timestamp ?? [];
  const closes = bars.close ?? [];
  let bestTs = -1;
  let best: number | null = null;
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    const close = closes[i];
    if (ts == null || ts > settlementSec) continue;
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    if (ts >= bestTs) {
      bestTs = ts;
      best = close;
    }
  }
  return best;
}

async function settlementPrint(symbol: string, settlementSec: number): Promise<number | null> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=5d&includePrePost=true`;
      const payload = await yahooJson<{
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      }>(url);
      const result = payload.chart?.result?.[0];
      if (!result) continue;
      const price = closeAtOrBefore(
        { timestamp: result.timestamp, close: result.indicators?.quote?.[0]?.close },
        settlementSec,
      );
      if (price != null) return price;
    } catch {
      // try the other host
    }
  }
  return null;
}

async function applySettlementBaselines(quotes: Quote[]): Promise<Quote[]> {
  if (quotes.length === 0) return quotes;
  const settlement = lastSettlementAt();
  const settlementSec = Math.floor(settlement.getTime() / 1000);
  const now = Date.now();
  const cached =
    baselineCache && baselineCache.settlement === settlement.getTime() && baselineCache.until > now
      ? baselineCache.prices
      : new Map<string, number>();
  const missing = quotes.map((quote) => quote.symbol).filter((symbol) => !cached.has(symbol));
  if (missing.length > 0) {
    const found = await Promise.all(
      missing.map(async (symbol) => [symbol, await settlementPrint(symbol, settlementSec)] as const),
    );
    for (const [symbol, price] of found) {
      if (price != null) cached.set(symbol, price);
    }
    baselineCache = { settlement: settlement.getTime(), until: now + BASELINE_CACHE_MS, prices: cached };
  }

  return quotes.map((quote) => {
    const baseline = cached.get(quote.symbol);
    if (baseline == null || baseline === 0) return quote;
    const change = quote.price - baseline;
    return {
      ...quote,
      previousClose: baseline,
      change,
      changePercent: (change / baseline) * 100,
    };
  });
}

export async function fetchWatchlistQuotes(extra: string[] = []): Promise<Quote[]> {
  const symbols = [...new Set([...WATCHLIST, ...extra.map(normalizeSymbol)])];
  return fetchQuotes(symbols);
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
  const payload = await yahooJson<{
    quotes?: Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
      exchDisp?: string;
    }>;
  }>(url);

  return (payload.quotes ?? [])
    .filter((hit) => {
      const type = (hit.quoteType || "").toUpperCase();
      return type === "EQUITY" || type === "ETF" || type === "INDEX";
    })
    .map((hit) => ({
      symbol: normalizeSymbol(hit.symbol || ""),
      name: hit.shortname || hit.longname || hit.symbol || "",
      type: hit.quoteType || "EQUITY",
      exchange: hit.exchDisp || "",
    }))
    .filter((hit) => hit.symbol);
}
