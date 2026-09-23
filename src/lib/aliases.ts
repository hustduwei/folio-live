export const SYMBOL_ALIASES: Record<string, string> = {
  苹果: "AAPL",
  微软: "MSFT",
  英伟达: "NVDA",
  辉达: "NVDA",
  谷歌: "GOOGL",
  谷歌a: "GOOGL",
  谷歌c: "GOOG",
  亚马逊: "AMZN",
  特斯拉: "TSLA",
  脸书: "META",
  元宇宙: "META",
  奈飞: "NFLX",
  网飞: "NFLX",
  博通: "AVGO",
  台积电: "TSM",
  阿里: "BABA",
  阿里巴巴: "BABA",
  拼多多: "PDD",
  京东: "JD",
  百度: "BIDU",
  小鹏: "XPEV",
  蔚来: "NIO",
  理想: "LI",
  可口可乐: "KO",
  伯克希尔: "BRK-B",
  标普: "SPY",
  纳指: "QQQ",
  纳斯达克: "QQQ",
  迪士尼: "DIS",
  英特尔: "INTC",
  超微: "AMD",
  超威: "AMD",
  高通: "QCOM",
  耐克: "NKE",
  星巴克: "SBUX",
  摩根: "JPM",
  摩根大通: "JPM",
  高盛: "GS",
  强生: "JNJ",
  辉瑞: "PFE",
  埃克森: "XOM",
  雪佛龙: "CVX",
  沃尔玛: "WMT",
  好市多: "COST",
  联合健康: "UNH",
  维萨: "V",
  万事达: "MA",
  Paypal: "PYPL",
  paypal: "PYPL",
  circle: "CRCL",
  hims: "HIMS",
  lumentum: "LITE",
  光通讯: "LITE",
  strategy: "MSTR",
  微策略: "MSTR",
  nuscale: "SMR",
  卫讯: "VSAT",
  oklo: "OKLO",
  "rocket lab": "RKLB",
  火箭实验室: "RKLB",
  recursion: "RXRX",
  palantir: "PLTR",
  帕兰提尔: "PLTR",
};

export const WATCHLIST = [
  "CRCL",
  "HIMS",
  "TSLA",
  "LITE",
  "NVDA",
  "MSTR",
  "SMR",
  "RKLB",
];

export function resolveAlias(query: string): string | null {
  const key = query.trim().toLowerCase();
  for (const [alias, symbol] of Object.entries(SYMBOL_ALIASES)) {
    if (alias.toLowerCase() === key) return symbol;
  }
  return null;
}

export function aliasHits(query: string): { symbol: string; name: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.entries(SYMBOL_ALIASES)
    .filter(([alias, symbol]) => alias.toLowerCase().includes(q) || symbol.toLowerCase().includes(q))
    .slice(0, 6)
    .map(([alias, symbol]) => ({ symbol, name: alias }));
}
