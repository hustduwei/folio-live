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

/** Previous close carried by a quote that already belongs to the current Longbridge day. */
export function settlementBaseline(price: number, feedPrev: number): number {
  return Number.isFinite(feedPrev) && feedPrev > 0 ? feedPrev : price;
}

function quoteMillis(quote: Quote | null | undefined): number {
  if (!quote?.marketTime) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(quote.marketTime);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function withBaseline(quote: Quote, baseline: number): Quote {
  if (!Number.isFinite(baseline) || baseline <= 0) return quote;
  const change = quote.price - baseline;
  return {
    ...quote,
    previousClose: baseline,
    change,
    changePercent: (change / baseline) * 100,
  };
}

/**
 * Longbridge, with overnight pricing on, runs a US day from 20:00 ET to the next
 * 20:00 ET. The latest price includes the regular session, post-market, and the
 * overnight session. At 20:00 the day resets against that session's close.
 * A print from before the reset is not reused as the new day's move.
 */
export function pickLiveQuote(fresh: Quote | null, fallback: Quote | undefined, now = new Date()): Quote | null {
  const candidates = [fresh, fallback].filter((quote): quote is Quote => Boolean(quote && quote.price > 0));
  if (candidates.length === 0) return null;
  const newest = candidates.reduce((best, quote) => (quoteMillis(quote) >= quoteMillis(best) ? quote : best));
  const dayStart = lastSettlementAt(now).getTime();
  if (!(quoteMillis(newest) >= dayStart)) return withBaseline(newest, newest.price);
  const anchor = candidates.reduce<Quote | undefined>((best, quote) => {
    const time = quoteMillis(quote);
    if (!(time <= dayStart)) return best;
    if (!best || time > quoteMillis(best)) return quote;
    return best;
  }, undefined);
  const baseline = anchor?.price ?? (newest.previousClose > 0 ? newest.previousClose : newest.price);
  return withBaseline(newest, baseline);
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
  const at = parseTencentClock(parts[30] ?? "");
  const marketTime = at?.toISOString() ?? fallback?.marketTime ?? null;
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
    marketTime,
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
