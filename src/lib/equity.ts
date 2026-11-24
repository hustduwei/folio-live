import { newYorkDate } from "./market";
import { normalizeSymbol } from "./quotes";
import type { EquityPoint, PortfolioFile, Trade } from "./types";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function signedShares(trade: Trade): number {
  return trade.side === "buy" ? trade.shares : -trade.shares;
}

function tradeDay(trade: Trade): string {
  return newYorkDate(new Date(trade.executedAt));
}

/** Positions entered without a cash movement are the opening book, held from the first plotted day. */
function openingShares(trades: Trade[]): Map<string, number> {
  const lots = new Map<string, number>();
  for (const trade of trades) {
    if (trade.affectsCash === true) continue;
    const symbol = normalizeSymbol(trade.symbol);
    lots.set(symbol, (lots.get(symbol) ?? 0) + signedShares(trade));
  }
  return lots;
}

function cashOnDay(portfolio: PortfolioFile, day: string): number {
  let cash = portfolio.cash;
  for (const trade of portfolio.trades) {
    if (trade.affectsCash !== true || tradeDay(trade) <= day) continue;
    const notional = trade.shares * trade.price;
    cash += trade.side === "buy" ? notional : -notional;
  }
  return money(cash);
}

function sharesOnDay(opening: Map<string, number>, trades: Trade[], day: string): Map<string, number> {
  const lots = new Map(opening);
  for (const trade of trades) {
    if (trade.affectsCash !== true || tradeDay(trade) > day) continue;
    const symbol = normalizeSymbol(trade.symbol);
    lots.set(symbol, (lots.get(symbol) ?? 0) + signedShares(trade));
  }
  return lots;
}

export async function fetchDailyCloses(symbols: string[]): Promise<Map<string, Map<string, number>>> {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const closes = new Map<string, Map<string, number>>();
  await Promise.all(
    unique.map(async (symbol) => {
      const series = await fetchSymbolCloses(symbol);
      if (series.size > 0) closes.set(symbol, series);
    }),
  );
  return closes;
}

async function fetchSymbolCloses(symbol: string): Promise<Map<string, number>> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
      const response = await fetch(url, {
        headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      };
      const row = payload.chart?.result?.[0];
      const timestamps = row?.timestamp ?? [];
      const prices = row?.indicators?.quote?.[0]?.close ?? [];
      const series = new Map<string, number>();
      for (let i = 0; i < timestamps.length; i += 1) {
        const close = prices[i];
        const ts = timestamps[i];
        if (typeof close !== "number" || !Number.isFinite(close) || ts == null) continue;
        series.set(newYorkDate(new Date(ts * 1000)), close);
      }
      if (series.size > 0) return series;
    } catch {
      // try the other host
    }
  }
  return new Map();
}

/**
 * Daily account net value.
 * The opening book is marked from the day it was fully recorded. Later buys and
 * sells land on their trade date. Missing prints carry the previous close.
 */
export function buildEquityCurve(portfolio: PortfolioFile, closes: Map<string, Map<string, number>>): EquityPoint[] {
  const opening = openingShares(portfolio.trades);
  const recorded = portfolio.trades
    .filter((trade) => trade.affectsCash !== true)
    .map(tradeDay)
    .sort();
  const start = recorded.at(-1) ?? portfolio.yearStart?.date ?? newYorkDate();
  const dates = [...new Set([...closes.values()].flatMap((series) => [...series.keys()]))]
    .filter((date) => date >= start)
    .sort();
  const carried = new Map<string, number>();
  const points: EquityPoint[] = [];

  for (const date of dates) {
    for (const [symbol, series] of closes) {
      const close = series.get(date);
      if (close != null) carried.set(symbol, close);
    }
    const lots = sharesOnDay(opening, portfolio.trades, date);
    let nav = cashOnDay(portfolio, date);
    let priced = true;
    for (const [symbol, shares] of lots) {
      if (shares <= 0.0000001) continue;
      const price = carried.get(symbol);
      if (price == null) {
        priced = false;
        break;
      }
      nav += shares * price;
    }
    if (!priced || !Number.isFinite(nav)) continue;
    points.push({ date, nav: money(nav) });
  }
  return points;
}

/** Replace today's point with the live net value, or append it when the close is not in yet. */
export function stampEquity(points: EquityPoint[], nav: number, date: string): EquityPoint[] {
  if (!Number.isFinite(nav) || nav <= 0) return points;
  const next = points.filter((point) => point.date <= date).map((point) => ({ ...point }));
  const live = money(nav);
  const last = next.at(-1);
  if (!last) return [{ date, nav: live }];
  if (last.date === date) last.nav = live;
  else next.push({ date, nav: live });
  return next;
}
