import { WATCHLIST } from "./aliases";
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
    signal: AbortSignal.timeout(8_000),
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

const QUOTE_CACHE_MS = 2_500;
let quoteCache: { key: string; at: number; quotes: Quote[] } | null = null;

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  if (unique.length === 0) return [];
  const cacheKey = unique.join(",");
  if (quoteCache && quoteCache.key === cacheKey && Date.now() - quoteCache.at < QUOTE_CACHE_MS) {
    return quoteCache.quotes;
  }

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
    .map((symbol) => bySymbol.get(symbol))
    .filter((quote): quote is Quote => Boolean(quote));
  quoteCache = { key: cacheKey, at: Date.now(), quotes };
  return quotes;
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
