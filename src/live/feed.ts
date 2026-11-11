import { dateInNewYork, lastSettlementAt } from "../lib/market";
import { normalizeSymbol } from "../lib/quotes";
import type { Quote } from "../lib/types";

const TAPE_CODES: Record<string, string> = {
  "^GSPC": "usINX",
  "^DJI": "usDJI",
  "^IXIC": "usIXIC",
  QQQ: "usQQQ",
  "ES=F": "fuES",
  "NQ=F": "fuNQ",
  "YM=F": "fuYM",
};

export function tencentCode(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return TAPE_CODES[normalized] ?? `us${normalized.replace(/-/g, "")}`;
}

export function parseTencentClock(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return dateInNewYork(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
}

/** Previous close once a print belongs to the session that started at 20:00 ET. */
export function settlementBaseline(price: number, feedPrev: number): number {
  return Number.isFinite(feedPrev) && feedPrev > 0 ? feedPrev : price;
}

function inNewSession(quote: Quote | null | undefined, settlementMs: number): boolean {
  if (!quote?.marketTime) return false;
  const time = Date.parse(quote.marketTime);
  return Number.isFinite(time) && time >= settlementMs;
}

/**
 * Longbridge rolls today's P&L at 20:00 ET. The baseline becomes that session's
 * close, and the latest price includes the overnight print. A feed still showing
 * the previous regular close must not be reused as today's move.
 */
export function pickLiveQuote(fresh: Quote | null, fallback: Quote | undefined, now = new Date()): Quote | null {
  const settlementMs = lastSettlementAt(now).getTime();
  if (fresh && inNewSession(fresh, settlementMs)) return fresh;
  if (fallback && inNewSession(fallback, settlementMs)) return fallback;
  const prior = fresh ?? fallback ?? null;
  if (!prior) return null;
  return {
    ...prior,
    previousClose: prior.price,
    change: 0,
    changePercent: 0,
  };
}

export function quoteFromTencent(
  symbol: string,
  raw: string,
  fallback: Quote | undefined,
  now = new Date(),
): Quote | null {
  const parts = raw.split("~");
  const price = Number(parts[3]);
  const feedPrev = Number(parts[4]);
  if (!Number.isFinite(price) || price <= 0) return null;
  const at = parseTencentClock(parts[30] ?? "") ?? now;
  const previousClose = settlementBaseline(price, feedPrev);
  const change = price - previousClose;
  const high = Number(parts[33]);
  const low = Number(parts[34]);
  const volume = Number(parts[6]);
  return {
    symbol: normalizeSymbol(symbol),
    name: fallback?.name || normalizeSymbol(symbol),
    currency: fallback?.currency || "USD",
    price,
    previousClose,
    change,
    changePercent: previousClose ? (change / previousClose) * 100 : 0,
    dayHigh: Number.isFinite(high) ? high : null,
    dayLow: Number.isFinite(low) ? low : null,
    volume: Number.isFinite(volume) ? volume : null,
    spark: fallback?.spark ?? [],
    marketTime: at.toISOString(),
  };
}

export function quotesFromTencentBody(body: string, symbols: string[], fallback: Quote[], now = new Date()): Quote[] {
  const byCode = new Map<string, string>();
  for (const match of body.matchAll(/v_([A-Za-z0-9_]+)="([^"]*)"/g)) {
    byCode.set(match[1], match[2]);
  }
  return quotesFromRows(
    symbols,
    (symbol) => byCode.get(tencentCode(symbol)) ?? "",
    fallback,
    now,
  );
}

function quotesFromRows(
  symbols: string[],
  rawFor: (symbol: string) => string,
  fallback: Quote[],
  now: Date,
): Quote[] {
  const fallbackBySymbol = new Map(fallback.map((quote) => [normalizeSymbol(quote.symbol), quote]));
  const quotes: Quote[] = [];
  for (const symbol of symbols) {
    const previous = fallbackBySymbol.get(normalizeSymbol(symbol));
    const raw = rawFor(symbol);
    const quote = raw ? quoteFromTencent(symbol, raw, previous, now) : null;
    const picked = pickLiveQuote(quote, previous, now);
    if (picked) quotes.push(picked);
  }
  return quotes;
}

export async function loadTencentQuotes(symbols: string[], fallback: Quote[], now = new Date()): Promise<Quote[]> {
  const unique = [...new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean))];
  const codes = unique.map(tencentCode);
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("行情超时")), 8_000);
    const el = document.createElement("script");
    el.src = `https://qt.gtimg.cn/q=${codes.join(",")}&_=${Date.now()}`;
    el.async = true;
    el.onload = () => {
      window.clearTimeout(timer);
      el.remove();
      resolve();
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      el.remove();
      reject(new Error("行情加载失败"));
    };
    document.head.appendChild(el);
  });
  const windowRecord = window as unknown as Record<string, string | undefined>;
  return quotesFromRows(unique, (symbol) => windowRecord[`v_${tencentCode(symbol)}`] ?? "", fallback, now);
}
