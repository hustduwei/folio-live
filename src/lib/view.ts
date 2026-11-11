import { accountDayPnl, deriveHoldings, summarize, summarizeCapital, summarizeYear } from "./calc";
import { getMarketClock } from "./market";
import { MARKET_TAPE_SYMBOLS } from "./markets";
import { normalizeSymbol } from "./quotes";
import { attachCashSector, groupBySector } from "./sectors";
import type { PortfolioFile, Quote, Snapshot } from "./types";

export function viewSnapshot(portfolio: PortfolioFile, quotes: Quote[], now = new Date()): Snapshot {
  const holdings = deriveHoldings(portfolio.trades, quotes, now);
  const totals = summarize(holdings, portfolio.cash);
  const day = accountDayPnl(portfolio.trades, quotes, now);
  totals.dayPnl = day.pnl;
  totals.dayPnlPercent = day.percent;
  return {
    fetchedAt: now.toISOString(),
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
