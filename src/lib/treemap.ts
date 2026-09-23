export type TreemapInput = {
  id: string;
  value: number;
};

export type TreemapRect = TreemapInput & {
  x: number;
  y: number;
  w: number;
  h: number;
};

function worst(row: number[], side: number): number {
  if (!row.length || side <= 0) return Infinity;
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function placeRow(
  row: (TreemapInput & { area: number })[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: TreemapRect[],
): { x: number; y: number; w: number; h: number } {
  const sum = row.reduce((acc, item) => acc + item.area, 0);
  if (sum <= 0) return { x, y, w, h };

  if (w >= h) {
    const rowW = sum / h;
    let cursor = y;
    for (const item of row) {
      const rowH = item.area / rowW;
      out.push({ id: item.id, value: item.value, x, y: cursor, w: rowW, h: rowH });
      cursor += rowH;
    }
    return { x: x + rowW, y, w: w - rowW, h };
  }

  const rowH = sum / w;
  let cursor = x;
  for (const item of row) {
    const rowW = item.area / rowH;
    out.push({ id: item.id, value: item.value, x: cursor, y, w: rowW, h: rowH });
    cursor += rowW;
  }
  return { x, y: y + rowH, w, h: h - rowH };
}

function layout(
  remaining: (TreemapInput & { area: number })[],
  row: (TreemapInput & { area: number })[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: TreemapRect[],
) {
  if (w <= 0 || h <= 0) return;
  if (!remaining.length) {
    if (row.length) placeRow(row, x, y, w, h, out);
    return;
  }

  const next = remaining[0];
  const candidate = [...row, next];
  const side = Math.min(w, h);
  const keep =
    row.length === 0 ||
    worst(
      row.map((item) => item.area),
      side,
    ) >=
      worst(
        candidate.map((item) => item.area),
        side,
      );

  if (keep) {
    layout(remaining.slice(1), candidate, x, y, w, h, out);
    return;
  }

  const rest = placeRow(row, x, y, w, h, out);
  layout(remaining, [], rest.x, rest.y, rest.w, rest.h, out);
}

export function squarify(
  items: TreemapInput[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreemapRect[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  if (total <= 0 || w <= 0 || h <= 0) return [];

  const area = w * h;
  const scaled = items
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ ...item, area: (item.value / total) * area }));

  const out: TreemapRect[] = [];
  layout(scaled, [], x, y, w, h, out);
  return out;
}
