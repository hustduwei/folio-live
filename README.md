# 美股持仓看板

本地实时跟踪美股报价和持仓总市值。页面每 3 秒拉一次最新价。

之后你只要说「买入 / 卖出」即可，例如：

- `买入 AAPL 10 股，成本 180`
- `卖出 NVDA 2 股`

我会改 `data/portfolio.json`，本地页面会自动跟上。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:43147](http://localhost:43147)。

## 说明

- 报价来自 Yahoo Finance，无需 API Key。盘中接近实时，盘前盘后用全日最新价。
- 美股收盘后数字不会跳，但页面仍会持续刷新；开盘后会跟着变。
- 涨跌颜色按 A 股习惯：**红涨绿跌**。
- 持仓保存在 `data/portfolio.json`，没有登录，也不绑定 IP。
