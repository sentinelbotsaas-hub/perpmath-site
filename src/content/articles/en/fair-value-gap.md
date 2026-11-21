---
title: "Fair value gap: exact rules and a backtest that lost money"
slug: "fair-value-gap"
description: "What a fair value gap is, rules precise enough to code, and a one-year BTCUSDT backtest: it lost 66.94% after costs and showed no edge before them."
date: "2026-11-18"
lastmod: "2026-11-18"
lang: "en"
category: "Backtests"
tags: ["fair value gap", "FVG", "backtest", "BTCUSDT", "trading costs"]
keywords: ["fair value gap", "FVG trading", "fair value gap strategy", "fair value gap backtest"]
tldr: "A fair value gap is a three-candle pattern in which candles 1 and 3 do not overlap, leaving a zone only the middle candle traded through. We backtested a return-to-gap entry on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026: 801 in-sample trades lost 66.94% and 304 out-of-sample trades lost 42.86%. Rerun with zero fees and slippage, the same rules returned +6.03% and -10.05%, and neither is distinguishable from zero."
---

<!-- unique:firsthand-data -->
Price came back to 92.02% of the fair value gaps we counted on a year of BTCUSDT 15-minute candles, usually within half an hour. Trading that return lost two thirds of the account. Both numbers are real, and the distance between them is the whole article.

## What is a fair value gap?

A fair value gap (FVG) is a three-candle pattern in which the first and third candles do not overlap, so a band of prices was crossed by the middle candle alone. The idea comes from the [ICT and "smart money" school](/learn/ict-trading/) of chart reading, where the band is treated as an imbalance that price tends to revisit.

There are two versions. In a bullish gap the low of candle 3 sits above the high of candle 1. In a bearish gap the high of candle 3 sits below the low of candle 1. Nothing else is needed for the pattern itself, no indicator and no trend filter.

<!-- unique:firsthand-data -->
That bare definition fires constantly. On the 35,040 fifteen-minute BTCUSDT bars in our data, 7,176 bars completed a gap of some size, one bar in five (20.48%). A pattern that shows up every fifth candle can't mean much by itself. Any usable definition needs a size filter, and that's where the agreement ends.

## How do you spot a fair value gap? The rules, precisely

You spot one by comparing two prices: the high of candle 1 and the low of candle 3 for a bullish gap, the low of candle 1 and the high of candle 3 for a bearish one. Written so that a program can check it:

```
bullish gap:  low[3] > high[1]     zone = high[1] (bottom) to low[3] (top)
bearish gap:  high[3] < low[1]     zone = high[3] (bottom) to low[1] (top)
size filter:  zone height >= 0.5 x ATR(14), ATR read on candle 3
```

The ATR here is the simple average of the last 14 true ranges. The 0.5 is our choice. Fair value gaps have no agreed standard parameters, and the public tools show it: the [LuxAlgo library entry](https://www.luxalgo.com/library/concept/fair-value-gap/) (checked 18 November 2026) says most tools require a minimum size, set either from ATR or as a percentage, and that many treat a touch of the zone's midpoint as a fill. Two traders who both "trade FVGs" can be looking at different sets of candles.

<!-- unique:firsthand-data -->
With our filter, 1,930 of the 7,176 gaps survive (26.9%), about 5.29 a day. Their median height is 0.218% of price, roughly 140 USDT on a 64,000 USDT bitcoin.

## The entry rule we tested

We tested the entry exactly as the docstring of [fvg.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/2fdc9ded4ca0f04d518bfe8a4fb7bbcd57245079/src/perpmath/strategies/fvg.py) in the open-source engine defines it (checked 18 November 2026): wait for price to come back to the gap, enter if the return bar closes on the right side of the zone, stop beyond the zone, target at twice the risk. Everything is decided on a bar's close and filled at the next bar's open.

- A gap waits for price to return and expires, unused, after 96 bars (24 hours).
- Bullish entry: the first later bar whose low reaches the top of the zone. If that bar closes at or above the bottom of the zone, go long. If it closes below the bottom, the gap has failed and is dropped.
- Bearish entry: the first later bar whose high reaches the bottom of the zone. If that bar closes at or below the top of the zone, go short. If it closes above the top, the gap is dropped.
- Each gap is used at most once, whether or not it leads to a trade.
- Stop: for a long, the bottom of the zone minus 0.1 x ATR; for a short, the top plus 0.1 x ATR, with ATR as measured when the gap formed.
- Target: 2 x risk from the fill price, where risk is the distance from fill to stop.
- One position at a time. Signals that arrive while a position is open are ignored. If several gaps trigger on one bar, the most recently formed is used.

One detail matters more than it looks. The entry is a market order placed once the return bar has closed. It is not a limit order resting at the edge of the gap, so the fill can land anywhere relative to the zone.

The five parameters (ATR period 14, minimum gap 0.5 ATR, wait 96 bars, stop buffer 0.1 ATR, target 2R) sit in [configs/fvg.json](https://github.com/sentinelbotsaas-hub/perpmath/blob/2fdc9ded4ca0f04d518bfe8a4fb7bbcd57245079/configs/fvg.json). The engine's README states they were fixed once, before the first run on real data, and not adjusted. The engine has no optimizer.

## What the one-year backtest shows

<!-- unique:firsthand-data -->
It lost money in both periods, and the loss is too large to be luck. The data is BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 18 November 2026), from 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026: 35,040 bars, none missing. The published result file was generated on 18 November 2026. The first 70% of the period is in-sample and the rest, from 31 July 2026, is out-of-sample.

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Equity left of 10,000 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 801 | 31.46% | -0.57 | -4.93 | -66.94% | 66.97% | 3,305.50 |
| Out-of-sample | 304 | 27.96% | -0.83 | -5.23 | -42.86% | 43.19% | 5,714.36 |

Costs in that run: a fee of 0.055% per side, which is the base taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page updated 5 November 2026, checked 18 November 2026), plus 0.02% slippage on every fill. The slippage figure is an assumption, not a measurement. Each trade uses 100% of equity with no leverage. Funding payments are not modelled.

The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) (NIST handbook, checked 18 November 2026) of per-trade net returns against zero. As a rough guide, an absolute value under 2 can't be told apart from zero. Here it is -4.93 and -5.23. The test treats trades as independent, which flatters the figure, so take the exact values loosely and the sign seriously.

<!-- unique:original-calc -->
Both directions lose. In-sample, the 378 longs won 28.57% of the time and the 423 shorts 34.04%; out-of-sample it was 27.72% of 184 longs and 28.33% of 120 shorts. With a 2R target the win rate needed to break even before costs is 33.33%. Three of those four groups never reached it.

<!-- unique:original-calc -->
A 66.94% loss needs a 202.5% gain to get back to where it started, which you can check on the [drawdown calculator](/tools/drawdown-calculator/). The full report is listed under [backtests](/backtests/).

## How much of the loss is costs? Nearly all of it

<!-- unique:original-calc -->
Costs account for all of the in-sample loss and about four fifths of the out-of-sample loss. I expected something closer to half. We reran the engine (version 0.1.0, commit `2fdc9de`) on the same candle file, same parameters and same split date, changing only the cost settings:

```
python -m perpmath backtest fvg --symbol BTCUSDT --interval 15m --config research/fvg-zero-cost.config.json --out research/fvg-btcusdt-zero-cost.json --data-dir <engine>/data
python -m perpmath backtest fvg --symbol BTCUSDT --interval 15m --config research/fvg-fee-only.config.json --out research/fvg-btcusdt-fee-only.json --data-dir <engine>/data
```

The first config sets `fee_rate` and `slippage` to 0. The second keeps the 0.055% fee and drops slippage. Both reruns were made on 18 November 2026, and the script refuses to compare them unless the candle file's SHA-256 matches the published run.

| Run | Sample | Trades | Win rate | Avg trade | t-stat | Total return |
| --- | --- | --- | --- | --- | --- | --- |
| Published costs | In | 801 | 31.46% | -0.135% | -4.93 | -66.94% |
| Fee only | In | 814 | 33.29% | -0.100% | -3.77 | -56.71% |
| Zero cost | In | 814 | 34.15% | +0.010% | 0.38 | +6.03% |
| Published costs | Out | 304 | 27.96% | -0.182% | -5.23 | -42.86% |
| Fee only | Out | 316 | 30.38% | -0.142% | -4.33 | -36.48% |
| Zero cost | Out | 316 | 31.65% | -0.032% | -0.97 | -10.05% |

<!-- unique:original-calc -->
Read the "Avg trade" column. In-sample, the average trade goes from -0.135% of notional to +0.010% once costs are removed, a swing of 0.145 points against an assumed round-trip cost of 0.15%. Out-of-sample it goes from -0.182% to -0.032%. The trade counts differ slightly (814 against 801) since removing slippage moves fills, stops and targets by a hair, which changes when a position is still open and a later signal gets skipped.

<!-- unique:original-calc -->
Why do costs bite this hard? The stops are tiny. The median distance from entry to stop was 0.323% of price in-sample and 0.243% out-of-sample, so a 0.15% round trip is 0.46R and 0.62R at the median. You pay about half your risk to find out whether you were right. On 123 of the 801 in-sample trades the stop was closer than the round-trip cost itself. In money terms the in-sample account paid 5,417.00 USDT in fees on its way from 10,000 down to 3,305.50, and that's before slippage.

<!-- unique:original-calc -->
Here I have to take back part of the heading. "Nearly all costs" sounds like the strategy is fine and the exchange ate it. The zero-cost row says something less kind: +6.03% with a t-statistic of 0.38, then -10.05% with -0.97. That's a coin flip with a 2R payoff and a win rate hovering around the 33.33% break-even. There's no edge underneath for cheaper fees to uncover.

## Do fair value gaps get filled? Yes, and it doesn't help

Price did come back to almost every gap; coming back was not the hard part. This is the result I'd want a believer in the pattern to look at, since it grants the claim and still loses.

<!-- unique:firsthand-data -->
Of the 1,930 gaps that passed the size filter, price returned to the near edge of the zone within 96 bars on 1,776 of them, 92.02%. The median wait was 2 bars. On 826 of those returns (46.51%) it happened on the very next candle, and 72.8% came within an hour. After the return, 1,607 gaps produced an entry signal, 169 failed when the return bar closed through the far side, and 154 expired untouched.

<!-- unique:original-calc -->
So "price returns to the gap" is true and close to worthless as a trading signal. Something that happens 92% of the time, mostly within two bars, tells you very little about what happens next. Those 1,607 gaps fired on 1,592 bars, which became 1,105 trades (the other 487 signals arrived while a position was open), and those trades are the table above.

## Limits of this test, and how to run it yourself

This is one symbol, one timeframe, one year and one parameter set, so it says nothing about fair value gaps on daily charts, on other coins, or with a limit-order entry. BTC fell from about 92,000 to about 65,000 USDT over the period. The engine assumes the stop is hit first when a bar touches both stop and target, ignores funding, and fills at the next open with a fixed slippage.

What it does support is narrow: under these rules, on this market, the return-to-gap entry had no measurable edge before costs and a heavy loss after them. Hunting through parameters on the same year until something turns positive would be curve fitting, and we haven't done it.

To reproduce the published numbers:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest fvg --symbol BTCUSDT --interval 15m --config configs/fvg.json --out results/fvg-btcusdt.json
```

On Windows the activate line is `.venv\Scripts\activate`. These commands only backtest and never ask for an API key. Its home on this site is the [bot section](/bot/), and the [position size calculator](/tools/position-size-calculator/) shows what a 0.3% stop does to position size before you run anything of your own. Other concept pages are under [learn](/learn/), the remaining calculators under [tools](/tools/).

## FAQ

### Do fair value gaps always get filled?

<!-- unique:firsthand-data -->
No, but most are revisited. In our data price returned to the near edge of 92.02% of filtered gaps within 24 hours, with a median wait of 2 fifteen-minute bars. That's a touch of the edge, which is not the same as trading through the whole zone, and 7.98% weren't touched inside that window.

### What are the best settings for a fair value gap strategy?

There aren't agreed ones. We used a 0.5 ATR minimum size, a 96-bar wait, a 0.1 ATR stop buffer and a 2R target, chosen before the run. We haven't searched for better values, and a search on the same year would mostly find noise.

### Is 1,105 trades a big enough sample?

It's enough to say the loss isn't chance: both periods clear the engine's 100-trade minimum and have t-statistics near -5. It isn't enough to generalise. One year of one market can't tell you about the next.

### Would a limit order at the gap edge do better?

We don't know; it's a different strategy and it hasn't been run. A resting limit order would pay the maker rate, which Bybit's table lists at 0.02% for the base tier, but it would also get filled on the 169 gaps that failed, where our rule stood aside.

### Does this prove fair value gaps don't work?

It shows that one mechanical version lost 66.94% and 42.86% after costs and did nothing measurable before them. A discretionary trader who picks gaps by context is running a different test, one that nobody can check without a written rule. The limit-order variant and the 1-hour chart are the two runs still missing from our side.
