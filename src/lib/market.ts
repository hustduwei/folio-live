import type { MarketClock, MarketState } from "./types";

function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
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
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function getMarketClock(date = new Date()): MarketClock {
  const ny = nyParts(date);
  const minutes = ny.hour * 60 + ny.minute;
  const weekend = ny.weekday === "Sat" || ny.weekday === "Sun";
  const nyTime = `${String(ny.hour).padStart(2, "0")}:${String(ny.minute).padStart(2, "0")}`;
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

export function pollIntervalMs(state: MarketState): number {
  return state === "closed" ? 20_000 : 5_000;
}
