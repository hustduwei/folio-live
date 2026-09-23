"use client";

import { useEffect, useState } from "react";
import { formatNyClock } from "@/lib/format";
import { getMarketClock } from "@/lib/market";

export function LiveClock({ fetchedAt }: { fetchedAt: string }) {
  const [now, setNow] = useState(() => getMarketClock());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(getMarketClock());
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-muted-foreground">
      纽约 {now.nyTime} · 报价 {formatNyClock(fetchedAt)}
    </span>
  );
}
