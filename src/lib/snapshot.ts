import { WATCHLIST } from "./aliases";
import { getMarketClock } from "./market";
import { deriveHoldings, readPortfolio, summarize } from "./portfolio";
import { fetchQuotes, normalizeSymbol } from "./quotes";
import { groupBySector } from "./sectors";
import type { Snapshot } from "./types";

export async function buildSnapshot(): Promise<Snapshot> {
  const portfolio = await readPortfolio();
  const heldSymbols = [
    ...new Set(portfolio.trades.map((trade) => normalizeSymbol(trade.symbol))),
  ];
  const symbols = [...new Set([...heldSymbols, ...WATCHLIST])];

  let quotesError: string | null = null;
  let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
  try {
    quotes = await fetchQuotes(symbols);
  } catch (error) {
    quotesError = error instanceof Error ? error.message : "行情暂时不可用";
  }

  const holdings = deriveHoldings(portfolio.trades, quotes);
  const totals = summarize(holdings);
  const sectors = groupBySector(holdings);
  const watchlist = quotes.filter((quote) => WATCHLIST.includes(quote.symbol));

  return {
    fetchedAt: new Date().toISOString(),
    market: getMarketClock(),
    quotesError,
    holdings,
    sectors,
    watchlist,
    trades: [...portfolio.trades].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
    ),
    totals,
  };
}
