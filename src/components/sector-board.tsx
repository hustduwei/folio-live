import { formatPercent, formatUsd, formatWeight, signedClass } from "@/lib/format";
import type { SectorGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SectorAllocation({ sectors }: { sectors: SectorGroup[] }) {
  const total = sectors.reduce((sum, sector) => sum + Math.max(0, sector.weight), 0);

  if (sectors.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-muted-foreground">
        有持仓后，这里会按板块展开仓位占比。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-11 overflow-hidden rounded-xl border border-black/10">
        {sectors.map((sector) => {
          const width = total > 0 ? (Math.max(0, sector.weight) / total) * 100 : 0;
          return (
            <div
              key={sector.key}
              className="flex min-w-[2px] items-center justify-center font-mono text-[11px] font-bold text-white"
              style={{ flex: Math.max(0.4, sector.weight), background: sector.hex }}
              title={`${sector.zh} ${formatWeight(sector.weight)}`}
            >
              <span className="truncate px-1 drop-shadow-sm">
                {width > 8 ? `${sector.zh} ` : ""}
                {width > 5 ? formatWeight(sector.weight) : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {sectors.map((sector) => (
          <span key={sector.key} className="inline-flex items-center gap-2 text-[13px]">
            <i className="size-2.5 rounded-[3px] shadow-[0_0_10px_-1px_var(--c)]" style={{ background: sector.hex, ["--c" as string]: sector.hex }} />
            {sector.zh}{" "}
            <b className="font-mono font-bold">{formatWeight(sector.weight)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SectorCards({ sectors }: { sectors: SectorGroup[] }) {
  if (sectors.length === 0) return null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sectors.map((sector, index) => (
        <article
          key={sector.key}
          className="card-rise overflow-hidden rounded-[18px] border border-black/10 bg-white transition-transform duration-200 hover:-translate-y-0.5"
          style={{ ["--c" as string]: sector.hex, animationDelay: `${0.08 + index * 0.05}s` }}
        >
          <div className="h-1 bg-[linear-gradient(90deg,var(--c),transparent_92%)]" />
          <div className="flex items-start gap-3 px-[18px] pt-4 pb-3">
            <div
              className="grid size-[38px] shrink-0 place-items-center rounded-[11px] text-lg"
              style={{
                color: sector.hex,
                background: `color-mix(in srgb, ${sector.hex} 16%, transparent)`,
                border: `1px solid color-mix(in srgb, ${sector.hex} 40%, transparent)`,
              }}
            >
              {sector.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-none">{sector.zh}</p>
              <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                {sector.en}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-[26px] leading-none font-extrabold" style={{ color: sector.hex }}>
                {formatWeight(sector.weight)}
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">{formatUsd(sector.marketValue)}</p>
            </div>
          </div>
          <div className="mx-[18px] mb-3 h-[5px] overflow-hidden rounded-[3px] bg-black/10">
            <i
              className="block h-full rounded-[3px]"
              style={{
                width: `${Math.min(100, sector.weight)}%`,
                background: sector.hex,
                boxShadow: `0 0 12px -2px ${sector.hex}`,
              }}
            />
          </div>
          <div className="px-[18px] pb-2">
            {sector.holdings.map((row) => (
              <div
                key={row.symbol}
                className="relative mb-1.5 flex items-center gap-2.5 overflow-hidden rounded-[9px] px-2.5 py-2"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-[9px] opacity-[0.16]"
                  style={{ width: `${Math.min(100, row.sectorWeight)}%`, background: sector.hex }}
                />
                <span className="relative font-mono text-sm font-bold">{row.symbol}</span>
                <span className="relative min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{row.name}</span>
                <span className={cn("relative ml-auto font-mono text-sm font-bold", signedClass(row.changePercent))}>
                  {formatPercent(row.changePercent)}
                </span>
                <span className="relative w-12 text-right font-mono text-sm font-bold">{formatWeight(row.weight)}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
