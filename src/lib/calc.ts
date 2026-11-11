import { lastSettlementAt } from "./market";
import { normalizeSymbol } from "./quotes";
import type {
  CapitalEvent,
  CapitalSummary,
  Holding,
  PortfolioTotals,
  Quote,
  Trade,
  YearMark,
  YearSummary,
} from "./types";

function normalizeCash(value: unknown): number {
  const cash = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(cash) || cash < 0) return 0;
  return Math.round(cash * 100) / 100;
}

function money2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function heldShares(trades: Trade[], symbol: string): number {
  const target = normalizeSymbol(symbol);
  return trades.reduce((shares, trade) => {
    if (normalizeSymbol(trade.symbol) !== target) return shares;
    return trade.side === "buy" ? shares + trade.shares : shares - trade.shares;
  }, 0);
}

export function positionDayStats(
  trades: Trade[],
  symbol: string,
  price: number,
  previousClose: number,
  now = new Date(),
): { dayPnl: number; dayPnlPercent: number; base: number } {
  const settlementMs = lastSettlementAt(now).getTime();
  const target = normalizeSymbol(symbol);
  const prior: Trade[] = [];
  let buyNotional = 0;
  let sellNotional = 0;
  const sameSymbol: Trade[] = [];
  for (const trade of trades) {
    if (normalizeSymbol(trade.symbol) !== target) continue;
    sameSymbol.push(trade);
    const at = Date.parse(trade.executedAt);
    if (!Number.isFinite(at) || at < settlementMs) {
      prior.push(trade);
      continue;
    }
    const notional = trade.shares * trade.price;
    if (trade.side === "sell") sellNotional += notional;
    else buyNotional += notional;
  }
  const sharesAtCutoff = heldShares(prior, target);
  const sharesNow = heldShares(sameSymbol, target);
  const dayPnl = price * sharesNow - previousClose * sharesAtCutoff + sellNotional - buyNotional;
  const base = previousClose * sharesAtCutoff + buyNotional;
  return { dayPnl, dayPnlPercent: base > 0 ? (dayPnl / base) * 100 : 0, base };
}

export function deriveHoldings(trades: Trade[], quotes: Quote[], now = new Date()): Holding[] {
  const lots = new Map<string, { shares: number; cost: number; name: string }>();
  const ordered = [...trades].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  for (const trade of ordered) {
    const symbol = normalizeSymbol(trade.symbol);
    const current = lots.get(symbol) ?? { shares: 0, cost: 0, name: trade.name };
    if (trade.side === "buy") {
      current.shares += trade.shares;
      current.cost += trade.shares * trade.price;
      current.name = trade.name || current.name;
    } else {
      const avg = current.shares > 0 ? current.cost / current.shares : trade.price;
      current.shares -= trade.shares;
      current.cost -= trade.shares * avg;
      if (current.shares <= 0.0000001) {
        current.shares = 0;
        current.cost = 0;
      }
    }
    lots.set(symbol, current);
  }

  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
  const holdings: Holding[] = [];

  for (const [symbol, lot] of lots) {
    if (lot.shares <= 0) continue;
    const quote = quoteMap.get(symbol);
    const price = quote?.price ?? 0;
    const previousClose = quote?.previousClose ?? price;
    const avgCost = lot.shares > 0 ? lot.cost / lot.shares : 0;
    const marketValue = price * lot.shares;
    const pnl = marketValue - lot.cost;
    const pnlPercent = lot.cost > 0 ? (pnl / lot.cost) * 100 : 0;
    const day = quote
      ? positionDayStats(trades, symbol, price, previousClose, now)
      : { dayPnl: 0, dayPnlPercent: 0, base: 0 };

    holdings.push({
      symbol,
      name: quote?.name || lot.name || symbol,
      shares: lot.shares,
      avgCost,
      cost: lot.cost,
      price,
      previousClose,
      change: quote?.change ?? 0,
      changePercent: quote?.changePercent ?? 0,
      marketValue,
      pnl,
      pnlPercent,
      dayPnl: day.dayPnl,
      dayPnlPercent: day.dayPnlPercent,
      weight: 0,
      spark: quote?.spark ?? [],
      currency: quote?.currency ?? "USD",
      quoteMissing: !quote,
    });
  }

  const stockValue = holdings.reduce((sum, row) => sum + row.marketValue, 0);
  for (const row of holdings) {
    row.weight = stockValue > 0 ? (row.marketValue / stockValue) * 100 : 0;
  }

  holdings.sort((a, b) => b.marketValue - a.marketValue);
  return holdings;
}

export function accountDayPnl(trades: Trade[], quotes: Quote[], now = new Date()): { pnl: number; percent: number } {
  const quoteMap = new Map(quotes.map((quote) => [normalizeSymbol(quote.symbol), quote]));
  const symbols = new Set(trades.map((trade) => normalizeSymbol(trade.symbol)));
  let pnl = 0;
  let base = 0;
  for (const symbol of symbols) {
    const quote = quoteMap.get(symbol);
    if (!quote || !Number.isFinite(quote.price) || !Number.isFinite(quote.previousClose)) continue;
    const day = positionDayStats(trades, symbol, quote.price, quote.previousClose, now);
    pnl += day.dayPnl;
    base += day.base;
  }
  return { pnl, percent: base > 0 ? (pnl / base) * 100 : 0 };
}

export function summarize(holdings: Holding[], cash = 0): PortfolioTotals {
  const marketValue = holdings.reduce((sum, row) => sum + row.marketValue, 0);
  const cost = holdings.reduce((sum, row) => sum + row.cost, 0);
  const pnl = marketValue - cost;
  const dayPnl = holdings.reduce((sum, row) => sum + row.dayPnl, 0);
  const safeCash = normalizeCash(cash);
  const netValue = marketValue + safeCash;
  return {
    marketValue,
    cost,
    cash: safeCash,
    netValue,
    cashWeight: netValue > 0 ? (safeCash / netValue) * 100 : 0,
    pnl,
    pnlPercent: cost > 0 ? (pnl / cost) * 100 : 0,
    dayPnl,
    dayPnlPercent: marketValue - dayPnl > 0 ? (dayPnl / (marketValue - dayPnl)) * 100 : 0,
  };
}

export function summarizeCapital(events: CapitalEvent[], netValue: number): CapitalSummary {
  const principalCny = events.filter((row) => row.kind === "deposit").reduce((sum, row) => sum + row.cny, 0);
  const principalUsd = events.filter((row) => row.kind === "deposit").reduce((sum, row) => sum + row.usd, 0);
  const withdrawnCny = events.filter((row) => row.kind === "withdraw").reduce((sum, row) => sum + row.cny, 0);
  const withdrawnUsd = events.filter((row) => row.kind === "withdraw").reduce((sum, row) => sum + row.usd, 0);
  const netCapitalUsd = money2(principalUsd - withdrawnUsd);
  const vsCapital = money2(netValue - netCapitalUsd);
  return {
    events: [...events].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()),
    principalCny: money2(principalCny),
    principalUsd: money2(principalUsd),
    withdrawnCny: money2(withdrawnCny),
    withdrawnUsd: money2(withdrawnUsd),
    netCapitalUsd,
    vsCapital,
    vsCapitalPercent: netCapitalUsd > 0 ? (vsCapital / netCapitalUsd) * 100 : 0,
  };
}

export function summarizeYear(
  netValue: number,
  yearStart: YearMark | null,
  events: CapitalEvent[],
): YearSummary | null {
  if (!yearStart) return null;
  const startAt = Date.parse(`${yearStart.date}T00:00:00.000Z`);
  if (!Number.isFinite(startAt)) return null;

  let deposits = 0;
  let withdrawals = 0;
  for (const event of events) {
    const at = Date.parse(event.executedAt);
    if (!Number.isFinite(at) || at < startAt) continue;
    if (event.kind === "deposit") deposits += event.usd;
    else withdrawals += event.usd;
  }

  const ytdPnl = money2(netValue - yearStart.usd - deposits + withdrawals);
  return {
    date: yearStart.date,
    startUsd: yearStart.usd,
    deposits: money2(deposits),
    withdrawals: money2(withdrawals),
    ytdPnl,
    ytdPercent: yearStart.usd > 0 ? (ytdPnl / yearStart.usd) * 100 : 0,
  };
}
