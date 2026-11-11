import esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MARKET_TAPE_SYMBOLS } from "../src/lib/markets";
import { readPortfolio } from "../src/lib/portfolio";
import { fetchQuotes, normalizeSymbol } from "../src/lib/quotes";
import { viewSnapshot } from "../src/lib/view";
import { renderPage } from "../src/pages/render";

function gate(dashboardHtml: string): string {
  const packed = JSON.stringify(dashboardHtml).replaceAll("<", "\\u003c");
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
  </style>
</head>
<body>
  <form id="lock">
    <h1>持仓全景图</h1>
    <p>点进入即可查看。密码可以随便填，也可以留空。</p>
    <input id="password" type="password" autocomplete="off" placeholder="密码" autofocus />
    <button type="submit">进入</button>
  </form>
  <script id="vault" type="application/json">${packed}</script>
  <script>
    const dashboard = JSON.parse(document.getElementById("vault").textContent);
    document.getElementById("lock").addEventListener("submit", (event) => {
      event.preventDefault();
      document.open();
      document.write(dashboard);
      document.close();
    });
  </script>
</body>
</html>`;
}

async function main(): Promise<void> {
  const portfolio = await readPortfolio();
  const symbols = [
    ...new Set([
      ...portfolio.trades.map((trade) => normalizeSymbol(trade.symbol)),
      ...MARKET_TAPE_SYMBOLS,
    ]),
  ];
  const quotes = await fetchQuotes(symbols);
  const snapshot = viewSnapshot(portfolio, quotes);
  const outDir = path.join(process.cwd(), "docs");
  await mkdir(outDir, { recursive: true });
  const dashboard = renderPage(snapshot, {
    books: { portfolio, fallback: quotes },
    scriptSrc: `live.js?v=${Date.now()}`,
  });
  await writeFile(path.join(outDir, "index.html"), gate(dashboard), "utf8");
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), "src/live/boot.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: path.join(outDir, "live.js"),
    legalComments: "none",
  });
  console.log(`wrote docs/index.html ${snapshot.holdings.length} holdings`);
}

void main();
