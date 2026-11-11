import { MARKET_TAPE_SYMBOLS } from "./markets";
import { readPortfolio } from "./portfolio";
import { fetchQuotes, normalizeSymbol } from "./quotes";
import type { Snapshot } from "./types";
import { viewSnapshot } from "./view";

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
  const symbols = [...new Set([...heldSymbols, ...MARKET_TAPE_SYMBOLS])];

  let quotesError: string | null = null;
  let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
  try {
    quotes = await fetchQuotes(symbols, maxWaitMs != null ? { maxWaitMs } : undefined);
  } catch (error) {
    quotesError = error instanceof Error ? error.message : "行情暂时不可用";
  }

  const snapshot = viewSnapshot(portfolio, quotes);
  snapshot.quotesError = quotesError;
  lastGood = snapshot;
  return snapshot;
}
