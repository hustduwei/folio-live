import { MARKET_TAPE_SYMBOLS } from "../lib/markets";
import { normalizeSymbol } from "../lib/quotes";
import { viewSnapshot } from "../lib/view";
import type { PortfolioFile, Quote } from "../lib/types";
import { loadTencentQuotes } from "./feed";
import { renderPage, type PageBooks } from "../pages/render";

function readBooks(): PageBooks {
  const node = document.getElementById("books");
  if (!node?.textContent) throw new Error("缺少持仓数据");
  return JSON.parse(node.textContent) as PageBooks;
}

async function redraw(): Promise<void> {
  const button = document.getElementById("refresh");
  if (button) {
    button.setAttribute("disabled", "true");
    button.textContent = "刷新中";
  }
  try {
    const books = readBooks();
    const symbols = [
      ...new Set([
        ...books.portfolio.trades.map((trade) => normalizeSymbol(trade.symbol)),
        ...MARKET_TAPE_SYMBOLS,
      ]),
    ];
    const quotes = await loadTencentQuotes(symbols, books.fallback);
    const portfolio: PortfolioFile = books.portfolio;
    const snapshot = viewSnapshot(portfolio, quotes);
    const nextBooks: PageBooks = { portfolio, fallback: mergeQuotes(books.fallback, quotes) };
    document.open();
    document.write(renderPage(snapshot, { live: true, books: nextBooks }));
    document.close();
  } catch {
    if (button) {
      button.removeAttribute("disabled");
      button.textContent = "刷新失败";
    }
  }
}

function mergeQuotes(fallback: Quote[], fresh: Quote[]): Quote[] {
  const bySymbol = new Map(fallback.map((quote) => [normalizeSymbol(quote.symbol), quote]));
  for (const quote of fresh) bySymbol.set(normalizeSymbol(quote.symbol), quote);
  return [...bySymbol.values()];
}

document.getElementById("refresh")?.addEventListener("click", () => {
  void redraw();
});

if (document.documentElement.dataset.live !== "1") {
  void redraw();
}
