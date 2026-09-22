# 美股持仓看板

实时跟踪美股持仓总市值。行情约每 5 秒刷新一次（收盘后 20 秒），买入卖出后按最新报价重估。

之后你只要说「买入 / 卖出」即可，例如：

- `买入 AAPL 10 股，成本 180`
- `卖出 NVDA 2 股`

我会改 `data/portfolio.json`，页面会自动跟上。也可以在页面右侧自己登记成交。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:43147](http://localhost:43147)。

生产构建：

```bash
npm run build
npm start
```

## 说明

- 报价来自 Yahoo Finance 公开接口，无需 API Key。盘中接近实时，盘前盘后使用全日最新价。
- 涨跌颜色按 A 股习惯：**红涨绿跌**。
- 成本按移动平均法；卖出不能超过当前持股。
- 持仓只保存在本仓库的 `data/portfolio.json`，没有账户登录。
