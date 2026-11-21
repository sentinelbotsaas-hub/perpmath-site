---
title: "用 Python 寫交易機器人：策略 25 行，處理下單 1,077 行"
slug: "build-a-trading-bot-python"
description: "用 Python 寫一個連 Bybit 測試網的交易機器人：25 行的策略、它賠錢的回測、不用金鑰的乾跑，以及其餘程式碼在處理的八種出錯情況。"
date: "2026-11-30"
lastmod: "2026-11-30"
lang: "zh-Hant"
category: "交易機器人"
tags: ["交易機器人", "Python", "Bybit 測試網", "下單處理", "回測"]
keywords: ["Python 交易機器人", "交易機器人", "Bybit 交易機器人", "程式交易 Python"]
tldr: "開源的 perpmath 引擎在 0.2.0 版共有 4,785 行 Python 程式碼，策略模組占 130 行，2.72%。處理 Bybit 測試網下單的部分是 1,077 行，它的測試 707 行。我們寫了一個 25 行的突破策略，拿一年的 BTCUSDT 15 分鐘 K 線回測（樣本內賠 34.79%，樣本外賠 19.32%），再用不需要 API 金鑰的乾跑模式跑它。0.2 版只在測試網交易，需要簽章的請求只對模擬伺服器測過，沒有碰過真的帳戶。"
---

<!-- unique:firsthand-data -->
4,785 行 Python 程式碼裡，隨附的三個策略檔加起來是 107 行。動筆之前我們先數了自己的機器人，這是開源 perpmath 引擎 0.2.0 版的數字。均線交叉 32 行。負責送單、追蹤訂單、拒絕訂單的程式 1,077 行，專門想辦法弄壞它的測試另外 707 行。

這篇教你用 Python 寫交易機器人，而策略是裡面最短的一段。你會寫一個策略模組、回測它、看它賠錢、不用 API 金鑰就讓它對著 Bybit 測試網跑，然後走過八種和策略無關、卻會讓機器人掛掉的狀況。文章最後不會有一個會賺錢的機器人。這裡寫出來的這一個是賠錢的。

## 交易機器人是由什麼組成的

交易機器人是一個迴圈：讀行情、向策略要一個決定、把決定變成訂單，並且讓自己的紀錄和交易所那邊保持一致。大家的注意力通常放在第二步。我們的行數統計說，工夫花在第三步和第四步。

<!-- unique:firsthand-data -->
下表涵蓋 [perpmath repo](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.0) 在 v0.2.0 標籤（commit `85ee44e`）底下，`src/` 與 `tests/` 裡所有納入版控的 `.py` 檔：34 個檔案、6,704 行，2026-11-21 用 Python 內建的 `ast` 和 `tokenize` 模組數的。空行、註解和 docstring 裡的行，都不算進「程式碼」那一欄。

| 這些程式在做什麼 | 程式碼 | 占比 | 全部行數 |
| --- | --- | --- | --- |
| 策略、註冊表 | 130 | 2.72% | 255 |
| 指標 | 39 | 0.82% | 75 |
| 回測引擎 | 428 | 8.94% | 610 |
| 網格模擬器 | 830 | 17.35% | 1,104 |
| 資料下載 | 356 | 7.44% | 486 |
| 命令列 | 155 | 3.24% | 194 |
| 交易所用戶端 | 198 | 4.14% | 308 |
| 執行器 | 665 | 13.90% | 894 |
| 熔斷機制 | 61 | 1.27% | 110 |
| 狀態檔 | 49 | 1.02% | 69 |
| live 設定、金鑰 | 104 | 2.17% | 156 |
| 測試：回測、網格 | 1,063 | 22.22% | 1,502 |
| 測試：下單處理 | 707 | 14.78% | 941 |
| 合計 | 4,785 | 100% | 6,704 |

<!-- unique:original-calc -->
處理訂單的五個檔案（用戶端、執行器、熔斷、狀態、設定）共 1,077 行，占整個 repo 程式碼的 22.51%。加上替它們寫的測試是 1,784 行，37.28%。換算下來，均線交叉每一行，對上 33.7 行的下單處理。測試整體是 1,770 行，等於每一行原始碼配 0.59 行測試。

<!-- unique:original-calc -->
這篇的初稿標題裡有「2.7%」，這個我得收回。寫稿期間，0.2.1 版釋出了，多了三個範例策略和它們的測試。我們重數一次：策略那一列從 130 行變成 320 行，占比從 2.72% 變成 6.09%，而處理訂單的五個檔案一行都沒變。占 repo 的比例，量到的多半是隨附了幾個範例。站得住的數字要以一個機器人為單位：一個策略檔，目前隨附的六個範例是 27 到 82 行、下面這個是 25 行，對上 1,077 行的下單處理。

## 第一步：寫策略模組

perpmath 的策略是一個模組，裡面有一個 `DEFAULTS` 字典和一個函式 `generate(bars, params)`，回傳一個 `Signals` 物件：每一根 K 線的進場方向、停損價、以風險倍數表示的停利目標（可省略），以及出場旗標（可省略）。這份[約定](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/engine.py#L57-L88)寫在 `engine.py` 裡，大約 30 行。

範例是通道突破。K 線收盤高於前 96 根的最高價就做多，96 根 15 分鐘 K 線是 24 小時。收盤低於前 96 根的最低價就做空。停損放在離收盤價 2 倍 ATR 的地方，停利是風險的兩倍。這四個數字我們在第一次跑之前就寫下來，之後沒有動過。

```python
import numpy as np

from ..data import Bars
from ..engine import Signals
from ..indicators import atr, prior_high, prior_low

DEFAULTS = {
    "lookback": 96,
    "atr_period": 14,
    "stop_atr_mult": 2.0,
    "r_multiple": 2.0,
}


def generate(bars: Bars, params: dict) -> Signals:
    signals = Signals.empty(len(bars))
    top = prior_high(bars.high, params["lookback"])
    bottom = prior_low(bars.low, params["lookback"])
    distance = params["stop_atr_mult"] * atr(bars.high, bars.low, bars.close, params["atr_period"])

    ready = np.isfinite(distance)
    go_long = (bars.close > top) & ready
    go_short = (bars.close < bottom) & ready

    signals.side[go_long] = 1
    signals.side[go_short] = -1
    signals.stop[go_long] = bars.close[go_long] - distance[go_long]
    signals.stop[go_short] = bars.close[go_short] + distance[go_short]
    signals.target_r[go_long | go_short] = params["r_multiple"]
    return signals
```

<!-- unique:firsthand-data -->
加上 docstring 和一行 `from __future__`，整個檔案是 51 行，其中 25 行是程式碼。裡面沒有迴圈、沒有追蹤倉位，也沒有任何訂單。`prior_high` 不包含當下這一根，而和暖機期的 `NaN` 做比較，結果都是 false，前 96 根不會出訊號。

把它存成 repo clone 裡的 `src/perpmath/strategies/breakout.py`，再到 `strategies/__init__.py` 註冊：在 import 那一行加上 `breakout`，並在 `STRATEGIES` 字典裡加一筆 `"breakout": breakout,`。不在這個字典裡的策略名稱，命令列一律拒絕。

## 第二步：靠近交易所之前，先回測

先回測。它不花錢，而且這是最後一個「出錯的只可能是策略」的時刻。把 `configs/ma_cross.json` 複製成 `configs/breakout.json`，填上策略名稱和四個參數，然後跑：

```
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest breakout --symbol BTCUSDT --interval 15m --config configs/breakout.json --out results/breakout-btcusdt.json
```

<!-- unique:firsthand-data -->
這兩行指令，我們在 2026-11-21 用一份全新 clone 的 v0.2.0 跑的，K 線檔就是引擎隨附結果背後的那一個（35,040 根，一根不缺，SHA-256 開頭是 `ac4acc42`）。終端機印出：

```
breakout BTCUSDT 15m  2025-11-18T11:30:00Z to 2026-11-18T11:15:00Z
fee 0.0550% per side, slippage 0.0200% per fill, funding not modelled
               trades   win %   avg R  t-stat  return %  max DD %
in_sample         364   34.34   -0.17   -1.55    -34.79     39.36
out_of_sample     157   32.48   -0.29   -1.60    -19.32     28.27
wrote results/breakout-btcusdt.json
```

<!-- unique:original-calc -->
兩段都賠：10,000 USDT 在樣本內變成 6,520.79，樣本外變成 8,068.17。t 值 -1.55 與 -1.60 落在「平均值和零分不出來」的範圍裡，公道的讀法是「量不到優勢，再扣掉成本」。光是手續費，樣本內就付了 3,250.21 USDT，而虧損是 3,479.21。勝率 34.34%，比 2R 目標在不計成本時需要的 33.33% 高一點點，離計入成本後需要的勝率還不夠。

<!-- unique:firsthand-data -->
策略出訊號的次數，遠多於實際交易的次數。樣本內它給了 791 個進場訊號，引擎跳過其中 427 個，當時手上已經有倉位。在這一切之前，引擎先在九份截短的資料上重跑 `generate`，確認拿掉後面的 K 線時沒有任何決定改變。這個偷看未來檢查每次回測都會跑，不用另外開。

39.36% 的回撤要漲 64.90% 才回得到原本的高點，可以用[回撤計算機](/zh-hant/tools/drawdown-calculator/)驗算。這個回撤數字是怎麼量的、兩套工具為什麼會對不上，寫在[最大回撤](/zh-hant/learn/max-drawdown/)那篇。樣本切分與成本的完整流程在[回測怎麼做](/zh-hant/learn/how-to-backtest-a-trading-strategy/)，隨附策略的結果（到目前為止每一個都賠）在[回測頁](/zh-hant/backtests/)。

回測賠錢該怎麼辦？不要去調它。這組參數我們只跑過一次；在同一年的資料裡找一個讓結果翻正的回看長度，只會得到一個數字，得不到任何知識。這篇剩下的部分，策略只是個替身。賠錢的也行：下面每一個問題，不管訊號有沒有用都會找上門。

## 第三步：不用 API 金鑰，對著 Bybit 測試網乾跑

乾跑會讀測試網的即時 K 線，每收一根就跑一次策略，把它本來要送的訂單印出來，什麼都不簽。從 `configs/live/ma_cross.json` 複製出 `configs/live/breakout.json`，然後跑：

```
perpmath live breakout --symbol BTCUSDT --interval 15m --config configs/live/breakout.json --dry-run --once
```

<!-- unique:firsthand-data -->
```
2026-11-21T17:23:58Z perpmath live breakout BTCUSDT 15m | DRY RUN (no signed requests, no orders) | state .perpmath-live\breakout-BTCUSDT-15m-5f467f-dryrun.json
2026-11-21T17:23:58Z limits: order 100 USDT, max position 200 USDT, max daily loss 20 USDT, max 5 consecutive API errors, max clock skew 5000 ms
2026-11-21T17:23:58Z clock offset to Bybit: 1019 ms (request timestamps and bar timing use Bybit's clock)
2026-11-21T17:23:59Z bar 2026-11-21T17:00:00Z close 59660.0: no entry
```

四行輸出，有三行在講策略以外的事：狀態檔放在哪、上限是多少、這台電腦的時鐘離 Bybit 的時鐘多遠。策略的全部貢獻是「no entry」。`5f467f` 是策略名稱、交易對、K 線週期與參數算出來的雜湊值，下面的訂單編號裡還會再看到它。

<!-- unique:field-note -->
不加 `--once` 的話，下單程式會一直跑，每收一根 K 線印一行。2026-11-21 我們讓它多跑了兩根：

```
2026-11-21T17:30:02Z bar 2026-11-21T17:15:00Z close 59660.0: no entry
2026-11-21T17:45:02Z bar 2026-11-21T17:30:00Z close 59677.3: no entry
```

每一行都印在這台電腦的時鐘走到整刻（每十五分鐘）之後兩秒，也就是 Bybit 時鐘上等 K 線結算的三秒，減掉大約 0.9 秒的時鐘偏差。然後我們把它停掉。在下面統計的 904 根測試網 K 線裡，94.25% 會以同樣那兩個字收場。

<!-- unique:firsthand-data -->
安靜的一根 K 線看不出什麼，我們就去問下單程式自己的規劃器：最近一次訊號，它會送出什麼。在最近 1,000 根已收盤的測試網 K 線上（2026-11-11 到 21 日，一根不缺），暖機之後的 904 根裡策略給了 52 個進場訊號，其中 51 個是做空。最近的一個是 11 月 21 日 10:15 UTC 開盤的那一根，收在 55,399.8。`SignalPlanner.plan` 只用公開資料組出來的請求內容如下：

```
{
  "category": "linear",
  "symbol": "BTCUSDT",
  "side": "Sell",
  "orderType": "Market",
  "qty": "0.001",
  "positionIdx": 0,
  "orderLinkId": "pm-breakout-5f467f-1795256100-SE1",
  "stopLoss": "56303.8",
  "slTriggerBy": "LastPrice",
  "tpslMode": "Full",
  "slOrderType": "Market",
  "takeProfit": "53591.8",
  "tpTriggerBy": "LastPrice"
}
```

<!-- unique:original-calc -->
看 `qty`。設定檔要的是每次進場 100 USDT，100 / 55,399.8 是 0.0018 BTC。測試網 BTCUSDT 的下單數量最小單位是 0.001，規劃器無條件捨去，訂單變成 0.001 BTC：55.40 USDT，只比設定值的一半多一點。教學文章很容易漏掉最小下單單位這個過濾條件，而在小帳戶上，決定你實際倉位大小的就是它。

停損和停利是跟著進場單一起送出去的，由 Bybit 那邊保管，你的程式沒在跑的時候照樣有效。帳戶那一邊怎麼設定，寫在 [Bybit 測試網](/zh-hant/learn/bybit-testnet/)那篇；自己動手簽請求，寫在[用 Python 串 Bybit API](/zh-hant/learn/bybit-api-python/)。測試網還有一件事要習慣：那根 K 線收在 55,399.8，17:00 那根收在 59,660.0，6.75 小時裡動了 7.69%。我們下載的資料裡，15 分鐘 K 線的成交量中位數是 0.99 BTC，那裡的價格和真實市場關係不大。

## 交易機器人死在哪裡，程式碼怎麼處理

下面的每一種失敗，都配上 perpmath 0.2.0 裡處理它的那一段程式。請把它們當成一份可以檢查的解答範例來讀，這些程式都還沒碰過真的帳戶。

### 重複下單

機器人把同一張單送兩次，是它忘了自己已經送過。常見的原因是「處理過的訊號」清單只放在記憶體裡：程式重啟，清單空了，那根 K 線的訊號又送一次。這份程式碼改寫自一個更早的私人下單程式，那個版本就有這個弱點。

<!-- unique:cross-reference -->
解法是一個單靠「決定本身」就能重建的訂單編號。[`order_link_id`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L117-L132) 把策略名稱、設定的雜湊值、K 線開盤時間、方向與動作串在一起。Bybit 的[下單文件](https://bybit-exchange.github.io/docs/v5/order/create-order)（2026-11-22 查閱）允許自訂最長 36 個字元的 `orderLinkId`，並要求它不能重複，[錯誤碼列表](https://bybit-exchange.github.io/docs/v5/error)裡 110072 就是編號重複。Stripe 的[冪等性指南](https://docs.stripe.com/api/idempotent_requests)（2026-11-22 查閱）建議這類金鑰用隨機的 V4 UUID。用戶端記得住自己的金鑰時，這樣可行。一個可能在「做完決定」和「寫下紀錄」之間當掉的機器人，需要的是一把可以從零重新推導出來的金鑰。

<!-- unique:firsthand-data -->
我們對那根 10:15 的 K 線呼叫這個函式兩次，兩次都拿到 `pm-breakout-5f467f-1795256100-SE1`。下一根 K 線是 `...-1795257000-SE1`。把回看長度從 96 改成 97，雜湊那一段變成 `6ece7d`，同一個帳戶上的兩組參數不會撞號。

### 請求逾時，不知道訂單到底在不在

逾時的請求結果未知，閉著眼睛重送，一個訊號就會變成兩個倉位。Bybit 的 [API 常見問題](https://bybit-exchange.github.io/docs/faq)（2026-11-22 查閱）寫明下單端點是非同步的，訂單還沒被處理就先回應，就算回應一切正常，也不代表成交。

下單程式在送出之前先把待確認的編號寫進狀態檔；HTTP 用戶端裡絕不重試 POST；遇到網路錯誤，先[用編號查這張單](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L718-L758)，才做別的事。只有查不到的時候才重送，而且只用同一個編號。接著它輪詢到訂單進入最終狀態為止，超過 20 秒就停機。

### 部分成交

市價單可能只成交一部分。進場單的話，下單程式留下已成交的部分，不去追剩下的；停損是用 `Full` 模式附上去的，不管倉位最後多大都蓋得到。出場單只成交一部分才危險。它會再送一張只減倉的訂單處理剩下的數量，最多三張，然後停機，交易所那邊的停損仍然掛著。

### 重啟之後不知道自己的倉位

重啟之後，機器人的記憶和交易所可能不一致，而相信自己記憶的機器人，會在一個它不知道存在的倉位上再加碼。[狀態檔](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/state.py#L60-L69)的寫法是先寫到一個暫時的檔案、強制寫入磁碟，再改名蓋掉舊檔；Python 的 [`os.replace`](https://docs.python.org/3/library/os.html#os.replace) 文件寫明這個動作在 POSIX 系統上是原子性的（2026-11-22 查閱）。寫到一半當掉，上一份檔案還是完整的。

啟動時，[`reconcile`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L567-L607) 拿這個檔案去對 Bybit 上的倉位與掛單。檔案不知道的倉位、檔案以為還在但已經不見的倉位、數量不同、不是它掛的單、沒有停損的倉位：遇到任何一種，程式就停下來，並說明它看到了什麼。它不會自己選邊。

### 時鐘偏差

<!-- unique:firsthand-data -->
簽章請求的時間戳如果落在 `server_time - recv_window <= timestamp < server_time + 1000` 之外，Bybit 就會拒絕，預設視窗是 5,000 毫秒（[串接指南](https://bybit-exchange.github.io/docs/v5/guide)，2026-11-22 查閱）。我們跑這些測試的那台電腦，在幾分鐘內的三次啟動分別比 Bybit 慢 1,019、884 與 893 毫秒。慢一秒還在視窗裡。同樣大小的誤差換成快，三次裡的第一次就已經超過 1,000 毫秒的上限。

用戶端的做法是從公開的時間端點量出偏差，用 Bybit 的時鐘替請求蓋時間戳，不用自己的。偏差超過 5,000 毫秒，下單程式就停機。設定檔的註解說那是對本機時鐘的合理性上限，和 Bybit 的一秒規則是兩回事。

### 頻率限制

Bybit 的[頻率限制說明](https://bybit-exchange.github.io/docs/v5/rate-limit)（2026-11-22 查閱）允許每個 IP 每 5 秒 600 個請求，並告訴收到 HTTP 403 的用戶端停下來，至少等 10 分鐘。重試迴圈中間不停頓，機器人就是這樣撞上這個封鎖的。[用戶端](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/bybit.py#L258-L283)會讀 `X-Bapi-Limit-Status` 與 `X-Bapi-Limit-Reset-Timestamp` 兩個標頭，等到重設時間，並把每一次撞到限制都算成一次 API 錯誤，交給下面的熔斷機制。

### 沒有熔斷機制

沒有停止條件的機器人，會在把它弄壞的那個狀況裡繼續交易。perpmath 有[四個熔斷](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/breaker.py#L42-L110)，每一個都是設定檔裡的一項：

| 熔斷 | 預設值 | 什麼時候觸發 |
| --- | --- | --- |
| 每日虧損 | 20 USDT | 權益比當天（UTC）第一次讀到的數字少了這麼多 |
| 倉位大小 | 200 USDT | 一張訂單或 Bybit 上的倉位超過這個數字 |
| API 錯誤 | 連續 5 次 | 中間沒有任何一根 K 線是正常處理完的 |
| 時鐘偏差 | 5,000 毫秒 | 本機和 Bybit 的時鐘差距超過這個數字 |

熔斷一觸發，會把原因寫進狀態檔，以結束碼 3 離開，重啟之後仍然維持觸發狀態，直到你加上 `--clear-halt`。它不會平倉。docstring 給的理由是：API 連續失敗五次之後自動平倉，等於相信同一個出問題的 API 能把倉平對。保護來自 Bybit 那邊的停損單。

### 權限太大的 API 金鑰

交易機器人永遠用不到出金的權限。Bybit 的[金鑰資訊端點](https://bybit-exchange.github.io/docs/v5/user/apikey-info)（2026-11-22 查閱）會列出一把金鑰的權限，[`check_api_key`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L276-L311) 遇到帶有 `Withdraw` 或任何轉帳權限的金鑰、唯讀金鑰、或沒有合約下單權限的金鑰，都拒絕啟動。金鑰沒有綁定 IP 時它會警告。金鑰只從兩個環境變數讀，沒有別的來源；日誌裡頂多顯示金鑰的長度和頭尾各四個字元。

還有兩個比較小的防護也該列在這裡。拿到的歷史 K 線有缺漏時，下單程式不會交易那一根。決定做出超過 60 秒之後，它也不會照做：回測會成交在那根的開盤價，晚成交就是另一筆交易了。

## 0.2 版做不到的事

它不能用真錢交易，這是刻意的。端點是一個常數，[每次請求之前都會再檢查一次](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/bybit.py#L114-L119)，設定檔或參數要求連正式網都會被拒絕。README 的規劃是 0.3 版才做真錢交易，而且要等倉位防護（position guard）做出來。

<!-- unique:field-note -->
對這篇文章最要緊的一個限制：需要簽章的端點只對一個假交易所跑過，那是一個 234 行、照著 Bybit 文件做的測試替身檔。2026-11-21，把突破策略註冊進去之後，整套測試的結果是 253 個通過、1 個跳過，花了 3.49 秒，其中 69 個測試在下單程式自己的測試檔裡。沒有任何一個碰到網路。沒有人拿真的測試網金鑰用這份程式下過單，上一節寫的全部是「程式被寫成、也被測成會這樣做」，沒有任何一項是來自交易所的實際回報。

README 還列了其他缺口：訂單狀態是用 REST 輪詢，不是 WebSocket 串流。進場是固定的 USDT 金額，回測則是按權益的比例算倉位。停利是用訊號那根 K 線的收盤價算的，送單時還不知道成交價。測試網的價格與流動性和正式網不同。

有一件事要揭露。下單程式有一個 `broker_id` 設定，對應 Bybit 的 API Broker 計畫，帶著它的話，專案可以分到一部分交易手續費。它預設是空的，空的時候不會送出任何經紀商標頭。我們和 Bybit 的關係寫在[揭露頁](/zh-hant/disclosure/)。

引擎在本站的家是[機器人專區](/zh-hant/bot/)。決定倉位之前，想看 2 倍 ATR 的停損會把數量變成多少，可以用[倉位大小計算機](/zh-hant/tools/position-size-calculator/)。

## 常見問題

### Python 寫交易機器人夠快嗎？

每收一根 K 線才決定一次的機器人，夠。上面的乾跑裡，照日誌自己的時間戳，啟動加上第一根 K 線大約花一秒，而下一個決定在 15 分鐘之後。拚微秒的策略不該用 Python，這一頁的內容也都不適用於那種策略。

### 要先有 API 金鑰才能試嗎？

不用。回測用公開 K 線，`--dry-run` 用測試網的公開端點，兩者都不簽任何請求。只有要在測試網下單時才需要測試網金鑰，而且第一次下單前，下單程式會要你輸入 `TESTNET`。

### 這個機器人會賺錢嗎？

<!-- unique:firsthand-data -->
不會。突破範例在兩段測試期間分別賠 34.79% 與 19.32%，0.2.1 版隨附的六個範例策略在各自的兩段期間也都是賠的。這份程式碼存在的目的，是示範帳怎麼記、訂單怎麼處理。

### 一個交易機器人要寫多少程式？

<!-- unique:original-calc -->
在這個 repo 裡，下單處理 1,077 行、它的測試 707 行，旁邊的策略檔每個 27 到 82 行。你的數字會不一樣，比例大概不會差太多。8 種失敗每一種都要寫程式處理，策略再簡單也不會少掉任何一種。
