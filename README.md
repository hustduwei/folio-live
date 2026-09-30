# 持仓全景图

网页地址（发布完成后）：https://hustduwei.github.io/folio-live/

报价大约每 5 分钟自动刷新一次。笔记本和台式机用浏览器打开这个地址即可。

在你自己电脑上看美股持仓和实时报价。页面跑在你电脑上，报价仍从网上抓取。

## 在你电脑上打开

1. 安装 [Node.js 20+](https://nodejs.org/zh-cn)（LTS，只做一次）。
2. 解压下载的压缩包。
3. Windows 双击 `start.bat`，Mac 双击 `start.command`。
4. 浏览器打开 **http://localhost:43147**。黑色窗口不要关，关掉页面就停。

第一次会执行 `npm install`，等一两分钟。之后双击就能开。

也可以在项目目录里手动执行：

```bash
npm install
npm run local
```

`npm run local` 只监听你这台电脑。对话里的 `127.0.0.1` 是云电脑的地址，不要贴进你自己的浏览器。

## 之后怎么改持仓

直接跟我说即可：

- `买入 AAPL 10 股，成本 180`
- `卖出 NVDA 2 股`
- `现金 3578.32 美元`
- `提现 8000 人民币，汇率 7.05`

我会改 `data/portfolio.json`。你本机重新拉代码后再 `npm run preview`，数字就对上了。

净资产 = 股票市值 + 现金。  
账户收益率 =（净资产 − 净投入）÷ 净投入。  
今年收益率 =（净资产 − 年初 $52,418 − 今年入金 + 今年提现）÷ $52,418。

## 说明

- 报价来自 Yahoo Finance，不用 API Key。
- 涨跌按 A 股习惯：**红涨绿跌**。
- 数据只存在你电脑上的 `data/portfolio.json`，不上公网。
