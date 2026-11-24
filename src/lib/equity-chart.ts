import type { EquityPoint } from "./types";

const WIDTH = 1000;
const HEIGHT = 320;
const PAD = { l: 8, r: 78, t: 16, b: 32 };

function moneyLabel(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function equitySvg(points: EquityPoint[], yearStart: number | null): string {
  if (points.length < 2) return "";
  const navs = points.map((point) => point.nav);
  let min = Math.min(...navs);
  let max = Math.max(...navs);
  if (yearStart != null && yearStart > 0) {
    min = Math.min(min, yearStart);
    max = Math.max(max, yearStart);
  }
  const span = Math.max(max - min, 1);
  min -= span * 0.08;
  max += span * 0.08;
  const innerW = WIDTH - PAD.l - PAD.r;
  const innerH = HEIGHT - PAD.t - PAD.b;
  const xAt = (index: number) => PAD.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const yAt = (nav: number) => PAD.t + ((max - nav) / (max - min)) * innerH;
  const up = points[points.length - 1].nav >= points[0].nav;
  const stroke = up ? "#C41414" : "#16A34A";
  const fill = up ? "rgba(196,20,20,.14)" : "rgba(22,163,74,.14)";
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(point.nav).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(points.length - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;
  const ticks = 4;
  const grid = Array.from({ length: ticks }, (_, index) => {
    const value = max - ((max - min) * index) / (ticks - 1);
    const y = yAt(value);
    return `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${WIDTH - PAD.r}" y2="${y.toFixed(1)}" stroke="rgba(26,31,54,.08)" /><text x="${WIDTH - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#6b7280" font-size="12" font-family="JetBrains Mono, ui-monospace, monospace">${moneyLabel(value)}</text>`;
  }).join("");
  const labelIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const labels = [...new Set(labelIndexes)]
    .map((index) => {
      const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
      return `<text x="${xAt(index).toFixed(1)}" y="${HEIGHT - 8}" text-anchor="${anchor}" fill="#6b7280" font-size="12" font-family="Noto Sans SC, sans-serif">${dateLabel(points[index].date)}</text>`;
    })
    .join("");
  const year =
    yearStart != null && yearStart > 0
      ? `<line x1="${PAD.l}" y1="${yAt(yearStart).toFixed(1)}" x2="${WIDTH - PAD.r}" y2="${yAt(yearStart).toFixed(1)}" stroke="#0369A1" stroke-dasharray="4 4" stroke-width="1.5" /><text x="${PAD.l + 4}" y="${(yAt(yearStart) - 6).toFixed(1)}" fill="#0369A1" font-size="12" font-family="Noto Sans SC, sans-serif">年初 ${moneyLabel(yearStart)}</text>`
      : "";
  const endX = xAt(points.length - 1);
  const endY = yAt(points[points.length - 1].nav);
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="账户净值曲线">
    ${grid}
    ${year}
    <path d="${area}" fill="${fill}" />
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="5" fill="${stroke}" />
    ${labels}
  </svg>`;
}

export const EQUITY_CHART = { width: WIDTH, height: HEIGHT, pad: PAD };
