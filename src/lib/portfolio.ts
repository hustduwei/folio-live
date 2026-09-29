import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import seed from "../../data/portfolio.json";
import type {
  CapitalEvent,
  CapitalKind,
  CapitalSummary,
  Holding,
  PortfolioFile,
  PortfolioTotals,
  Quote,
  Trade,
  TradeSide,
  YearMark,
  YearSummary,
} from "./types";
import { normalizeSymbol } from "./quotes";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "portfolio.json");

let writeChain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const emptyPortfolio = (): PortfolioFile => ({
  version: 1,
  cash: 0,
  capital: [],
  yearStart: null,
  trades: [],
});

function normalizeCash(value: unknown): number {
  const cash = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(cash) || cash < 0) return 0;
  return Math.round(cash * 100) / 100;
}

function money2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeCapital(events: unknown): CapitalEvent[] {
  if (!Array.isArray(events)) return [];
  const next: CapitalEvent[] = [];
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<CapitalEvent>;
    const kind = row.kind === "withdraw" ? "withdraw" : row.kind === "deposit" ? "deposit" : null;
    const cny = Number(row.cny);
    const fx = Number(row.fx);
    if (!kind || !Number.isFinite(cny) || cny <= 0 || !Number.isFinite(fx) || fx <= 0) continue;
    const usd = Number.isFinite(Number(row.usd)) && Number(row.usd) > 0 ? money2(Number(row.usd)) : money2(cny / fx);
    next.push({
      id: String(row.id || `cap-${next.length + 1}`),
      kind,
      cny: money2(cny),
      fx,
      usd,
      note: row.note?.trim() || undefined,
      executedAt: row.executedAt || new Date().toISOString(),
      affectsCash: row.affectsCash === true,
    });
  }
  return next;
}

export function normalizeYearStart(value: unknown): YearMark | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<YearMark>;
  const usd = Number(row.usd);
  const date = String(row.date || "").trim();
  if (!date || !Number.isFinite(usd) || usd <= 0) return null;
  return { date, usd: money2(usd), note: row.note?.trim() || undefined };
}

export async function readPortfolio(): Promise<PortfolioFile> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as PortfolioFile;
    if (!parsed || !Array.isArray(parsed.trades)) return emptyPortfolio();
    return {
      version: 1,
      cash: normalizeCash(parsed.cash),
      capital: normalizeCapital(parsed.capital),
      yearStart: normalizeYearStart(parsed.yearStart),
      trades: parsed.trades,
    };
  } catch {
    if (Array.isArray(seed.trades)) {
      return {
        version: 1,
        cash: normalizeCash((seed as PortfolioFile).cash),
        capital: normalizeCapital((seed as PortfolioFile).capital),
        yearStart: normalizeYearStart((seed as PortfolioFile).yearStart),
        trades: seed.trades as PortfolioFile["trades"],
      };
    }
    return emptyPortfolio();
  }
}

async function writePortfolio(portfolio: PortfolioFile): Promise<void> {
  if (process.env.VERCEL) {
    throw new Error("线上网站不能直接改持仓。把买入卖出发给我，我会更新页面。");
  }
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(portfolio, null, 2) + "\n", "utf8");
  await rename(tmp, DATA_FILE);
}

export function deriveHoldings(trades: Trade[], quotes: Quote[]): Holding[] {
  const lots = new Map<
    string,
    { shares: number; cost: number; name: string }
  >();

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
    const dayPnl = (price - previousClose) * lot.shares;
    const dayPnlPercent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

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
      dayPnl,
      dayPnlPercent,
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
    events: [...events].sort(
      (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
    ),
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

export async function addCapitalEvent(input: {
  kind: CapitalKind;
  cny: number;
  fx: number;
  note?: string;
  executedAt?: string;
  affectsCash?: boolean;
}): Promise<CapitalEvent> {
  const cny = Number(input.cny);
  const fx = Number(input.fx);
  if (!Number.isFinite(cny) || cny <= 0) throw new Error("人民币金额必须大于 0");
  if (!Number.isFinite(fx) || fx <= 0) throw new Error("汇率必须大于 0");
  const kind = input.kind === "withdraw" ? "withdraw" : input.kind === "deposit" ? "deposit" : null;
  if (!kind) throw new Error("请选择入金或提现");

  return withLock(async () => {
    const portfolio = await readPortfolio();
    const event: CapitalEvent = {
      id: randomUUID(),
      kind,
      cny: money2(cny),
      fx,
      usd: money2(cny / fx),
      note: input.note?.trim() || undefined,
      executedAt: input.executedAt || new Date().toISOString(),
      affectsCash: input.affectsCash !== false,
    };
    if (event.affectsCash) {
      if (kind === "withdraw") {
        portfolio.cash = normalizeCash(Math.max(0, portfolio.cash - event.usd));
      } else {
        portfolio.cash = normalizeCash(portfolio.cash + event.usd);
      }
    }
    portfolio.capital.push(event);
    await writePortfolio(portfolio);
    return event;
  });
}

export async function removeCapitalEvent(id: string): Promise<void> {
  await withLock(async () => {
    const portfolio = await readPortfolio();
    const event = portfolio.capital.find((row) => row.id === id);
    if (!event) throw new Error("找不到这笔资金记录");
    if (event.affectsCash) {
      if (event.kind === "withdraw") {
        portfolio.cash = normalizeCash(portfolio.cash + event.usd);
      } else {
        portfolio.cash = normalizeCash(Math.max(0, portfolio.cash - event.usd));
      }
    }
    portfolio.capital = portfolio.capital.filter((row) => row.id !== id);
    await writePortfolio(portfolio);
  });
}

export async function setCash(amount: number): Promise<number> {
  const cash = normalizeCash(amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("现金必须是大于等于 0 的数字");
  }
  return withLock(async () => {
    const portfolio = await readPortfolio();
    portfolio.cash = cash;
    await writePortfolio(portfolio);
    return portfolio.cash;
  });
}

export function heldShares(trades: Trade[], symbol: string): number {
  const target = normalizeSymbol(symbol);
  return trades.reduce((shares, trade) => {
    if (normalizeSymbol(trade.symbol) !== target) return shares;
    return trade.side === "buy" ? shares + trade.shares : shares - trade.shares;
  }, 0);
}

function tradeCashAmount(trade: Pick<Trade, "shares" | "price">): number {
  return money2(trade.shares * trade.price);
}

function applyTradeToCash(cash: number, trade: Trade, undo = false): number {
  if (trade.affectsCash !== true) return normalizeCash(cash);
  const amount = tradeCashAmount(trade);
  const sign = trade.side === "sell" ? 1 : -1;
  const delta = (undo ? -sign : sign) * amount;
  return normalizeCash(Math.max(0, cash + delta));
}

export async function addTrade(input: {
  symbol: string;
  name?: string;
  side: TradeSide;
  shares: number;
  price: number;
  executedAt?: string;
  note?: string;
  affectsCash?: boolean;
}): Promise<Trade> {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) throw new Error("请填写股票代码");
  if (!Number.isFinite(input.shares) || input.shares <= 0) {
    throw new Error("股数必须大于 0");
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("成交价必须大于 0");
  }

  return withLock(async () => {
    const portfolio = await readPortfolio();
    if (input.side === "sell") {
      const available = heldShares(portfolio.trades, symbol);
      if (input.shares - available > 1e-8) {
        throw new Error(`可卖数量不足，当前持有 ${available} 股`);
      }
    }

    const trade: Trade = {
      id: randomUUID(),
      symbol,
      name: input.name?.trim() || symbol,
      side: input.side,
      shares: Number(input.shares),
      price: Number(input.price),
      executedAt: input.executedAt || new Date().toISOString(),
      note: input.note?.trim() || undefined,
    };

    trade.affectsCash = input.affectsCash !== false;
    portfolio.trades.push(trade);
    portfolio.cash = applyTradeToCash(portfolio.cash, trade);
    await writePortfolio(portfolio);
    return trade;
  });
}

export async function removeTrade(id: string): Promise<void> {
  await withLock(async () => {
    const portfolio = await readPortfolio();
    const removed = portfolio.trades.find((trade) => trade.id === id);
    const next = portfolio.trades.filter((trade) => trade.id !== id);
    if (!removed) {
      throw new Error("找不到这笔交易");
    }
    const replay = deriveHoldings(next, []);
    const negative = replay.find((row) => row.shares < 0);
    if (negative) {
      throw new Error("删除后持仓会变成负数，先处理后续卖出记录");
    }
    await writePortfolio({
      version: 1,
      cash: applyTradeToCash(portfolio.cash, removed, true),
      capital: portfolio.capital,
      yearStart: portfolio.yearStart,
      trades: next,
    });
  });
}
