import type { Holding, SectorGroup, SectorMeta } from "./types";

export const SECTOR_CATALOG: SectorMeta[] = [
  { key: "ai", zh: "科技 / AI", en: "Tech & AI", icon: "⚙", hex: "#3B5CE6" },
  { key: "consumer", zh: "消费", en: "Consumer", icon: "🛒", hex: "#EA580C" },
  { key: "finance", zh: "金融", en: "Finance", icon: "🏦", hex: "#30A8D8" },
  { key: "health", zh: "医疗", en: "Healthcare", icon: "➕", hex: "#2C2420" },
  { key: "energy", zh: "能源", en: "Energy", icon: "⛽", hex: "#CA8A04" },
  { key: "optical", zh: "光通讯", en: "Optical", icon: "◎", hex: "#7C3AED" },
  { key: "china", zh: "中概", en: "China ADRs", icon: "◆", hex: "#C41414" },
  { key: "space", zh: "太空", en: "Space", icon: "✦", hex: "#B91C1C" },
  { key: "crypto", zh: "加密货币", en: "Crypto", icon: "₿", hex: "#DC5C14" },
  { key: "etf", zh: "指数 / ETF", en: "Index & ETF", icon: "▣", hex: "#8A94B0" },
  { key: "other", zh: "其他", en: "Other", icon: "•", hex: "#3C3C3C" },
  { key: "cash", zh: "现金", en: "Cash", icon: "$", hex: "#8A94B0" },
];

const SYMBOL_SECTOR: Record<string, string> = {
  AAPL: "ai",
  MSFT: "ai",
  NVDA: "ai",
  GOOGL: "ai",
  GOOG: "ai",
  META: "ai",
  AVGO: "ai",
  TSM: "ai",
  AMD: "ai",
  INTC: "ai",
  QCOM: "ai",
  ORCL: "ai",
  CRM: "ai",
  ADBE: "ai",
  NOW: "ai",
  SNOW: "ai",
  PLTR: "ai",
  CRWV: "ai",
  AMAT: "ai",
  ASML: "ai",
  MU: "ai",
  ARM: "ai",
  SMCI: "ai",
  DELL: "ai",
  IBM: "ai",
  AMZN: "consumer",
  TSLA: "consumer",
  NFLX: "consumer",
  DIS: "consumer",
  NKE: "consumer",
  SBUX: "consumer",
  COST: "consumer",
  WMT: "consumer",
  HD: "consumer",
  MCD: "consumer",
  KO: "consumer",
  PEP: "consumer",
  JPM: "finance",
  GS: "finance",
  V: "finance",
  MA: "finance",
  PYPL: "finance",
  "BRK-B": "finance",
  "BRK-A": "finance",
  SOFI: "finance",
  BAC: "finance",
  WFC: "finance",
  JNJ: "health",
  PFE: "health",
  UNH: "health",
  LLY: "health",
  HIMS: "health",
  RXRX: "health",
  MRK: "health",
  ABBV: "health",
  XOM: "energy",
  CVX: "energy",
  COP: "energy",
  SMR: "energy",
  OKLO: "energy",
  LITE: "optical",
  BABA: "china",
  PDD: "china",
  JD: "china",
  BIDU: "china",
  NIO: "china",
  XPEV: "china",
  LI: "china",
  RKLB: "space",
  VSAT: "space",
  SPCE: "space",
  SPCX: "space",
  MSTR: "crypto",
  CRCL: "crypto",
  COIN: "crypto",
  MARA: "crypto",
  SPY: "etf",
  QQQ: "etf",
  DIA: "etf",
  IWM: "etf",
  VOO: "etf",
  VTI: "etf",
};

export const TICKER_HEX: Record<string, string> = {
  NVDA: "#76B900",
  AAPL: "#1D1D1F",
  MSFT: "#00A4EF",
  TSLA: "#CC0000",
  AMZN: "#FF9900",
  GOOGL: "#4285F4",
  GOOG: "#34A853",
  META: "#0866FF",
  AVGO: "#CC092F",
  AMD: "#ED1C24",
  TSM: "#4A90D9",
  NFLX: "#E50914",
  JPM: "#0A3D62",
  V: "#1A1F71",
  MA: "#EB001B",
  COST: "#E31837",
  WMT: "#0071CE",
  BABA: "#FF6A00",
  PDD: "#E02E24",
  MSTR: "#DC5C14",
  CRCL: "#3DCFCF",
  RKLB: "#C41414",
  SPCX: "#2C2C2C",
  VSAT: "#0F4C81",
  PLTR: "#3C3C3C",
  SOFI: "#30A8D8",
  HIMS: "#2C2420",
  LITE: "#7C3AED",
  SMR: "#CA8A04",
  OKLO: "#B45309",
  RXRX: "#0F766E",
  现金: "#8A94B0",
  CASH: "#8A94B0",
  USD: "#8A94B0",
};

const FALLBACK = SECTOR_CATALOG.find((sector) => sector.key === "other") ?? SECTOR_CATALOG[0];

export function sectorOf(symbol: string): SectorMeta {
  const key = SYMBOL_SECTOR[symbol] ?? "other";
  return SECTOR_CATALOG.find((sector) => sector.key === key) ?? FALLBACK;
}

export function tileColor(symbol: string, sectorHex: string, index: number, total: number): string {
  if (TICKER_HEX[symbol]) return TICKER_HEX[symbol];
  return shade(sectorHex, total > 1 ? (index / (total - 1)) * 0.16 : 0);
}

function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  const n = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.min(255, Math.round((n & 255) * (1 - amount)));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function groupBySector(holdings: Holding[]): SectorGroup[] {
  const buckets = new Map<string, Holding[]>();
  for (const holding of holdings) {
    const meta = sectorOf(holding.symbol);
    const list = buckets.get(meta.key) ?? [];
    list.push(holding);
    buckets.set(meta.key, list);
  }

  const groups: SectorGroup[] = [];
  for (const meta of SECTOR_CATALOG) {
    const rows = buckets.get(meta.key);
    if (!rows?.length) continue;
    const marketValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
    const weight = rows.reduce((sum, row) => sum + row.weight, 0);
    const dayPnl = rows.reduce((sum, row) => sum + row.dayPnl, 0);
    const pnl = rows.reduce((sum, row) => sum + row.pnl, 0);
    groups.push({
      ...meta,
      weight,
      marketValue,
      dayPnl,
      pnl,
      holdings: rows
        .slice()
        .sort((a, b) => b.marketValue - a.marketValue)
        .map((row) => ({
          symbol: row.symbol,
          name: row.name,
          weight: row.weight,
          sectorWeight: marketValue > 0 ? (row.marketValue / marketValue) * 100 : 0,
          marketValue: row.marketValue,
          changePercent: row.changePercent,
          dayPnl: row.dayPnl,
          pnl: row.pnl,
          shares: row.shares,
          price: row.price,
        })),
    });
  }
  return groups.sort((a, b) => b.marketValue - a.marketValue);
}

export function attachCashSector(
  sectors: SectorGroup[],
  cash: number,
  netValue: number,
): SectorGroup[] {
  if (!(cash > 0) || !(netValue > 0)) return sectors;

  const scaled = sectors.map((sector) => ({
    ...sector,
    weight: (sector.marketValue / netValue) * 100,
    holdings: sector.holdings.map((row) => ({
      ...row,
      weight: (row.marketValue / netValue) * 100,
    })),
  }));

  const cashMeta = SECTOR_CATALOG.find((sector) => sector.key === "cash") ?? {
    key: "cash",
    zh: "现金",
    en: "Cash",
    icon: "$",
    hex: "#8A94B0",
  };

  scaled.push({
    ...cashMeta,
    weight: (cash / netValue) * 100,
    marketValue: cash,
    dayPnl: 0,
    pnl: 0,
    holdings: [
      {
        symbol: "现金",
        name: "美元",
        weight: (cash / netValue) * 100,
        sectorWeight: 100,
        marketValue: cash,
        changePercent: 0,
        dayPnl: 0,
        pnl: 0,
        shares: 1,
        price: cash,
      },
    ],
  });

  return scaled.sort((a, b) => b.marketValue - a.marketValue);
}
