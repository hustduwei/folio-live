"use client";

import { useEffect, useMemo, useState } from "react";
import { recordTrade } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SearchHit, Snapshot, TradeSide } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: Snapshot | null;
};

export function TradeForm({ snapshot }: Props) {
  const [side, setSide] = useState<TradeSide>("buy");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    const q = symbol.trim();
    if (picked || q.length < 1) return;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await response.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [symbol, picked]);

  const quoteHint = useMemo(() => {
    const code = symbol.trim().toUpperCase().replace(/\./g, "-");
    const fromHoldings = snapshot?.holdings.find((row) => row.symbol === code);
    if (fromHoldings) return fromHoldings.price;
    const fromWatch = snapshot?.watchlist.find((row) => row.symbol === code);
    return fromWatch?.price;
  }, [snapshot, symbol]);

  function chooseHit(hit: SearchHit) {
    setSymbol(hit.symbol);
    setName(hit.name);
    setHits([]);
    setPicked(true);
  }

  const showHits = !picked && (hits.length > 0 || searching);

  return (
    <form action={recordTrade} className="flex flex-col gap-4">
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="name" value={name} />

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={cn(
            "h-8 rounded-md text-sm font-medium transition-colors",
            side === "buy" ? "bg-up text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          买入
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={cn(
            "h-8 rounded-md text-sm font-medium transition-colors",
            side === "sell" ? "bg-down text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          卖出
        </button>
      </div>

      <div className="relative space-y-1.5">
        <Label htmlFor="symbol">代码或中文名</Label>
        <Input
          id="symbol"
          name="symbol"
          value={symbol}
          onValueChange={(value) => {
            setSymbol(value.toUpperCase());
            setName("");
            setPicked(false);
          }}
          className="h-10"
          placeholder="AAPL 或 苹果"
          autoComplete="off"
        />
        {showHits && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
            {searching && hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">正在搜索…</p>
            ) : (
              hits.map((hit) => (
                <button
                  key={`${hit.symbol}-${hit.name}`}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseHit(hit)}
                >
                  <span className="font-mono">{hit.symbol}</span>
                  <span className="truncate pl-3 text-xs text-muted-foreground">{hit.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="shares">股数</Label>
          <Input
            id="shares"
            name="shares"
            inputMode="decimal"
            defaultValue=""
            onFocus={() => setHits([])}
            className="h-10"
            placeholder="10"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">成交价 USD</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue=""
            onFocus={() => setHits([])}
            className="h-10"
            placeholder={quoteHint ? quoteHint.toFixed(2) : "180.00"}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">备注（可选）</Label>
        <Input id="note" name="note" className="h-10" placeholder="券商 / 账户" autoComplete="off" />
      </div>

      <Button type="submit" className="w-full">
        {side === "buy" ? "记入买入" : "记入卖出"}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        之后你也可以直接在对话里说：「买入 NVDA 5 股，成本 120」。我会改持仓，页面会自动跟上。
      </p>
    </form>
  );
}
