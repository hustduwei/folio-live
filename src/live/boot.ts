import { MARKET_TAPE_SYMBOLS } from "../lib/markets";
import { normalizeSymbol } from "../lib/quotes";
import { viewSnapshot } from "../lib/view";
import type { PortfolioFile, Quote } from "../lib/types";
import { loadTencentQuotes, pickLiveQuote } from "./feed";
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
    const serverPromise = loadServerQuotes();
    let live: Quote[] | null = null;
    try {
      live = await loadTencentQuotes(symbols, books.fallback);
    } catch {
      live = null;
    }
    const server = await serverPromise;
    if (!live && server.length === 0) throw new Error("行情加载失败");
    const quotes = mergeNewer(live ?? books.fallback, server);
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

async function loadServerQuotes(): Promise<Quote[]> {
  try {
    const response = await fetch(`quotes.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = (await response.json()) as { quotes?: Quote[] };
    return Array.isArray(body.quotes) ? body.quotes : [];
  } catch {
    return [];
  }
}

/** Keep the newer print. A stale regular close must not wipe a published overnight price. */
function mergeNewer(primary: Quote[], extra: Quote[], now = new Date()): Quote[] {
  const extraBySymbol = new Map(extra.map((quote) => [normalizeSymbol(quote.symbol), quote]));
  const seen = new Set<string>();
  const merged = primary.map((quote) => {
    const symbol = normalizeSymbol(quote.symbol);
    seen.add(symbol);
    return pickLiveQuote(quote, extraBySymbol.get(symbol), now) ?? quote;
  });
  for (const quote of extra) {
    const symbol = normalizeSymbol(quote.symbol);
    if (!seen.has(symbol)) merged.push(quote);
  }
  return merged;
}

function bindEquityChart(): void {
  const plot = document.querySelector<HTMLElement>(".curve-plot");
  const data = document.getElementById("equity-points");
  if (!plot || !data?.textContent || plot.dataset.bound === "1") return;
  const parsed = JSON.parse(data.textContent) as {
    points?: { date: string; nav: number }[];
    yearStart?: number;
  };
  const points = parsed.points ?? [];
  const yearStart = parsed.yearStart ?? 0;
  if (points.length < 2 || !(yearStart > 0)) return;
  const hits = [...plot.querySelectorAll<SVGCircleElement>(".curve-hit")];
  if (hits.length !== points.length) return;
  plot.dataset.bound = "1";
  const tip = document.createElement("div");
  tip.className = "curve-tip";
  tip.hidden = true;
  const marker = document.createElement("div");
  marker.className = "curve-line";
  marker.hidden = true;
  const dot = document.createElement("div");
  dot.className = "curve-dot";
  dot.hidden = true;
  plot.append(tip, marker, dot);

  const show = (clientX: number) => {
    const box = plot.getBoundingClientRect();
    let index = 0;
    let best = Number.POSITIVE_INFINITY;
    hits.forEach((hit, hitIndex) => {
      const rect = hit.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < best) {
        best = distance;
        index = hitIndex;
      }
    });
    const hit = hits[index];
    const rect = hit.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - box.left;
    const top = rect.top + rect.height / 2 - box.top;
    const point = points[index];
    const previous = points[Math.max(0, index - 1)];
    const ytd = point.nav - yearStart;
    const dayChange = index === 0 ? 0 : point.nav - previous.nav;
    const percent = (ytd / yearStart) * 100;
    const [, month, day] = point.date.split("-");
    const sign = (value: number) => (value > 0 ? "+" : "");
    const shift = left < 96 ? "0%" : left > box.width - 96 ? "-100%" : "-50%";
    tip.hidden = false;
    marker.hidden = false;
    dot.hidden = false;
    tip.style.transform = `translate(${shift}, -130%)`;
    tip.innerHTML = `<b>${Number(month)}月${Number(day)}日</b>年度收益 ${sign(ytd)}$${Math.round(ytd).toLocaleString("en-US")} · ${sign(percent)}${percent.toFixed(2)}%<br>较前一日 ${sign(dayChange)}$${Math.round(dayChange).toLocaleString("en-US")}`;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    marker.style.left = `${left}px`;
    dot.style.left = `${left}px`;
    dot.style.top = `${top}px`;
  };

  plot.addEventListener("pointermove", (event) => show(event.clientX));
  plot.addEventListener("pointerdown", (event) => show(event.clientX));
  plot.addEventListener("pointerleave", () => {
    tip.hidden = true;
    marker.hidden = true;
    dot.hidden = true;
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
