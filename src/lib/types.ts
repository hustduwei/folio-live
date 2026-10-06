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
  affectsCash?: boolean;
};

export type CapitalKind = "deposit" | "withdraw";

export type CapitalEvent = {
  id: string;
  kind: CapitalKind;
  cny: number;
  fx: number;
  usd: number;
  note?: string;
  executedAt: string;
  affectsCash?: boolean;
};

export type YearMark = {
  date: string;
  usd: number;
  note?: string;
};

export type YearSummary = {
  date: string;
  startUsd: number;
  deposits: number;
  withdrawals: number;
  ytdPnl: number;
  ytdPercent: number;
};

export type PortfolioFile = {
  version: 1;
  cash: number;
  capital: CapitalEvent[];
  yearStart: YearMark | null;
  trades: Trade[];
};

export type CapitalSummary = {
  events: CapitalEvent[];
  principalCny: number;
  principalUsd: number;
  withdrawnCny: number;
  withdrawnUsd: number;
  netCapitalUsd: number;
  vsCapital: number;
  vsCapitalPercent: number;
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

export type MarketState = "pre" | "open" | "post" | "night" | "closed";

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
  cash: number;
  netValue: number;
  cashWeight: number;
  pnl: number;
  pnlPercent: number;
  dayPnl: number;
  dayPnlPercent: number;
};

export type SectorMeta = {
  key: string;
  zh: string;
  en: string;
  icon: string;
  hex: string;
};

export type SectorHoldingRow = {
  symbol: string;
  name: string;
  weight: number;
  sectorWeight: number;
  marketValue: number;
  changePercent: number;
  dayPnl: number;
  pnl: number;
  shares: number;
  price: number;
};

export type SectorGroup = SectorMeta & {
  weight: number;
  marketValue: number;
  dayPnl: number;
  pnl: number;
  holdings: SectorHoldingRow[];
};

export type Snapshot = {
  fetchedAt: string;
  market: MarketClock;
  quotesError: string | null;
  holdings: Holding[];
  sectors: SectorGroup[];
  watchlist: Quote[];
  indices: Quote[];
  trades: Trade[];
  capital: CapitalSummary;
  year: YearSummary | null;
  totals: PortfolioTotals;
};

export type SearchHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};
