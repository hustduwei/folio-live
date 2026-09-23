"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { FlashValue } from "@/components/flash-value";
import { HoldingsTable } from "@/components/holdings-table";
import { HoldingsTreemap } from "@/components/holdings-treemap";
import { LiveClock } from "@/components/live-clock";
import { SectorAllocation, SectorCards } from "@/components/sector-board";
import { Sparkline } from "@/components/sparkline";
import { TradeForm } from "@/components/trade-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPercent,
  formatShares,
  formatSignedUsd,
  formatUsd,
  formatUsdPrecise,
  formatWeight,
  signedClass,
} from "@/lib/format";
import { QUOTE_POLL_MS } from "@/lib/market";
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
    let cancelled = false;
    const load = () => {
      void fetch("/api/snapshot", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "无法刷新行情");
          }
          return response.json() as Promise<Snapshot>;
        })
        .then((data) => {
          if (cancelled) return;
          setSnapshot(data);
          setError(formError || data.quotesError);
          setLive(true);
        })
        .catch(() => {
          if (!cancelled) setLive(false);
        });
    };
    const id = window.setInterval(load, QUOTE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [formError]);

  const totals = snapshot.totals;
  const market = snapshot.market;
  const sectors = snapshot.sectors ?? [];

  return (
    <div className="sheet mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="card-rise mb-7 flex flex-col gap-5 border-b border-black/10 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="brand inline-flex flex-wrap items-center gap-2.5">
            <span className={cn("dot size-2 rounded-full", live ? "bg-[#16A34A]" : "bg-muted-foreground")} />
            <span className="font-display text-[17px] font-bold tracking-[0.005em]">美股持仓</span>
            <span className="hidden h-3.5 w-px bg-black/10 sm:inline-block" />
            <span className="text-[12.5px] font-medium tracking-[0.08em] text-muted-foreground">实时看板</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="gap-1.5 rounded-full font-normal">
              <span className={cn("size-1.5 rounded-full", live ? "bg-[#16A34A] animate-pulse" : "bg-muted-foreground")} />
              {live ? "实时更新" : "连接中断"}
            </Badge>
            {market.state && (
              <Badge
                variant={market.state === "open" ? "default" : "secondary"}
                className={cn(market.state === "open" && "bg-[#16A34A] text-white")}
              >
                {market.label}
              </Badge>
            )}
            <LiveClock fetchedAt={snapshot.fetchedAt} />
          </div>
        </div>

        <div>
          <h1 className="hero-title font-display text-[clamp(34px,5.4vw,58px)] leading-none font-extrabold tracking-[-0.015em]">
            持仓全景图
          </h1>
          <p className="mt-2.5 text-sm tracking-[0.02em] text-muted-foreground">
            按板块分类的仓位占比 · <b className="text-foreground">{snapshot.holdings.length}</b> 个标的 ·{" "}
            <b className="text-foreground">{sectors.length}</b> 大板块
            {market.state === "open" || market.state === "pre" || market.state === "post"
              ? " · 报价每 3 秒刷新"
              : " · 美股已收盘，显示最新价"}
          </p>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}。页面会继续用上次成功的报价重试。
        </p>
      )}

      <section className="mb-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label="总市值"
          en="Value"
          color="#0369A1"
          delay={0.1}
          value={
            <FlashValue value={totals.marketValue}>
              <AnimatedNumber
                value={totals.marketValue}
                format={formatUsd}
                className="font-display text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.01em]"
              />
            </FlashValue>
          }
          hint={snapshot.holdings.length > 0 ? `${snapshot.holdings.length} 只股票` : "等待第一笔买入"}
        />
        <StatTile
          label="今日"
          en="Day"
          color="#EA580C"
          delay={0.16}
          value={
            <span className={cn("font-display text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.01em]", signedClass(totals.dayPnl))}>
              {formatSignedUsd(totals.dayPnl)}
            </span>
          }
          hint={formatPercent(totals.dayPnlPercent)}
          tone={totals.dayPnl}
        />
        <StatTile
          label="累计"
          en="P&L"
          color="#C41414"
          delay={0.22}
          value={
            <span className={cn("font-display text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.01em]", signedClass(totals.pnl))}>
              {formatSignedUsd(totals.pnl)}
            </span>
          }
          hint={formatPercent(totals.pnlPercent)}
          tone={totals.pnl}
        />
        <StatTile
          label="成本"
          en="Cost"
          color="#8A94B0"
          delay={0.28}
          value={
            <span className="font-display text-[clamp(26px,3vw,38px)] font-extrabold tracking-[-0.01em] text-foreground">
              {formatUsd(totals.cost)}
            </span>
          }
          hint={snapshot.trades.length > 0 ? `共 ${snapshot.trades.length} 笔成交` : "平均成本法"}
        />
      </section>

      <SectionTitle title="持仓地图" tag="Map" hint="方块面积 = 仓位占比" />
      <div className="card-rise mapwrap rounded-[20px] border border-black/10 bg-white p-3.5">
        <HoldingsTreemap sectors={sectors} />
      </div>

      <SectionTitle title="板块配置" tag="Allocation" hint={sectors.length > 0 ? `占股票总仓位 ${formatWeight(sectors.reduce((s, x) => s + x.weight, 0))}` : undefined} />
      <SectorAllocation sectors={sectors} />

      <SectionTitle title="板块明细" tag="Sectors" hint="涨跌按最新报价，红涨绿跌" />
      {sectors.length > 0 ? (
        <SectorCards sectors={sectors} />
      ) : (
        <p className="rounded-[18px] border border-dashed border-black/10 bg-white/70 px-4 py-10 text-center text-sm text-muted-foreground">
          还没有板块。买入后会按科技、消费、金融等自动归类。
        </p>
      )}

      <section className="mt-8 grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card-rise rounded-[18px] border border-black/10 bg-white p-5">
          <SectionHead title="登记成交" tag="Trade" desc="买入卖出都会立刻改总市值和地图" />
          <TradeForm snapshot={snapshot} onTraded={setSnapshot} />
        </div>
        <div className="card-rise rounded-[18px] border border-black/10 bg-white p-5">
          <SectionHead title="行情条" tag="Tape" desc="热门美股，用来确认报价是活的" />
          <div className="grid grid-cols-2 gap-2.5">
            {(snapshot.watchlist ?? []).map((quote) => (
              <div key={quote.symbol} className="rounded-xl border border-black/10 bg-[#F7F8FC] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{quote.symbol}</p>
                    <p className="max-w-24 truncate text-[11px] text-muted-foreground">{quote.name}</p>
                  </div>
                  <Sparkline points={quote.spark} up={quote.change >= 0} className="h-6 w-14" />
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <FlashValue value={quote.price} className="font-mono text-base font-bold">
                    {formatUsdPrecise(quote.price)}
                  </FlashValue>
                  <span className={cn("font-mono text-xs font-bold", signedClass(quote.changePercent))}>
                    {formatPercent(quote.changePercent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionTitle title="持仓明细" tag="Holdings" hint="按最新报价重估，平均成本法" />
      <div className="card-rise overflow-hidden rounded-[18px] border border-black/10 bg-white p-4 sm:p-5">
        <HoldingsTable holdings={snapshot.holdings} />
      </div>

      <SectionTitle title="成交记录" tag="Ledger" hint="这是持仓的唯一来源，撤掉一笔会重算仓位" />
      <div className="card-rise overflow-hidden rounded-[18px] border border-black/10 bg-white p-4 sm:p-5">
        {(snapshot.trades.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">还没有成交。说一句买入，就会出现在这里。</p>
        ) : (
          <ul className="divide-y divide-black/10">
            {snapshot.trades.map((trade) => (
              <li key={trade.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    variant="secondary"
                    className={cn(trade.side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down")}
                  >
                    {trade.side === "buy" ? "买" : "卖"}
                  </Badge>
                  <span className="font-mono font-bold">{trade.symbol}</span>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void fetch(`/api/trades?id=${encodeURIComponent(trade.id)}`, { method: "DELETE" })
                      .then(async (response) => {
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || "撤销失败");
                        setSnapshot(data);
                      })
                      .catch((error: unknown) => {
                        setError(error instanceof Error ? error.message : "撤销失败");
                      });
                  }}
                >
                  撤销
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-black/10 pt-4 font-mono text-[11.5px] tracking-wide text-muted-foreground">
        <p>本地持仓 · 报价 Yahoo Finance · 红涨绿跌</p>
        <p className="sm:text-right">这不是网页文件，需要用本机的 npm run dev 打开</p>
      </footer>
    </div>
  );
}

function SectionTitle({
  title,
  tag,
  hint,
}: {
  title: string;
  tag: string;
  hint?: string;
}) {
  return (
    <div className="mt-8 mb-4 flex flex-wrap items-baseline gap-3">
      <h2 className="font-display text-[21px] font-bold tracking-[-0.01em]">{title}</h2>
      <span className="font-mono text-[11px] tracking-[0.26em] text-muted-foreground uppercase">{tag}</span>
      {hint ? <span className="ml-auto text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function SectionHead({ title, tag, desc }: { title: string; tag: string; desc: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{tag}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function StatTile({
  label,
  en,
  color,
  value,
  hint,
  tone,
  delay,
}: {
  label: string;
  en: string;
  color: string;
  value: ReactNode;
  hint?: string;
  tone?: number;
  delay: number;
}) {
  return (
    <div
      className="card-rise relative overflow-hidden rounded-2xl border border-black/10 bg-white px-[18px] py-4"
      style={{ ["--c" as string]: color, animationDelay: `${delay}s` }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {label}
        <em className="font-mono text-[11px] tracking-[0.12em] not-italic uppercase opacity-70">{en}</em>
      </p>
      <div className="mt-1.5">{value}</div>
      {hint ? (
        <p className={cn("mt-1 font-mono text-[10px] tracking-wide text-muted-foreground", tone != null && signedClass(tone))}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
