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
import { squarify } from "../src/lib/treemap";
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
      <article class="tile" style="--c:${color}">
        <p class="kicker">${esc(label)} <em>${esc(en)}</em></p>
        <p class="stat" style="color:${color}">${esc(value)}</p>
        <p class="hint">${esc(hint)}</p>
      </article>`,
    )
    .join("");
}

function mapBlocks(snapshot: Snapshot): string {
  const net = Math.max(snapshot.totals.netValue, 1);
  const cash = snapshot.totals.cash ?? 0;
  const leaves = snapshot.holdings
    .filter((holding) => holding.marketValue > 0)
    .map((holding) => ({
      id: holding.symbol,
      value: holding.marketValue,
      label: holding.symbol,
      weight: (holding.marketValue / net) * 100,
      color: tileColor(holding.symbol, "#334155", 0, 1),
    }));
  if (cash > 0) {
    leaves.push({
      id: "CASH",
      value: cash,
      label: "现金",
      weight: snapshot.totals.cashWeight,
      color: "#8A94B0",
    });
  }
  if (!leaves.length) return "";

  const width = 1000;
  const height = 560;
  const pad = 4;
  const layout = squarify(
    leaves.map((leaf) => ({ id: leaf.id, value: leaf.value })),
    pad,
    pad,
    width - pad * 2,
    height - pad * 2,
  );
  const shapes = layout
    .map((rect) => {
      const leaf = leaves.find((item) => item.id === rect.id);
      if (!leaf) return "";
      const gap = 4;
      const x = rect.x + gap;
      const y = rect.y + gap;
      const w = Math.max(0, rect.w - gap * 2);
      const h = Math.max(0, rect.h - gap * 2);
      const cx = x + w / 2;
      const cy = y + h / 2;
      const minSide = Math.min(w, h);
      const compact = minSide < 70;
      const tickerSize = compact
        ? Math.max(12, Math.min(18, w / Math.max(leaf.label.length * 0.7, 2)))
        : Math.max(16, Math.min(34, Math.min(w, h) * 0.22));
      const pctSize = compact ? 11 : 14;
      const twoLine = !compact && h > tickerSize + pctSize + 36;
      const label = esc(leaf.label);
      const weight = esc(formatWeight(leaf.weight));
      const text = twoLine
        ? `<text x="${cx.toFixed(1)}" y="${(cy - 6).toFixed(1)}" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="${tickerSize.toFixed(1)}">${label}</text>
           <text x="${cx.toFixed(1)}" y="${(cy + pctSize + 8).toFixed(1)}" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="${pctSize}" opacity="0.86">${weight}</text>`
        : `<text x="${cx.toFixed(1)}" y="${(cy + tickerSize * 0.35).toFixed(1)}" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="${tickerSize.toFixed(1)}">${label}</text>`;
      return `<g><title>${label} ${weight}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="12" fill="${leaf.color}"/>${text}</g>`;
    })
    .join("");
  return `<svg class="map" viewBox="0 0 ${width} ${height}" role="img" aria-label="持仓地图">${shapes}</svg>`;
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
            <em style="color:${tone(holding.changePercent)}">${esc(formatPercent(holding.changePercent))}</em>
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
      <article class="tile" style="--c:${color}">
        <p class="kicker">${esc(label)} <em>${esc(en)}</em></p>
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
  const trades = [...(snapshot.trades ?? [])]
    .sort((a, b) => Date.parse(b.executedAt) - Date.parse(a.executedAt))
    .slice(0, 5);
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
      <article class="tile" style="--c:${tone(quote.changePercent)}">
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=JetBrains+Mono:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&family=Orbitron:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; --ink: #1a1f36; --muted: #6b7280; --line: rgba(0,0,0,.08); }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background-color: #f7f8fc;
      background-image: linear-gradient(rgba(0,0,0,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.035) 1px, transparent 1px);
      background-size: 42px 42px;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 72px; }
    .brand { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; letter-spacing: .08em; color: var(--muted); }
    .brand i { width: 8px; height: 8px; border-radius: 99px; background: #16a34a; display: inline-block; }
    h1 {
      margin: 10px 0 6px;
      font-family: "Bricolage Grotesque", "Noto Sans SC", sans-serif;
      font-size: clamp(40px, 6vw, 64px);
      line-height: .95;
      letter-spacing: -0.03em;
      background: linear-gradient(95deg, #1a1f36 20%, #4b5683 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    h2 { margin: 0; font-family: "Bricolage Grotesque", "Noto Sans SC", sans-serif; font-size: 22px; letter-spacing: -0.02em; }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; margin: 28px 0 12px; }
    .head span { margin-left: auto; color: var(--muted); font-size: 12px; }
    .sub, .hint, small { color: var(--muted); }
    .sub { margin: 0; font-size: 14px; }
    .tiles, .sectors, .tape { display: grid; gap: 12px; }
    .tiles { grid-template-columns: repeat(4, 1fr); }
    .sectors { grid-template-columns: repeat(3, 1fr); }
    .tape { grid-template-columns: repeat(4, 1fr); }
    .tile, .card, .panel, .mapwrap {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(26, 31, 54, .04);
    }
    .tile { position: relative; overflow: hidden; padding: 16px 18px 14px; }
    .tile::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c, #1a1f36); }
    .kicker { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 13px; font-weight: 500; color: var(--muted); }
    .kicker em { font-style: normal; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
    .stat { margin: 8px 0 4px; font-family: Orbitron, "JetBrains Mono", sans-serif; font-weight: 700; font-size: clamp(26px, 3vw, 36px); letter-spacing: .03em; line-height: 1; }
    .mapwrap { padding: 10px; }
    .map { display: block; width: 100%; height: auto; }
    .bar { display: flex; height: 16px; border-radius: 99px; overflow: hidden; background: #e7eaf2; }
    .card { padding: 16px; }
    .card header, .card li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .card ul { list-style: none; margin: 10px 0 0; padding: 0; }
    .card li { font-size: 13px; padding: 6px 0; border-top: 1px solid var(--line); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { color: var(--muted); font-weight: 500; font-size: 12px; }
    th, td { text-align: right; padding: 12px 8px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; }
    th:first-child, td:first-child { text-align: left; }
    td b, .kicker em { font-family: "JetBrains Mono", ui-monospace, monospace; }
    td small { display: block; color: var(--muted); font-family: "Noto Sans SC", "PingFang SC", sans-serif; }
    .panel { padding: 8px 16px 12px; overflow-x: auto; }
    .ledger { list-style: none; margin: 0; padding: 0; }
    .ledger li { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 12px 4px; border-bottom: 1px solid var(--line); font-size: 14px; }
    .tag { border-radius: 99px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
    .tag.in { background: #0369A11f; color: #0369A1; }
    .tag.out { background: #B453091f; color: #B45309; }
    .tag.buy { background: #C414141f; color: #C41414; }
    .tag.sell { background: #16A34A1f; color: #16A34A; }
    footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
    @media (max-width: 900px) {
      .tiles, .tape { grid-template-columns: 1fr 1fr; }
      .sectors { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <p class="brand"><i></i>美股持仓 · 实时看板</p>
    <h1>持仓全景图</h1>
    <p class="sub">${snapshot.holdings.length} 个标的${year ? ` · 今年 ${formatPercent(year.ytdPercent)}` : ""}${capital?.netCapitalUsd ? ` · 账户 ${formatPercent(capital.vsCapitalPercent)}` : ""} · 现金 ${formatUsd(snapshot.totals.cash)} · 更新于北京时间 ${esc(when)}</p>
    <section class="tiles">${tiles(snapshot)}</section>
    <div class="head"><h2>持仓地图</h2><span>方块面积 = 仓位占比</span></div>
    <section class="mapwrap">${mapBlocks(snapshot)}</section>
    <div class="head"><h2>板块配置</h2><span>红涨绿跌</span></div>
    <div class="bar">${sectorBar(snapshot.sectors)}</div>
    <section class="sectors">${sectorCards(snapshot.sectors)}</section>
    <div class="head"><h2>行情条</h2><span>大约每 5 分钟刷新</span></div>
    <section class="tape">${tape(snapshot)}</section>
    <div class="head"><h2>持仓明细</h2><span>按最新报价重估</span></div>
    <section class="panel">${table(snapshot.holdings)}</section>
    <div class="head"><h2>资金</h2><span>入金和提现按当时汇率折成美元</span></div>
    <section class="tiles">${capitalTiles(snapshot)}</section>
    <div class="head"><h2>资金流水</h2></div>
    <section class="panel"><ul class="ledger">${capitalLedger(snapshot)}</ul></section>
    <div class="head"><h2>成交记录</h2><span>最近 5 笔</span></div>
    <section class="panel"><ul class="ledger">${tradeLedger(snapshot)}</ul></section>
    <footer>买入、卖出和提现发在对话里。网页大约每 5 分钟更新。红涨绿跌。</footer>
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: #f7f8fc; color: #1a1f36; font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
    form { width: min(420px, 100%); min-width: 0; margin: 0; overflow: hidden; background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 20px; padding: 28px 24px; box-shadow: 0 10px 30px rgba(26,31,54,.06); }
    h1 { margin: 0 0 8px; font-family: "Bricolage Grotesque", "Noto Sans SC", sans-serif; font-size: 36px; letter-spacing: -0.03em; }
    p { margin: 0 0 18px; color: #6b7280; }
    input, button { display: block; width: 100%; max-width: 100%; min-width: 0; margin-left: 0; margin-right: 0; }
    input { height: 46px; border: 1px solid #d6dde6; border-radius: 12px; padding: 0 14px; font-size: 18px; }
    button { height: 46px; margin-top: 12px; border: 0; border-radius: 12px; background: #172033; color: #fff; font-size: 16px; }
    .err { min-height: 22px; margin-top: 10px; color: #C41414; }
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
