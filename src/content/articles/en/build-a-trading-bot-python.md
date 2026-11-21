---
title: "How to build a trading bot in Python: 25 lines of strategy, 1,077 of order handling"
slug: "build-a-trading-bot-python"
description: "Build a Python trading bot for Bybit's testnet: a 25-line strategy, its losing backtest, a keyless dry run, and the eight failures the rest of the code handles."
date: "2026-11-24"
lastmod: "2026-11-24"
lang: "en"
category: "Trading bots"
tags: ["trading bot", "Python", "Bybit testnet", "order handling", "backtest"]
keywords: ["how to build a trading bot", "python trading bot", "bybit trading bot", "trading bot python"]
tldr: "At version 0.2.0 of the open-source perpmath engine, strategy modules were 130 of 4,785 lines of Python code, 2.72%. Order handling for the Bybit testnet was 1,077 lines and its tests 707. We wrote a 25-line breakout strategy, backtested it on one year of BTCUSDT 15-minute bars (it lost 34.79% in-sample and 19.32% out-of-sample), then ran it as a dry run with no API key. Version 0.2 trades on the testnet only, and its signed requests have been tested against a fake server, never a real account."
---

<!-- unique:firsthand-data -->
We counted the lines of our own bot before writing this. The open-source perpmath engine is 4,785 lines of Python code at version 0.2.0, and the three strategy files it ships add up to 107 of them. The moving-average cross is 32 lines. The code that places, tracks and refuses orders is 1,077, and the tests that try to break that code are another 707.

So this is a guide to building a trading bot in Python in which the strategy is the short part. You'll write a strategy module, backtest it, watch it lose, run it against Bybit's testnet without an API key, and then walk through eight ways a bot dies that have nothing to do with the strategy. It does not end with a bot that makes money. The one built here loses.

## What is a trading bot made of?

A trading bot is a loop that reads market data, asks a strategy for a decision, turns the decision into orders, and keeps its own records in agreement with the exchange. Most of the attention usually goes to the second step. Our line counts say the work sits in the third and fourth.

<!-- unique:firsthand-data -->
The table covers every tracked `.py` file under `src/` and `tests/` of the [perpmath repository](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.0) at tag v0.2.0 (commit `85ee44e`): 34 files, 6,704 lines, counted on 21 November 2026 with Python's own `ast` and `tokenize` modules. A line of code here is a line that is not blank, not a comment and not inside a docstring.

| What the lines do | Code | Share | All lines |
| --- | --- | --- | --- |
| Strategies, registry | 130 | 2.72% | 255 |
| Indicators | 39 | 0.82% | 75 |
| Backtest engine | 428 | 8.94% | 610 |
| Grid simulator | 830 | 17.35% | 1,104 |
| Data download | 356 | 7.44% | 486 |
| Command line | 155 | 3.24% | 194 |
| Exchange client | 198 | 4.14% | 308 |
| Executor | 665 | 13.90% | 894 |
| Circuit breakers | 61 | 1.27% | 110 |
| State file | 49 | 1.02% | 69 |
| Live config, keys | 104 | 2.17% | 156 |
| Tests: backtest, grid | 1,063 | 22.22% | 1,502 |
| Tests: order handling | 707 | 14.78% | 941 |
| Total | 4,785 | 100% | 6,704 |

<!-- unique:original-calc -->
The five files that deal with orders (client, executor, breakers, state, config) hold 1,077 lines of code, 22.51% of the repository. Add the tests written for them and it is 1,784 lines, 37.28%. That is 33.7 lines of order handling for every line of the moving-average cross. Tests as a whole are 1,770 lines, or 0.59 lines of test for each line of source.

<!-- unique:original-calc -->
The first draft of this page had "2.7%" in its title, and I have to take that back. While it was being written, version 0.2.1 was tagged with three more example strategies and their tests. We counted again: the strategies row went from 130 lines to 320 and its share from 2.72% to 6.09%, and the five order-handling files did not change by one line. A share of the repository mostly measures how many examples ship. The figures that hold still are per bot: one strategy file, 27 to 82 lines across the six examples now shipped and 25 for the one below, against 1,077 lines of order handling.

## Step 1: write the strategy module

A perpmath strategy is one module with a `DEFAULTS` dict and one function, `generate(bars, params)`, which returns a `Signals` object: for every bar an entry side, a stop price, an optional target in multiples of risk, and optional exit flags. The [contract](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/engine.py#L57-L88) is about 30 lines of `engine.py`.

The example is a channel breakout. Go long when a bar closes above the highest high of the previous 96 bars, which is 24 hours on a 15-minute chart. Go short when it closes below the lowest low. The stop sits 2 ATR from the close and the target at twice the risk. We wrote those four numbers down before the first run and have not touched them.

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
With its docstring and a `from __future__` line the file is 51 lines, 25 of them code. There is no loop, no position tracking and no order in it. `prior_high` leaves the current bar out, and comparisons against the `NaN` warm-up values are false, so the first 96 bars give no signal.

Save it as `src/perpmath/strategies/breakout.py` in a clone of the repository, then register it in `strategies/__init__.py`: add `breakout` to the import line and a `"breakout": breakout,` entry to the `STRATEGIES` dict. The command line refuses any strategy name that is not in that dict.

## Step 2: backtest it before it goes near an exchange

Backtest first, since it costs nothing and it is the last moment the strategy is the only thing that can be wrong. Copy `configs/ma_cross.json` to `configs/breakout.json`, set the strategy name and the four parameters, and run:

```
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest breakout --symbol BTCUSDT --interval 15m --config configs/breakout.json --out results/breakout-btcusdt.json
```

<!-- unique:firsthand-data -->
We ran those two commands on 21 November 2026 in a fresh clone of v0.2.0, on the candle file behind the engine's shipped results (35,040 bars, none missing, SHA-256 starting `ac4acc42`). The terminal printed:

```
breakout BTCUSDT 15m  2025-11-18T11:30:00Z to 2026-11-18T11:15:00Z
fee 0.0550% per side, slippage 0.0200% per fill, funding not modelled
               trades   win %   avg R  t-stat  return %  max DD %
in_sample         364   34.34   -0.17   -1.55    -34.79     39.36
out_of_sample     157   32.48   -0.29   -1.60    -19.32     28.27
wrote results/breakout-btcusdt.json
```

<!-- unique:original-calc -->
It lost in both periods: 10,000 USDT became 6,520.79 in-sample and 8,068.17 out-of-sample. The t-statistics of -1.55 and -1.60 are inside the range where an average is not distinguishable from zero, so the fair reading is "no measurable edge, minus costs". Fees alone came to 3,250.21 USDT in-sample against a loss of 3,479.21. The win rate, 34.34%, is a hair above the 33.33% a 2R target needs before costs, and short of what it needs after them.

<!-- unique:firsthand-data -->
The strategy fired far more often than it traded. In-sample it gave 791 entry signals and the engine skipped 427 of them, since a position was already open. Before any of this the engine reran `generate` on nine shortened copies of the data and confirmed that no decision changed when later bars were removed. That look-ahead check runs on every backtest; you don't opt in.

A 39.36% drawdown needs a 64.90% gain to get back to the old high, which you can confirm on the [drawdown calculator](/tools/drawdown-calculator/). How that drawdown figure is measured, and why two tools can disagree about it, is in [max drawdown](/learn/max-drawdown/). The longer walk through sample splits and costs is in [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/), and the results of the shipped strategies, losses every one so far, are under [backtests](/backtests/).

What should you do with a losing backtest? Not tune it. We ran these parameters once, and searching the same year for a lookback that turns the result positive would produce a number and no knowledge. For the rest of this page the strategy is a stand-in. A losing one will do: every problem below arrives whether or not the signals are any use.

## Step 3: dry run it against the Bybit testnet with no API key

A dry run reads live testnet candles, runs the strategy on each closed bar and prints the order it would send, without signing anything. Make `configs/live/breakout.json` from `configs/live/ma_cross.json` and run:

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

Four lines, and three of them are about things other than the strategy: where the state file lives, what the limits are, and how far this machine's clock is from Bybit's. The strategy's whole contribution is "no entry". `5f467f` is a hash of the strategy name, symbol, interval and parameters, and it comes back in the order IDs below.

<!-- unique:field-note -->
Without `--once` the runner keeps going, one line per closed bar. We left it up for the next two bars, on 21 November 2026:

```
2026-11-21T17:30:02Z bar 2026-11-21T17:15:00Z close 59660.0: no entry
2026-11-21T17:45:02Z bar 2026-11-21T17:30:00Z close 59677.3: no entry
```

Each line lands two seconds after the quarter hour by this machine's clock, which is the three-second settle delay on Bybit's clock less the offset of about 0.9 seconds. Then we stopped it. On the 904 testnet bars counted below, 94.25% would have ended in the same two words.

<!-- unique:firsthand-data -->
One quiet bar shows little, so we asked the runner's own planner what it would have sent on the most recent signal. On the last 1,000 closed testnet bars (11 to 21 November 2026, none missing) the strategy gave 52 entry signals in the 904 bars after warm-up, 51 of them short. The latest was the bar that opened at 10:15 UTC on 21 November and closed at 55,399.8. The request body, built by `SignalPlanner.plan` from public data only:

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
Look at `qty`. The config asks for 100 USDT per entry, and 100 / 55,399.8 is 0.0018 BTC. The testnet's quantity step for BTCUSDT is 0.001, the planner rounds down, and the order is for 0.001 BTC: 55.40 USDT, a little over half of what the config says. The lot size filter is easy to leave out of a tutorial, and on a small account it decides your real position size.

The stop and the target travel on the entry order itself, so Bybit holds them and they keep working if your program is not running. Setting up the account side is covered in [Bybit testnet](/learn/bybit-testnet/), and signing requests by hand in [Bybit API with Python](/learn/bybit-api-python/). One more thing to get used to on the testnet: that bar closed at 55,399.8 and the 17:00 bar at 59,660.0, a 7.69% move in 6.75 hours. The median 15-minute bar in our download traded 0.99 BTC, so prices there say little about the real market.

## Where trading bots die, and what the code does about it

Each failure below is paired with the lines in perpmath 0.2.0 that deal with it. Read them as one worked answer you can check, since none of it has met a real account yet.

### Duplicate orders

A bot sends the same order twice when it forgets it already sent it. The usual cause is keeping the list of handled signals in memory only: the process restarts, the list is empty, and that bar's signal goes out again. An earlier private runner this code was rewritten from had that weakness.

<!-- unique:cross-reference -->
The fix is an order ID that can be rebuilt from the decision alone. [`order_link_id`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L117-L132) joins the strategy name, the settings hash, the bar's open time, the direction and the action. Bybit's [create-order page](https://bybit-exchange.github.io/docs/v5/order/create-order) (checked 22 November 2026) allows a custom `orderLinkId` of up to 36 characters and requires it to be unique, and its [error list](https://bybit-exchange.github.io/docs/v5/error) has code 110072 for a duplicate. Stripe's [idempotency guide](https://docs.stripe.com/api/idempotent_requests) (checked 22 November 2026) suggests random V4 UUIDs for such keys. That works when the client remembers its key. A bot that may crash between deciding and writing things down needs a key it can derive again from nothing.

<!-- unique:firsthand-data -->
We called the function twice for that 10:15 bar and got `pm-breakout-5f467f-1795256100-SE1` both times. One bar later it gives `...-1795257000-SE1`. With the lookback changed from 96 to 97 the hash part becomes `6ece7d`, so two parameter sets on one account can't collide.

### A timeout, and no idea whether the order exists

A request that times out has an unknown outcome, and resending it blind is how one signal becomes two positions. Bybit's [API FAQ](https://bybit-exchange.github.io/docs/faq) (checked 22 November 2026) says the place-order endpoint is asynchronous and answers before the order is executed, so even a clean reply is not a fill.

The runner writes the pending ID into its state file before sending, never retries a POST inside the HTTP client, and on a network error [looks the order up by its ID](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L718-L758) before doing anything else. It retries only if the lookup finds nothing, and only with the same ID. Then it polls until the order reaches a final status, and halts if that takes longer than 20 seconds.

### Partial fills

A market order can fill in part. For an entry the runner keeps what filled and does not chase the rest; the stop is attached in `Full` mode, so it covers whatever size the position ended up with. A partly filled exit is the dangerous case. It is followed by another reduce-only order for the remainder, three at most, and then a halt with the exchange-side stop still in place.

### Restarting without knowing your position

After a restart the bot's memory and the exchange can disagree, and a bot that trusts its memory will add to a position it does not know it has. The [state file](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/state.py#L60-L69) is written to a temporary file, flushed to disk and renamed over the old one, which Python's [`os.replace`](https://docs.python.org/3/library/os.html#os.replace) documents as atomic on POSIX systems (checked 22 November 2026). A crash mid-write leaves the previous file intact.

On start, [`reconcile`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L567-L607) compares that file with Bybit's positions and open orders. A position the file does not know, a position the file expects that is gone, a different size, an open order it did not place, or a position with no stop-loss: each one stops the program with a message saying what it found. It does not pick a side.

### Clock skew

<!-- unique:firsthand-data -->
Bybit rejects a signed request whose timestamp falls outside `server_time - recv_window <= timestamp < server_time + 1000`, with a default window of 5,000 ms ([integration guide](https://bybit-exchange.github.io/docs/v5/guide), checked 22 November 2026). The machine these runs were made on was 1,019 ms, 884 ms and 893 ms behind Bybit on three starts within a few minutes. Behind by a second is inside the window. The same error in the other direction would have been past the 1,000 ms limit on the first of those starts.

So the client measures the offset from the public time endpoint and stamps requests with Bybit's clock, not its own. An offset above 5,000 ms halts the runner. The config comment calls that a sanity limit on the machine's clock, separate from Bybit's one-second rule.

### Rate limits

Bybit's [rate limit page](https://bybit-exchange.github.io/docs/v5/rate-limit) (checked 22 November 2026) allows 600 requests per 5 seconds per IP and tells clients that hit an HTTP 403 to stop and wait at least 10 minutes. A retry loop with no pause is how a bot walks into that ban. The [client](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/bybit.py#L258-L283) reads the `X-Bapi-Limit-Status` and `X-Bapi-Limit-Reset-Timestamp` headers, waits until the reset time, and counts every limit hit as an API error for the breaker below.

### No circuit breaker

A bot with no stop condition keeps trading through whatever is breaking it. perpmath has [four breakers](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/breaker.py#L42-L110), each a setting in the config:

| Breaker | Default | Trips when |
| --- | --- | --- |
| Daily loss | 20 USDT | equity is down this much since the day's first reading (UTC) |
| Position size | 200 USDT | an order or the position on Bybit is larger |
| API errors | 5 in a row | no bar was handled cleanly in between |
| Clock skew | 5,000 ms | local and Bybit clocks differ by more |

A tripped breaker writes its reason into the state file, exits with code 3 and stays tripped across restarts until you pass `--clear-halt`. It does not close the position. The docstring gives the reason: closing automatically after five failed API calls would mean trusting the same failing API to close correctly. The stop-loss on Bybit's side is the protection.

### An API key that can do too much

A trading bot never needs to withdraw. Bybit's [key information endpoint](https://bybit-exchange.github.io/docs/v5/user/apikey-info) (checked 22 November 2026) lists a key's permissions, and [`check_api_key`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/executor.py#L276-L311) refuses to start with a key that has `Withdraw` or any transfer permission, with a read-only key, or with one lacking contract order permission. It warns when the key isn't bound to an IP. Keys come from two environment variables and nowhere else, and the logs show at most a key's length and its first and last four characters.

Two smaller guards belong on this list. The runner does not trade a bar when candles are missing from the history it was given, and it does not act on a decision more than 60 seconds old, as the backtest would have filled at that bar's open and a late fill is a different trade.

## What version 0.2 cannot do

It cannot trade real money, and that is deliberate. The endpoint is a constant, [checked again before every request](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.0/src/perpmath/live/bybit.py#L114-L119), and a config or a flag that asks for mainnet is refused. The README plans live trading for 0.3, after a position guard exists.

<!-- unique:field-note -->
The limit that matters most for this article: the signed endpoints have only been exercised against a fake exchange, a 234-line file of test doubles built from Bybit's documentation. On 21 November 2026 the suite, with the breakout strategy registered, finished at 253 passed and 1 skipped in 3.49 seconds, and 69 of those tests are in the runner's own test file. None of them touched the network. Nobody has placed an order with this code using a real testnet key, so everything in the previous section describes what the code is written and tested to do, and none of it is a report from an exchange.

Other gaps, from the README: order status is polled over REST, not streamed over WebSocket. Entries are a fixed USDT amount, where the backtest sizes by a fraction of equity. The target is computed from the signal bar's close, since the fill price isn't known when the order goes out. Testnet prices and liquidity are not mainnet's.

One disclosure. The runner has a `broker_id` setting for Bybit's API Broker programme, which would let the project receive a share of trading fees. It is empty by default and no broker header is sent while it is empty. Our relationship with Bybit is described on the [disclosure page](/disclosure/).

The engine's home on this site is the [bot page](/bot/). To see what a 2 ATR stop does to the quantity before you size anything, use the [position size calculator](/tools/position-size-calculator/).

## FAQ

### Is Python fast enough for a trading bot?

For a bot that decides once per closed bar, yes. In the dry run above, start-up and the first bar took about one second by the log's own timestamps, and the next decision was 15 minutes away. Python is the wrong tool for strategies that compete on microseconds, and nothing on this page applies to those.

### Do I need an API key to try this?

No. The backtest uses public candles and `--dry-run` uses public testnet endpoints, and neither signs a request. You need a testnet key only to place testnet orders, and the runner asks you to type `TESTNET` before the first one.

### Will this bot make money?

<!-- unique:firsthand-data -->
No. The breakout example lost 34.79% and 19.32% in its two test periods, and the six example strategies shipped with version 0.2.1 lose in both of theirs as well. The code exists to show how the accounting and the order handling work.

### How much code is a trading bot?

<!-- unique:original-calc -->
In this repository, 1,077 lines for order handling and 707 for its tests, next to strategy files of 27 to 82 lines each. Your numbers will differ. The ratio probably won't, since each failure above needs code and none of them goes away with a simpler strategy.