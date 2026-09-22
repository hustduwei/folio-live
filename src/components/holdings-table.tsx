"use client";

import { Sparkline } from "@/components/sparkline";
import { FlashValue } from "@/components/flash-value";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPercent,
  formatShares,
  formatSignedUsd,
  formatUsd,
  formatUsdPrecise,
  signedClass,
} from "@/lib/format";
import type { Holding } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="text-base font-medium">还没有持仓</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          直接跟我说买入或卖出，例如「买入 AAPL 10 股，成本 180」；也可以在右侧把成交登记进来。登记后总市值会跟着行情跳动。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标的</TableHead>
              <TableHead className="text-right">现价</TableHead>
              <TableHead className="text-right">持股</TableHead>
              <TableHead className="text-right">成本</TableHead>
              <TableHead className="text-right">市值</TableHead>
              <TableHead className="text-right">今日</TableHead>
              <TableHead className="text-right">累计盈亏</TableHead>
              <TableHead className="w-28">走势</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((row) => (
              <TableRow key={row.symbol}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-semibold">{row.symbol}</span>
                    <span className="max-w-40 truncate text-xs text-muted-foreground">
                      {row.name}
                      {row.quoteMissing ? " · 暂无报价" : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  <FlashValue value={row.price} className={signedClass(row.change)}>
                    {formatUsdPrecise(row.price)}
                  </FlashValue>
                  <div className={cn("text-xs", signedClass(row.changePercent))}>
                    {formatPercent(row.changePercent)}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatShares(row.shares)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatUsd(row.avgCost)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatUsd(row.marketValue)}
                  <div className="text-xs text-muted-foreground">{row.weight.toFixed(1)}%</div>
                </TableCell>
                <TableCell className={cn("text-right font-mono", signedClass(row.dayPnl))}>
                  {formatSignedUsd(row.dayPnl)}
                </TableCell>
                <TableCell className={cn("text-right font-mono", signedClass(row.pnl))}>
                  {formatSignedUsd(row.pnl)}
                  <div className="text-xs">{formatPercent(row.pnlPercent)}</div>
                </TableCell>
                <TableCell>
                  <Sparkline points={row.spark} up={row.change >= 0} className="h-7 w-[88px]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {holdings.map((row) => (
          <article key={row.symbol} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{row.symbol}</p>
                <p className="text-xs text-muted-foreground">{row.name}</p>
              </div>
              <div className="text-right">
                <FlashValue value={row.price} className={cn("font-mono", signedClass(row.change))}>
                  {formatUsdPrecise(row.price)}
                </FlashValue>
                <p className={cn("text-xs", signedClass(row.changePercent))}>
                  {formatPercent(row.changePercent)}
                </p>
              </div>
            </div>
            <Sparkline points={row.spark} up={row.change >= 0} className="mt-3 h-8 w-full" />
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">持股</dt>
                <dd className="font-mono">{formatShares(row.shares)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">市值</dt>
                <dd className="font-mono">{formatUsd(row.marketValue)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">今日</dt>
                <dd className={cn("font-mono", signedClass(row.dayPnl))}>{formatSignedUsd(row.dayPnl)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-muted-foreground">累计盈亏</dt>
                <dd className={cn("font-mono", signedClass(row.pnl))}>
                  {formatSignedUsd(row.pnl)} {formatPercent(row.pnlPercent)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
