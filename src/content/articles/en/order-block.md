---
title: "Order block: rules a program can check, and a backtest that lost"
slug: "order-block"
description: "What an order block is, one definition a program can check, and the test: 801 blocks in a year of BTCUSDT, and a return entry that lost 42.33% after costs."
date: "2026-11-22"
lastmod: "2026-11-22"
lang: "en"
category: "Backtests"
tags: ["order block", "ICT trading", "smart money concepts", "backtest", "BTCUSDT"]
keywords: ["order block", "ict order block", "order block trading", "order block strategy", "bullish order block"]
tldr: "An order block is the last candle that closed against a strong move before the move began, and the trade is to enter when price comes back to it. We fixed one definition: a down bar immediately before three or more up bars that cover 2 ATR and close above the latest swing high, or the mirror image. On BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026 that gives 801 blocks, and price returned to 75.41% of them within 24 hours. Entering on the return lost 42.33% in-sample (325 trades) and 18.71% out-of-sample (141 trades) after costs. With costs at zero the same trades returned -6.27% and +0.54%, which cannot be told apart from zero."
---

<!-- unique:firsthand-data -->
How many order blocks are there in a year of BTCUSDT 15-minute candles? We counted 4,233, then 1,450, then 801, all on the same 35,040 bars. The first number is every candle that closed against a run of three or more candles going the other way. The last is what remains once "a strong move" has to be measured instead of eyeballed. Then we traded the 801 the way the idea is usually described, entering when price came back to the candle. The account lost 42.33% in the first 70% of the year and 18.71% in the rest.

## What is an order block?

An order block is the last candle that closed against a strong move before the move began. Ahead of a rise it is a down-closing candle, called a bullish order block. Ahead of a fall it is an up-closing candle, a bearish order block. The candle's range is drawn forward on the chart as a zone, and the trade is to enter in the direction of the move when price comes back to that zone, with the stop on its far side.

The term comes from [ICT trading and smart money concepts](/learn/ict-trading/), where it sits next to the [fair value gap](/learn/fair-value-gap/) and the [liquidity sweep](/learn/liquidity-sweep/). An "ICT order block" and an "SMC order block" are the same object under two labels. The story attached to it is that large traders built a position on that candle and will defend the price when it is revisited. A chart can show that a candle was followed by a strong move. It cannot show who traded there or what they intend to do next.

<!-- unique:cross-reference -->
On where the name comes from, we can only report what others say. [TMGM's guide to order blocks](https://www.tmgm.com/en/academy/trading-academy/order-block) (last updated 22 October 2026, checked 22 November 2026) says the concept was named and popularised by Michael J. Huddleston, who publishes as The Inner Circle Trader, mainly through his online videos, and that the underlying idea is older than his teaching. We could not find a dated, written primary source to check that against. His own site, [theinnercircletrader.com](https://www.theinnercircletrader.com/) (checked 22 November 2026), does not use the term on its home page and points to video lectures that we have not catalogued. So nothing below is presented as his wording.

## Where does the usual description stop being a rule?

At the words "strong move". We read three public descriptions on 22 November 2026. All of them draw the same picture, and none puts a number on the move.

- The [LuxAlgo library entry](https://www.luxalgo.com/library/concept/bullish-bearish-order-block/) calls an order block the last candle that closed against a move before the move took off, and says the candle alone is not the concept: the move away has to show displacement, meaning speed and range that break structure or trade through a prior swing. It lists four ways to draw the zone (the candle's full range, its body, its open to its extreme, the midpoint of the range) and says none is official. It also says no reliable universal hit rate exists.
- TMGM's guide marks the last opposite candle before an impulsive move, from high to low with the wicks. The move should be much bigger than the candles around it and usually breaks a prior swing. It gives no size. Its worked example enters only after price has come back and printed a rejection candle.
- LuxAlgo's open-source [Smart Money Concepts script](https://www.tradingview.com/script/CnB3fSph-Smart-Money-Concepts-SMC-LuxAlgo/) on TradingView, published on 11 October 2022, describes order blocks as areas where institutional participants open positions and removes a block from the chart once price breaks through it. The same page states that no supporting data exists on the validity of these teachings.

<!-- unique:cross-reference -->
Put side by side, the three leave the same questions open and answer one of them differently. How many candles make a move "impulsive", and how far does it have to travel? Does it have to break a swing, and a swing of what size? Is the block one candle or several? LuxAlgo says a run of consecutive opposite candles can be boxed as a single zone; TMGM marks a single candle. And neither written guide enters with a blind order at the edge of the zone. Both describe waiting for some confirmation after price returns, which is another thing a program cannot do until somebody defines it.

## The order block rule we tested

It is the one in the docstring of [order_block.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/strategies/order_block.py) in the open-source engine (checked 22 November 2026). The bullish case, with the published parameters filled in:

```
up bar:      close > open            down bar:  close < open

impulse:     3 or more up bars in a row, and on the latest of them
             (a) close - open of the run's first bar >= 2 x ATR(14)
             (b) close > latest confirmed swing high,
                 which the bar before the run had not closed above
             (c) close > high of the bar before the run

block:       the bar immediately before the run, if it is a down bar
zone:        that bar's low (bottom) to its high (top), wicks included
swing high:  a high above the highs of the 5 bars before it and the 5 after,
             used only once those 5 later bars have closed

wait:        up to 96 bars for the first bar whose low reaches the top
entry:       that bar closes at or above the bottom -> long at the next open
             that bar closes below the bottom       -> block dropped
stop:        bottom of the zone - 0.1 x ATR(14)
target:      2 x risk from the fill price
```

The bearish case is the exact mirror. ATR is the plain average of the last 14 true ranges, read on the block's own bar, before the impulse. Each block is used once, whether or not it leads to a trade, and the rule holds one position at a time.

Every line of that is a choice somebody could make differently. The module lists the ones it had to make:

- **Which candle.** The single bar immediately before the run, not a last down candle somewhere near the low.
- **How big a move.** Three same-direction closes in a row that cover 2 ATR and close beyond the latest confirmed swing point. A fair value gap inside the move is not required.
- **The zone.** The whole candle, high to low. Body-only zones and the candle's midpoint are also taught and are not used.
- **Mitigation.** The first bar that touches the zone uses the block up.
- **Filters.** No higher-timeframe bias, no session filter, no premium or discount filter.

Four of the eight parameters are carried over from the engine's earlier strategies (ATR 14, a 96-bar wait, a 0.1 ATR stop buffer, a 2R target). The swing size of 5, the 3-bar impulse and the 2 ATR minimum are new. According to the engine's [changelog](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/CHANGELOG.md), all of them were written down on 21 November 2026 (UTC), before the first run on real data, run once and not changed.

## How many order blocks does a year of BTCUSDT hold?

<!-- unique:firsthand-data -->
Between 801 and 4,233, depending on how much of the definition you switch on. We added the conditions one at a time on the same candles, which come from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) and run from 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, with none missing.

| Condition added | Candles left | Share of the first row |
| --- | --- | --- |
| The candle immediately before a run of 3 or more same-direction bars | 4,234 | 100% |
| That candle closed the other way | 4,233 | 99.98% |
| The run covers 2 ATR | 1,450 | 34.25% |
| The run closes beyond the candle | 1,434 | 33.87% |
| The run closes beyond the latest swing point | 801 | 18.92% |

<!-- unique:original-calc -->
The loosest reading, "the last opposite candle before three candles the other way", finds 4,233 candles, about 11.6 a day. Asking the run to cover 2 ATR removes two thirds of them. Asking it to close beyond the latest confirmed swing point removes another 633 and leaves 801, or 2.19 a day. Two traders who both mark order blocks, one by eye on any three-candle push and one who insists on a structure break, are looking at sets of candles that differ by a factor of 5.3.

Two rows in that table do almost nothing. A run starts when the direction of the candles flips, so the candle before it has already closed the other way unless it closed exactly at its open, which happened once. And a run that has covered 2 ATR has nearly always closed beyond the candle it started from; that condition removes 16 candles. The two conditions that carry the definition are the size of the move and the structure break. Those are also the two that the public descriptions leave without a number.

<!-- unique:firsthand-data -->
Of the 801 blocks, 385 are bullish and 416 bearish. The median zone is 0.226% of price tall, a little under one ATR (0.94), which is about 145 USDT on a 64,000 USDT bitcoin. The stop goes just beyond a box that small, a fact that decides most of what follows.

## Does price come back to an order block?

<!-- unique:firsthand-data -->
Three times out of four. Price returned to the near edge of the zone within 96 bars (24 hours) on 604 of the 801 blocks, 75.41%. The median wait was 10 bars, two and a half hours. Only 42 of those returns came on the very next candle, and 26.82% came within an hour.

That is slower and less certain than the fair value gap, where price came back to 92.02% of gaps with a median wait of 2 bars. The difference is built in. A gap's near edge is the low or high of the very candle that completes it. An order block exists only after a run of at least three candles has travelled 2 ATR and closed beyond it, so price starts well clear of the zone.

<!-- unique:firsthand-data -->
What happened on the return decides the trade:

| What happened to the block | Blocks | Share of 801 |
| --- | --- | --- |
| Price returned and the bar closed on the right side: entry signal | 533 | 66.54% |
| Price returned and the bar closed through the far edge: dropped | 71 | 8.86% |
| Never touched in 96 bars: expired | 196 | 24.47% |
| Formed too close to the end of the data | 1 | 0.12% |

The 533 signals landed on 530 bars, since three bars triggered two blocks at once. They became 466 trades. The other 64 signals arrived while a position was already open and were ignored.

So "price comes back to order blocks" is true on this chart, and "they hold when it does" is true on the bar of the return 88.25% of the time. Neither statement says anything about the next few hours, which is where the trade is won or lost.

## What the one-year backtest shows

<!-- unique:firsthand-data -->
It lost in both periods, by more than chance explains. In-sample is the first 70% of the year and out-of-sample starts on 31 July 2026; each starts again from 10,000 USDT. The engine's result file was generated on 21 November 2026 (UTC), and the page for it, with the equity curve, is the [order block backtest](/backtests/order-block-btcusdt/).

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Equity left |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 325 | 30.77% | -0.61 | -3.77 | -42.33% | 46.92% | 5,766.69 |
| Out-of-sample | 141 | 24.11% | -0.98 | -2.49 | -18.71% | 24.94% | 8,128.92 |

Every fill pays 0.055%, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), and is moved 0.02% against the trade as slippage. The slippage figure is an assumption, not a measurement. Position size is 100% of equity with no leverage, and funding payments are not modelled.

The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of each trade's net return against zero. Under 2 in absolute value, the average can't be told apart from zero. These are -3.77 and -2.49, which the site's verdict rule calls a clear loss in both periods. The test treats trades as independent, which flatters it, so trust the sign more than the decimals.

<!-- unique:original-calc -->
A 2R target needs a win rate of 33.33% to break even before costs, which you can check on the [risk-reward calculator](/tools/risk-reward-calculator/). In-sample, 148 longs won 27.03% and 177 shorts won 33.90%. Out-of-sample it was 23.29% of 73 longs and 25.00% of 68 shorts. One group of four got past the line, the in-sample shorts, in a year when BTCUSDT fell 29.86%. Their average trade still lost 0.17% of notional.

<!-- unique:original-calc -->
The account that fell to 5,766.69 needs a 73.4% gain to be back at 10,000. The [drawdown calculator](/tools/drawdown-calculator/) does that sum for any figure.

## Where did the fills land? The limit order the engine doesn't have

The engine has no resting limit orders. The entry is a market order at the open of the bar after the one that came back to the zone, and it pays the taker fee. The fill can be above the zone, inside it, or below it but above the stop. The engine's own notes say the usual description of this trade rests a limit order at the edge of the block, so we measured how far off the market order was.

<!-- unique:firsthand-data -->
In-sample, 207 of the 325 fills (63.69%) were outside the zone, on the side price had come from: the return bar dipped into the block, closed back out of it, and the next bar opened beyond the near edge. The other 118 (36.31%) filled inside the zone. Out-of-sample the split was 86 and 55. Our script also had a bucket for fills past the far edge. It stayed empty in both samples, which makes sense once you see it: a bar that gives a signal has closed on the right side of the far edge, and the next open is rarely far from that close.

<!-- unique:original-calc -->
Measured from the stop, the median fill was 1.11 times as far away as the near edge of the zone, in both samples. The market order typically carried about a tenth more risk distance than a fill exactly at the edge would have. That is a real handicap. It is not the 0.61R the average trade lost.

<!-- unique:original-calc -->
What does the damage is the size of the stop. The median distance from fill to stop was 0.330% of price in-sample and 0.262% out-of-sample. The round trip costs 0.15% (two fees, two fills of slippage), which is 0.45R and 0.57R at those medians. On 49 of the 325 in-sample trades and 34 of the 141 out-of-sample trades, the stop was closer than the round-trip cost itself. This is also why the out-of-sample average R is -0.98 with a 24.11% win rate, a figure that looks impossible if a loss is supposed to cost 1R: a stopped trade loses 1R plus costs, and 25 of those 141 trades lost more than 2R. In-sample, 72 trades (22.15%) were stopped out inside the bar they entered on.

<!-- unique:firsthand-data -->
With fees and slippage set to zero, the same rule made 327 in-sample trades for -6.27% and 145 out-of-sample trades for +0.54%, with t-statistics of -0.38 and 0.11. The average trade moved from -0.166% of notional to -0.017%, and from -0.145% to +0.006%. Those reruns were first published in our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/), and we reproduced them for this article on 21 November 2026 (UTC). There is no edge under the costs. With them removed the rule wins 33.03% and 28.28% of its trades, against the 33.33% a 2R target needs.

Would a real limit order at the edge do better? We have not run it, and it is a different strategy. It would start with about a tenth less risk per trade and would pay the 0.02% maker rate in Bybit's table in place of the taker rate. It would also be filled on the 71 blocks that closed through their far edge on the return bar, which the rule above stands aside from. Which of those effects wins is unknown until someone codes it.

## Four other values for "how big a move"

<!-- unique:firsthand-data -->
Since the size of the move is the judgement call that matters most, we reran the engine on four other settings of it: a minimum of 1 ATR and of 3 ATR, and impulses of 2 and of 4 bars. The list was fixed before the first of these runs, on 21 November 2026 (UTC), after the published result already existed. It is a sensitivity check. None of these rows was used to choose the published parameters, and none is a recommendation.

In the table, "in / out" is in-sample and out-of-sample, and the last column is the t-statistic of the same row with fees and slippage at zero.

| Impulse bars | Minimum move | Trades in / out | Return in / out | t-stat in / out | Zero-cost t in / out |
| --- | --- | --- | --- | --- | --- |
| 3 | 2 ATR (published) | 325 / 141 | -42.33% / -18.71% | -3.77 / -2.49 | -0.38 / 0.11 |
| 3 | 1 ATR | 434 / 205 | -53.78% / -27.38% | -4.92 / -3.50 | -0.46 / 0.01 |
| 3 | 3 ATR | 179 / 76 | -32.02% / -0.97% | -3.54 / -0.10 | -0.87 / 1.49 |
| 2 | 2 ATR | 398 / 175 | -44.24% / -20.87% | -3.62 / -2.54 | 0.17 / 0.37 |
| 4 | 2 ATR | 225 / 109 | -31.85% / -14.33% | -3.29 / -2.17 | -0.20 / -0.06 |

<!-- unique:original-calc -->
All ten blocks lost after costs, and nine of them have a t-statistic below -2. The tenth is the 3 ATR setting out-of-sample: 76 trades, -0.97%, t of -0.10. That block is under the engine's 100-trade minimum, so it is flagged as an insufficient sample and every number in it is noise, including the fact that it almost broke even. Its zero-cost version, +10.82% with a t of 1.49, is the best-looking cell in the whole exercise and has 79 trades behind it.

<!-- unique:original-calc -->
The stricter settings lose less in total, and it would be easy to read that as "bigger impulses make better order blocks". The per-trade figures say otherwise. In the nine blocks with at least 100 trades, the average trade lost between 0.13% and 0.21% of notional, the same size as the 0.15% round trip. The 4-bar setting loses 31.85% where the 1 ATR setting loses 53.78% mostly by trading 225 times in place of 434. With costs at zero, no block in the table has an absolute t-statistic above 1.49.

## What this test leaves out

It covers one coin, one timeframe and one falling year, with one fixed reading of a term that is normally applied with judgement. The article on [breaker blocks](/learn/breaker-block/) reran this same rule on ETHUSDT and SOLUSDT and found the same in-sample picture (-37.71% and -41.27%) and two out-of-sample blocks that were flat, at -0.63% and -2.22%. All three coins come from the same twelve months, so they are not three independent tests.

Inside the engine, a bar that touches both the stop and the target counts as a stop, fills happen at the next open with a fixed slippage, and funding is ignored. With an average holding time of 3.44 hours in-sample, funding matters less here than in a rule that holds for days.

What the rule does not have is everything a discretionary trader adds: a higher-timeframe bias, a preference for blocks in the discount half of a range, a session filter, a confirmation candle on a lower timeframe. Those may help or may not. None of them can be tested until it is written down as tightly as the block itself, and a [break of structure](/learn/break-of-structure/) filter, the most common of them, has its own definition problem.

## Run it yourself

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest order_block --symbol BTCUSDT --interval 15m --config configs/order_block.json --out results/order-block-btcusdt.json
```

On Windows the activate line is `.venv\Scripts\activate`. The backtester asks for no account and no API key. To reproduce a row of the sensitivity table, copy `configs/order_block.json`, change `min_impulse_atr` or `impulse_bars`, and point `--config` at the copy; for the zero-cost column set `fee_rate` and `slippage` to 0. Our rerun of the published setting gave the published metrics exactly.

The engine's home on this site is the [bot section](/bot/), and every published run is listed under [backtests](/backtests/). Before trying a variant of your own, put a 0.3% stop into the [position size calculator](/tools/position-size-calculator/) and look at the size of the position it implies.

## FAQ

### What is a bullish order block?

The last down-closing candle before a strong move up, drawn as a zone from its low to its high. In our test it is the down bar immediately before three or more up bars that cover 2 ATR and close above the latest confirmed swing high. A bearish order block is the mirror image.

### What is the difference between an order block and a fair value gap?

An order block is a candle: the one the move started from. A fair value gap is a space: the band between the first and third candle of a fast move, which only the middle candle traded. They often appear in the same move. On our data the gap was revisited sooner (median 2 bars against 10) and more often (92.02% against 75.41%).

### What is the difference between an order block and a breaker block?

A breaker block is an order block that price has closed straight through, read in the opposite direction afterwards. On this chart 59.68% of the 801 order blocks were closed through within 24 hours of forming. The [breaker block article](/learn/breaker-block/) follows what happened to them.

### Do order blocks get mitigated?

<!-- unique:firsthand-data -->
If mitigated means price trades back into the zone, then mostly yes: 75.41% of our 801 blocks were touched within 96 bars, after a median wait of 10 bars. On the bar of the touch, 88.25% closed without breaking the far edge. Being touched is not the same as being profitable to trade.

### Which timeframe is best for order blocks?

We don't know. Only the 15-minute chart has been run, and a result on it says nothing about the 4-hour or daily chart, where a block is wider and costs are a smaller share of the stop. That run is still to be done.

### Does this prove order blocks don't work?

No. It shows that one mechanical version lost 42.33% and 18.71% after costs and did nothing measurable before them, on one coin in one year. Someone who picks blocks by context is running a different test, and it can't be checked without written rules. We haven't run the limit-order entry or the higher timeframes either.
