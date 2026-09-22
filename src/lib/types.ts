export type TradeSide = "buy" | "sell";

export type Trade = {
  id: string;
  symbol: string;
  name: string;
  side: TradeSide;
  shares: number;
  price: number;
  executedAt: string;
  note?: string;
};

export type PortfolioFile = {
  version: 1;
  trades: Trade[];
};

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  spark: number[];
  marketTime: string | null;
};

export type MarketState = "pre" | "open" | "post" | "closed";

export type MarketClock = {
  state: MarketState;
  label: string;
  nyTime: string;
  nyDate: string;
};

export type Holding = {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  cost: number;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  dayPnl: number;
  dayPnlPercent: number;
  weight: number;
  spark: number[];
  currency: string;
  quoteMissing: boolean;
};

export type PortfolioTotals = {
  marketValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dayPnl: number;
  dayPnlPercent: number;
};

export type Snapshot = {
  fetchedAt: string;
  market: MarketClock;
  quotesError: string | null;
  holdings: Holding[];
  watchlist: Quote[];
  trades: Trade[];
  totals: PortfolioTotals;
};

export type SearchHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};
