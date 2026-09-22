"use client";

import { useEffect, useState } from "react";
import { undoTrade } from "@/app/actions";
import { AnimatedNumber } from "@/components/animated-number";
import { FlashValue } from "@/components/flash-value";
import { HoldingsTable } from "@/components/holdings-table";
import { Sparkline } from "@/components/sparkline";
import { TradeForm } from "@/components/trade-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatNyClock,
  formatPercent,
  formatShares,
  formatSignedUsd,
  formatUsd,
  formatUsdPrecise,
  signedClass,
} from "@/lib/format";
import { pollIntervalMs } from "@/lib/market";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PortfolioDashboard({
  initialSnapshot,
  formError,
}: {
  initialSnapshot: Snapshot;
  formError?: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [error, setError] = useState<string | null>(formError || initialSnapshot.quotesError);
  const [live, setLive] = useState(!initialSnapshot.quotesError);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetch("/api/snapshot", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "无法刷新行情");
          }
          return response.json() as Promise<Snapshot>;
        })
        .then((data) => {
          setSnapshot(data);
          setError(formError || data.quotesError);
          setLive(true);
        })
        .catch(() => setLive(false));
    }, pollIntervalMs(snapshot.market.state));
    return () => window.clearInterval(id);
  }, [formError, snapshot.market.state]);

  const totals = snapshot.totals;
  const market = snapshot.market;
  const allocation = snapshot.holdings;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">US Equities</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">美股持仓看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">实时报价 · 红涨绿跌 · 总市值跟着仓位走</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span
              className={cn(
                "size-1.5 rounded-full",
                live ? "bg-up animate-pulse" : "bg-muted-foreground",
              )}
            />
            {live ? "实时更新" : "连接中断"}
          </Badge>
          {market.state && (
            <Badge
              variant={market.state === "open" ? "default" : "secondary"}
              className={cn(market.state === "open" && "bg-up text-white")}
            >
              {market.label}
            </Badge>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            纽约 {market.nyTime} · 刷新 {formatNyClock(snapshot.fetchedAt)}
          </span>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}。页面会继续用上次成功的报价重试。
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardDescription>当前总市值</CardDescription>
            <CardTitle className="flex flex-wrap items-end justify-between gap-3">
              <FlashValue value={totals.marketValue}>
                <AnimatedNumber
                  value={totals.marketValue}
                  format={formatUsd}
                  className="font-mono text-4xl tracking-tight sm:text-5xl"
                />
              </FlashValue>
              {allocation.length > 0 && (
                <AllocationBar holdings={allocation} />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
            <Stat
              label="今日盈亏"
              value={formatSignedUsd(totals.dayPnl)}
              hint={formatPercent(totals.dayPnlPercent)}
              tone={totals.dayPnl}
            />
            <Stat
              label="累计盈亏"
              value={formatSignedUsd(totals.pnl)}
              hint={formatPercent(totals.pnlPercent)}
              tone={totals.pnl}
            />
            <Stat label="持仓成本" value={formatUsd(totals.cost)} />
            <Stat
              label="标的数"
              value={String(snapshot.holdings.length)}
              hint={snapshot.holdings.length > 0 ? `共 ${snapshot.trades.length} 笔成交` : "等待第一笔买入"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>登记成交</CardTitle>
            <CardDescription>买入卖出都会立刻改总市值</CardDescription>
          </CardHeader>
          <CardContent>
            <TradeForm snapshot={snapshot} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>持仓</CardTitle>
          <CardDescription>按最新报价重估，平均成本法</CardDescription>
        </CardHeader>
        <CardContent>
          <HoldingsTable holdings={snapshot.holdings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>行情条</CardTitle>
          <CardDescription>热门美股，用来确认报价是活的</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(snapshot.watchlist ?? []).map((quote) => (
              <div key={quote.symbol} className="rounded-xl border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold">{quote.symbol}</p>
                    <p className="max-w-36 truncate text-xs text-muted-foreground">{quote.name}</p>
                  </div>
                  <Sparkline points={quote.spark} up={quote.change >= 0} className="h-6 w-16" />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <FlashValue value={quote.price} className="font-mono text-lg">
                    {formatUsdPrecise(quote.price)}
                  </FlashValue>
                  <span className={cn("font-mono text-sm", signedClass(quote.changePercent))}>
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成交记录</CardTitle>
          <CardDescription>这是持仓的唯一来源，撤掉一笔会重算仓位</CardDescription>
        </CardHeader>
        <CardContent>
          {(snapshot.trades.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">还没有成交。说一句买入，就会出现在这里。</p>
          ) : (
            <ul className="divide-y">
              {snapshot.trades.map((trade) => (
                <li key={trade.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge
                      variant="secondary"
                      className={cn(
                        trade.side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down",
                      )}
                    >
                      {trade.side === "buy" ? "买" : "卖"}
                    </Badge>
                    <span className="font-mono font-semibold">{trade.symbol}</span>
                    <span className="text-muted-foreground">
                      {formatShares(trade.shares)} 股 @ {formatUsdPrecise(trade.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(trade.executedAt))}
                    </span>
                    {trade.note && <span className="text-xs text-muted-foreground">{trade.note}</span>}
                  </div>
                  <form action={undoTrade}>
                    <input type="hidden" name="id" value={trade.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      撤销
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: number;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-lg font-medium", tone != null && signedClass(tone))}>{value}</p>
      {hint ? <p className={cn("text-xs", tone != null && signedClass(tone))}>{hint}</p> : null}
    </div>
  );
}

function AllocationBar({
  holdings,
}: {
  holdings: { symbol: string; weight: number }[];
}) {
  const palette = ["#f43f5e", "#fb7185", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#14b8a6"];
  return (
    <div className="min-w-40 max-w-xs flex-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {holdings.map((row, index) => (
          <div
            key={row.symbol}
            style={{ width: `${row.weight}%`, background: palette[index % palette.length] }}
            title={`${row.symbol} ${row.weight.toFixed(1)}%`}
          />
        ))}
      </div>
      <p className="mt-1 truncate text-right text-[11px] text-muted-foreground">
        {holdings
          .slice(0, 4)
          .map((row) => `${row.symbol} ${row.weight.toFixed(0)}%`)
          .join(" · ")}
      </p>
    </div>
  );
}
