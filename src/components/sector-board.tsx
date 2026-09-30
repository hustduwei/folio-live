import { formatPercent, formatWeight, signedClass } from "@/lib/format";
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
    <div className="flex flex-col gap-2.5">
      {sectors.map((sector) => (
        <article
          key={sector.key}
          className="grid items-center gap-3 rounded-[18px] border border-black/10 bg-white px-4 py-3.5 sm:grid-cols-[240px_1fr] sm:gap-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <i className="h-9 w-2 shrink-0 rounded-full" style={{ background: sector.hex }} />
            <div className="min-w-0">
              <p className="font-display text-base leading-none font-bold">{sector.zh}</p>
              <p className="mt-1 truncate font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                {sector.en}
              </p>
            </div>
            <p className="ml-auto font-mono text-lg font-bold" style={{ color: sector.hex }}>
              {formatWeight(sector.weight)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sector.holdings.map((row) => (
              <div key={row.symbol} className="grid min-w-[148px] grid-cols-[auto_auto] gap-x-3 rounded-xl bg-[#f4f6fb] px-3 py-2">
                <span className="font-mono text-sm font-bold">{row.symbol}</span>
                <span className={cn("text-right font-mono text-sm font-bold", signedClass(row.changePercent))}>
                  {formatPercent(row.changePercent)}
                </span>
                <span className="col-span-2 truncate text-[11px] text-muted-foreground">
                  {row.name} · {formatWeight(row.weight)}
                </span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
