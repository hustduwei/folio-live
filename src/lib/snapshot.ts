import { WATCHLIST } from "./aliases";
import { getMarketClock } from "./market";
import { deriveHoldings, readPortfolio, summarize, summarizeCapital } from "./portfolio";
import { fetchQuotes, normalizeSymbol } from "./quotes";
import { attachCashSector, groupBySector } from "./sectors";
import type { Snapshot } from "./types";

let lastGood: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

export async function buildSnapshot(mode: "fast" | "fresh" = "fresh"): Promise<Snapshot> {
  if (mode === "fast" && lastGood) {
    void refresh();
    return lastGood;
  }
  return refresh();
}

function refresh(): Promise<Snapshot> {
  if (!inflight) {
    inflight = assemble(lastGood ? 450 : undefined).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function assemble(maxWaitMs?: number): Promise<Snapshot> {
  const portfolio = await readPortfolio();
  const heldSymbols = [...new Set(portfolio.trades.map((trade) => normalizeSymbol(trade.symbol)))];
  const symbols = [...new Set([...heldSymbols, ...WATCHLIST])];

  let quotesError: string | null = null;
  let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
  try {
    quotes = await fetchQuotes(symbols, maxWaitMs != null ? { maxWaitMs } : undefined);
  } catch (error) {
    quotesError = error instanceof Error ? error.message : "行情暂时不可用";
  }

  const holdings = deriveHoldings(portfolio.trades, quotes);
  const totals = summarize(holdings, portfolio.cash);
  const snapshot: Snapshot = {
    fetchedAt: new Date().toISOString(),
    market: getMarketClock(),
    quotesError,
    holdings,
    sectors: attachCashSector(groupBySector(holdings), totals.cash, totals.netValue),
    watchlist: quotes.filter((quote) => WATCHLIST.includes(quote.symbol)),
    trades: [...portfolio.trades].sort(
      (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime(),
    ),
    capital: summarizeCapital(portfolio.capital, totals.netValue),
    totals,
  };
  lastGood = snapshot;
  return snapshot;
}
