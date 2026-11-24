import type { EquityPoint } from "./types";

const WIDTH = 1000;
const HEIGHT = 320;
const PAD = { l: 8, r: 86, t: 18, b: 32 };

function moneyLabel(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function polygon(coords: Array<[number, number]>): string {
  return `${coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} Z`;
}

export function equitySvg(points: EquityPoint[], baseline: number): string {
  if (points.length < 2 || !(baseline > 0)) return "";
  const values = points.map((point) => point.nav - baseline);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  const span = Math.max(max - min, 1);
  min -= span * 0.08;
  max += span * 0.08;
  const innerW = WIDTH - PAD.l - PAD.r;
  const innerH = HEIGHT - PAD.t - PAD.b;
  const xAt = (index: number) => PAD.l + (index / (points.length - 1)) * innerW;
  const yAt = (value: number) => PAD.t + ((max - value) / (max - min)) * innerH;
  const zeroY = yAt(0);
  const up: string[] = [];
  const down: string[] = [];
  const red: string[] = [];
  const green: string[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const x0 = xAt(index);
    const x1 = xAt(index + 1);
    const v0 = values[index];
    const v1 = values[index + 1];
    const pieces: Array<[number, number, number, number]> = [];
    if (v0 === 0 && v1 === 0) continue;
    if (v0 * v1 < 0) {
      const ratio = v0 / (v0 - v1);
      const cross = x0 + (x1 - x0) * ratio;
      pieces.push([x0, v0, cross, 0], [cross, 0, x1, v1]);
    } else {
      pieces.push([x0, v0, x1, v1]);
    }
    for (const [ax, av, bx, bv] of pieces) {
      const positive = av > 0 || bv > 0;
      const shape = polygon([
        [ax, yAt(av)],
        [bx, yAt(bv)],
        [bx, zeroY],
        [ax, zeroY],
      ]);
      (positive ? up : down).push(shape);
      const stroke = `M${ax.toFixed(1)},${yAt(av).toFixed(1)} L${bx.toFixed(1)},${yAt(bv).toFixed(1)}`;
      (positive ? red : green).push(stroke);
    }
  }

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
  const end = values[values.length - 1];
  const endColor = end >= 0 ? "#C41414" : "#16A34A";
  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="年度收益曲线">
    ${grid}
    <line x1="${PAD.l}" y1="${zeroY.toFixed(1)}" x2="${WIDTH - PAD.r}" y2="${zeroY.toFixed(1)}" stroke="#1a1f36" stroke-dasharray="4 4" stroke-width="1.25" />
    <text x="${PAD.l + 4}" y="${(zeroY - 6).toFixed(1)}" fill="#1a1f36" font-size="12" font-family="Noto Sans SC, sans-serif">年初</text>
    <path d="${up.join(" ")}" fill="rgba(196,20,20,.16)" />
    <path d="${down.join(" ")}" fill="rgba(22,163,74,.16)" />
    <path d="${red.join(" ")}" fill="none" stroke="#C41414" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
    <path d="${green.join(" ")}" fill="none" stroke="#16A34A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${xAt(points.length - 1).toFixed(1)}" cy="${yAt(end).toFixed(1)}" r="5" fill="${endColor}" />
    ${labels}
  </svg>`;
}

export const EQUITY_CHART = { width: WIDTH, height: HEIGHT, pad: PAD };
