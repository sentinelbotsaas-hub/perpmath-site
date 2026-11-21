---
title: "Breaker block: which candle it is, and a retest backtest on 3 coins"
slug: "breaker-block"
description: "A breaker block is a failed order block traded the other way. Of 801 order blocks on BTCUSDT, 59.68% failed, and the retest entry lost in 5 of 6 blocks on 3 coins."
date: "2026-11-22"
lastmod: "2026-11-22"
lang: "en"
category: "Backtests"
tags: ["breaker block", "order block", "ICT trading", "backtest", "BTCUSDT"]
keywords: ["breaker block", "ict breaker block", "breaker block trading", "breaker block vs order block", "breaker block vs mitigation block"]
tldr: "A breaker block is an order block that price has closed straight through; the zone is then traded in the opposite direction when price comes back to it. Of 801 order blocks on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026, 478 (59.68%) were closed through within 24 hours, and 92.47% of those were retested. Entering on the retest lost 18.44% in-sample (243 trades) and 15.07% out-of-sample (120 trades) after costs. On ETHUSDT and SOLUSDT the same rule lost in three of four blocks; the fourth, +4.81%, has a t-statistic of 0.34."
---

"A breaker block is a failed order block that has flipped sides." That is the opening line of [TMGM's guide](https://www.tmgm.com/en/academy/trading-academy/breaker-block) (last updated 16 November 2026, checked 22 November 2026), and it is about as far as the sources agree. Which candle the breaker is, and whether a stop run has to come first, depends on who you read. We picked one reading, followed all 801 order blocks in a year of BTCUSDT to see how many failed, and traded the retests. It lost 18.44% in the first 70% of the year and 15.07% in the rest.

## What is a breaker block, and which candle is it?

A breaker block is a zone that was an [order block](/learn/order-block/) until price closed through it. A bullish order block is supposed to act as support. Once price has closed below it, the same zone is expected to act as resistance, and the trade is a short when price comes back up to it. The mirror case gives a long. The same flip applied to a [fair value gap](/learn/fair-value-gap/) is called an inverse fair value gap, which we have not tested. The idea belongs to [ICT trading and smart money concepts](/learn/ict-trading/); TMGM's page says it comes from ICT, and we could not find a dated primary source for when the term was first used.

<!-- unique:cross-reference -->
Ask which candle to draw the box around and the three pages we read give three answers. Take the bullish breaker, the one traded long. TMGM builds it from a failed bearish order block, which is the last up-closing candle before the drop. The [LuxAlgo library entry](https://www.luxalgo.com/library/concept/breaker-block/) (checked 22 November 2026) says it is the down-closing candle or series that drove the failed move lower, and its FAQ confirms that a bullish breaker is built from down-closing candles. A [post on the MQL5 blogs](https://www.mql5.com/en/blogs/post/773691) by Diego Arribas Lopez, dated 18 August 2026, marks the bearish candle range that formed the swing high the drop started from; that post also promotes the author's paid indicators. All three boxes hang off the same swing high, and they are not the same box. Their edges differ, so the entry and the stop differ too.

<!-- unique:cross-reference -->
The second disagreement is about what has to happen first. LuxAlgo describes a strict reading, in which the failing move must first trade beyond a prior high or low, and a looser one that treats any violated order block as a breaker. TMGM says a liquidity sweep must come first in the ICT version and calls the version without one a mitigation block. The MQL5 post lists three conditions (a real sweep, displacement through structure, a first retest) and argues that most of what gets labelled a breaker fails the first. Not one of the three pages gives a number for the sweep, the displacement or the wait.

Here is the reading we tested, from the docstring of [breaker_block.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/strategies/breaker_block.py) in the open-source engine (checked 22 November 2026). It is written for a bullish order block that fails; the other case is the mirror image.

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

So the engine sides with TMGM on the candle: the breaker is the order-block candle itself, whole, unchanged by the failure. "Failed" means one close beyond the far edge. A wick does not count and the breaking bar needs no minimum size. No separate sweep test is applied, which makes this the looser reading on paper. One waiting time, 96 bars, is used for both clocks. Each breaker is used once and the rule holds one position at a time.

## Six in ten order blocks became breakers

<!-- unique:firsthand-data -->
Of the 801 order blocks the rule finds on our 35,040 BTCUSDT 15-minute bars, 478 were closed through within 96 bars of forming. That is 59.68%. Among those, the median time from the block forming to the close that broke it was 21 bars, a little over five hours.

| What happened | Count | Share |
| --- | --- | --- |
| Order blocks found | 801 | |
| Closed through within 96 bars (now breakers) | 478 | 59.68% of blocks |
| Breaker retested within 96 bars | 442 | 92.47% of breakers |
| Retest bar gave an entry signal | 389 | 81.38% of breakers |
| Retest bar closed back through the zone (dropped) | 53 | 11.09% of breakers |
| Never retested (expired) | 36 | 7.53% of breakers |

<!-- unique:original-calc -->
The word "retest" suggests price leaving and coming back. Mostly it doesn't leave. The median wait between the breaking close and the retest was 1 bar, and 255 of the 442 retests (57.69%) came on the very next candle: price closes just past the zone and the next bar's wick reaches back to its edge. The 389 signals fell on 384 bars and became 363 trades, since 21 arrived while a position was open.

<!-- unique:operator-view -->
Here is the number I would show anyone who trades both setups. The order block rule got an entry signal on 533 of these blocks, meaning price came back and the bar closed on the right side. Of those 533, 407 (76.36%) were then closed through anyway, still inside 24 hours of forming, and 339 (63.60%) went on to give a breaker signal in the opposite direction. A chart marked afterwards can label the first touch "order block respected" and the second "breaker respected". It is one zone, a few hours apart, and 63.60% of the zones that gave the first signal qualify for both labels.

<!-- unique:firsthand-data -->
We also tried to apply the strict reading. For each breaker we checked whether the move away from the block had traded beyond the highest high or lowest low of the 20 bars before the block candle, the same level our [liquidity sweep](/learn/liquidity-sweep/) test uses. We built that check expecting it to split the sample. It barely does: 455 of 478 breakers (95.19%) pass. The order block definition already demands a close beyond the latest swing point, so nearly every block that fails has run a prior extreme first. Dropping the 23 that don't removes 13 of the 243 in-sample trades and 7 of the 120 out-of-sample ones, and the average trade in what remains is -0.07% and -0.12% of notional, against -0.08% and -0.13% for all of them. That split was chosen after the published run, and it changes nothing.

## Breaker block backtest: BTC, then ETH and SOL

<!-- unique:firsthand-data -->
On BTCUSDT the retest entry lost in both periods. The candles are from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 18 November 2025 to 18 November 2026, with the first 70% in-sample and the rest, from 31 July 2026, out-of-sample. The full report is the [breaker block backtest page](/backtests/breaker-block-btcusdt/).

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 243 | 33.74% | -0.56 | -1.56 | -18.44% | 21.23% | Cannot be told apart from zero |
| Out-of-sample | 120 | 30.83% | -0.79 | -2.88 | -15.07% | 16.62% | Clear loss |

Each fill pays 0.055%, the VIP 0 taker rate in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (checked 22 November 2026), plus an assumed 0.02% of slippage. The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of per-trade net returns; under 2 in absolute value it can't be told apart from zero.

<!-- unique:original-calc -->
The stops are as tight as in the order block test. The median distance from fill to stop was 0.310% of price in-sample and 0.259% out-of-sample, so the 0.15% round trip is 0.48R and 0.58R. With fees and slippage set to zero the same rule returned +16.45% and +0.78%, with t-statistics of 1.30 and 0.17. In-sample, 123 longs won 38.21% of the time and 120 shorts 29.17%; out-of-sample it was 27.69% of 65 longs and 34.55% of 55 shorts. A 2R target needs 33.33% before costs, which the [risk-reward calculator](/tools/risk-reward-calculator/) will confirm.

<!-- unique:firsthand-data -->
A loss that can't be told apart from zero in-sample invites the thought that breakers nearly work. So we ran the same rule, and the order block rule on the same zones, on ETHUSDT and SOLUSDT. The six runs were listed before the first one was made, on 21 November 2026 (UTC). "In / out" is in-sample and out-of-sample, an asterisk marks a block under 100 trades, and the last column is the t-statistic with costs at zero.

| Market | Rule | Trades in / out | Return in / out | t-stat in / out | Zero-cost t in / out |
| --- | --- | --- | --- | --- | --- |
| BTC | Breaker retest | 243 / 120 | -18.44% / -15.07% | -1.56 / -2.88 | 1.30 / 0.17 |
| BTC | Order block return | 325 / 141 | -42.33% / -18.71% | -3.77 / -2.49 | -0.38 / 0.11 |
| ETH | Breaker retest | 214 / 96* | -29.80% / -13.64% | -2.10 / -2.54 | -0.13 / -0.22 |
| ETH | Order block return | 298 / 146 | -37.71% / -0.63% | -2.57 / 0.00 | -0.13 / 1.83 |
| SOL | Breaker retest | 231 / 110 | +4.81% / -12.95% | 0.34 / -1.75 | 2.07 / 0.48 |
| SOL | Order block return | 308 / 143 | -41.27% / -2.22% | -2.58 / -0.06 | -0.42 / 1.34 |

<!-- unique:original-calc -->
Eleven of the twelve blocks lost after costs. The exception is the breaker rule on SOLUSDT in-sample: +4.81% over 231 trades with a t-statistic of 0.34, followed by -12.95% out-of-sample. That is not a finding. Its zero-cost version has the only t-statistic above 2 anywhere in the table (2.07), and the out-of-sample block right next to it is 0.48.

<!-- unique:original-calc -->
In-sample, the breaker rule lost less than the order block rule on all three coins. Out-of-sample the order block rule lost less on ETHUSDT and SOLUSDT, by more than ten points each, and on BTCUSDT the two were within four points. If "trade the failure, not the block" were a real improvement it should survive the split, and it doesn't. The three coins also share one falling year (BTCUSDT down 29.86%, ETHUSDT 41.33%, SOLUSDT 46.03%), so they are not three independent tests.

## Limits, and how to rerun it

The engine has no resting limit orders. Entry is a market order at the open after the retest bar, at the taker fee, and the fill can be anywhere relative to the zone. A bar that touches both stop and target counts as a stop, and funding is ignored; with an average holding time of 9.28 bars in-sample, funding is a small omission here.

We tested one choice of candle out of the three above, with no confirmation step and no filter. The versions built on the first candles of the failed move are untested, and so is any [break of structure](/learn/break-of-structure/) or displacement condition measured by hand.

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest breaker_block --symbol BTCUSDT --interval 15m --config configs/breaker_block.json --out results/breaker-block-btcusdt.json
```

On Windows the activate line is `.venv\Scripts\activate`; no account or API key is needed. For the other rows, download ETHUSDT or SOLUSDT with the same dates and change `--symbol`, or run `order_block` with `configs/order_block.json`. Our reruns of both published BTCUSDT settings gave the published metrics exactly. More about the engine is in the [bot section](/bot/), and the other runs are under [backtests](/backtests/).

## FAQ

### What is the difference between a breaker block and an order block?

Time and direction. An order block is the zone while it holds, traded with the move that left it. A breaker block is that zone after a close through it, traded the other way on the retest. In our data 59.68% of order blocks became breakers within 24 hours.

### What is the difference between a breaker block and a mitigation block?

In the sources we read, the stop run. A breaker's failing move first trades beyond a prior high or low; a mitigation block flips without that. Our rule does not separate them, and on our chart 95.19% of failed blocks had run the prior 20-bar extreme anyway.

### Is a bullish breaker block made of bullish or bearish candles?

It depends on the source. TMGM uses the last up-closing candle before the drop, LuxAlgo and the MQL5 post use down-closing candles at the same swing high. We tested the first.

### How often is a breaker block retested?

<!-- unique:firsthand-data -->
On BTCUSDT 15-minute bars, 442 of 478 breakers (92.47%) were retested within 96 bars, 57.69% of them on the very next candle. On the retest bar, 53 closed back through the zone and were dropped.

### Do breaker blocks work?

Not in this test. The mechanical retest entry lost after costs on BTCUSDT in both periods, and with costs at zero it could not be told apart from zero. Here is the count across three coins and both rules built on these zones. 11 of the 12 blocks we ran lost money after costs.
