---
title: "Max drawdown: how to calculate it, and why one equity curve gives several answers"
slug: "max-drawdown"
description: "The max drawdown formula with a worked example, then real backtests where daily sampling shows 27.02% and bar-by-bar 31.18%, and the gain needed to recover."
date: "2026-11-24"
lastmod: "2026-11-24"
lang: "en"
category: "Backtests"
tags: ["max drawdown", "drawdown", "backtest", "risk", "Calmar ratio"]
keywords: ["max drawdown", "maximum drawdown", "max drawdown formula", "drawdown recovery", "calmar ratio"]
tldr: "Max drawdown is the largest fall from an earlier equity high to a later low, as a percentage of that high. The answer depends on how often equity is sampled: for one moving-average backtest we measured 27.02% on daily points, 28.83% on closed trades and 31.18% on 15-minute bar closes. A grid backtest showed 0.0033% on realised profit and 12.52% marked to market. Getting back from a drawdown d takes a gain of d ÷ (1 − d), so 31.18% needs 45.30%."
---

<!-- unique:firsthand-data -->
We took one backtest, one equity history, and computed its max drawdown three ways. The daily equity points said 27.02%. The list of closed trades said 28.83%. Every 15-minute bar close said 31.18%. Nothing was changed between the three except how often we looked.

That gap is the reason two tools can disagree about the same strategy and both be right. This page gives the definition and a hand-worked example, then measures the gap on seven published result files, and ends with what a drawdown costs to climb out of.

## What is max drawdown?

Max drawdown is the largest percentage fall from a previous high of the equity curve to a later low. It answers one question: at the worst moment, how far below its own best was this account?

```
drawdown at time t = (highest equity up to t - equity at t) / highest equity up to t
max drawdown       = the largest drawdown at any t
```

Wikipedia's [drawdown article](https://en.wikipedia.org/wiki/Drawdown_%28economics%29) (checked 22 November 2026) gives the same thing in symbols: the drawdown is the decline from a historical peak, and the maximum drawdown is its maximum over the history. Two details are left to whoever writes the code. One is what counts as the first peak; in the perpmath engine the starting capital does, per the docstring of [`max_drawdown_pct`](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.1/src/perpmath/metrics.py#L32-L42). The other is which moments "t" runs over, and that is where the trouble starts.

## How do you calculate max drawdown by hand?

Walk the equity curve once, keep the highest value seen so far, and at each point divide the distance below that high by the high. The largest result is the max drawdown. Here is an invented six-point curve, small enough to do on paper:

| Point | Equity | Highest so far | Drawdown |
| --- | --- | --- | --- |
| 1 | 10,000 | 10,000 | 0% |
| 2 | 12,000 | 12,000 | 0% |
| 3 | 9,000 | 12,000 | 25.00% |
| 4 | 11,000 | 12,000 | 8.33% |
| 5 | 8,400 | 12,000 | 30.00% |
| 6 | 13,000 | 13,000 | 0% |

The max drawdown is 30.00%: from 12,000 down to 8,400. Two things trip people up. The bounce to 11,000 at point 4 does not start a new measurement, since 11,000 never beat the old high, so point 5 is still measured from 12,000. And the new high at point 6 does not erase anything. The account recovered, and the 30% still happened.

Now delete point 5 from your records, as if nobody had looked that day. The worst you would see is 25%. That is the whole sampling problem in one row.

## Why does one equity curve give different max drawdowns?

The equity curve is continuous and every calculation samples it. A coarser sample can skip the true high, the true low, or both, and then it reports a shallower drawdown. A sample of realised profit alone leaves out open positions altogether.

<!-- unique:firsthand-data -->
We measured this on the six strategy results shipped with version 0.2.1 of the open-source engine: BTCUSDT 15-minute bars from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 22 November 2026), 18 November 2025 to 18 November 2026, with the first 70% in-sample. The [result files](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.1/results) hold every trade and one equity point per UTC day. We rebuilt the bar-by-bar equity from the trade list and the candle file on 21 November 2026, and the script stops unless that rebuild matches the engine's published figure to within 0.01 points. It matched on all twelve rows.

| Strategy, sample | Daily points | Bar closes | Closed trades | Inside the bar |
| --- | --- | --- | --- | --- |
| MA cross, in | 62.97% | 63.33% | 62.81% | 63.33% |
| MA cross, out | 27.02% | 31.18% | 28.83% | 31.25% |
| FVG, in | 66.97% | 66.97% | 66.94% | 66.97% |
| FVG, out | 43.04% | 43.19% | 43.04% | 43.28% |
| Liquidity sweep, in | 94.21% | 94.35% | 94.34% | 94.37% |
| Liquidity sweep, out | 69.03% | 69.31% | 69.31% | 69.36% |
| Order block, in | 46.40% | 46.92% | 46.70% | 47.04% |
| Order block, out | 24.17% | 24.94% | 24.49% | 25.02% |
| Break of structure, in | 52.95% | 53.72% | 52.90% | 53.84% |
| Break of structure, out | 22.61% | 23.57% | 22.60% | 23.65% |
| Breaker block, in | 21.18% | 21.23% | 21.18% | 21.33% |
| Breaker block, out | 16.62% | 16.62% | 16.62% | 16.62% |

"Daily points" marks open positions to market once a day at the last bar close. "Bar closes" does the same every 15 minutes and is the number the engine publishes; its [output format](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.1/docs/output-format.md) says so in the `max_drawdown_pct` row. "Closed trades" is equity after each trade is closed, with nothing counted while a position is open. The last column is explained in the next section. One row, break of structure out-of-sample, has 42 trades, under the engine's 100-trade minimum; its drawdown is still a fact about that curve.

<!-- unique:original-calc -->
The moving-average cross out-of-sample is the row to study. By bar closes the equity peaked at 10,796.25 USDT at 09:00 UTC on 21 August 2026. By the end of that day it was 10,388.56, and that lower figure is the highest point the daily series ever recorded. The bottom was 7,430.16 at 12:15 UTC on 4 November; the lowest point in the daily series was 7,581.07, recorded at 00:00 UTC that day. The daily sample missed the top by 407.69 USDT and the bottom by 150.91, and those two misses are the 4.16 points between 27.02% and 31.18%.

<!-- unique:original-calc -->
On the other eleven rows the gap between daily points and bar closes runs from 0.00 to 0.96 points. These strategies lose steadily, so their peak is near the start and their low near the end, and almost any sampling finds both. The gap opens when a curve has a sharp top or bottom that a day can hide, which is what a strategy with real swings looks like. I would not read "under one point" as the typical error. It is the error for curves this monotonous.

One rule holds whatever the curve does. The daily points are a subset of the bar closes, so the daily figure can never be the larger of the two. Closed-trade equity is a different series, not a subset: it came out above the daily figure on five rows, below it on four and level with it on three. The site's own [MA cross backtest page](/backtests/ma-cross-btcusdt/) charts the daily points and prints the engine's bar-close figure next to them, which is how the two numbers ended up on one page.

## How much deeper is the intrabar drawdown?

<!-- unique:firsthand-data -->
On these twelve runs, between 0.00 and 0.12 percentage points deeper than the bar-close figure. We marked each open position at the worst price its bar reached, the low for a long and the high for a short, and kept the peaks at bar closes. The biggest change was break of structure in-sample, from 53.72% to 53.84%.

<!-- unique:original-calc -->
I expected more. Then the reason turned out to be sitting in the rules. Every one of these trades has a stop, so the worst price inside a bar is capped; the positions are 100% of equity with no leverage; and a 15-minute BTC bar is small next to a 30% to 90% drawdown. An outer bound, where the peak is also taken at the best price inside a bar, adds at most 0.31 points (MA cross out-of-sample, 31.49%).

Two limits on that measurement. Candles don't record whether the high or the low came first, so the outer bound assumes the worst order and is not something that happened. And the mark carries no exit fee or slippage. We have not measured a leveraged strategy or hourly bars, where the same arithmetic should produce a larger gap, so treat "about a tenth of a point" as a fact about these files only.

## The equity curve that hides its drawdown: realised profit

A curve built from realised profit alone can show almost no drawdown while the account is deep under water. Grid bots are the clearest case, since they close winners and keep losers open.

<!-- unique:firsthand-data -->
The engine's shipped grid result (neutral, 50 cells, no leverage) completed 669 round trips in-sample, and not one of them closed at a loss. Add up realised profit minus fees fill by fill and the worst dip before the final close is 0.36 USDT on about 11,000, a max drawdown of 0.0033%. The same run marked to market at every bar close had a max drawdown of 12.52%, and 11.75% on daily points. The difference was inventory: 0.084 BTC bought on the way down, closed at the end of the sample for a loss of 953.84 USDT.

| Grid sample | Realised only | Daily points | Bar closes (published) | Range across intrabar paths |
| --- | --- | --- | --- | --- |
| In-sample | 0.0033% | 11.75% | 12.52% | 11.80% to 12.52% |
| Out-of-sample | 0.0028% | 6.79% | 7.31% | 6.90% to 7.31% |

An intrabar figure for the grid can't be computed from the result file. It lists fills, not the position held at each bar, and funding is not itemised per fill. What the file does contain is the same run under four assumptions about the order of high and low inside each bar, and that is the last column: the assumption alone moves the max drawdown by 0.72 points in-sample. The published figure is the pessimistic path. How the grid itself works is in [grid trading bot](/learn/grid-trading-bot/).

If a dashboard shows you a smooth rising line and a tiny drawdown, find out whether it counts open positions before you believe either.

## How much do you need to gain to recover from a drawdown?

A loss and the gain that undoes it are not the same percentage, since the gain is earned on a smaller balance:

```
gain needed to recover = d / (1 - d)        d = drawdown as a fraction
```

| Drawdown | Left of 10,000 | Gain needed |
| --- | --- | --- |
| 10% | 9,000 | 11.11% |
| 20% | 8,000 | 25.00% |
| 30% | 7,000 | 42.86% |
| 40% | 6,000 | 66.67% |
| 50% | 5,000 | 100.00% |
| 60% | 4,000 | 150.00% |
| 70% | 3,000 | 233.33% |
| 80% | 2,000 | 400.00% |
| 90% | 1,000 | 900.00% |

<!-- unique:original-calc -->
Put the sampling gap through that formula and it gets wider. The MA cross drawdown of 27.02% on daily points needs a 37.03% gain; the 31.18% from bar closes needs 45.30%. A 4.16-point difference in the drawdown became an 8.27-point difference in the climb back. At the far end, the liquidity sweep's 94.35% needs 1,671.39%. Any other value can be tried on the [drawdown calculator](/tools/drawdown-calculator/), which also turns a losing streak into a drawdown.

## How long does a drawdown last?

Depth is half of it. The other half is duration: the time between one equity high and the next, often called time under water. Depth says how much it hurt and duration says for how long you had to keep going without a new high.

<!-- unique:firsthand-data -->
For the losing strategies the answer is "nearly always". The MA cross in-sample made its last equity high at 16:45 UTC on 5 December 2025 and spent the remaining 237.3 days of a 254.5-day sample below it. FVG in-sample was under water for 254 of those days.

<!-- unique:firsthand-data -->
The grid is the more useful lesson, since it made money. Out-of-sample it returned +4.37% and ended on a new high, and yet 78.57% of its daily equity points sat below an earlier high. Its longest spell ran 73 days, from the daily point of 19 August to that of 31 October 2026, in a sample of 110.5 days. In-sample, the last high was the daily point of 11 May 2026 and the remaining 81 days never got back to it. A strategy can finish up and still spend most of its life in drawdown.

## Why does max drawdown get deeper with a longer sample?

Max drawdown is a maximum, and a maximum over more data can stay the same or grow. It never shrinks. So the figure from any backtest is a floor on what the strategy can do to you, measured on the history you happened to test.

<!-- unique:original-calc -->
The same MA cross in-sample curve, cut short at different lengths, by bar closes:

| First days of the sample | 7 | 30 | 90 | 180 | 254.5 (all) |
| --- | --- | --- | --- | --- | --- |
| Max drawdown | 8.97% | 13.97% | 35.93% | 50.05% | 63.33% |

<!-- unique:original-calc -->
Cut the other way, into eight separate 30-day windows that each start from their own opening balance, the worst window showed 23.31% and the median 14.91%. Someone who tested this strategy for any one of those eight months would have seen 23.31% at most. All of them together showed 63.33%.

<!-- unique:original-calc -->
This also changes how the in-sample and out-of-sample columns should be read. The out-of-sample drawdowns in the first table are all much shallower (31.18% against 63.33% for the MA cross), and it is tempting to call that an improvement. Compare equal lengths instead. Over their first 90 days the two samples show 35.93% and 27.61% for the MA cross, 33.47% and 37.37% for FVG, 64.24% and 60.88% for the liquidity sweep. Across all six strategies the two 90-day figures sit 0.92 to 8.32 points apart, where the full-sample figures sit 4.61 to 32.16 apart. Most of the gap between the columns is 110.5 days against 254.5.

A caution about how far this goes. All six strategies lose money, and a losing curve is the case where drawdown grows fastest. Magdon-Ismail and Atiya's paper [An Analysis of the Maximum Drawdown Risk Measure](https://www.cs.rpi.edu/~magdon/ps/journal/drawdown_RISK04.pdf) (checked 22 November 2026) derives the expected max drawdown of a Brownian motion with drift, and finds it grows in proportion to time for a losing process, with the square root of time at break-even, and with the logarithm of time for a profitable one. Slower, then, for a strategy that works, and still growing.

## Calmar ratio and MAR ratio

Both ratios divide a return by a max drawdown, and they differ in the window they use. According to Wikipedia's [Calmar ratio article](https://en.wikipedia.org/wiki/Calmar_ratio) (checked 22 November 2026), the Calmar ratio was created by Terry W. Young and published in the trade journal Futures in 1991; it is the average annual rate of return over the last 36 months divided by the max drawdown over those 36 months. The MAR ratio, popularised by the newsletter Managed Account Reports, uses the compound annual return and the max drawdown since inception. We have not read the 1991 article itself.

<!-- unique:original-calc -->
The window is not a technicality. The grid result gives an annualised return of 4.57% and a 12.52% drawdown in-sample, a ratio of 0.37. Out-of-sample the same settings give 15.18% and 7.31%, a ratio of 2.08. Neither is a Calmar ratio; the samples are 254.5 and 110.5 days, far short of 36 months. They show a return-over-drawdown figure moving by a factor of more than five between two neighbouring periods of one strategy. The paper above notes that the common practice is to compare Calmar ratios over intervals of equal length, typically three years.

## Reading a max drawdown in someone else's backtest

Four questions get you most of the way, and a report that can't answer them hasn't told you its drawdown yet.

- How often was equity sampled? Trade by trade, daily, or every bar. Coarser is shallower.
- Were open positions marked to market? If not, the figure can be close to zero for a strategy that holds losers.
- How long was the sample? Compare drawdowns over equal lengths, and expect a longer one to be deeper.
- How long did it take to recover, if it did?

Then size for more than the number. The [position size calculator](/tools/position-size-calculator/) works from the loss you can accept on one trade, and the calculator above shows what a streak of those losses adds up to. The engine behind these result files is on the [bot page](/bot/), its results are under [backtests](/backtests/), and [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) covers the steps before the drawdown column. To see these measurements on a strategy you write yourself, start from [building a trading bot in Python](/learn/build-a-trading-bot-python/).

## FAQ

### What is a good max drawdown?

There is no threshold that makes one good. The recovery table is the practical guide: 20% needs 25% to get back, 50% needs 100%. A figure only means something next to the sample length, the sampling frequency and the return it came with.

### Is max drawdown the same as the total loss?

<!-- unique:firsthand-data -->
No. It is measured from a high, not from the start. The MA cross out-of-sample ended down 18.46% and had a max drawdown of 31.18%, since it first rose to 10,796.25 and fell from there.

### Does max drawdown include open positions?

It depends on the tool, and you have to check. The perpmath engine marks open positions to market at every bar close. A figure built from closed trades does not include them until they close.

### Why does my exchange or bot show a smaller drawdown than my own calculation?

Usually it samples less often or counts realised profit only. In our grid example those two choices gave 0.0033% and 12.52% for one run.

### Can max drawdown go down if I test more data?

No. Adding history can leave it unchanged or raise it. In our files it rose from 13.97% after 30 days to 63.33% after 254.5.
