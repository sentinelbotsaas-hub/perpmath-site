---
title: "Liquidity sweep: exact rules and 19 backtests that all lost"
slug: "liquidity-sweep"
description: "A liquidity sweep written as a rule a program can check, then tested: 19 settings on BTC, ETH and SOL perpetuals all lost after costs, with no edge before them."
date: "2026-11-24"
lastmod: "2026-11-24"
lang: "en"
category: "Backtests"
tags: ["liquidity sweep", "stop hunt", "false breakout", "backtest", "BTCUSDT"]
keywords: ["liquidity sweep", "liquidity sweep trading", "liquidity sweep strategy", "liquidity sweep vs liquidity grab"]
tldr: "A liquidity sweep is a bar that trades through a prior high or low and closes back inside the old range. We coded it as: take out the highest high or lowest low of the previous 20 bars, close back inside, trade against it. On BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026 that lost 93.98% in-sample (1,639 trades) and 69.03% out-of-sample (688 trades). Eighteen other settings, including ETHUSDT, SOLUSDT and 1-hour bars, also lost after costs, and with costs set to zero none could be told apart from zero."
---

<!-- unique:firsthand-data -->
3,374 times in one year of BTCUSDT 15-minute candles, a bar took out the previous 20-bar high or low and closed back inside. That is a little over nine times a day. Trading against each of those pokes, with the stop behind the wick and a target at twice the risk, turned 10,000 USDT into 602.28 in the first 70% of the year. We then ran 18 more versions of the rule. Every one of them lost as well.

## What is a liquidity sweep?

A liquidity sweep is a move in which price trades through an obvious prior high or low and then fails to stay beyond it. "Liquidity" means the orders resting there. A stop-loss above a high is a buy order waiting to happen, and so is a breakout entry, so a push through the high finds plenty to trade against.

It is a term from [ICT and smart money trading](/learn/ict-trading/), like the [fair value gap](/learn/fair-value-gap/). In that telling the sweep is the trap before the real move: breakout buyers get filled at the top, shorts get stopped out, and price turns. What a chart can show is narrower. A level broke and the break failed. Who did it, and whether they meant to, isn't on the chart.

## Where do the usual definitions stop being checkable?

They agree on the story and leave out the three numbers a program needs: how many bars make the level, how far through it price has to go, and how long it has to come back. We read four explanations that rank for the term, all checked on 22 November 2026.

- The [LuxAlgo library entry](https://www.luxalgo.com/library/concept/liquidity-sweep/) describes a run through a level where resting orders cluster that then fails to hold, classically a wick through a prior swing high or low. It says outright that definitions are contested at the edges: some traders want the close back inside on the sweeping candle, others accept any rejection within a few bars.
- [TMGM's academy page](https://www.tmgm.com/en/academy/trading-academy/liquidity-sweep) (last updated 29 September 2026) asks for a level that existed beforehand, a breach, and a rejection or reclaim. Its FAQ says a wick alone is not enough. It names a "penetration threshold" and a "reclaim window" as settings and gives a value for neither.
- [LiteFinance](https://www.litefinance.org/blog/for-beginners/trading-strategies/liquidity-sweep/) (published 17 August 2026, modified 31 August 2026 in the page's metadata) says price briefly crosses a level where stops are concentrated and typically leaves a long wick. It calls the sweep a form of market manipulation.
- [FXOpen](https://fxopen.com/blog/en/liquidity-sweep-in-trading-basics-components-and-application/) (published 29 December 2025) describes large institutions intentionally driving price into those zones.

<!-- unique:cross-reference -->
Put side by side, they disagree on things that change which candles count. TMGM says a wick is not enough; LiteFinance treats the long wick as the tell. FXOpen and LiteFinance assert intent; LuxAlgo's FAQ says the phrase "stop hunt" implies an intent no chart can prove. Even the neighbouring term points both ways. For FXOpen a "liquidity grab" goes only slightly beyond the level while a sweep can stay beyond it for a while, TMGM reports that some traders use "grab" for the faster single-candle event, and LiteFinance says the grab is the broader concept. None of the four gives a lookback, a distance or a time limit.

<!-- unique:firsthand-data -->
Those omissions are not small. On our 35,040 bars, 6,402 bars (18.27%) traded beyond the prior 20-bar high or low. Only 3,374 of them, 52.7%, closed back inside. An "any poke counts" reading and a "close back inside" reading therefore differ by a factor of 1.9 on one chart. The lookback matters as much: that year holds 5,177 sweeps with a 10-bar lookback, 3,374 with 20, 1,909 with 50 and 1,228 with 100.

## A liquidity sweep rule a program can check

Here is the version we tested, exactly as the docstring of [liquidity_sweep.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/src/perpmath/strategies/liquidity_sweep.py) in the open-source engine states it (checked 22 November 2026):

```
prior high = highest high of the 20 bars before this bar
prior low  = lowest low of the 20 bars before this bar

high sweep:  high > prior high  and  close < prior high   -> go short
low sweep:   low  < prior low   and  close > prior low    -> go long
both on the same bar: no signal

stop:    short: the sweep bar's high + 0.1 x ATR(14)
         long:  the sweep bar's low  - 0.1 x ATR(14)
target:  2 x risk from the fill price
```

The rule decides when a bar closes and fills with a market order at the open of the bar after it. It holds one position at a time, so a signal that arrives while a trade is open is ignored. ATR here is the plain average of the 14 most recent true ranges.

So the three missing numbers are filled in like this: the level is the 20-bar extreme, any distance through it counts, and price has to be back inside by the close of that bar. According to the engine's README, the parameters in `configs/liquidity_sweep.json` were set once, ahead of any run on real data; it calls them one reasonable choice, not the definition.

<!-- unique:field-note -->
Two things this rule leaves out on purpose. It has no judgement about which highs are "obvious" and no confirmation step (displacement, a structure break on a lower timeframe) that stricter readings add. And it has one quirk we found while counting on 22 November 2026: 10 of the 3,374 signal bars traded through both the prior high and the prior low and closed beyond one of them. The rule reads those as a sweep of the other side. Ten bars don't move the result, but they are in it.

The idea is older than the vocabulary. LuxAlgo's entry on [Turtle Soup](https://www.luxalgo.com/library/concept/turtle-soup/) (checked 22 November 2026) credits Laurence Connors and Linda Raschke's 1995 book Street Smarts with a rule-defined fade of failed 20-day breakouts. We haven't read the book, so that attribution rests on LuxAlgo's page.

## One year of BTCUSDT: what the rule did

<!-- unique:firsthand-data -->
Both periods lost, and the losses are too large to put down to bad luck. We used the 35,040 BTCUSDT 15-minute candles that Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) returns for 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, with none missing. In-sample is the first 70%, and out-of-sample starts on 31 July 2026. The full report with the equity curve is on the [liquidity sweep backtest page](/backtests/liquidity-sweep-btcusdt/).

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown |
| --- | --- | --- | --- | --- | --- | --- |
| In-sample | 1,639 | 29.16% | -0.67 | -10.91 | -93.98% | 94.35% |
| Out-of-sample | 688 | 28.20% | -0.79 | -8.48 | -69.03% | 69.31% |

Of the 10,000 USDT each period started with, 602.28 was left in-sample and 3,097.46 out-of-sample.

Every fill was charged 0.055%, which Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026) lists as the VIP 0 taker rate for perpetuals, and moved 0.02% against the trade as slippage. We assumed that slippage figure and did not measure it. Position size is 100% of equity with no leverage. Funding is left out.

The t-statistic comes from a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm), which asks whether the average net return per trade differs from zero. When its absolute value is under 2 the answer is "can't tell"; these are -10.91 and -8.48. Trades are assumed to be independent, and that assumption flatters the test, so trust the sign more than the decimals.

<!-- unique:original-calc -->
A 2R target breaks even, before costs, at a win rate of 33.33%. The rule won 29.16% and 28.20%. Longs and shorts were equally bad: in-sample, 823 longs won 28.68% and 816 shorts won 29.66%; out-of-sample it was 27.15% of 361 longs and 29.36% of 327 shorts. In-sample 1,157 trades ended at the stop and 481 at the target, and the average trade lasted 1.91 hours.

<!-- unique:original-calc -->
What's left after a 93.98% loss needs a 1,560.4% gain to get back to the start. The [drawdown calculator](/tools/drawdown-calculator/) does that sum for any figure.

## How much of the loss is trading costs?

<!-- unique:firsthand-data -->
Most of it, and there is no profit underneath. We reran the same candles, parameters and split date with the fee and slippage set to zero (engine 0.2.0, 22 November 2026). The average trade went from -0.169% of notional to -0.017% in-sample and from -0.169% to -0.021% out-of-sample. Total return became -27.12% on 1,679 trades and -14.58% on 712, with t-statistics of -1.14 and -1.11. That is a rule that does nothing measurable, slightly on the wrong side.

<!-- unique:original-calc -->
The gap between the two runs is 0.152 and 0.148 points per trade, which is the assumed round trip of 0.15% (two fees, two fills of slippage). Costs bite this hard on a sweep fade for a structural reason: the stop sits just behind the wick, so the risk on each trade is very small. Entry and stop were a median 0.296% of price apart in-sample and 0.234% out-of-sample, which makes the round trip 0.51R and 0.64R. For 244 of the 1,639 in-sample trades, the trade's own cost was larger than the distance to its stop. The account paid 6,395.45 USDT in fees on its way down from 10,000.

## All 19 settings: the sensitivity table

<!-- unique:firsthand-data -->
One parameter set proves little, so we wrote down 18 more before running any of them: lookbacks of 10, 20, 50 and 100 bars crossed with stop buffers of 0.1, 0.5 and 1.0 ATR; targets of 1R and 3R; ETHUSDT and SOLUSDT on 15-minute bars; and all three coins on 1-hour bars (8,759 bars each). That gives 19 settings and 38 sample blocks. Nothing was added or dropped after seeing results. This is a sensitivity check, not a search for the best row, and no row here is a recommendation.

In the table, BTC, ETH and SOL are the USDT perpetuals, and "Settings" reads lookback / stop buffer in ATR / target. "In / out" is in-sample and out-of-sample. The last column is the t-statistic of the same row with fees and slippage at zero.

| Market | Settings | Return in / out | t-stat in / out | Trades in / out | Zero-cost t in / out |
| --- | --- | --- | --- | --- | --- |
| BTC 15m | 10 / 0.1 / 2R | -96.93% / -71.87% | -12.79 / -8.68 | 2,048 / 795 | -1.37 / -0.64 |
| BTC 15m | 10 / 0.5 / 2R | -89.01% / -61.00% | -7.08 / -5.90 | 1,170 / 458 | -0.87 / -1.60 |
| BTC 15m | 10 / 1.0 / 2R | -81.14% / -37.18% | -4.83 / -2.59 | 696 / 252 | -1.17 / -0.37 |
| BTC 15m | 20 / 0.1 / 2R | -93.98% / -69.03% | -10.91 / -8.48 | 1,639 / 688 | -1.14 / -1.11 |
| BTC 15m | 20 / 0.5 / 2R | -83.69% / -56.36% | -6.04 / -5.20 | 1,013 / 427 | -0.59 / -1.31 |
| BTC 15m | 20 / 1.0 / 2R | -74.32% / -36.17% | -4.02 / -2.61 | 638 / 253 | -0.58 / -0.50 |
| BTC 15m | 50 / 0.1 / 2R | -82.95% / -53.51% | -7.59 / -6.12 | 1,103 / 462 | -0.13 / -0.42 |
| BTC 15m | 50 / 0.5 / 2R | -70.96% / -45.77% | -4.45 / -4.17 | 762 / 323 | 0.07 / -0.81 |
| BTC 15m | 50 / 1.0 / 2R | -56.37% / -29.58% | -2.50 / -2.13 | 533 / 206 | 0.27 / -0.10 |
| BTC 15m | 100 / 0.1 / 2R | -72.04% / -41.56% | -6.13 / -4.69 | 765 / 311 | -0.36 / -0.25 |
| BTC 15m | 100 / 0.5 / 2R | -64.45% / -36.30% | -4.17 / -3.33 | 554 / 226 | -0.54 / -0.77 |
| BTC 15m | 100 / 1.0 / 2R | -50.89% / -27.04% | -2.37 / -2.05 | 412 / 159 | -0.03 / -0.53 |
| BTC 15m | 20 / 0.1 / 1R | -96.31% / -76.79% | -16.73 / -13.28 | 2,004 / 924 | -1.67 / -0.37 |
| BTC 15m | 20 / 0.1 / 3R | -85.57% / -61.28% | -6.48 / -6.10 | 1,273 / 523 | -0.16 / -1.41 |
| ETH 15m | 20 / 0.1 / 2R | -89.96% / -60.72% | -6.66 / -5.03 | 1,466 / 613 | 0.18 / 0.35 |
| SOL 15m | 20 / 0.1 / 2R | -94.45% / -63.19% | -8.10 / -4.06 | 1,724 / 664 | -1.08 / 0.14 |
| BTC 1h | 20 / 0.1 / 2R | -40.47% / -27.95% | -1.71 / -2.54 | 439 / 206 | 0.53 / -0.32 |
| ETH 1h | 20 / 0.1 / 2R | -47.99% / -13.18% | -1.61 / -0.84 | 393 / 176 | -0.02 / 1.10 |
| SOL 1h | 20 / 0.1 / 2R | -57.91% / -4.11% | -2.33 / -0.06 | 458 / 182 | -0.17 / 1.18 |

<!-- unique:original-calc -->
After costs, 0 of the 38 blocks is positive. Returns run from -96.93% to -4.11%. On 15-minute bars every block has a t-statistic below -2. The 1-hour rows are less clear cut: four of their six blocks lose with a t-statistic between -2 and 0, so on that timeframe the reading is "lost, and not provably different from zero".

<!-- unique:original-calc -->
My first reading of this table was wrong. Going down the BTC 15m rows, a longer lookback and a wider stop shrink the loss from -93.98% to -50.89%, which looks like the rule getting better. It isn't. The average trade loses between 0.15% and 0.23% of notional in every one of the 14 BTCUSDT 15-minute rows, in both samples. The rows near the bottom lose less only by trading less: 412 times against 1,639. Fewer trades means fewer payments of the same toll.

<!-- unique:firsthand-data -->
With costs at zero the picture is flat. All 19 settings have an absolute t-statistic under 2 in both samples; the range is -1.67 to 1.18. One setting, ETHUSDT on 15-minute bars, is positive in both periods at +0.43% and +4.87%, with t-statistics of 0.18 and 0.35. Out of 19 tries that is what noise looks like, and it sits on a market nobody can trade for free.

## Stop hunt, false breakout, liquidity sweep: how are they related?

They are three descriptions of one event with different amounts of story attached. A false breakout says a level broke and the break failed. A liquidity sweep adds a reason: stops were resting there. A stop hunt adds a culprit. LuxAlgo's [false breakout entry](https://www.luxalgo.com/library/concept/false-breakout/) (checked 22 November 2026) draws the line by emphasis, and notes that a false breakout can sit beyond the level for several bars, where a sweep is usually judged on a single wick.

Our rule sits at the plain end. It is a one-bar failed breakout of a 20-bar range, nothing more. That makes it possible to ask a question the vocabulary skips: when a bar takes the level, how often does it fail?

<!-- unique:firsthand-data -->
About half the time. Of the 6,402 bars that took the level, 3,374 were sweeps under our rule and 3,018 closed beyond it. The other 10 either swept both sides at once or closed exactly on the level. For the two main groups we then checked whether the bar's own extreme held, meaning no later bar traded through it, over the next 1, 4, 20 and 96 bars.

| Bar that took the level | Bars | Held 1 bar | Held 4 bars | Held 20 bars | Held 96 bars |
| --- | --- | --- | --- | --- | --- |
| Sweep (closed back inside) | 3,374 | 68.85% | 46.66% | 23.57% | 11.00% |
| Breakout (closed beyond) | 3,018 | 39.03% | 23.93% | 13.37% | 5.91% |

Each percentage is taken over the bars that have that many later bars of data, 3,365 sweeps for the 96-bar column.

<!-- unique:original-calc -->
The extreme of a sweep bar holds roughly twice as often as that of a breakout bar. Part of this is mechanical, since a bar that closed back inside has already moved away from its extreme. It is still a real regularity, and it still doesn't pay: 76.43% of sweep extremes were traded through within 20 bars, and the stop sits just behind them.

## Why does every liquidity sweep on a finished chart look right?

Because the chart was marked afterwards, by someone who could see which sweeps turned into the high or low of the move. That is a selection on the outcome. A trader at the close of the sweep bar has no such filter.

<!-- unique:original-calc -->
We can put a number on the filter. Take the 2,321 published trades that have at least 96 later bars of data, and split them by a fact nobody had at entry: was the sweep bar's extreme still untouched 24 hours later?

| Known only afterwards | Trades | Win rate | Avg R | Stopped out | Hit target |
| --- | --- | --- | --- | --- | --- |
| Extreme held for 24 hours | 275 | 94.91% | 1.46 | 12 | 263 |
| Extreme broken within 24 hours | 2,046 | 20.04% | -0.99 | 1,627 | 418 |

<!-- unique:original-calc -->
The first group is 11.85% of the trades and it is the whole screenshot gallery: sweeps that marked a turn, entered at the turn, paid 2R. Its 12 stops all came after the 24-hour window. The second group is everything else, and it is 88.15% of what the rule actually trades. A method judged on marked-up charts is judged on the first row. An account lives on both.

This is the look-ahead problem in its most ordinary form, and the reason the engine refuses to run a strategy whose signals change when later bars are removed. Our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) covers that check and the other ways a test fools its author.

## What this test can't tell you, and the commands to rerun it

The year was a falling one: BTCUSDT went from 91,423.0 to 64,124.5 (-29.86%), ETHUSDT fell 41.33% and SOLUSDT 46.03%. All three coins come from the same twelve months, so they are not three independent tests. The engine fills at the next open and leaves funding out, and when one bar reaches both the stop and the target it counts the stop.

Nothing here tests a discretionary sweep trader. Someone who only takes sweeps of a daily high, or waits for a structure break after the sweep, is running a different rule, and until it is written down nobody can test it, including them. What the numbers support is narrow: the plain mechanical version had no measurable edge before costs on these markets and a heavy loss after them.

To reproduce the published result:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest liquidity_sweep --symbol BTCUSDT --interval 15m --config configs/liquidity_sweep.json --out results/liquidity-sweep-btcusdt.json
```

For the other rows, copy the config, change `lookback`, `stop_buffer_atr` or `r_multiple`, and download ETHUSDT, SOLUSDT or the `1h` interval the same way. Our rerun of the published setting on engine 0.2.0 gave the published metrics exactly. There is more about the engine in the [bot section](/bot/). Before you try a variant of your own, put a 0.3% stop into the [position size calculator](/tools/position-size-calculator/) and look at the size it gives back.

## FAQ

### What is a liquidity sweep in simple terms?

Price pokes through a recent high or low, triggers the orders waiting there, and comes back. In our test it is a bar whose high exceeds the highest high of the previous 20 bars and whose close is back below that level, or the mirror image at the lows.

### Is a liquidity sweep the same as a stop hunt?

On the chart, yes. The difference is the claim attached. "Stop hunt" says someone did it deliberately, which price data can't show. "Liquidity sweep" describes the same breach and failure without naming a culprit.

### What is the difference between a liquidity sweep and a liquidity grab?

There is no agreed difference. Of the sources we read on 22 November 2026, one calls the grab the smaller and quicker event, one calls it the broader concept, and one treats the two words as names for the same thing.

### How often does a liquidity sweep lead to a reversal?

<!-- unique:firsthand-data -->
It depends on how long you wait. In our BTCUSDT data the sweep bar's extreme was still untouched after 4 bars in 46.66% of cases, after 20 bars in 23.57% and after 96 bars in 11.00%. Under the published rule 481 of the 1,639 in-sample trades, 29.35%, reached the 2R target before the stop.

### Which lookback works best?

<!-- unique:firsthand-data -->
None of the four we ran made money. Lookbacks of 10, 20, 50 and 100 bars all lost after costs in both samples, and at zero cost none had a t-statistic outside -2 to 2. The longer ones lost less in total only by trading less often.

### Does this prove liquidity sweeps don't work?

No. One mechanical version lost in 38 of 38 sample blocks once costs were charged, and with costs removed it showed nothing measurable, all on three coins in one falling year. A sweep used as one input among several, with judgement, is a different claim, and it stays untestable until the judgement is written down as rules. Which highs count as obvious, and what has to happen after the sweep before you enter?
