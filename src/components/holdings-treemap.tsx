"use client";

import { useMemo } from "react";
import { formatWeight } from "@/lib/format";
import { tileColor } from "@/lib/sectors";
import { squarify } from "@/lib/treemap";
import type { SectorGroup } from "@/lib/types";

const W = 1000;
const H = 560;
const PAD = 6;

export function HoldingsTreemap({ sectors }: { sectors: SectorGroup[] }) {
  const tiles = useMemo(() => {
    const leaves = sectors.flatMap((sector, sectorIndex) =>
      sector.holdings
        .filter((row) => row.weight > 0)
        .map((row, index) => ({
          id: row.symbol,
          value: row.weight,
          symbol: row.symbol,
          name: row.name,
          weight: row.weight,
          hex: tileColor(row.symbol, sector.hex, index + sectorIndex, Math.max(sector.holdings.length, 1)),
        })),
    );
    const layout = squarify(
      leaves.map((leaf) => ({ id: leaf.id, value: leaf.value })),
      PAD,
      PAD,
      W - PAD * 2,
      H - PAD * 2,
    );
    return layout.map((rect) => {
      const leaf = leaves.find((item) => item.id === rect.id);
      return { ...rect, ...leaf! };
    });
  }, [sectors]);

  if (tiles.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[10px] border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center sm:min-h-[360px]">
        <div>
          <p className="font-display text-lg font-bold">还没有仓位方块</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            登记第一笔买入后，这里会按仓位占比铺开持仓地图。方块越大，占组合的比重越高。
          </p>
        </div>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="持仓地图">
      <defs>
        <linearGradient id="tmMatte" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="38%" stopColor="white" stopOpacity="0.04" />
          <stop offset="100%" stopColor="black" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      {tiles.map((tile, index) => {
        const gap = 3;
        const x = tile.x + gap;
        const y = tile.y + gap;
        const w = Math.max(0, tile.w - gap * 2);
        const h = Math.max(0, tile.h - gap * 2);
        const cx = x + w / 2;
        const cy = y + h / 2;
        const minSide = Math.min(w, h);
        const landscape = w > h * 1.5 && h < 160;
        const compact = minSide < 56;
        const tickerSize = compact
          ? Math.max(10, Math.min(16, w / Math.max(tile.symbol.length * 0.7, 2)))
          : landscape
            ? Math.max(14, Math.min(22, w * 0.12))
            : Math.max(16, Math.min(36, Math.min(w * 0.22, h * 0.22)));
        const pctSize = compact ? 10 : 13;
        const twoLine = !compact && h > tickerSize + pctSize + 28;

        return (
          <g key={tile.id} className="tile" style={{ animationDelay: `${0.12 + index * 0.04}s` }}>
            <title>{`${tile.symbol} ${tile.name} ${formatWeight(tile.weight)}`}</title>
            <rect x={x} y={y} width={w} height={h} rx={10} fill={tile.hex} />
            <rect x={x} y={y} width={w} height={h} rx={10} fill="url(#tmMatte)" />
            {twoLine ? (
              <>
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  fill="white"
                  fontFamily="var(--font-display), sans-serif"
                  fontWeight={800}
                  fontSize={tickerSize}
                >
                  {tile.symbol}
                </text>
                <text
                  x={cx}
                  y={cy + pctSize + 8}
                  textAnchor="middle"
                  fill="white"
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight={700}
                  fontSize={pctSize}
                  opacity={0.82}
                >
                  {formatWeight(tile.weight)}
                </text>
              </>
            ) : (
              <text
                x={cx}
                y={cy + tickerSize * 0.35}
                textAnchor="middle"
                fill="white"
                fontFamily="var(--font-display), sans-serif"
                fontWeight={800}
                fontSize={tickerSize}
              >
                {tile.symbol}
                <tspan
                  dx={8}
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight={700}
                  fontSize={pctSize}
                  opacity={0.8}
                >
                  {formatWeight(tile.weight)}
                </tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
