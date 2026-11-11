import { MARKET_TAPE_SYMBOLS } from "../lib/markets";
import { normalizeSymbol } from "../lib/quotes";
import { viewSnapshot } from "../lib/view";
import type { PortfolioFile, Quote } from "../lib/types";
import { loadTencentQuotes } from "./feed";
import { renderPage, type PageBooks } from "../pages/render";

const POLL_MS = 5_000;

function readBooks(): PageBooks {
  const node = document.getElementById("books");
  if (!node?.textContent) throw new Error("缺少持仓数据");
  return JSON.parse(node.textContent) as PageBooks;
}

let refreshing = false;

function priceKey(quotes: Quote[]): string {
  return quotes
    .map((quote) => `${normalizeSymbol(quote.symbol)}:${quote.price}`)
    .sort()
    .join("|");
}

async function redraw(manual: boolean): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  const button = document.getElementById("refresh");
  if (manual && button) {
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
    const nextKey = priceKey(quotes);
    if (!manual && nextKey === sessionStorage.getItem("folio-prices")) return;
    sessionStorage.setItem("folio-prices", nextKey);
    sessionStorage.setItem("folio-scroll", String(window.scrollY));
    const timer = (window as unknown as { __folioTimer?: number }).__folioTimer;
    if (timer) window.clearInterval(timer);
    const portfolio: PortfolioFile = books.portfolio;
    const snapshot = viewSnapshot(portfolio, quotes);
    const nextBooks: PageBooks = { portfolio, fallback: mergeQuotes(books.fallback, quotes) };
    document.open();
    document.write(renderPage(snapshot, { live: true, books: nextBooks }));
    document.close();
  } catch {
    if (manual && button) {
      button.removeAttribute("disabled");
      button.textContent = "刷新失败";
    }
  } finally {
    refreshing = false;
  }
}

function mergeQuotes(fallback: Quote[], fresh: Quote[]): Quote[] {
  const bySymbol = new Map(fallback.map((quote) => [normalizeSymbol(quote.symbol), quote]));
  for (const quote of fresh) bySymbol.set(normalizeSymbol(quote.symbol), quote);
  return [...bySymbol.values()];
}

document.getElementById("refresh")?.addEventListener("click", () => {
  void redraw(true);
});

if (document.documentElement.dataset.live === "1") {
  const savedScroll = Number(sessionStorage.getItem("folio-scroll") || "0");
  if (savedScroll > 0) requestAnimationFrame(() => window.scrollTo(0, savedScroll));
  (window as unknown as { __folioTimer?: number }).__folioTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") void redraw(false);
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void redraw(false);
  });
} else {
  void redraw(false);
}
