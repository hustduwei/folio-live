import { randomBytes, webcrypto } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatCnyWhole,
  formatPercent,
  formatShares,
  formatUsdPrecise,
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

function whenLabel(iso: string, withTime = false): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hourCycle: "h23",
  };
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("zh-CN", options).format(new Date(iso));
}

function capitalTiles(snapshot: Snapshot): string {
  const capital = snapshot.capital;
  if (!capital) return "";
  const deposits = capital.events.filter((row) => row.kind === "deposit").length;
  const withdrawals = capital.events.filter((row) => row.kind === "withdraw").length;
  const cards = [
    ["原始本金", "In", formatUsdWhole(capital.principalUsd), "#0369A1", `${formatCnyWhole(capital.principalCny)} · ${deposits} 笔入金`],
    ["提现", "Out", formatUsdWhole(capital.withdrawnUsd), "#B45309", `${formatCnyWhole(capital.withdrawnCny)} · ${withdrawals} 笔`],
    ["净投入", "Basis", formatUsdWhole(capital.netCapitalUsd), "#5B6478", "入金 − 提现"],
    [
      "账户收益率",
      "All",
      formatPercent(capital.vsCapitalPercent),
      tone(capital.vsCapital),
      `${formatSignedUsdWhole(capital.vsCapital)} · 净投入 ${formatUsdWhole(capital.netCapitalUsd)}`,
    ],
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

function capitalLedger(snapshot: Snapshot): string {
  const events = [...(snapshot.capital?.events ?? [])].reverse();
  if (!events.length) return `<li>还没有资金记录。</li>`;
  return events
    .map(
      (event) => `
      <li>
        <span class="tag ${event.kind === "deposit" ? "in" : "out"}">${event.kind === "deposit" ? "入金" : "提现"}</span>
        <b>${esc(formatCnyWhole(event.cny))}</b>
        <span>÷ ${esc(String(event.fx))} = ${esc(formatUsd(event.usd))}</span>
        <span>${esc(whenLabel(event.executedAt))}</span>
        ${event.note ? `<span>${esc(event.note)}</span>` : ""}
      </li>`,
    )
    .join("");
}

function tradeLedger(snapshot: Snapshot): string {
  const trades = [...(snapshot.trades ?? [])].reverse();
  if (!trades.length) return `<li>还没有成交。</li>`;
  return trades
    .map(
      (trade) => `
      <li>
        <span class="tag ${trade.side === "buy" ? "buy" : "sell"}">${trade.side === "buy" ? "买" : "卖"}</span>
        <b>${esc(trade.symbol)}</b>
        <span>${esc(formatShares(trade.shares))} 股 @ ${esc(formatUsdPrecise(trade.price))}</span>
        <span>${esc(whenLabel(trade.executedAt, true))}</span>
        ${trade.note ? `<span>${esc(trade.note)}</span>` : ""}
      </li>`,
    )
    .join("");
}

function tape(snapshot: Snapshot): string {
  return (snapshot.watchlist ?? [])
    .map(
      (quote) => `
      <article class="tile">
        <p class="kicker">${esc(quote.symbol)}</p>
        <p class="stat" style="font-size:22px">${esc(formatUsdPrecise(quote.price))}</p>
        <p class="hint" style="color:${tone(quote.changePercent)}">${esc(formatPercent(quote.changePercent))}</p>
      </article>`,
    )
    .join("");
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
    .ledger { list-style: none; margin: 0; padding: 0; }
    .ledger li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; padding: 10px 4px; border-bottom: 1px solid #e2e8f0; font-family: "Avenir Next", "PingFang SC", sans-serif; font-size: 14px; }
    .tag { border-radius: 99px; padding: 2px 8px; font-size: 12px; }
    .tag.in { background: #0369A11f; color: #0369A1; }
    .tag.out { background: #B453091f; color: #B45309; }
    .tag.buy { background: #C414141f; color: #C41414; }
    .tag.sell { background: #16A34A1f; color: #16A34A; }
    .tape { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    @media (max-width: 800px) {
      .tiles, .sectors { grid-template-columns: 1fr 1fr; }
      .sectors, .tape { grid-template-columns: 1fr; }
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
    <h2>行情条</h2>
    <section class="tape">${tape(snapshot)}</section>
    <h2>持仓明细</h2>
    <section class="panel">${table(snapshot.holdings)}</section>
    <h2>资金</h2>
    <p class="sub">入金和提现按当时人民币汇率折成美元</p>
    <section class="tiles">${capitalTiles(snapshot)}</section>
    <h2>资金流水</h2>
    <section class="panel"><ul class="ledger">${capitalLedger(snapshot)}</ul></section>
    <h2>成交记录</h2>
    <section class="panel"><ul class="ledger">${tradeLedger(snapshot)}</ul></section>
    <p class="sub">买入、卖出和提现仍然发在对话里。更新后这个网页会在下一次自动刷新时变过来。红涨绿跌。</p>
  </main>
</body>
</html>
`;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function encryptHtml(html: string, password: string): Promise<{ salt: string; iv: string; data: string }> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const cipher = new Uint8Array(
    await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(html)),
  );
  return { salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(cipher) };
}

function gate(payload: { salt: string; iv: string; data: string }): string {
  const packed = JSON.stringify(payload);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>持仓全景图</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef1f4; color: #172033; font-family: "Songti SC", "Noto Serif SC", Georgia, serif; }
    form { width: min(420px, calc(100% - 32px)); background: #fff; border-radius: 20px; padding: 28px 24px; box-shadow: 0 1px 0 rgba(15,23,42,.06); }
    h1 { margin: 0 0 8px; font-size: 36px; }
    p { margin: 0 0 18px; color: #64748b; font-family: "PingFang SC", sans-serif; }
    input { width: 100%; height: 46px; border: 1px solid #d6dde6; border-radius: 12px; padding: 0 14px; font-size: 18px; }
    button { width: 100%; height: 46px; margin-top: 12px; border: 0; border-radius: 12px; background: #172033; color: #fff; font-size: 16px; }
    .err { min-height: 22px; margin-top: 10px; color: #C41414; font-family: "PingFang SC", sans-serif; }
  </style>
</head>
<body>
  <form id="lock">
    <h1>持仓全景图</h1>
    <p>输入密码后查看。</p>
    <input id="password" type="password" inputmode="numeric" autocomplete="current-password" placeholder="密码" autofocus />
    <button type="submit">进入</button>
    <p class="err" id="err"></p>
  </form>
  <script id="vault" type="application/json">${packed}</script>
  <script>
    const payload = JSON.parse(document.getElementById("vault").textContent);
    const form = document.getElementById("lock");
    const input = document.getElementById("password");
    const err = document.getElementById("err");
    function b64(value) {
      const bin = atob(value);
      return Uint8Array.from(bin, (char) => char.charCodeAt(0));
    }
    async function unlock(password) {
      const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: b64(payload.salt), iterations: 120000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(payload.iv) }, key, b64(payload.data));
      const html = new TextDecoder().decode(plain);
      sessionStorage.setItem("folio-live-password", password);
      document.open();
      document.write(html);
      document.close();
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      err.textContent = "正在打开…";
      unlock(input.value).catch(() => {
        err.textContent = "密码不对";
      });
    });
    const saved = sessionStorage.getItem("folio-live-password");
    if (saved) unlock(saved).catch(() => sessionStorage.removeItem("folio-live-password"));
  </script>
</body>
</html>`;
}

async function main(): Promise<void> {
  const password = process.env.PAGE_PASSWORD;
  if (!password) throw new Error("缺少 PAGE_PASSWORD");
  const snapshot = await buildSnapshot("fresh");
  const outDir = path.join(process.cwd(), "docs");
  await mkdir(outDir, { recursive: true });
  const payload = await encryptHtml(render(snapshot), password);
  await writeFile(path.join(outDir, "index.html"), gate(payload), "utf8");
  console.log(`wrote locked docs/index.html ${snapshot.holdings.length} holdings`);
}

void main();
