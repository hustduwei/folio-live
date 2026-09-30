import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatPercent,
  formatShares,
  formatSignedUsdWhole,
  formatUsd,
  formatUsdWhole,
  formatWeight,
} from "../src/lib/format";
import { buildSnapshot } from "../src/lib/snapshot";
import { tileColor } from "../src/lib/sectors";
import type { Holding, SectorGroup, Snapshot } from "../src/lib/types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tone(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "#64748b";
  return value > 0 ? "#C41414" : "#16A34A";
}

function tiles(snapshot: Snapshot): string {
  const totals = snapshot.totals;
  const year = snapshot.year;
  const cash = totals.cash ?? 0;
  const cards = [
    ["净资产", "Net", formatUsdWhole(totals.netValue), "#0369A1", `股票 ${formatUsdWhole(totals.marketValue)}`],
    ["今日", "Day", formatSignedUsdWhole(totals.dayPnl), tone(totals.dayPnl), formatPercent(totals.dayPnlPercent)],
    [
      "今年收益率",
      "YTD",
      year ? formatPercent(year.ytdPercent) : "—",
      year ? tone(year.ytdPnl) : "#64748b",
      year ? `${formatSignedUsdWhole(year.ytdPnl)} · 年初 ${formatUsdWhole(year.startUsd)}` : "还没有年初净值",
    ],
    ["现金", "Cash", formatUsdWhole(cash), "#0F172A", cash > 0 ? `占总资产 ${formatWeight(totals.cashWeight)}` : "还没有现金"],
  ];
  return cards
    .map(
      ([label, en, value, color, hint]) => `
      <article class="tile">
        <p class="kicker"><i style="background:${color}"></i>${esc(label)} <span>${esc(en)}</span></p>
        <p class="stat" style="color:${color}">${esc(value)}</p>
        <p class="hint">${esc(hint)}</p>
      </article>`,
    )
    .join("");
}

function mapBlocks(snapshot: Snapshot): string {
  const net = Math.max(snapshot.totals.netValue, 1);
  const cash = snapshot.totals.cash ?? 0;
  const blocks = [
    ...snapshot.holdings.map((holding) => ({
      label: holding.symbol,
      sub: formatWeight((holding.marketValue / net) * 100),
      value: holding.marketValue,
      color: tileColor(holding.symbol, "#334155", 0, 1),
    })),
  ];
  if (cash > 0) {
    blocks.push({
      label: "现金",
      sub: formatWeight(snapshot.totals.cashWeight),
      value: cash,
      color: "#8A94B0",
    });
  }
  blocks.sort((a, b) => b.value - a.value);
  return blocks
    .map(
      (block) => `
      <div class="block" style="flex:${Math.max(block.value, 1)} 1 120px;background:${block.color}">
        <strong>${esc(block.label)}</strong>
        <span>${esc(block.sub)}</span>
      </div>`,
    )
    .join("");
}

function sectorBar(sectors: SectorGroup[]): string {
  return sectors
    .map(
      (sector) =>
        `<i title="${esc(sector.zh)} ${formatWeight(sector.weight)}" style="width:${sector.weight}%;background:${sector.hex}"></i>`,
    )
    .join("");
}

function sectorCards(sectors: SectorGroup[]): string {
  return sectors
    .map((sector) => {
      const rows = sector.holdings
        .map(
          (holding: Holding) => `
          <li>
            <b>${esc(holding.symbol)}</b>
            <span>${esc(holding.name)}</span>
            <em style="color:${tone(holding.pnl)}">${esc(formatPercent(holding.changePercent))}</em>
            <small>${esc(formatWeight(holding.weight))}</small>
          </li>`,
        )
        .join("");
      return `
      <article class="card">
        <header>
          <strong>${esc(sector.zh)}</strong>
          <b style="color:${sector.hex}">${esc(formatWeight(sector.weight))}</b>
        </header>
        <ul>${rows}</ul>
      </article>`;
    })
    .join("");
}

function table(holdings: Holding[]): string {
  const rows = holdings
    .map(
      (holding) => `
      <tr>
        <td><b>${esc(holding.symbol)}</b><small>${esc(holding.name)}</small></td>
        <td>${esc(formatShares(holding.shares))}</td>
        <td>${esc(formatUsd(holding.avgCost))}</td>
        <td>${esc(formatUsd(holding.price))}</td>
        <td>${esc(formatUsdWhole(holding.marketValue))}</td>
        <td style="color:${tone(holding.dayPnl)}">${esc(formatSignedUsdWhole(holding.dayPnl))}</td>
        <td style="color:${tone(holding.pnl)}">${esc(formatPercent(holding.pnlPercent))}</td>
        <td>${esc(formatWeight(holding.weight))}</td>
      </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr><th>标的</th><th>股数</th><th>成本</th><th>现价</th><th>市值</th><th>今日</th><th>盈亏</th><th>仓位</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function render(snapshot: Snapshot): string {
  const year = snapshot.year;
  const capital = snapshot.capital;
  const when = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(snapshot.fetchedAt));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>持仓全景图</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef1f4; color: #172033; font-family: "Songti SC", "Noto Serif SC", Georgia, serif; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 20px 64px; }
    h1 { margin: 8px 0; font-size: clamp(36px, 6vw, 58px); letter-spacing: -0.03em; }
    .sub, .hint, small, .kicker span { color: #64748b; font-family: "Avenir Next", "PingFang SC", sans-serif; }
    .tiles, .sectors { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .tile, .card, .panel { background: #fff; border-radius: 18px; box-shadow: 0 1px 0 rgba(15,23,42,.06); }
    .tile { padding: 16px 18px 14px; }
    .kicker { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 13px; }
    .kicker i { width: 8px; height: 8px; border-radius: 99px; display: inline-block; }
    .stat { margin: 10px 0 4px; font-family: "DIN Alternate", "Avenir Next", sans-serif; font-size: clamp(28px, 4vw, 40px); letter-spacing: .02em; }
    .map { display: flex; flex-wrap: wrap; gap: 8px; min-height: 280px; margin: 18px 0; }
    .block { min-height: 92px; border-radius: 16px; color: white; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; }
    .block span, .bar i { font-family: "Avenir Next", sans-serif; }
    .bar { display: flex; height: 14px; border-radius: 99px; overflow: hidden; background: #e2e8f0; }
    .sectors { grid-template-columns: repeat(3, 1fr); margin-top: 14px; }
    .card { padding: 14px 16px; }
    .card header, .card li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .card ul { list-style: none; margin: 8px 0 0; padding: 0; }
    .card li { font-size: 13px; padding: 4px 0; font-family: "Avenir Next", "PingFang SC", sans-serif; }
    table { width: 100%; border-collapse: collapse; font-family: "Avenir Next", "PingFang SC", sans-serif; font-size: 14px; }
    th, td { text-align: right; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }
    th:first-child, td:first-child { text-align: left; }
    td small { display: block; }
    .panel { padding: 8px 12px 16px; margin-top: 16px; overflow-x: auto; }
    h2 { font-size: 18px; margin: 22px 0 8px; }
    @media (max-width: 800px) {
      .tiles, .sectors { grid-template-columns: 1fr 1fr; }
      .sectors { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <p class="sub">美股持仓 · 网页版 · 报价更新于北京时间 ${esc(when)} · 大约每 5 分钟自动刷新</p>
    <h1>持仓全景图</h1>
    <p class="sub">${snapshot.holdings.length} 个标的${year ? ` · 今年 ${formatPercent(year.ytdPercent)}` : ""}${capital?.netCapitalUsd ? ` · 账户 ${formatPercent(capital.vsCapitalPercent)}` : ""} · 现金 ${formatUsd(snapshot.totals.cash)}</p>
    <section class="tiles">${tiles(snapshot)}</section>
    <h2>持仓地图</h2>
    <section class="map">${mapBlocks(snapshot)}</section>
    <h2>板块配置</h2>
    <div class="bar">${sectorBar(snapshot.sectors)}</div>
    <section class="sectors">${sectorCards(snapshot.sectors)}</section>
    <h2>持仓明细</h2>
    <section class="panel">${table(snapshot.holdings)}</section>
    <p class="sub">买入、卖出和提现仍然发在对话里。更新后这个网页会在下一次自动刷新时变过来。红涨绿跌。</p>
  </main>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const snapshot = await buildSnapshot("fresh");
  const outDir = path.join(process.cwd(), "docs");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), render(snapshot), "utf8");
  console.log(`wrote docs/index.html ${snapshot.holdings.length} holdings`);
}

void main();
