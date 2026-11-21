---
title: "Breaker block 是哪一根 K 線？失效的訂單塊反著做，三個幣的回測"
slug: "breaker-block"
description: "Breaker block 是失效之後反過來做的訂單塊。BTCUSDT 一年 801 個訂單塊有 59.68% 失效；等重測進場，在三個幣的 6 個樣本區段裡有 5 個賠錢。附規則與重跑指令。"
date: "2026-11-28"
lastmod: "2026-11-28"
lang: "zh-Hant"
category: "回測"
tags: ["breaker block", "訂單塊", "ICT 交易", "回測", "BTCUSDT"]
keywords: ["breaker block", "breaker block 是什麼", "ICT breaker block", "breaker block 訂單塊差別", "mitigation block"]
tldr: "Breaker block 是被價格直接收盤穿過的訂單塊（order block）；之後價格回到這個區塊時，改成反方向交易。BTCUSDT 15 分鐘 K 線、2025-11-18 到 2026-11-18 的 801 個訂單塊裡，有 478 個（59.68%）在 24 小時內被收盤穿過，其中 92.47% 等到了重測（retest）。重測就進場，扣成本後樣本內賠 18.44%（243 筆），樣本外賠 15.07%（120 筆）。同一條規則放到 ETHUSDT 與 SOLUSDT，四個區段有三個賠錢；第四個是 +4.81%，t 值 0.34。"
---

「Breaker block 是失效之後翻了面的訂單塊。」這是 [TMGM 指南](https://www.tmgm.com/en/academy/trading-academy/breaker-block)（最後更新 2026-11-16，2026-11-22 查閱）的第一句話，原文是英文，中文是我們翻的。各家來源的共識差不多也就到這裡。Breaker 到底是哪一根 K 線、前面要不要先有一次掃停損，要看你讀的是誰。我們挑了一種讀法，把一年 BTCUSDT 裡全部 801 個訂單塊追到底，看有幾個失效，再去交易它們的重測。一年的前 70% 賠 18.44%，剩下的期間賠 15.07%。

## Breaker block 是什麼，又是哪一根 K 線

Breaker block 是一個區塊，它本來是[訂單塊（order block）](/zh-hant/learn/order-block/)，直到價格收盤穿過它。看多的訂單塊照說要當支撐。價格一旦收在它下面，同一個區塊就被預期會變成壓力，做法是等價格往上回到區塊時做空。反過來的情況就是做多。同樣的翻面套在[公平價值缺口](/zh-hant/learn/fair-value-gap/)上，叫 inverse fair value gap，那個我們另外測了。這個想法屬於 [ICT 交易與聰明錢概念](/zh-hant/learn/ict-trading/)；TMGM 那一頁說它出自 ICT，至於這個詞最早是什麼時候開始用的，我們找不到有日期的原始出處。

<!-- unique:cross-reference -->
問框要畫在哪一根 K 線上，我們讀的三頁給了三個答案。拿看多的 breaker、也就是用來做多的那一種當例子。TMGM 從失效的看空訂單塊出發，那是下跌之前最後一根上漲 K 線。[LuxAlgo 的詞條](https://www.luxalgo.com/library/concept/breaker-block/)（2026-11-22 查閱）說，它是把那段失敗的走勢往下推的那一根或那一串下跌 K 線，詞條的常見問題也確認，看多的 breaker 是用下跌 K 線組成的。Diego Arribas Lopez 在 [MQL5 部落格的一篇文章](https://www.mql5.com/en/blogs/post/773691)（日期 2026-08-18）標的是形成波段高點的那段看跌 K 線範圍，下跌就是從那個高點開始的；那篇文章同時在推銷作者自己的付費指標。三個框都掛在同一個波段高點上，卻不是同一個框。邊緣不一樣，進場價和停損也就不一樣。

<!-- unique:cross-reference -->
第二個分歧，是前面必須先發生什麼。LuxAlgo 描述了兩種讀法：嚴格的那種，失敗的走勢要先穿過先前的高點或低點；寬鬆的那種，任何被破壞的訂單塊都算 breaker。TMGM 說，ICT 的版本前面一定要有一次流動性掃蕩，沒有掃蕩的版本它叫 mitigation block。MQL5 那篇列了三個條件（一次真的掃蕩、穿過結構的位移、第一次重測），並主張大多數被叫做 breaker 的東西連第一個條件都不符合。掃蕩要多大、位移要多大、要等多久，三頁沒有一頁給出數字。

## 我們測的是哪一種讀法

是開源引擎 [breaker_block.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/strategies/breaker_block.py) 的 docstring 寫的那一種（2026-11-22 查閱）。它寫的是看多的訂單塊失效的情況，另一種完全對稱。

```
order block:  found exactly as in the order block test, same code, same parameters
              (the down bar before 3+ up bars that cover 2 ATR and close
               above the latest swing high); zone = that bar's low to its high

failure:      within 96 bars of the block forming, a bar closes below the bottom
              -> from that close the zone is a bearish breaker
retest:       up to 96 bars later, the first bar whose high reaches the bottom
              closes at or below the top -> short at the next bar's open
              closes above the top       -> breaker dropped
stop:         top of the zone + 0.1 x ATR(14), ATR read on the bar that broke the block
target:       2 x risk from the fill price
```

在「哪一根 K 線」這件事上，引擎站在 TMGM 那一邊：breaker 就是訂單塊那一根 K 線本身，整根，失效之後也不變。「失效」的意思是有一次收盤越過另一側的邊緣。只有影線穿過不算，對穿過去的那一根 K 線也沒有大小要求。規則沒有另外檢查有沒有掃蕩，照字面看，這是比較寬鬆的那種讀法。等待時間只有一個，96 根，兩段等待都用它。每個 breaker 只用一次，同一時間只持有一個倉位。

## 十個訂單塊裡有六個變成 breaker

<!-- unique:firsthand-data -->
這條規則在我們的 35,040 根 BTCUSDT 15 分鐘 K 線上找到 801 個訂單塊，其中 478 個在形成後 96 根 K 線內被收盤穿過，佔 59.68%。這 478 個裡面，從區塊形成到被收盤穿過，時間的中位數是 21 根，五個小時多一點。

| 發生了什麼 | 數量 | 比例 |
| --- | --- | --- |
| 找到的訂單塊 | 801 | |
| 96 根內被收盤穿過（變成 breaker） | 478 | 訂單塊的 59.68% |
| breaker 在 96 根內被重測 | 442 | breaker 的 92.47% |
| 重測那一根給出進場訊號 | 389 | breaker 的 81.38% |
| 重測那一根收盤又穿回區塊（作廢） | 53 | breaker 的 11.09% |
| 一直沒被重測（到期） | 36 | breaker 的 7.53% |

<!-- unique:original-calc -->
「重測」這個詞聽起來像價格先離開、再回來。多半它根本沒離開。從穿過去的那次收盤到重測，等待的中位數是 1 根，442 次重測裡有 255 次（57.69%）就在下一根 K 線：價格才剛收在區塊外面一點點，下一根的影線就伸回它的邊緣。389 個訊號落在 384 根 K 線上，變成 363 筆交易，有 21 個來的時候手上還有倉位。

<!-- unique:operator-view -->
兩種型態都在做的人，我會請他看這個數字。訂單塊規則在這些區塊裡的 533 個上拿到進場訊號，也就是價格回來、那一根收盤站在正確的一側。這 533 個裡面，有 407 個（76.36%）後來還是被收盤穿過，而且仍然在形成後 24 小時之內；有 339 個（63.60%）接著給出反方向的 breaker 訊號。事後才標記的圖，可以把第一次碰觸標成「訂單塊守住了」，第二次標成「breaker 守住了」。那是同一個區塊，前後差幾個小時，而給出第一個訊號的區塊裡，有 63.60% 兩張標籤都貼得上去。

<!-- unique:firsthand-data -->
嚴格的讀法我們也試著套過。每一個 breaker，我們去看離開區塊的那段走勢，有沒有穿過訂單塊那一根之前 20 根 K 線的最高價或最低價，和我們[流動性掃蕩](/zh-hant/learn/liquidity-sweep/)測試用的是同一個價位。做這項檢查的時候，我們以為它會把樣本切成兩塊。幾乎沒切到：478 個 breaker 有 455 個（95.19%）通過。訂單塊的定義本來就要求收盤越過最近的波段點，會失效的區塊幾乎都先掃過了先前的極值。把沒通過的 23 個拿掉，樣本內 243 筆交易少 13 筆，樣本外 120 筆少 7 筆，剩下的交易平均每筆是名目價值的 −0.07% 與 −0.12%，全部交易是 −0.08% 與 −0.13%。這個切法是公開那次回測跑完之後才選的，而它什麼都沒改變。

## Breaker block 回測：先 BTC，再 ETH 和 SOL

<!-- unique:firsthand-data -->
在 BTCUSDT 上，重測進場兩段期間都賠。K 線來自 Bybit 公開的 [K 線端點](https://bybit-exchange.github.io/docs/v5/market/kline)，2025-11-18 到 2026-11-18，前 70% 是樣本內，其餘從 2026-07-31 起是樣本外。完整報告在 [breaker block 回測頁](/zh-hant/backtests/breaker-block-btcusdt/)。

| 樣本 | 交易筆數 | 勝率 | 平均 R | t 值 | 總報酬率 | 最大回撤 | 判讀 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 樣本內 | 243 | 33.74% | −0.56 | −1.56 | −18.44% | 21.23% | 和零分不出差別 |
| 樣本外 | 120 | 30.83% | −0.79 | −2.88 | −15.07% | 16.62% | 明確虧損 |

每次成交付 0.055%，是 Bybit [費率表](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure)（2026-11-22 查閱）裡 VIP 0 的吃單費率，另外加上假設的 0.02% 滑價。t 值是拿每筆淨報酬做[單一樣本 t 檢定](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm)；絕對值小於 2，就和零分不出差別。

<!-- unique:original-calc -->
停損和訂單塊那次測試一樣近。成交價到停損的距離，中位數在樣本內是價格的 0.310%，樣本外是 0.259%，0.15% 的來回成本換算下來是 0.48R 與 0.58R。把手續費和滑價設成零，同一條規則的報酬是 +16.45% 與 +0.78%，t 值 1.30 與 0.17。樣本內 123 筆多單的勝率是 38.21%，120 筆空單是 29.17%；樣本外是 65 筆多單 27.69%、55 筆空單 34.55%。停利目標 2R，不計成本需要 33.33%，[風險報酬比計算機](/zh-hant/tools/risk-reward-calculator/)可以驗算。

<!-- unique:firsthand-data -->
樣本內的虧損和零分不出差別，很容易讓人覺得 breaker 差一點就有用。我們就把同一條規則，連同建在同一批區塊上的訂單塊規則，拿到 ETHUSDT 和 SOLUSDT 上跑。這六次回測的清單在 2026-11-21（UTC）、跑第一次之前就列好了。「內 / 外」是樣本內與樣本外，打星號的是不到 100 筆的區段，最後一欄是成本設成零的 t 值。

| 市場 | 規則 | 交易筆數 內 / 外 | 總報酬率 內 / 外 | t 值 內 / 外 | 零成本 t 值 內 / 外 |
| --- | --- | --- | --- | --- | --- |
| BTC | Breaker 重測 | 243 / 120 | −18.44% / −15.07% | −1.56 / −2.88 | 1.30 / 0.17 |
| BTC | 訂單塊回到區塊 | 325 / 141 | −42.33% / −18.71% | −3.77 / −2.49 | −0.38 / 0.11 |
| ETH | Breaker 重測 | 214 / 96* | −29.80% / −13.64% | −2.10 / −2.54 | −0.13 / −0.22 |
| ETH | 訂單塊回到區塊 | 298 / 146 | −37.71% / −0.63% | −2.57 / 0.00 | −0.13 / 1.83 |
| SOL | Breaker 重測 | 231 / 110 | +4.81% / −12.95% | 0.34 / −1.75 | 2.07 / 0.48 |
| SOL | 訂單塊回到區塊 | 308 / 143 | −41.27% / −2.22% | −2.58 / −0.06 | −0.42 / 1.34 |

<!-- unique:original-calc -->
十二個區段裡有十一個扣成本後賠錢。例外是 SOLUSDT 樣本內的 breaker 規則：231 筆交易 +4.81%，t 值 0.34，接著樣本外是 −12.95%。這稱不上發現。它的零成本版本是整張表裡唯一超過 2 的 t 值（2.07），緊鄰的樣本外那一格則是 0.48。

<!-- unique:original-calc -->
樣本內，breaker 規則在三個幣上的報酬率都比訂單塊規則高。到了樣本外，ETHUSDT 和 SOLUSDT 都是訂單塊規則賠得比較少，各差了十個百分點以上，BTCUSDT 則是兩條規則相差不到四個百分點。「做失效的那一次，不要做區塊本身」如果真的是改進，換一段期間應該還站得住，結果沒有。這三個幣還共用同一個下跌的年份（BTCUSDT 跌 29.86%，ETHUSDT 跌 41.33%，SOLUSDT 跌 46.03%），不能算三次獨立的測試。

## 限制，以及怎麼重跑

引擎沒有掛著等成交的限價單。進場是市價單，在重測那一根的下一根開盤價成交，付吃單費率，成交價可能落在區塊的任何一側。同一根 K 線同時碰到停損和停利目標時算停損，資金費率不算；樣本內平均只持有 9.28 根 K 線，少算資金費率在這裡影響不大。

上面三種挑 K 線的方式，我們只測了其中一種，沒有確認步驟，也沒有過濾條件。用失敗走勢最前面幾根 K 線來畫框的版本沒測過，靠人工判斷的[結構突破（break of structure，BOS）](/zh-hant/learn/break-of-structure/)或位移條件也沒測過。

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest breaker_block --symbol BTCUSDT --interval 15m --config configs/breaker_block.json --out results/breaker-block-btcusdt.json
```

Windows 上啟用虛擬環境那一行是 `.venv\Scripts\activate`；不需要帳戶，也不需要 API 金鑰。要跑表裡其他幾列，用同樣的日期下載 ETHUSDT 或 SOLUSDT 並改 `--symbol`，或改跑 `order_block` 搭配 `configs/order_block.json`。我們重跑兩組公開的 BTCUSDT 設定，得到的指標和公開的完全一樣。引擎的其他說明在[機器人專區](/zh-hant/bot/)，其他幾份回測列在[回測頁](/zh-hant/backtests/)。

## 常見問題

### Breaker block 和訂單塊差在哪？

時間和方向。訂單塊是這個區塊還守得住的時候，順著離開它的那段走勢去做。Breaker block 是同一個區塊被收盤穿過之後，在重測時反方向去做。在我們的資料裡，59.68% 的訂單塊在 24 小時內變成 breaker。

### Breaker block 和 mitigation block 差在哪？

照我們讀的來源，差在有沒有掃停損。Breaker 那段失敗的走勢會先穿過先前的高點或低點；mitigation block 沒有這一步就翻面。我們的規則不區分這兩種，而在我們的圖上，失效的區塊反正有 95.19% 都掃過了前 20 根的極值。

### 看多的 breaker block 是上漲 K 線還是下跌 K 線組成的？

看來源。TMGM 用的是下跌之前最後一根上漲 K 線，LuxAlgo 和 MQL5 那篇用的是同一個波段高點上的下跌 K 線。我們測的是前一種。

### Breaker block 多常被重測？

<!-- unique:firsthand-data -->
在 BTCUSDT 15 分鐘 K 線上，478 個 breaker 有 442 個（92.47%）在 96 根內被重測，其中 57.69% 就在下一根 K 線。重測的那一根上，有 53 個收盤又穿回區塊，被作廢。

### Breaker block 有用嗎？

在這次測試裡沒有。機械式的重測進場在 BTCUSDT 上兩段期間扣成本後都賠，成本設成零則和零分不出差別。把三個幣、建在這些區塊上的兩條規則全部算進來，我們實際跑出來的數字如下。12 個區段裡有 11 個扣成本後賠錢。
