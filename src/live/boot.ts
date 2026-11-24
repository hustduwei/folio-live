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
    const nextBooks: PageBooks = {
      portfolio,
      fallback: mergeQuotes(books.fallback, quotes),
      equity: books.equity,
    };
    const scriptSrc = document.querySelector("script[src*='live.js']")?.getAttribute("src") ?? "live.js";
    document.open();
    document.write(renderPage(snapshot, { live: true, books: nextBooks, scriptSrc }));
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

function bindEquityChart(): void {
  const plot = document.querySelector<HTMLElement>(".curve-plot");
  const data = document.getElementById("equity-points");
  if (!plot || !data?.textContent || plot.dataset.bound === "1") return;
  const parsed = JSON.parse(data.textContent) as { points?: { date: string; nav: number }[] };
  const points = parsed.points ?? [];
  if (points.length < 2) return;
  plot.dataset.bound = "1";
  const tip = document.createElement("div");
  tip.className = "curve-tip";
  tip.hidden = true;
  const marker = document.createElement("div");
  marker.className = "curve-line";
  marker.hidden = true;
  plot.append(tip, marker);
  const width = Number(plot.dataset.width || "1000");
  const padLeft = Number(plot.dataset.padLeft || "8");
  const padRight = Number(plot.dataset.padRight || "78");

  const show = (clientX: number) => {
    const box = plot.getBoundingClientRect();
    const local = ((clientX - box.left) / box.width) * width;
    const inner = width - padLeft - padRight;
    const ratio = Math.min(1, Math.max(0, (local - padLeft) / inner));
    const index = Math.round(ratio * (points.length - 1));
    const point = points[index];
    const previous = points[Math.max(0, index - 1)];
    const dayChange = index === 0 ? 0 : point.nav - previous.nav;
    const [, month, day] = point.date.split("-");
    const sign = dayChange > 0 ? "+" : "";
    tip.hidden = false;
    marker.hidden = false;
    tip.innerHTML = `<b>${Number(month)}月${Number(day)}日</b>净值 $${Math.round(point.nav).toLocaleString("en-US")}<br>较前一日 ${sign}$${Math.round(dayChange).toLocaleString("en-US")}`;
    const x = padLeft + ratio * inner;
    const left = (x / width) * box.width;
    tip.style.left = `${left}px`;
    tip.style.top = "28px";
    marker.style.left = `${left}px`;
  };

  plot.addEventListener("pointermove", (event) => show(event.clientX));
  plot.addEventListener("pointerdown", (event) => show(event.clientX));
  plot.addEventListener("pointerleave", () => {
    tip.hidden = true;
    marker.hidden = true;
  });
}

document.getElementById("refresh")?.addEventListener("click", () => {
  void redraw(true);
});
bindEquityChart();

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
