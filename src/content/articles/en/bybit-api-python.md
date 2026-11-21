---
title: "Bybit API in Python without an SDK: real responses, signing and the traps"
slug: "bybit-api-python"
description: "Call the Bybit V5 API with Python's standard library only: candles, funding history, contract rules and HMAC signing, with the responses we recorded on 21 November 2026."
date: "2026-11-23"
lastmod: "2026-11-23"
lang: "en"
category: "Trading bots"
tags: ["Bybit API", "Python", "REST API", "HMAC signing", "trading bot"]
keywords: ["bybit api", "bybit api python", "bybit v5 api", "bybit api signature", "bybit kline api"]
tldr: "Bybit's V5 market endpoints need no key: one urllib request returns candles, funding history, server time or contract rules as JSON. We ran every example here on 21 November 2026 and kept the responses. Three wrong candle requests came back as retCode 0 with an empty or shortened list, not as an error. A timestamp 1.5 seconds ahead of Bybit's clock was refused even with a 10-second recv_window. The signing code was run with a made-up key only, never against a real account."
---

<!-- unique:firsthand-data -->
What does Bybit answer when you ask for 15-minute candles with `interval=15m`? `retCode 0`, `retMsg "OK"` and an empty list. No error, no hint that the right value is `15`. We ran into that and two more silent failures while running every request in this article against the live API, 76 HTTP requests in 21 seconds starting at 17:26 UTC on 21 November 2026 (already the 22nd in Taipei, where the script ran). The answers are printed below, shortened where they are long.

Everything uses Python's standard library. The script, its transcript and the raw responses are in this site's source under `research/bybit-api-python/`.

## What do you need to call the Bybit API from Python?

Nothing beyond Python itself: [urllib.request](https://docs.python.org/3/library/urllib.request.html) sends the request and `json` decodes the answer. Market data needs no account and no key. Bybit's [integration guide](https://bybit-exchange.github.io/docs/v5/guide) (checked 22 November 2026) gives two base URLs that matter here, `https://api.bybit.com` for mainnet and `https://api-testnet.bybit.com` for the testnet. Paths and parameters are the same on both.

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

Every answer has the same envelope. `retCode` is 0 on success, `result` holds the data, and `time` is Bybit's clock in milliseconds. Here is `get("/v5/market/time")`:

<!-- unique:firsthand-data -->
```json
{"retCode": 0, "retMsg": "OK",
 "result": {"timeSecond": "1795281973", "timeNano": "1795281973213909951"},
 "retExtInfo": {}, "time": 1795281973213}
```

Two habits follow from that envelope. Check `retCode` on every call, since Bybit reports most errors with HTTP 200. And don't assume the body is JSON: a mistyped path (`/v5/market/klines`) gave us HTTP 404 with an empty body, which `json.loads` cannot read.

## How do you get candles (klines) from the Bybit API?

Send `category`, `symbol` and `interval` to `/v5/market/kline`. The [kline reference](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 22 November 2026) lists the interval codes: `1`, `3`, `5`, `15`, `30`, `60`, `120`, `240`, `360`, `720`, `D`, `W`, `M`. Minutes are bare numbers, with no `m` or `h`.

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

Each row is open time, open, high, low, close, volume, turnover. Four things in that answer cause most first-day bugs.

- **Every value is a string**, the timestamp included. Convert before you compare.
- **Timestamps are milliseconds.** `1795281300000` is 17:15:00 UTC on 21 November 2026.
- **The list runs newest to oldest.** Reverse it before feeding it to anything that expects time order.
- **The first row is still forming.** The answer's own `time` is 17:26:24, eleven minutes into a candle that closes at 17:30, so its close of 60234.4 is only the last trade so far. Keep a row only if its open time plus the interval is at or before `time`.

<!-- unique:firsthand-data -->
The failures that worried me most were the quiet ones. We sent six requests of the kind a tired programmer sends and wrote down what came back:

| What we sent | HTTP | retCode | What came back |
| --- | --- | --- | --- |
| `interval=15m` | 200 | 0 | `"list": []` |
| `start` and `end` in seconds | 200 | 0 | `"list": []` |
| `limit=5000` | 200 | 0 | 1,000 rows |
| no `limit` at all | 200 | 0 | 200 rows |
| `symbol=btcusdt` | 200 | 10001 | `params error: Symbol Is Invalid` |
| path `/v5/market/klines` | 404 | none | empty body |

<!-- unique:operator-view -->
The first three are mistakes, and all three pass a `retCode == 0` check. A backtest fed by the first two would run on zero bars, and one fed by the third would cover a fifth of the history it asked for. Count the rows you get back and compare with the number you expected.

### Paging backwards through more than 1,000 candles

One request returns at most 1,000 candles, so a longer history means walking backwards: ask for the newest page, then set `end` to one candle before the oldest row received.

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
Asked for the 2,500 candles before 17:15 UTC, it made 3 requests and returned 2,500 rows from 16:15 UTC on 26 October to 17:00 UTC on 21 November 2026, with no gap between any two. The open-source engine behind this site does the same walk, with more validation, in [fetch_klines](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/data.py#L156) (commit `85ee44e`, checked 22 November 2026). It refuses rows that are not aligned to the interval and rows where the high sits below the close.

## How do you download funding rate history?

`/v5/market/funding/history` returns settled funding rates, 200 per request at most, newest first. The time parameters are named `startTime` and `endTime` here, not `start` and `end` as on the kline endpoint.

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

The rate is a fraction, so `-0.00001056` is -0.001056%, settled at 16:00 UTC on 21 November 2026. The [funding history reference](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate) (checked 22 November 2026) warns that sending `startTime` alone is an error. It is, and it is a loud one: we got `retCode 10001`, `params error: Time Is Invalid`. Asking for `limit=1000` was quiet again, with 200 rows and `retCode 0`.

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
For the 365 days up to 00:00 UTC on 21 November 2026 it took 6 requests and returned 1,095 BTCUSDT settlements, every one 8 hours after the last. The rates sum to +2.8426%, a mean of +0.002596% per settlement, and 303 of the 1,095 were negative. That sum is what a long of constant notional value would have paid in funding over the year, before any price change. The live figures are on the [funding rate page](/data/funding-rate/).

## Where are the contract rules and risk limit tiers?

Two more public endpoints hold what an order needs to be valid. `/v5/market/instruments-info` gives the price and quantity steps, and `/v5/market/risk-limit` gives the margin tiers. An order whose quantity is not a multiple of `qtyStep`, or whose price is off the `tickSize` grid, is refused, so read these before sizing anything.

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
That is the BTCUSDT entry with the less useful fields cut. `fundingInterval` is in minutes, so 480 is the 8-hour schedule seen above. Leave `symbol` out and the endpoint pages: we got 500 instruments and a `nextPageCursor`, while the full list on that day was 939 linear contracts, which fit in one page once `limit=1000` was set. Stop at the first page and you silently lose 439 symbols.

<!-- unique:firsthand-data -->
`/v5/market/risk-limit` returned 35 tiers for BTCUSDT. The first reads `"riskLimitValue": "300000", "maintenanceMargin": "0.0033", "maxLeverage": "150.00"`: positions up to 300,000 USDT need 0.33% maintenance margin. The second tier runs to 2,000,000 USDT at 0.5%, and the last allows 1x leverage at a 60% maintenance rate. Without `symbol` the answer held 407 rows covering 15 symbols, plus a cursor for the next 15. These tiers are the input of the [liquidation price calculator](/tools/liquidation-price-calculator/), and the quantity step decides how a [position size](/tools/position-size-calculator/) gets rounded.

## How does Bybit API request signing work?

A private request carries up to four headers, and the signature is an HMAC-SHA256 of one concatenated string. The [guide's authentication section](https://bybit-exchange.github.io/docs/v5/guide) (checked 22 November 2026) defines that string as timestamp, then API key, then `recv_window`, then the parameters:

- for a **GET**, the parameters are the query string exactly as it appears after the `?`;
- for a **POST**, they are the JSON body exactly as it is sent.

The headers are `X-BAPI-API-KEY`, `X-BAPI-TIMESTAMP` (milliseconds), `X-BAPI-SIGN` and the optional `X-BAPI-RECV-WINDOW`, which is 5,000 ms when left out. With a system-generated key the signature is lowercase hex. Python's [hmac module](https://docs.python.org/3/library/hmac.html) does the work:

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
Here it is with a key and secret we made up (`FAKEKEY0000000000` and `FAKESECRET-not-a-real-secret-0000000`), a fixed timestamp, and the query `category=linear&symbol=BTCUSDT`:

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
The last two lines are the POST trap. `json.dumps(order)` puts a space after every colon and comma, and `json.dumps(order, separators=(",", ":"))` does not. Both are valid JSON, and they hash differently. Serialise the body once, sign that string, and send those same bytes. Signing a dict and letting an HTTP library serialise it again is how a correct key produces a wrong signature.

**How far this was checked.** The two signatures match what the engine's own [sign function](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/bybit.py#L100-L111) produces for the same inputs. That makes two implementations of one reading of the documentation agree. Neither has been accepted by Bybit: we have not signed a request with a real key, on mainnet or on the testnet, and the order body above was never sent anywhere.

## What does Bybit do with a wrong timestamp or a bad key?

It refuses the timestamp first, before it looks at the key. That ordering is useful: you can test your clock handling without owning an account.

<!-- unique:firsthand-data -->
Start with the clock. We compared `/v5/market/time` with the local clock 20 times: Bybit was between 872 and 892 ms ahead of this Windows PC, median 879 ms, on a median round trip of 78 ms. The guide's rule is `server_time - recv_window <= timestamp < server_time + 1000`, with `recv_window` defaulting to 5,000 ms. A clock that runs behind has five seconds of room. A clock that runs ahead has one. Had this machine been 879 ms fast instead of slow, it would have been about 120 ms from having every private request refused.

<!-- unique:firsthand-data -->
Then we sent read-only GETs to the testnet's `/v5/user/query-api` with the made-up key, shifting the timestamp against Bybit's clock:

| Request | HTTP | Answer |
| --- | --- | --- |
| no auth headers | 200 | `10001` apiKey is missing |
| made-up key, timestamp on time | 200 | `10003` API key is invalid. |
| timestamp 4.0 s behind | 200 | `10003` (timestamp accepted) |
| timestamp 6.0 s behind | 200 | `10002` |
| timestamp 0.5 s ahead | 200 | `10003` (timestamp accepted) |
| timestamp 1.5 s ahead | 200 | `10002` |
| 6.0 s behind, `recv_window` 10000 | 200 | `10003` (timestamp accepted) |
| 1.5 s ahead, `recv_window` 10000 | 200 | `10002` |
| made-up key on `/v5/position/list` | 401 | empty body |

<!-- unique:operator-view -->
Raising `recv_window` rescued the late request and did nothing for the early one. The window only stretches backwards, so a larger value is no fix for a fast clock. The `10002` text was also not the one in the [error list](https://bybit-exchange.github.io/docs/v5/error) (checked 22 November 2026). What arrived was `invalid request, please check your server timestamp or recv_window param: req_timestamp[1795281984494],server_timestamp[1795281990543],recv_window[5000]`, which is more helpful than the documented sentence and a reason to branch on the code, never on the message. And the last row: one endpoint answered a bad key with JSON and HTTP 200, another with HTTP 401 and nothing to parse.

Bybit's guide recommends keeping the device clock synchronised with NTP. The engine does not rely on that alone: it measures the offset from `/v5/market/time` at the start of every bar and adds it to its request timestamps, and it stops if the offset exceeds 5,000 ms.

## Which errors can you retry, and what about rate limits?

Retry only what Bybit says it did not process. The [rate limit page](https://bybit-exchange.github.io/docs/v5/rate-limit) (checked 22 November 2026) gives the outer limit as 600 requests per 5 seconds per IP address. Break it and you get HTTP 403, after which the page tells you to stop all HTTP sessions and wait at least 10 minutes. Private endpoints add per-account limits and report the remaining budget in `X-Bapi-Limit-Status` and `X-Bapi-Limit-Reset-Timestamp` headers.

<!-- unique:firsthand-data -->
We did not see those headers. None of the public answers carried one (the header names we got were `Ret_code`, `Timenow`, `Traceid` and the usual CDN ones), and neither did the refusals of the made-up key. With no real key we cannot show them, and we did not try to trip the limit: the whole run was 76 requests in 21 seconds, under 4 a second.

| Code | Bybit's meaning | What to do |
| --- | --- | --- |
| `10001` | parameter error | fix it, never retry |
| `10002` | timestamp outside the window | resync the clock, sign again |
| `10003` `10004` | bad key, bad signature | stop |
| `10005` `10010` `33004` | no permission, wrong IP, expired key | stop |
| `10006` `10018` | API or IP rate limit | wait for the reset, retry |
| HTTP 403 | IP limit breached | stop for 10 minutes |
| HTTP 429 | system frequency protection | wait, retry |
| `10000` `10016` | server timeout, server error | GET: retry. POST: see below |
| `110072` | duplicate `orderLinkId` | the order exists, look it up |

For the "stop" rows a retry cannot help: an unchanged key and signature will be refused again. The error list gives two more causes for HTTP 403 besides the rate limit, a request from a US IP address and a GET sent with an empty JSON body. The engine groups these codes in [bybit.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/bybit.py#L51-L54). We have seen `10001`, `10002`, `10003` and the HTTP 401 on the wire. The rest of the table is documentation that we have not triggered.

## Why does orderLinkId matter, and why not resend a timed-out POST?

When a POST times out you don't know what became of it: the order may exist. Sending it again can open the position twice, and `orderLinkId` is what turns the retry into a lookup.

The [create-order reference](https://bybit-exchange.github.io/docs/v5/order/create-order) (checked 22 November 2026) describes `orderLinkId` as your own order ID, at most 36 characters of letters, digits, dashes and underscores, and unique. It also says the call is asynchronous: a success answer means the order was accepted for processing, and its status has to be confirmed separately.

Those two facts fix the safe sequence. Build the ID from things that do not change between attempts. The engine uses strategy, a hash of the settings, the bar's open time, direction and action, giving IDs shaped like `pm-macross-3fa9c1-1763467200-LE1` (see [order_link_id](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/executor.py#L117)). Look the ID up before sending. If the POST gets no answer, look it up again before doing anything else, and resend only with the same ID. If Bybit answers `110072`, the first attempt arrived and the order is yours to adopt. GETs are safe to repeat and POSTs are not, so the engine's client retries the first kind and never the second.

I have to correct my own table above: `10000` and `10016` on a POST belong with the timeout case, whatever the word "error" suggests. Treat any order request without a clear refusal as possibly placed.

<!-- unique:field-note -->
Field note, 22 November 2026: that order path is tested against a fake server we wrote from Bybit's documentation. It has never placed an order with a real testnet key, and nothing in this article should be read as a tested order flow.

## Which API key permissions should a trading script have?

Trading only. A script that places orders has no use for withdrawal or transfer rights, and a leaked key that cannot move money can lose far less.

The [API key information endpoint](https://bybit-exchange.github.io/docs/v5/user/apikey-info) (checked 22 November 2026), `GET /v5/user/query-api`, reports what a key can do: `readOnly` (0 or 1), the bound `ips`, and a `permissions` object whose `Wallet` group can hold `AccountTransfer`, `SubMemberTransfer` and `Withdraw`. For USDT perpetuals the needed entries are `Order` and `Position` under `ContractTrade`. Bybit's [API FAQ](https://bybit-exchange.github.io/docs/faq) (same date) adds that a key with no bound IP address expires after 90 days.

The engine calls that endpoint before it looks at positions or sends any order, and [refuses to start](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/live/executor.py#L276) if the key can withdraw or transfer, if it is read-only, or if it has no contract order permission. Same caveat as before: that check has run against our fake server's answers, not against a real key's.

To try any of this without money, the paths above work unchanged on the testnet. What the testnet is good for, and how far its prices sit from the real market, is in [the Bybit testnet article](/learn/bybit-testnet/). The runner that uses these calls is described on the [bot page](/bot/). It trades on the testnet only and ships no profitable strategy; the [backtests](/backtests/) show its three examples losing money. perpmath is an independent project and is not endorsed by Bybit; what the site earns from Bybit links is on the [disclosure page](/disclosure/).

## FAQ

### Do you need an API key for Bybit market data?

No. Candles, funding history, server time, tickers, the order book, contract rules and risk limit tiers are public. Every market-data response in this article was fetched without a key or an account.

### How many candles does the Bybit API return per request?

<!-- unique:firsthand-data -->
Up to 1,000, and 200 if you leave `limit` out. A larger value is not an error: `limit=5000` returned 1,000 rows with `retCode 0` when we tried it. Funding history stops at 200 records per request in the same quiet way.

### Why do I get retCode 10002 from Bybit?

The timestamp you signed fell outside the allowed window. Either your clock is more than one second ahead of Bybit's, or it is more than `recv_window` (5,000 ms by default) behind. Compare your clock with `/v5/market/time`. A larger `recv_window` helps only when you are behind.

### Is there an official Bybit Python SDK?

Yes. Bybit's [API introduction](https://bybit-exchange.github.io/docs/v5/intro) (checked 22 November 2026) lists pybit as its official Python SDK. This article skips it on purpose, so that every header and every byte of the signed string is visible. For a script that only downloads candles, forty lines of standard library are enough.

### Can I test signed requests without risking money?

Partly. A testnet key costs nothing and uses play money, so signing, permissions and order handling can all be exercised there. Fills and prices are another matter, and we measured how different they are in [the testnet article](/learn/bybit-testnet/). We have not yet done that signed test ourselves, which is the largest gap in this page.
