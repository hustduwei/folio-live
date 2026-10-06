"use client";

import { FlashValue } from "@/components/flash-value";
import { Sparkline } from "@/components/sparkline";
import { formatPercent, formatPoints, formatUsdPrecise, signedClass } from "@/lib/format";
import { marketTapeItem } from "@/lib/markets";
import type { Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MarketTape({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return (
      <p className="rounded-[18px] border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-muted-foreground">
        指数行情暂时没有拿到。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {quotes.map((quote) => {
        const item = marketTapeItem(quote.symbol);
        const price = item?.dollars ? formatUsdPrecise(quote.price) : formatPoints(quote.price);
        return (
          <article key={quote.symbol} className="rounded-[18px] border border-black/10 bg-white px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[13px] font-medium text-muted-foreground">
                {item?.label ?? quote.symbol}
                <span className="ml-1.5 font-mono text-[10px] tracking-[0.08em] uppercase opacity-70">
                  {quote.symbol}
                </span>
              </p>
              <Sparkline points={quote.spark} up={quote.change >= 0} className="h-5 w-12 shrink-0" />
            </div>
            <p className="mt-2 font-stat text-[clamp(16px,1.6vw,22px)] leading-none font-bold tracking-tight">
              <FlashValue value={quote.price}>{price}</FlashValue>
            </p>
            <p className={cn("mt-1.5 font-mono text-xs font-bold", signedClass(quote.changePercent))}>
              {formatPercent(quote.changePercent)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
