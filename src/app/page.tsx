import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { getMarketClock } from "@/lib/market";
import { buildSnapshot } from "@/lib/snapshot";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

const emptySnapshot = (): Snapshot => ({
  fetchedAt: new Date().toISOString(),
  market: getMarketClock(),
  quotesError: "行情暂时不可用",
  holdings: [],
  watchlist: [],
  trades: [],
  totals: {
    marketValue: 0,
    cost: 0,
    pnl: 0,
    pnlPercent: 0,
    dayPnl: 0,
    dayPnlPercent: 0,
  },
});

export default async function Home() {
  let snapshot: Snapshot;
  try {
    snapshot = await buildSnapshot();
  } catch {
    snapshot = emptySnapshot();
  }

  return (
    <main className="flex-1">
      <PortfolioDashboard initialSnapshot={snapshot} />
    </main>
  );
}
