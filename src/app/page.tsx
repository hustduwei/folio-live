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
  sectors: [],
  watchlist: [],
  trades: [],
  capital: {
    events: [],
    principalCny: 0,
    principalUsd: 0,
    withdrawnCny: 0,
    withdrawnUsd: 0,
    netCapitalUsd: 0,
    vsCapital: 0,
    vsCapitalPercent: 0,
  },
  year: null,
  totals: {
    marketValue: 0,
    cost: 0,
    cash: 0,
    netValue: 0,
    cashWeight: 0,
    pnl: 0,
    pnlPercent: 0,
    dayPnl: 0,
    dayPnlPercent: 0,
  },
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  let snapshot: Snapshot;
  try {
    snapshot = await buildSnapshot("fast");
  } catch {
    snapshot = emptySnapshot();
  }

  return (
    <main className="flex-1">
      <PortfolioDashboard initialSnapshot={snapshot} formError={params.error} />
    </main>
  );
}
