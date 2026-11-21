---
title: "Paper trading crypto: what a backtest, a demo account and a bot's dry run each test"
slug: "paper-trading-crypto"
description: "Three ways to practise crypto trading with no money, and what each can't show. We ran a bot's dry run for 80 minutes and backtested the same candles to compare."
date: "2026-12-03"
lastmod: "2026-12-03"
lang: "en"
category: "Trading bots"
tags: ["paper trading", "dry run", "backtest", "Bybit testnet", "trading bot"]
keywords: ["paper trading crypto", "crypto paper trading", "paper trading bot", "crypto demo trading", "dry run trading bot"]
tldr: "Paper trading crypto can mean a backtest, an exchange's demo or testnet account, or a bot's dry-run mode, and each one tests something different. On 21 November 2026 we ran four keyless dry runs of our bot for 80 minutes on Bybit testnet candles: 176 bar decisions and 3 entries. A backtest of the same candles reproduced all 176 decisions, then added what the dry run never computes: fills, fees and a result. One paper trade had its stop 2.70 USDT from the entry while the backtest's assumed slippage was 11.84."
---

Paper trading crypto is three different exercises that share one name. You can replay old prices through fixed rules, which is a backtest. You can trade play money in an account the exchange gives you. Or you can let a bot run live and stop it one step short of sending its orders, which is a dry run. Each tests one part of trading and is blind to the rest.

<!-- unique:firsthand-data -->
We ran the third kind and then checked it against the first. On 21 November 2026, four dry runs of our open-source bot watched Bybit testnet candles for 80 minutes with no API key: 176 closed bars, 3 entries, 1 paper stop-out. Then the engine backtested the same strategies on the same candles. Every decision matched. What did not match is everything that happens after a decision, and that is most of this page.

## Three ways to paper trade crypto, and what each one tests

A backtest tests rules against history. A practice account tests you, or your bot's orders, against live prices. A dry run tests whether a bot makes the decisions you think it makes, in real time.

| | Backtest | Demo or testnet account | Bot dry run |
| --- | --- | --- | --- |
| Prices | Recorded history | Live | Live |
| Who decides | Fixed rules | You or your bot | Your bot |
| A year of trading takes | Seconds | A year | A year |
| Orders reach an exchange | No | Yes, in play money | No |
| Fills | Assumed by a rule | Simulated by the exchange | None, or assumed |
| Fees and slippage | Assumed | Charged in play money | Often not computed |
| Needs an account | No | Yes | No |

**Backtest.** It is the only one of the three that can cover a year in seconds, and the only one whose every assumption is written down where you can change it. The method, and five ways it goes wrong, are in [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/).

**Demo or testnet account.** On Bybit these are two products. Its [Demo Trading article](https://www.bybit.com/en/help-center/article/Demo-Trading) (last updated 30 October 2026, checked 22 November 2026) says a demo account follows mainnet price movements and that its executed orders do not enter the real order book, while testnet orders trade inside the testnet's own book and move its prices. We measured how far that separate book drifts from the real market in [Bybit testnet](/learn/bybit-testnet/) and will not repeat the figures. We did not open either kind of account for this article, so nothing below comes from clicking through a demo screen.

**Bot dry run.** The last column describes our own runner, which is the plainest kind: it prints the order and stops. Others do more. Freqtrade's [configuration docs](https://www.freqtrade.io/en/stable/configuration/) (checked 22 November 2026) say its dry-run keeps a simulated wallet, fills market orders from order-book volume at the moment they are placed with slippage capped at 5%, and fills limit orders once price reaches their level. That is a fuller simulation. Every clause in it is still an assumption about fills.

## The dry run we kept: four runs, 80 minutes, no key

Each run was one command. The `--dry-run` flag builds the client without credentials, so no key is read and nothing can be signed:

```text
perpmath live ma_cross --symbol BTCUSDT --interval 1m --config ma_cross.live.config.json --dry-run
```

On every closed bar the runner fetches the last 500 testnet candles from Bybit's public endpoint, runs the strategy on them, and prints one line. If the strategy wants in, it prints the exact order body it would have signed and keeps a paper position so the next bars can check the stop and the target.

<!-- unique:firsthand-data -->
| Strategy | Bar | Bars handled | Entries | Paper exits |
| --- | --- | --- | --- | --- |
| `ma_cross` | 1 minute | 81 | 1 long | 1, by its stop |
| `liquidity_sweep` | 1 minute | 81 | 1 long | 0 |
| `ma_cross` | 15 minutes | 7 | 0 | 0 |
| `liquidity_sweep` | 15 minutes | 7 | 1 short | 0 |

<!-- unique:field-note -->
All four started at 19:40:10 UTC and printed their last line at 21:00:02, when we stopped them. That is 79.9 minutes, and it has to be read as 79.9 minutes. It shows that the loop ran, that no bar was skipped, and that each line landed two seconds after the bar closed by this machine's clock. It shows nothing about the strategies, which lose money over a year in the [published backtests](/backtests/). We used 1-minute bars for two of the runs only to get more decisions into the time we had; the engine's published results are all on 15-minute bars.

Here is the one trade that opened and closed inside the window, from the `ma_cross` 1-minute log:

<!-- unique:firsthand-data -->
```text
2026-11-21T19:51:02Z bar 2026-11-21T19:50:00Z close 59198.6: no entry
2026-11-21T19:52:02Z bar 2026-11-21T19:51:00Z close 59200.4: long exit-short
2026-11-21T19:52:02Z [dry run] would send POST /v5/order/create {"category":"linear","symbol":"BTCUSDT","side":"Buy","orderType":"Market","qty":"0.001","positionIdx":0,"orderLinkId":"pm-macross-156e42-1795290660-LE1","stopLoss":"59197.7","slTriggerBy":"LastPrice","tpslMode":"Full","slOrderType":"Market"}
(24 lines of "no entry" left out)
2026-11-21T20:17:02Z bar 2026-11-21T20:16:00Z close 59701.0: no entry
2026-11-21T20:17:02Z [dry run] paper position would have closed by its stop at 59197.7 in bar 2026-11-21T20:16:00Z
```

Notice what is missing. There is an order and there is a stop, and at no point is there a fill price, a fee or a profit and loss. The dry run never says whether that trade made or lost money.

## Does a dry run agree with a backtest of the same candles?

On decisions, completely. On everything after the decision the dry run is silent, and the backtest has to fill the gap with assumptions.

<!-- unique:firsthand-data -->
After stopping the runs we downloaded the same testnet candles again, with the 500 bars of history before the first one, and replayed each of the 176 bars the way the runner had seen it. All 176 decisions were identical to the log: the three entries on the same bars, the same sides, the same exit flags. The 176 closing prices in the log matched the re-downloaded candles to the last digit too, so the testnet did not revise a bar after the runner read it. This is what a dry run is good for. It shows that the live loop and the backtest run the same strategy code on the same data, with nothing shifted by a bar.

<!-- unique:firsthand-data -->
Then we ran the engine's own `perpmath backtest` on that candle file, with the split placed on the first bar the runner handled, so that the result's second block starts flat and covers exactly the dry-run window. The script is `research/paper-trading-crypto/compare.py` in the site's repository. Costs are the engine's defaults, a 0.055% fee per side and 0.02% of slippage per fill:

| Entry | Dry run printed | Backtest of the same candles |
| --- | --- | --- |
| `ma_cross`, 1 minute, long | reference 59,200.4, stop 59,197.7 | filled 59,212.24, stopped out at 59,185.87, result -0.15% |
| `liquidity_sweep`, 1 minute, long | reference 59,701.0, stop 58,676.0, target 61,751.0 | filled 59,712.94, target 61,786.78, still open, +0.93% |
| `liquidity_sweep`, 15 minutes, short | reference 60,307.7, stop 60,891.2, target 59,140.7 | filled 60,295.64, target 59,104.56, still open, -0.21% |

Results are percentages of the position's value. Three trades are not a sample of anything, and the two open ones are marked at the window's last close. Look at the gaps between the columns instead.

<!-- unique:original-calc -->
The first row is the instructive one. The strategy put its stop 2 ATR below the close, and on quiet 1-minute testnet bars that came to 2.70 USDT, or 0.0046% of the price. The backtest's assumed slippage on the entry alone is 11.84 USDT, 4.4 times the distance to the stop, and the fees for a round trip are 65.13 USDT per bitcoin, 24 times that distance. So the backtest booked a loss of 6.30 times the planned risk on a trade whose dry-run log looks perfectly orderly. A stop sitting inside the strategy's own costs only shows up when something does the cost arithmetic, and the dry run does none.

<!-- unique:original-calc -->
The second and third rows show a smaller, permanent difference. The runner has to send the take-profit with the entry order, before it knows the fill, so it measures the target from the signal bar's close. The backtest measures it from the fill. On the same signal the two targets are 35.78 and 36.14 USDT apart. The engine's [README](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.2/README.md#known-limitations) lists this under known limitations, and here it is with numbers on it.

<!-- unique:firsthand-data -->
And the stop-out itself. The 1-minute testnet bar that opened at 20:16 UTC went from 59,233.7 up to 60,630, down to 58,690 and closed at 59,701.0, a range of 3.28% on 2.666 BTC of volume. The dry run assumes the stop filled at exactly 59,197.7. The backtest assumes 0.02% worse. What a real stop-market order would have received inside a bar like that, neither of them knows.

<!-- unique:firsthand-data -->
That bar existed only on the testnet. The same minute on mainnet ran from 60,266.7 to 60,296.0, a range of 0.06%. Over the 81 minutes the testnet traded 17.80 BTC and mainnet 1,521.83. When we backtested the same strategies on mainnet candles for the same minutes, they gave 7 entry signals against the testnet's 3, and none fell on the same bar in the same direction. A dry run on testnet candles and a backtest on real ones are tests of two different markets.

## What a dry run cannot tell you

It cannot tell you anything that depends on an order meeting a market. In our case the list is:

- **Whether the exchange would accept the order.** Nothing is signed or sent. The runner's signed endpoints have been tested against a fake server built from Bybit's documentation, and have never placed an order with a real testnet key.
- **The fill.** No price, no slippage, no partial fill, no place in a queue.
- **Fees.** None are computed, so a stop inside the fee, like the one above, passes unnoticed.
- **Funding.** BTCUSDT settles every eight hours, and our 80 minutes sat between the 16:00 and 00:00 UTC settlements. A longer run would cross them, and this runner would still not book them.
- **A result.** There is a paper position and no paper balance. You get a list of decisions, not an equity curve.

<!-- unique:original-calc -->
It also cannot give you evidence in any reasonable time. Over the engine's shipped year `ma_cross` made 835 trades on 15-minute bars, which is 2.29 a day. The engine marks any block with fewer than 100 trades as an insufficient sample. To watch 100 trades go by in a dry run you would wait about 44 days; the backtest reads the whole year in seconds. I was hoping our 80 minutes would let me say something about how the strategies behave live, and I have to take that back: one closed trade supports no statement about them at all.

So the three kinds of practice belong in an order, each doing the job it can do. Backtest first, with costs, to find out whether the rules are worth another minute. Dry run next, for days, to confirm the bot decides what the backtest decided. A testnet or demo account after that, for the order handling a dry run skips. Before any real order, work out the size with the [position size calculator](/tools/position-size-calculator/) and where it would be closed with the [liquidation price calculator](/tools/liquidation-price-calculator/).

The runner used here is described on the [bot page](/bot/), and the code behind each log line in [how to build a trading bot in Python](/learn/build-a-trading-bot-python/). perpmath is independent of Bybit; how this site earns from Bybit links is on the [disclosure page](/disclosure/).

## FAQ

### Is paper trading crypto accurate?

It is accurate about what it actually exercises. A backtest is exact arithmetic on assumed fills, a demo account uses real prices with simulated fills, and a dry run reproduces decisions and nothing else. None of the three places your order in a real book.

### Does Bybit have paper trading?

Two forms of it: Demo Trading inside the main site, on mainnet prices, and a separate testnet with its own order book. They behave very differently, and the comparison is in [Bybit testnet](/learn/bybit-testnet/).

### Can I paper trade a bot without an API key?

Yes, for the first two steps. A backtest needs only public candles, and the dry run above used public testnet endpoints with no key and no account. A key becomes necessary when orders are actually sent, on a testnet or demo account.

### How long should I paper trade before going live?

Long enough to see the things that only happen live, such as restarts, missing bars and a settlement or two, which is days and not minutes. We would not treat the profit or loss of a paper run as evidence either way.
