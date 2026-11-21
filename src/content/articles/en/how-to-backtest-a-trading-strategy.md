---
title: "How to backtest a trading strategy: one rule, five ways the result lies"
slug: "how-to-backtest-a-trading-strategy"
description: "How to backtest a trading strategy with an open-source engine: one moving-average rule on a year of BTCUSDT, and the five checks that moved its result."
date: "2026-11-21"
lastmod: "2026-11-21"
lang: "en"
category: "Backtests"
tags: ["backtesting", "crypto backtesting", "look-ahead bias", "trading costs", "BTCUSDT"]
keywords: ["how to backtest a trading strategy", "crypto backtesting", "backtest trading strategy", "look-ahead bias", "out-of-sample testing"]
tldr: "To backtest a trading strategy, write the rule so a program can run it, fill orders at the next bar's open, charge fees and slippage on every fill, and judge it on a period you did not tune on. We ran a 20/50 moving-average cross on a year of BTCUSDT 15-minute bars: it lost 62.35% in-sample and 18.46% out-of-sample. Setting costs to zero turned the second figure into +20.99%, and a deliberate look-ahead bug turned the first into +4,470.18%. Neither of those is a result."
---

<!-- unique:firsthand-data -->
I ran one moving-average rule on one year of BTCUSDT candles in November 2026 and came away with four results: -62.35%, -11.15%, +20.99% and +4,470.18%. Same rule, same candles. Only the first is the honest in-sample figure. This page shows how to produce that one, and where the other three came from.

## How do you backtest a trading strategy?

You write the rule precisely enough for a program to follow, replay it over historical candles with realistic fills and costs, and judge it on a stretch of data you did not use to choose anything. The mechanics take ten minutes. Most of the work is stopping the result from flattering you.

<!-- unique:firsthand-data -->
We ran the whole thing with the open-source [perpmath engine](https://github.com/sentinelbotsaas-hub/perpmath/tree/d06236ec9fd04a5a17854aaed5477bb048ff98ad) (version 0.2.1, commit `d06236e`, checked 21 November 2026) and then changed one thing at a time. Five changes moved the number:

| Where it lies | What we changed | Honest run | After the change |
| --- | --- | --- | --- |
| Costs | fee and slippage set to 0 | -18.46% out-of-sample | +20.99% |
| Sample split | best of 13 parameter pairs | -18.46% out-of-sample | +4.88%, t = 0.32 |
| Look-ahead | fast average sees 10 future bars | -62.35% in-sample | +4,470.18% |
| Order inside a bar | target first on tied bars (fvg) | -66.94% in-sample | -64.10% |
| Sample size | read t before the return | -18.46% over 263 trades | t = -0.68 |

All six example strategies the engine ships lose money after costs, in both periods, and this is one of them. The per-trade reports are under [backtests](/backtests/).

## Step 1: write a rule a program can run

A rule is ready to backtest when two people coding it separately would get the same trades. "Buy when the trend turns up" fails that test. The engine's [ma_cross.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/strategies/ma_cross.py) (checked 21 November 2026) passes it:

- Fast line: the simple average of the last 20 closes. Slow line: the last 50.
- When the fast line crosses above the slow line on a bar's close, close any short and go long. A cross below does the reverse.
- Stop: 2 x ATR(14) away from the signal bar's close. There is no profit target.
- After a stop the strategy waits, flat, for the next cross.

The parameters sit in `configs/ma_cross.json`. The README says they were fixed before the first run on real data, and the engine has no optimizer.

The timing rule matters more than the indicator. A decision is made on a bar's close, and the order fills at the next bar's open, never earlier.

<!-- unique:firsthand-data -->
The first trade in our output shows it. The 01:30 UTC bar on 19 November 2025 closed at 92,340 with the fast line newly under the slow one. The short filled at the open of the 01:45 bar, also 92,340, and was booked at 92,321.532 once 0.02% slippage came off. It closed at the next cross, 53 bars later, for +57.57 USDT net of 10.96 USDT in fees.

## Step 2: get the data and run it

Six commands take you from nothing to a result file. No exchange account or API key is involved: the candles come from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 21 November 2026). How this site relates to Bybit is on the [disclosure page](/disclosure/).

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
.venv/Scripts/python -m pip install -e .
.venv/Scripts/perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
.venv/Scripts/perpmath backtest ma_cross --symbol BTCUSDT --interval 15m --config configs/ma_cross.json --out results/ma-cross-btcusdt.json
```

<!-- unique:firsthand-data -->
That is Windows, where we ran it from a fresh clone on 21 November 2026 with Python 3.12.10. On Linux or macOS the folder is `.venv/bin/`. The download gave 35,040 fifteen-minute bars, none missing, from 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026. Its SHA-256 matched the file behind the engine's published result, and our output matched the published `results/ma-cross-btcusdt.json` line for line apart from the timestamp and the version number. This is what the last command printed:

```
ma_cross BTCUSDT 15m  2025-11-18T11:30:00Z to 2026-11-18T11:15:00Z
fee 0.0550% per side, slippage 0.0200% per fill, funding not modelled
               trades   win %   avg R  t-stat  return %  max DD %
in_sample         572   20.80   -0.31   -2.95    -62.35     63.33
out_of_sample     263   19.01   -0.05   -0.68    -18.46     31.18
```

<!-- unique:original-calc -->
In-sample, 10,000 USDT became 3,764.73, and climbing back from there takes a 165.6% gain (the [drawdown calculator](/tools/drawdown-calculator/) does that sum). The account paid 4,069.90 USDT in fees on the way down. Every trade is listed in the [ma_cross report](/backtests/ma-cross-btcusdt/).

That's a finished backtest. The rest of this page is the ways it could have looked better.

## How much do fees and slippage change a backtest?

In this run they are the difference between a small loss and a large one, and out-of-sample they flip the sign. We copied the config twice, set `slippage` to 0 in one and both `fee_rate` and `slippage` to 0 in the other, and ran the same command on the same candle file:

| Costs | Sample | Trades | Win rate | Avg trade | t-stat | Total return |
| --- | --- | --- | --- | --- | --- | --- |
| Published | In | 572 | 20.80% | -0.162% | -2.95 | -62.35% |
| Fee only | In | 572 | 21.68% | -0.122% | -2.22 | -52.66% |
| Zero | In | 572 | 26.57% | -0.012% | -0.22 | -11.15% |
| Published | Out | 263 | 19.01% | -0.066% | -0.68 | -18.46% |
| Fee only | Out | 263 | 20.91% | -0.026% | -0.27 | -9.40% |
| Zero | Out | 263 | 28.90% | +0.084% | 0.86 | +20.99% |

<!-- unique:original-calc -->
The average trade moves by exactly 0.15 points in both samples. That is the round trip: two fees of 0.055% and two fills moved 0.02% against you. Compounded over 572 trades at full position size, 0.15% a trade is the whole distance from -11.15% to -62.35%.

The 0.055% is the base-tier taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page updated 20 November 2026, checked 21 November 2026). The 0.02% slippage is an assumption, not a measurement. Funding payments are not modelled by this engine at all; the [funding rate page](/data/funding-rate/) shows what they have been running at.

<!-- unique:firsthand-data -->
We then did the same to the other five shipped strategies. IS is in-sample, OOS is out-of-sample, and each t column belongs to the zero-cost run on its left:

| Strategy | IS published | IS zero cost | t | OOS published | OOS zero cost | t |
| --- | --- | --- | --- | --- | --- | --- |
| ma_cross | -62.35% | -11.15% | -0.22 | -18.46% | +20.99% | 0.86 |
| fvg | -66.94% | +6.03% | 0.38 | -42.86% | -10.05% | -0.97 |
| liquidity_sweep | -93.98% | -27.12% | -1.14 | -69.03% | -14.58% | -1.11 |
| order_block | -42.33% | -6.27% | -0.38 | -18.71% | +0.54% | 0.11 |
| break_of_structure | -43.34% | -35.56% | -1.23 | -3.35% | +0.91% | 0.14 |
| breaker_block | -18.44% | +16.45% | 1.30 | -15.07% | +0.78% | 0.17 |

<!-- unique:original-calc -->
Twelve zero-cost blocks: six positive, six negative, and the largest t-statistic in either direction is 1.30. With costs removed these six rules are indistinguishable from coin flips, and half of the zero-cost blocks would have read as a win. The [fair value gap article](/learn/fair-value-gap/) takes the fvg row apart, and the per-trade reports are at [fvg](/backtests/fvg-btcusdt/) and [liquidity sweep](/backtests/liquidity-sweep-btcusdt/).

## What is in-sample and out-of-sample testing?

In-sample is the period you look at while deciding things. Out-of-sample is a period you run once, afterwards, with nothing left to decide. The engine cuts the data at a UTC midnight, here 31 July 2026, so the first 70% is in-sample. With nothing fitted, the two blocks are simply two consecutive periods: -62.35%, then -18.46%.

The split starts to matter the moment you choose something. To show that, we ran 13 fast/slow pairs (fast 5, 10, 20 or 50; slow 20, 50, 100 or 200), a list written down before the first run. It is not a search for a pair to trade.

| Fast/slow | IS trades | IS return | IS t | OOS trades | OOS return | OOS t |
| --- | --- | --- | --- | --- | --- | --- |
| 50/100 | 271 | -21.65% | -0.90 | 116 | +4.88% | 0.32 |
| 50/200 | 148 | -26.02% | -1.41 | 84 | -5.81% | -0.13 |
| 20/200 | 208 | -26.66% | -0.97 | 112 | -9.54% | -0.27 |
| 20/100 | 337 | -30.87% | -1.10 | 152 | -4.95% | -0.09 |
| 10/200 | 272 | -39.11% | -1.51 | 143 | -19.86% | -0.72 |
| 10/100 | 431 | -45.36% | -1.75 | 202 | -16.86% | -0.60 |
| 5/100 | 597 | -53.56% | -1.95 | 253 | -32.31% | -1.43 |
| 5/200 | 390 | -56.42% | -2.63 | 201 | -35.41% | -1.67 |
| 20/50 (shipped) | 572 | -62.35% | -2.95 | 263 | -18.46% | -0.68 |
| 10/50 | 690 | -71.65% | -3.68 | 293 | -28.14% | -1.13 |
| 5/50 | 900 | -81.09% | -4.55 | 413 | -46.87% | -2.30 |
| 10/20 | 1,442 | -93.63% | -8.38 | 609 | -61.22% | -5.05 |
| 5/20 | 1,644 | -94.60% | -8.24 | 695 | -65.75% | -5.41 |

<!-- unique:original-calc -->
I expected the textbook picture here, the best in-sample pair falling apart out-of-sample, and I was wrong. The 50/100 pair ranks first in both periods, and the rank correlation between the two return columns is 0.91. For a minute that looks like a stable edge.

<!-- unique:original-calc -->
It's a cost ranking. The five pairs with the smallest in-sample loss are the five that traded least (148 to 337 trades). Slower averages cross less often, pay the 0.15% round trip less often, and lose less. Trade frequency carries over to the next period, so the ranking does too. Nothing in it is about predicting price.

<!-- unique:original-calc -->
Then there is the one positive cell: 50/100 out-of-sample, +4.88% on 116 trades, t = 0.32. Had we run 13 pairs and reported that line alone, this page would be announcing a profitable moving-average bot. Harvey, Liu and Zhu's [NBER working paper 20592](https://www.nber.org/papers/w20592) (October 2014, checked 21 November 2026) argues that after heavy data mining the usual hurdle of a t-ratio above 2.0 no longer makes sense, and puts the bar for a newly found factor above 3.0. A value of 0.32 is nowhere near either.

## What is look-ahead bias, and can software catch it?

Look-ahead bias is a decision that uses data from after the moment it was supposedly made. Of the five, it produces the biggest numbers.

We wrote two versions of ma_cross that peek, on purpose. They live only in our research script, which registers them and then calls the engine's ordinary command-line entry point. The first uses a centred fast average: the value on each bar averages 10 closes up to that bar and the 10 closes after it. This is what `center=True` does in pandas' [rolling window](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.rolling.html) (checked 21 November 2026), and people reach for it since it hugs the chart so well.

| Version | Engine's check | IS trades | IS win rate | IS return | IS t | OOS return |
| --- | --- | --- | --- | --- | --- | --- |
| ma_cross as shipped | passed | 572 | 20.80% | -62.35% | -2.95 | -18.46% |
| Centred fast average | blocked | 478 | 63.81% | +4,470.18% | 10.01 | +208.16% |
| Decisions one bar early | passed | 561 | 22.64% | -38.19% | -1.37 | -11.81% |

<!-- unique:firsthand-data -->
The engine refused the centred version. Before simulating, it reruns the strategy on shortened copies of the data and compares every decision; a rule that reads tomorrow decides differently when tomorrow is cut off.

```
$ perpmath backtest ma_cross_centered --symbol BTCUSDT --interval 15m --config research/how-to-backtest/ma-cross-centered.config.json --out research/how-to-backtest/ma-cross-centered-btcusdt.json
error: signals.side at bar 3885 changes when bars after bar 3892 are removed: the strategy uses future data
```

Exit code 1, no result file. To see what the lie was worth, our script called the simulator directly and skipped the check. That is where the 63.81% win rate and +4,470.18% after costs come from. One changed line of code.

<!-- unique:firsthand-data -->
The second version is subtler, and I have to report that the check missed it. Every decision is moved one bar earlier, so the order fills at the open of the very bar whose close produced the cross. The command line compares against 9 shortened copies, and a one-bar peek only alters the last bar of each copy, and only if a cross happens to land there. None did. The run went through marked `lookahead_check: passed`, at -38.19% in-sample where the rule as shipped has -62.35%. With costs off it reads +43.38% and +29.86%. Raising the number of copies to 17 caught it, 65 let it through again, 129 caught it. That's luck.

<!-- unique:firsthand-data -->
What did catch it every time was a stricter test in our script: cut the data right after each bar that carries an entry signal, and ask whether that bar still decides the same thing. Both peeking versions failed on their first signal. The shipped rule passed all 835. So read the built-in check as a tripwire for blatant leaks. The README already says it cannot see future prices pulled in from outside the data, and sparse one-bar leaks are a second gap.

## What if one candle touches both the stop and the target?

Then the candle cannot tell you which came first, and the backtester has to assume. This engine always assumes the stop, the worse case for you. ma_cross has no target, so the question never comes up for it; the other five shipped strategies all aim for 2R.

The engine has no "target first" setting, so we replayed its published trade lists instead. The exit bar is the same under either rule and only the exit price of the ambiguous trades changes. Before changing anything, the script rebuilds the engine's final equity from the trade list to within 0.05 USDT.

| Strategy, in-sample | Trades | Bar touched both | Stop first (engine) | Target first |
| --- | --- | --- | --- | --- |
| fvg | 801 | 16 | -66.94% | -64.10% |
| liquidity_sweep | 1,639 | 26 | -93.98% | -93.16% |
| order_block | 325 | 7 | -42.33% | -41.32% |
| break_of_structure | 149 | 0 | -43.34% | -43.34% |
| breaker_block | 243 | 9 | -18.44% | -15.61% |

<!-- unique:original-calc -->
Counting the out-of-sample blocks too, 75 of 4,452 trades (1.68%) left on a bar that reached both levels, and 61 of those 75 were the entry bar itself. Handing every one of them to the strategy moves a result by 2.84 points at most; out-of-sample the largest shift is 1.86 points. On these rules and 15-minute bars it is the smallest of the five effects. I'd expect it to grow with tighter targets or wider bars, but that's reasoning, we haven't measured it. The truth sits somewhere between the two columns, and a backtester that quietly takes the right-hand one is choosing its own luck.

## How many trades does a backtest need?

Enough that the average trade can be told apart from zero, which is what the t-statistic measures. It is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) (NIST handbook, checked 21 November 2026) of per-trade net returns: the mean divided by its standard error. Roughly, when its absolute value is under 2 you can't tell the average from zero.

<!-- unique:original-calc -->
Apply that to our headline numbers. Out-of-sample the shipped rule lost 18.46% over 263 trades, and its t-statistic is -0.68. Nearly a fifth of the account gone, and statistically it is a shrug: the average trade was -0.066%, with enough scatter that zero sits well inside the noise. The zero-cost run's +20.99% has t = 0.86, the same shrug with the sign flipped. Returns compound, so they sound decisive. The t-statistic looks at the per-trade average and its spread.

The in-sample -62.35% does clear the bar, at -2.95 on 572 trades, so the fair summary is "loses after costs, clearly in one period and not clearly in the other". The engine also sets `insufficient_sample` on any block with fewer than 100 trades; in the sweep above, the 50/200 pair made 84 out-of-sample trades and carries that flag. Two cautions. It assumes trades are independent, which is generous when they cluster. And it knows nothing about how many variants you tried first.

## A checklist before you believe a backtest

1. Are fees and slippage charged on every fill, at your own tier's rate? Rerun with both at zero to see how much of the result is cost.
2. Was any parameter chosen after seeing results? Then only the out-of-sample block counts, and only the first time you look at it.
3. Does the entry fill after the signal bar has closed? Open the first trade and check its timestamps against the candles by hand.
4. Which way does the engine break a same-bar tie between stop and target? If it doesn't say, assume it picked the kind one.
5. Read the trade count and the t-statistic before the total return.
6. Can someone else rerun it? The data range, the file hash, the config and the code version belong in the result file.

The engine and its testnet-only order runner are described in the [bot section](/bot/). Before you test a rule of your own, put its stop distance into the [position size calculator](/tools/position-size-calculator/) and see what size comes out. For a strategy that holds many positions at once, where the order of prices inside a bar matters far more than it did here, see the [grid trading bot backtest](/learn/grid-trading-bot/).

## FAQ

### How much historical data do I need to backtest a trading strategy?

<!-- unique:firsthand-data -->
Count trades, not months. The engine flags any block under 100 trades as an insufficient sample, and even 263 trades could not separate an 18.46% loss from zero in our out-of-sample run. One year of one market is also one regime: BTCUSDT opened this window at 91,423 and closed it at 64,124.5.

### Can I backtest a crypto strategy without writing code?

With this engine, yes for the six shipped strategies: you edit numbers in a JSON config and run one command. A rule of your own needs a short Python function that returns, for each bar, an entry side, a stop price and an optional target.

### Is crypto backtesting different from backtesting stocks?

<!-- unique:firsthand-data -->
The steps are the same and three details differ. Perpetuals trade around the clock, so our 35,040 bars have no session gaps, and none of the 3,103 stop exits in the five published trade lists with a target was a gap through the stop at the open. Perpetuals charge funding, which this engine's strategy runs leave out. And costs are quoted per side: 0.055% taker at Bybit's base tier, 0.15% a round trip once you add our slippage assumption.

### Does a profitable backtest mean the strategy will make money?

No. A backtest is arithmetic on past prices under assumptions about fills and costs. All six rule-based strategies in the engine lose money when run as shipped, and one changed line was enough to make the same rule read +4,470.18% instead of -62.35%.
