import type { MarketClock, MarketState } from "./types";

function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function getMarketClock(date = new Date()): MarketClock {
  const ny = nyParts(date);
  const minutes = ny.hour * 60 + ny.minute;
  const weekend = ny.weekday === "Sat" || ny.weekday === "Sun";
  const nyTime = `${String(ny.hour).padStart(2, "0")}:${String(ny.minute).padStart(2, "0")}:${String(ny.second).padStart(2, "0")}`;
  const nyDate = `${ny.year}-${ny.month}-${ny.day}`;

  let state: MarketState = "closed";
  if (!weekend) {
    if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) state = "pre";
    else if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) state = "open";
    else if (minutes >= 16 * 60 && minutes < 20 * 60) state = "post";
  }

  const labels: Record<MarketState, string> = {
    pre: "盘前",
    open: "开盘中",
    post: "盘后",
    closed: "已收盘",
  };

  return { state, label: labels[state], nyTime, nyDate };
}

const DAY_CUTOFF_HOUR = 20;

function nyLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = target;
  for (let i = 0; i < 3; i += 1) {
    const ny = nyParts(new Date(utc));
    const wall = Date.UTC(Number(ny.year), Number(ny.month) - 1, Number(ny.day), ny.hour, ny.minute, ny.second);
    utc = target - (wall - utc);
  }
  return new Date(utc);
}

/** Most recent 20:00 America/New_York. Trades after this instant belong to the next day. */
export function lastSettlementAt(now = new Date()): Date {
  const ny = nyParts(now);
  const todayCutoff = nyLocalToUtc(Number(ny.year), Number(ny.month), Number(ny.day), DAY_CUTOFF_HOUR, 0);
  if (now.getTime() >= todayCutoff.getTime()) return todayCutoff;
  const yesterday = nyParts(new Date(todayCutoff.getTime() - 36 * 60 * 60 * 1000));
  return nyLocalToUtc(Number(yesterday.year), Number(yesterday.month), Number(yesterday.day), DAY_CUTOFF_HOUR, 0);
}

export const QUOTE_POLL_MS = 3_000;

export function pollIntervalMs(): number {
  return QUOTE_POLL_MS;
}
