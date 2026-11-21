---
title: "Bybit API Python 教學：不裝 SDK，附實際回應、簽章寫法與會踩的坑"
slug: "bybit-api-python"
description: "只用 Python 標準函式庫呼叫 Bybit V5 API：K 線、資金費率歷史、合約規格與 HMAC 簽章，附我們在 2026-11-21 錄下的實際回應，以及三個回 retCode 0 卻是錯的請求。"
date: "2026-11-29"
lastmod: "2026-11-29"
lang: "zh-Hant"
category: "交易機器人"
tags: ["Bybit API", "Python", "REST API", "HMAC 簽章", "交易機器人"]
keywords: ["Bybit API", "Bybit API Python", "Bybit API 教學", "Bybit V5 API", "Bybit API 簽章"]
tldr: "Bybit V5 的行情端點不需要金鑰：一個 urllib 請求就能拿到 K 線、資金費率歷史、伺服器時間或合約規格的 JSON。這篇的每個範例都在 2026-11-21 實際跑過，回應都留著。三個寫錯的 K 線請求拿到的是 retCode 0 加上空的或被截短的清單，不是錯誤。時間戳比 Bybit 的時鐘快 1.5 秒就被拒絕，recv_window 開到 10 秒也一樣。簽章程式只用編造的金鑰跑過，沒有對真實帳戶用過。"
---

<!-- unique:firsthand-data -->
跟 Bybit 要 15 分鐘 K 線，參數寫成 `interval=15m`，它會回什麼？`retCode 0`、`retMsg "OK"`，外加一個空清單。沒有錯誤，也沒有任何提示告訴你正確的值是 `15`。這篇的每個請求我們都對著正式網的 API 實際送過，這個坑和另外兩個不出聲的失敗就是這樣撞到的：2026-11-21 17:26 UTC 起（腳本在台北跑，當地已經是 22 日），21 秒內送了 76 個 HTTP 請求。回應印在下面，太長的有刪節。

全部只用 Python 標準函式庫。腳本、執行紀錄和原始回應放在本站原始碼的 `research/bybit-api-python/`。

## 用 Python 呼叫 Bybit API，需要準備什麼？

除了 Python 本身，什麼都不用：[urllib.request](https://docs.python.org/3/library/urllib.request.html) 送請求，`json` 解回應。行情資料不需要帳戶，也不需要金鑰。Bybit 的[串接指南](https://bybit-exchange.github.io/docs/v5/guide)（2026-11-22 查閱）列的基礎網址，這裡用得到兩個：正式網 `https://api.bybit.com`，測試網 `https://api-testnet.bybit.com`。兩邊的路徑和參數相同。

```python
import json
import urllib.parse
import urllib.request

MAINNET = "https://api.bybit.com"
TESTNET = "https://api-testnet.bybit.com"


def get(path, base=MAINNET, **params):
    """One public GET. Returns the whole payload: retCode, retMsg, result, time."""
    url = base + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "my-script/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read())
    if payload["retCode"] != 0:
        raise RuntimeError(f"retCode {payload['retCode']}: {payload['retMsg']}")
    return payload
```

每個回應的外層都長一樣。成功時 `retCode` 是 0，資料放在 `result`，`time` 是 Bybit 的時鐘，單位毫秒。下面是 `get("/v5/market/time")`：

<!-- unique:firsthand-data -->
```json
{"retCode": 0, "retMsg": "OK",
 "result": {"timeSecond": "1795281973", "timeNano": "1795281973213909951"},
 "retExtInfo": {}, "time": 1795281973213}
```

這個外層帶出兩個習慣。每次呼叫都檢查 `retCode`，Bybit 大部分的錯誤是用 HTTP 200 回報的。還有，別假設回來的一定是 JSON：路徑打錯（`/v5/market/klines`）時，我們拿到 HTTP 404 加上空的內容，`json.loads` 讀不了。

## Bybit API 怎麼抓 K 線？

把 `category`、`symbol`、`interval` 送到 `/v5/market/kline`。[K 線端點文件](https://bybit-exchange.github.io/docs/v5/market/kline)（2026-11-22 查閱）列出 interval 的代碼：`1`、`3`、`5`、`15`、`30`、`60`、`120`、`240`、`360`、`720`、`D`、`W`、`M`。分鐘就是純數字，後面不加 `m` 或 `h`。

```python
get("/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15", limit=3)
```

<!-- unique:firsthand-data -->
```json
{"retCode": 0, "retMsg": "OK",
 "result": {"symbol": "BTCUSDT", "category": "linear", "list": [
 ["1795281300000","60222.2","60313","60100.9","60234.4","328.35","19764229.5002"],
 ["1795280400000","60027.8","60298.6","60022.8","60222.2","790.816","47614664.4799"],
 ["1795279500000","59957.1","60218.5","59957.1","60027.8","713.282","42857538.6064"]
 ]},
 "retExtInfo": {}, "time": 1795281984867}
```

每一列依序是開盤時間、開、高、低、收、成交量、成交額。第一天寫出來的 bug，多半出在這個回應的四個地方。

- 每個值都是字串，連時間戳也是。比較之前先轉型。
- 時間戳是毫秒。`1795281300000` 是 2026-11-21 17:15:00 UTC。
- 清單是新的在前、舊的在後。要餵給預期時間順序的程式，先反轉。
- 第一列還沒收完。回應自己的 `time` 是 17:26:24，那根 17:30 才收的 K 線只走了十一分鐘，所以它的收盤價 60234.4 只是到目前為止的最後一筆成交。只留「開盤時間加上週期，不晚於 `time`」的列。

<!-- unique:firsthand-data -->
我最擔心的是不出聲的那種失敗。我們送了六個寫到很累的工程師會送出去的請求，把回來的東西記下來：

| 送出的請求 | HTTP | retCode | 回來的東西 |
| --- | --- | --- | --- |
| `interval=15m` | 200 | 0 | `"list": []` |
| `start` 與 `end` 用秒 | 200 | 0 | `"list": []` |
| `limit=5000` | 200 | 0 | 1,000 列 |
| 完全不帶 `limit` | 200 | 0 | 200 列 |
| `symbol=btcusdt` | 200 | 10001 | `params error: Symbol Is Invalid` |
| 路徑 `/v5/market/klines` | 404 | 無 | 空的內容 |

<!-- unique:operator-view -->
前三個是錯的請求，而且三個都過得了 `retCode == 0` 的檢查。吃前兩種資料的回測會跑在零根 K 線上，吃第三種的只涵蓋它要求的五分之一歷史。拿到幾列要數，數完跟預期的數量比。

## 超過 1,000 根 K 線：往回翻頁

一個請求最多回 1,000 根，要更長的歷史就得往回走：先要最新的一頁，再把 `end` 設成「已收到最舊那一列」的前一根。

```python
import time

INTERVAL_MS = {"1": 60_000, "5": 300_000, "15": 900_000,
               "60": 3_600_000, "240": 14_400_000, "D": 86_400_000}


def klines(symbol, interval, start_ms, end_ms, base=MAINNET):
    """Closed candles with open time in [start_ms, end_ms), oldest first."""
    step = INTERVAL_MS[interval]
    rows = {}
    cursor = (end_ms - 1) // step * step      # open time of the newest candle wanted
    while cursor >= start_ms:
        payload = get("/v5/market/kline", base, category="linear", symbol=symbol,
                      interval=interval, start=start_ms, end=cursor, limit=1000)
        page = payload["result"]["list"]      # newest first
        if not page:
            break
        for row in page:
            if int(row[0]) + step <= payload["time"]:   # skip the forming candle
                rows[int(row[0])] = row
        if len(page) < 1000:
            break
        cursor = int(page[-1][0]) - step      # one candle older than the oldest
        time.sleep(0.1)
    return [rows[ts] for ts in sorted(rows)]
```

<!-- unique:firsthand-data -->
請它抓 17:15 UTC 之前的 2,500 根，它送了 3 個請求，回了 2,500 列，從 2026-10-26 16:15 UTC 到 2026-11-21 17:00 UTC，任兩列之間都沒有缺口。本站背後的開源引擎做同樣的事，驗證更多，寫在 [fetch_klines](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/data.py#L156)（commit `85ee44e`，2026-11-22 查閱）。它會拒收沒對齊週期的列，以及最高價低於收盤價的列。

## 怎麼下載資金費率歷史？

`/v5/market/funding/history` 回的是已結算的資金費率，一次最多 200 筆，新的在前。這裡的時間參數叫 `startTime` 和 `endTime`，不像 K 線端點叫 `start` 和 `end`。

<!-- unique:firsthand-data -->
```json
{"retCode": 0, "retMsg": "OK", "result": {"category": "linear", "list": [
  {"symbol": "BTCUSDT", "fundingRate": "-0.00001056",
   "fundingRateTimestamp": "1795276800000"},
  {"symbol": "BTCUSDT", "fundingRate": "-0.0000354",
   "fundingRateTimestamp": "1795248000000"},
  {"symbol": "BTCUSDT", "fundingRate": "-0.00004217",
   "fundingRateTimestamp": "1795219200000"}
 ]},
 "retExtInfo": {}, "time": 1795281986162}
```

費率是小數，`-0.00001056` 就是 −0.001056%，結算於 2026-11-21 16:00 UTC。[資金費率歷史文件](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate)（2026-11-22 查閱）提醒，只送 `startTime` 會出錯。確實會，而且這個錯很大聲：我們拿到 `retCode 10001`、`params error: Time Is Invalid`。要 `limit=1000` 就又安靜了，200 列，`retCode 0`。

```python
def funding(symbol, start_ms, end_ms, base=MAINNET):
    """Settled funding rates with time in [start_ms, end_ms), oldest first."""
    rows = {}
    cursor = end_ms - 1
    while cursor >= start_ms:
        payload = get("/v5/market/funding/history", base, category="linear",
                      symbol=symbol, startTime=start_ms, endTime=cursor, limit=200)
        page = payload["result"]["list"]      # newest first
        if not page:
            break
        for record in page:
            rows[int(record["fundingRateTimestamp"])] = record["fundingRate"]
        if len(page) < 200:
            break
        cursor = min(int(record["fundingRateTimestamp"]) for record in page) - 1
        time.sleep(0.1)
    return sorted(rows.items())
```

<!-- unique:original-calc -->
抓到 2026-11-21 00:00 UTC 為止的 365 天，它用了 6 個請求，回了 1,095 次 BTCUSDT 結算，每一次都和前一次隔 8 小時。費率加總是 +2.8426%，平均每次結算 +0.002596%，1,095 次裡有 303 次是負的。這個加總，就是名目價值固定的多單這一年付出去的資金費，價格變動還沒算。即時的數字在[資金費率頁](/zh-hant/data/funding-rate/)，這個費率怎麼來的另外寫在[資金費率是什麼](/zh-hant/learn/what-is-funding-rate/)。

## 合約規格和風險限額級距放在哪裡？

訂單要合法需要的東西，在另外兩個公開端點。`/v5/market/instruments-info` 給價格和數量的最小單位，`/v5/market/risk-limit` 給保證金級距。數量不是 `qtyStep` 的整數倍，或價格不在 `tickSize` 的格子上，訂單會被拒絕，所以算任何倉位之前先讀這兩個。

<!-- unique:firsthand-data -->
```json
{"symbol": "BTCUSDT", "contractType": "LinearPerpetual", "status": "Trading",
 "priceFilter": {"minPrice": "0.10", "maxPrice": "1999999.80", "tickSize": "0.10"},
 "lotSizeFilter": {"maxOrderQty": "1500.000", "minOrderQty": "0.001",
                   "qtyStep": "0.001", "postOnlyMaxOrderQty": "1500.000",
                   "maxMktOrderQty": "150.000", "minNotionalValue": "5"},
 "leverageFilter": {"minLeverage": "1", "maxLeverage": "150.00", "leverageStep": "0.01"},
 "fundingInterval": 480, "upperFundingRate": "0.00333", "lowerFundingRate": "-0.00333"}
```

<!-- unique:firsthand-data -->
這是 BTCUSDT 那一筆，比較用不到的欄位刪掉了。`fundingInterval` 的單位是分鐘，480 就是上面看到的 8 小時週期。不帶 `symbol` 的話這個端點會分頁：我們拿到 500 個商品和一個 `nextPageCursor`，而當天完整的清單是 939 個 linear 合約，把 `limit=1000` 設上去就一頁裝得下。讀完第一頁就停，會不聲不響少掉 439 個交易對。

<!-- unique:firsthand-data -->
`/v5/market/risk-limit` 對 BTCUSDT 回了 35 級。第一級是 `"riskLimitValue": "300000", "maintenanceMargin": "0.0033", "maxLeverage": "150.00"`：倉位價值 300,000 USDT 以下，維持保證金率 0.33%。第二級到 2,000,000 USDT，0.5%；最後一級只能開 1 倍槓桿，維持保證金率 60%。不帶 `symbol` 時，回應有 407 列、涵蓋 15 個交易對，外加一個用來取下 15 個的 cursor。這些級距就是[爆倉價計算機](/zh-hant/tools/liquidation-price-calculator/)的輸入，數量的最小單位則決定[倉位大小](/zh-hant/tools/position-size-calculator/)怎麼取整。

## Bybit API 的請求簽章怎麼做？

私有請求最多帶四個標頭，簽章是把一個串接起來的字串做 HMAC-SHA256。[指南的認證章節](https://bybit-exchange.github.io/docs/v5/guide)（2026-11-22 查閱）把這個字串定義成：時間戳、API 金鑰、`recv_window`、參數，照這個順序接在一起。

- GET 的參數，是 query string 在 `?` 後面的樣子，一字不差；
- POST 的參數，是送出去的 JSON 內容，一字不差。

標頭是 `X-BAPI-API-KEY`、`X-BAPI-TIMESTAMP`（毫秒）、`X-BAPI-SIGN`，以及可省略的 `X-BAPI-RECV-WINDOW`，不帶的話是 5,000 毫秒。系統產生的金鑰，簽章用小寫十六進位。Python 的 [hmac 模組](https://docs.python.org/3/library/hmac.html)就能做：

```python
import hashlib
import hmac


def sign(secret, payload):
    """HMAC-SHA256 of the payload, lowercase hex."""
    digest = hmac.new(secret.encode(), payload.encode(), hashlib.sha256)
    return digest.hexdigest()


def signed_headers(api_key, secret, to_sign, timestamp_ms, recv_window_ms=5000):
    payload = f"{timestamp_ms}{api_key}{recv_window_ms}{to_sign}"
    return {
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": str(timestamp_ms),
        "X-BAPI-RECV-WINDOW": str(recv_window_ms),
        "X-BAPI-SIGN": sign(secret, payload),
        "Content-Type": "application/json",
    }
```

<!-- unique:firsthand-data -->
下面用一組我們編出來的 key 和 secret（`FAKEKEY0000000000` 與 `FAKESECRET-not-a-real-secret-0000000`）、固定的時間戳，以及 query string `category=linear&symbol=BTCUSDT` 跑一次：

<!-- unique:firsthand-data -->
```text
GET  string to sign: 1795281600000FAKEKEY00000000005000category=linear&symbol=BTCUSDT
GET  X-BAPI-SIGN:    d410389680b571cf1181fcff2bcfae0cfec777c1b7ed354b2c9de4638b70bdd9
POST body:           {"category":"linear","symbol":"BTCUSDT","side":"Buy","orderType":"Market","qty":"0.001","positionIdx":0,"orderLinkId":"demo-1795281600-LE1"}
POST X-BAPI-SIGN:    89715eb5de523bdd0377f338350da0a8dbc4fd87e16ff2d46cf436649e1ae785
same dict, default json.dumps (with spaces):
                     1c62a89642fcb0fd4e7d1c6cb2e01d87d3c2352c81fc63d5dc5eadf814dfcba7
```

<!-- unique:operator-view -->
最後兩行就是 POST 的陷阱。`json.dumps(order)` 會在每個冒號和逗號後面加空格，`json.dumps(order, separators=(",", ":"))` 不會。兩種都是合法的 JSON，雜湊出來卻不一樣。內容只轉成字串一次，簽那個字串，送出去的也要是同一串位元組。簽的是 dict、再讓 HTTP 函式庫自己重轉一遍，正確的金鑰就是這樣簽出錯的簽章。

**這一段驗到哪裡。** 這兩個簽章，和引擎自己的 [sign 函式](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/bybit.py#L100-L111)用同樣的輸入算出來的一致。也就是說，對文件的同一種讀法，有兩份實作互相吻合。兩份都沒被 Bybit 接受過：我們沒有用真的金鑰簽過任何請求，正式網和測試網都沒有，上面那個下單內容也從來沒送到任何地方。

## 時間戳不對或金鑰是假的，Bybit 怎麼回？

它先拒絕時間戳，還沒輪到看金鑰。這個順序很好用：沒有帳戶也能測自己的時鐘處理。

<!-- unique:firsthand-data -->
先看時鐘。我們拿 `/v5/market/time` 和本機時鐘比了 20 次：Bybit 比這台 Windows 電腦快 872 到 892 毫秒，中位數 879 毫秒，來回時間的中位數是 78 毫秒。指南的規則是 `server_time - recv_window <= timestamp < server_time + 1000`，`recv_window` 預設 5,000 毫秒。時鐘慢的人有五秒的空間，時鐘快的人只有一秒。這台機器如果不是慢 879 毫秒而是快 879 毫秒，離「每個私有請求都被拒絕」大約只剩 120 毫秒。

<!-- unique:firsthand-data -->
接著我們用那把編出來的金鑰，對測試網的 `/v5/user/query-api` 送唯讀的 GET，並且把時間戳相對於 Bybit 的時鐘往前往後挪：

| 請求 | HTTP | 回應 |
| --- | --- | --- |
| 不帶認證標頭 | 200 | `10001` apiKey is missing |
| 編造的金鑰，時間戳準時 | 200 | `10003` API key is invalid. |
| 時間戳慢 4.0 秒 | 200 | `10003`（時間戳被接受） |
| 時間戳慢 6.0 秒 | 200 | `10002` |
| 時間戳快 0.5 秒 | 200 | `10003`（時間戳被接受） |
| 時間戳快 1.5 秒 | 200 | `10002` |
| 慢 6.0 秒，`recv_window` 10000 | 200 | `10003`（時間戳被接受） |
| 快 1.5 秒，`recv_window` 10000 | 200 | `10002` |
| 編造的金鑰打 `/v5/position/list` | 401 | 空的內容 |

<!-- unique:operator-view -->
把 `recv_window` 調大，救回了遲到的請求，對早到的沒有用。這個視窗只往過去延伸，時鐘快的人把它調大也沒救。`10002` 的訊息文字也和[錯誤清單](https://bybit-exchange.github.io/docs/v5/error)（2026-11-22 查閱）寫的不一樣。實際回來的是 `invalid request, please check your server timestamp or recv_window param: req_timestamp[1795281984494],server_timestamp[1795281990543],recv_window[5000]`，比文件上那句有用，也是程式要看代碼分支、絕對不要看訊息文字的理由。還有最後一列：同樣是假金鑰，一個端點回 JSON 加 HTTP 200，另一個回 HTTP 401，什麼都沒得解析。

Bybit 的指南建議用 NTP 讓裝置的時鐘保持同步。引擎不單靠這個：它在每根 K 線開始時從 `/v5/market/time` 量一次時差，加到請求的時間戳上；時差超過 5,000 毫秒就停下來。

## 哪些錯誤可以重試？頻率限制怎麼算？

只重試 Bybit 表明它沒有處理的請求。[頻率限制頁](https://bybit-exchange.github.io/docs/v5/rate-limit)（2026-11-22 查閱）寫的最外層限制是每個 IP 位址每 5 秒 600 個請求。超過會拿到 HTTP 403，頁面接著要你停掉所有 HTTP 連線、至少等 10 分鐘。私有端點另外有每個帳戶的限制，剩餘額度放在 `X-Bapi-Limit-Status` 和 `X-Bapi-Limit-Reset-Timestamp` 標頭裡回報。

<!-- unique:firsthand-data -->
這些標頭我們沒看到。公開端點的回應沒有一個帶（拿到的標頭名稱是 `Ret_code`、`Timenow`、`Traceid` 和 CDN 常見的那幾個），假金鑰被拒絕的回應也沒有。沒有真的金鑰就示範不了，我們也沒有去試著撞限制：整個執行過程是 21 秒 76 個請求，每秒不到 4 個。

| 代碼 | Bybit 的意思 | 該怎麼做 |
| --- | --- | --- |
| `10001` | 參數錯誤 | 修正，不要重試 |
| `10002` | 時間戳在視窗外 | 重新對時，重新簽章 |
| `10003` `10004` | 金鑰錯誤、簽章錯誤 | 停 |
| `10005` `10010` `33004` | 沒有權限、IP 不對、金鑰過期 | 停 |
| `10006` `10018` | API 或 IP 頻率限制 | 等重置，再重試 |
| HTTP 403 | 超過 IP 限制 | 停 10 分鐘 |
| HTTP 429 | 系統頻率保護 | 等一下，再重試 |
| `10000` `10016` | 伺服器逾時、伺服器錯誤 | GET：重試。POST：見下文 |
| `110072` | `orderLinkId` 重複 | 訂單已經存在，去查它 |

標「停」的那幾列，重試沒有用：金鑰和簽章沒變，只會再被拒絕一次。錯誤清單還列了 HTTP 403 的另外兩個原因：請求來自美國的 IP 位址，以及 GET 帶了空的 JSON 內容。引擎把這些代碼分組放在 [bybit.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/bybit.py#L51-L54)。我們實際收到過的是 `10001`、`10002`、`10003` 和 HTTP 401。表裡其餘的都是文件上的說法，我們沒有觸發過。

## orderLinkId 為什麼重要？逾時的 POST 為什麼不能直接重送？

POST 逾時的時候，你不知道它的下場：訂單可能已經存在。再送一次可能開出兩倍的倉位，而 `orderLinkId` 能把「重送」變成「先查那張單在不在」。

[下單端點文件](https://bybit-exchange.github.io/docs/v5/order/create-order)（2026-11-22 查閱）說 `orderLinkId` 是你自訂的訂單 ID，最多 36 個字元，可用英文字母、數字、連字號和底線，而且不能重複。它還說這個呼叫是非同步的：回成功只代表訂單已被接受、等待處理，狀態要另外確認。

這兩件事決定了安全的順序。用兩次嘗試之間不會變的東西組出 ID。引擎用的是策略、設定的雜湊、K 線的開盤時間、方向與動作，組出來像 `pm-macross-3fa9c1-1763467200-LE1`（見 [order_link_id](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/executor.py#L117)）。送出之前先查這個 ID。POST 沒有得到回應的話，做任何事之前再查一次，要重送也只能用同一個 ID。如果 Bybit 回 `110072`，代表第一次其實送到了，那張單是你的，接手就好。GET 可以放心重複，POST 不行，所以引擎的 client 只重試前者，從不重試後者。

這裡要更正我自己上面那張表：POST 遇到 `10000` 和 `10016`，應該歸在逾時那一類，不管「錯誤」兩個字聽起來像什麼。任何沒有被明確拒絕的下單請求，都當成可能已經成立。

<!-- unique:field-note -->
實作紀錄，2026-11-22：這條下單路徑是用我們照 Bybit 文件寫的模擬伺服器測的。它從來沒有用真的測試網金鑰下過單，這篇文章裡沒有任何內容應該被讀成「測過的下單流程」。

## 交易腳本的 API 金鑰該開哪些權限？

只開交易。會下單的腳本用不到提領或轉帳的權限，而一把搬不動錢的金鑰就算外洩，能造成的損失也小得多。

[API 金鑰資訊端點](https://bybit-exchange.github.io/docs/v5/user/apikey-info)（2026-11-22 查閱）`GET /v5/user/query-api` 會回報一把金鑰能做什麼：`readOnly`（0 或 1）、綁定的 `ips`，以及 `permissions` 物件，其中 `Wallet` 群組可能含有 `AccountTransfer`、`SubMemberTransfer` 和 `Withdraw`。做 USDT 永續合約需要的是 `ContractTrade` 底下的 `Order` 和 `Position`。Bybit 的 [API 常見問題](https://bybit-exchange.github.io/docs/faq)（同一天查閱）另外提到，沒有綁定 IP 位址的金鑰 90 天後過期。

引擎在查倉位或送任何訂單之前，會先呼叫這個端點；金鑰能提領或轉帳、是唯讀、或沒有合約下單權限，它就[拒絕啟動](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/executor.py#L276)。同樣的但書：這項檢查是對著我們模擬伺服器的回應跑的，不是對著真金鑰的回應。

想不花錢試這些，上面的路徑搬到測試網原封不動就能用。測試網適合拿來做什麼、它的價格離真實市場多遠，寫在 [Bybit 測試網那篇](/zh-hant/learn/bybit-testnet/)。用到這些呼叫的下單程式介紹在[機器人專區](/zh-hant/bot/)，把這些呼叫組成一支機器人的做法在[用 Python 寫交易機器人](/zh-hant/learn/build-a-trading-bot-python/)那篇。下單程式只在測試網交易，沒有附任何會賺錢的策略；它的三個範例策略在[回測頁](/zh-hant/backtests/)上都是賠錢的。perpmath 是獨立的專案，沒有獲得 Bybit 背書；本站從 Bybit 連結賺到什麼，寫在[揭露頁](/zh-hant/disclosure/)。

## 常見問題

### 抓 Bybit 的行情資料需要 API 金鑰嗎？

不需要。K 線、資金費率歷史、伺服器時間、行情報價（ticker）、訂單簿、合約規格和風險限額級距都是公開的。這篇裡每一個行情資料的回應，都是在沒有金鑰、沒有帳戶的情況下抓的。

### Bybit API 一次請求回幾根 K 線？

<!-- unique:firsthand-data -->
最多 1,000 根，不帶 `limit` 是 200 根。給更大的值不會出錯：我們試 `limit=5000`，拿到 1,000 列和 `retCode 0`。資金費率歷史也是同一種安靜的做法，一次請求到 200 筆為止。

### 為什麼 Bybit 回我 retCode 10002？

你簽的時間戳落在允許的視窗之外。要嘛你的時鐘比 Bybit 快超過一秒，要嘛慢超過 `recv_window`（預設 5,000 毫秒）。拿你的時鐘和 `/v5/market/time` 比一下。把 `recv_window` 調大，只在你慢的時候有幫助。

### Bybit 有官方的 Python SDK 嗎？

有。Bybit 的 [API 簡介](https://bybit-exchange.github.io/docs/v5/intro)（2026-11-22 查閱）把 pybit 列為官方的 Python SDK。這篇刻意不用它，為的是讓每個標頭、被簽字串的每個位元組都看得到。只是要下載 K 線的腳本，四十行標準函式庫就夠了。

### 簽章請求可以不冒金錢風險地測試嗎？

一部分可以。測試網的金鑰不用錢，用的是練習資金，簽章、權限和訂單處理都可以在那裡跑過一遍。成交和價格是另一回事，兩邊差多少，我們在[測試網那篇](/zh-hant/learn/bybit-testnet/)量過。我們自己還沒做過這個簽章測試，這是這一頁最大的缺口。
