export type MarketTapeItem = {
  symbol: string;
  label: string;
  name: string;
  /** Index and futures levels are points. ETFs are quoted in dollars. */
  dollars: boolean;
};

export const MARKET_TAPE: MarketTapeItem[] = [
  { symbol: "^GSPC", label: "标普", name: "标普500", dollars: false },
  { symbol: "^DJI", label: "道指", name: "道琼斯", dollars: false },
  { symbol: "^IXIC", label: "纳指", name: "纳斯达克", dollars: false },
  { symbol: "QQQ", label: "纳指100", name: "QQQ", dollars: true },
  { symbol: "ES=F", label: "标普期货", name: "ES", dollars: false },
  { symbol: "YM=F", label: "道指期货", name: "YM", dollars: false },
  { symbol: "NQ=F", label: "纳指期货", name: "NQ", dollars: false },
];

export const MARKET_TAPE_SYMBOLS = MARKET_TAPE.map((item) => item.symbol);

const tapeBySymbol = new Map(MARKET_TAPE.map((item) => [item.symbol, item]));

export function marketTapeItem(symbol: string): MarketTapeItem | undefined {
  return tapeBySymbol.get(symbol);
}
