import { accountDayPnl, deriveHoldings, summarize, summarizeCapital, summarizeYear } from "./calc";
import { getMarketClock } from "./market";
import { MARKET_TAPE_SYMBOLS } from "./markets";
import { normalizeSymbol } from "./quotes";
import { attachCashSector, groupBySector } from "./sectors";
import type { PortfolioFile, Quote, Snapshot } from "./types";

function latestMarketTime(quotes: Quote[], symbols: Set<string>): string | null {
  let best = Number.NEGATIVE_INFINITY;
  for (const quote of quotes) {
    if (symbols.size > 0 && !symbols.has(quote.symbol)) continue;
    const time = Date.parse(quote.marketTime ?? "");
    if (Number.isFinite(time) && time > best) best = time;
  }
  return Number.isFinite(best) && best > Number.NEGATIVE_INFINITY ? new Date(best).toISOString() : null;
}

export function viewSnapshot(portfolio: PortfolioFile, quotes: Quote[], now = new Date()): Snapshot {
  const holdings = deriveHoldings(portfolio.trades, quotes, now);
  const totals = summarize(holdings, portfolio.cash);
  const day = accountDayPnl(portfolio.trades, quotes, now);
  totals.dayPnl = day.pnl;
  totals.dayPnlPercent = day.percent;
  const held = new Set(holdings.map((holding) => holding.symbol));
  return {
    fetchedAt: latestMarketTime(quotes, held) ?? latestMarketTime(quotes, new Set()) ?? now.toISOString(),
    market: getMarketClock(now),
    quotesError: null,
    holdings,
    sectors: attachCashSector(groupBySector(holdings), totals.cash, totals.netValue),
    watchlist: [...holdings]
      .sort((a, b) => b.marketValue - a.marketValue || a.symbol.localeCompare(b.symbol))
      .flatMap((holding) => {
        const quote = quotes.find((row) => row.symbol === holding.symbol);
        return quote ? [quote] : [];
      }),
    indices: MARKET_TAPE_SYMBOLS.flatMap((symbol) => {
      const quote = quotes.find((row) => normalizeSymbol(row.symbol) === symbol);
      return quote ? [quote] : [];
    }),
    trades: [...portfolio.trades].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
    ),
    capital: summarizeCapital(portfolio.capital, totals.netValue),
    year: summarizeYear(totals.netValue, portfolio.yearStart, portfolio.capital),
    totals,
  };
}
