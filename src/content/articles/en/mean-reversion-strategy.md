---
title: "Mean reversion strategy: price came back every time, and it still lost"
slug: "mean-reversion-strategy"
description: "A Bollinger Band mean reversion strategy as five checkable rules, backtested on a year of BTCUSDT: price returned to its mean every time and the account lost 80.76%."
date: "2026-11-30"
lastmod: "2026-11-30"
lang: "en"
category: "Backtests"
tags: ["mean reversion", "Bollinger Bands", "backtest", "BTCUSDT", "trading costs", "variance ratio"]
keywords: ["mean reversion strategy", "mean reversion trading", "bollinger band mean reversion", "mean reversion backtest", "does mean reversion work"]
tldr: "A mean reversion strategy bets that a price far from its recent average will come back to it. We coded the textbook version: buy the first 15-minute close below the lower Bollinger Band (20 bars, 2 standard deviations), sell at the average, stop 2 ATR away, and the mirror image for shorts. On BTCUSDT from 18 November 2025 to 18 November 2026, price closed back at the average after all 2,138 signals we could follow, a median 12 bars later. The trades still lost 80.76% in-sample (1,214 trades) and 51.85% out-of-sample (517 trades) after costs. With fees and slippage at zero the same rule returned +18.99% and +4.60%, and neither can be told apart from zero."
---

<!-- unique:firsthand-data -->
2,138 times in one year we watched BTCUSDT close outside a Bollinger Band on its 15-minute chart after a close inside it, and all 2,138 times it was back at its 20-bar average within a day. A rule that bought and sold those moves lost 80.76% of its account in the first 70% of the year and 51.85% in the rest. The average moves too, and that is most of the story.

## What is a mean reversion strategy?

A mean reversion strategy buys when price is unusually far below some average and sells when it is unusually far above, expecting the distance to close. It is the opposite bet to trend following, which buys strength and sells weakness.

Every version needs two things. One is a mean: a moving average, a session VWAP, the spread between two related assets. The other is a ruler for "unusually far": standard deviations, an RSI reading, a percentage. Mean reversion trading on a single chart most often uses Bollinger Bands, which supply both at once, a 20-bar average and bands two standard deviations either side of it.

The idea carries an assumption that rarely gets stated. For the trade to pay, price has to travel back to where the mean was when you entered. If the mean travels to the price instead, the distance closes and you have made nothing.

## Does price really revert to the mean?

It depends on which price, over what horizon, and the published evidence is about horizons nothing like a 15-minute chart.

### What the research measured

<!-- unique:cross-reference -->
The phrase comes from studies of stock indexes over years. Poterba and Summers, in [Mean Reversion in Stock Prices](https://www.nber.org/papers/w2343) (NBER working paper 2343, August 1987, later in the Journal of Financial Economics, volume 22, 1988; checked 22 November 2026), compared the variance of returns at different horizons. Their abstract reports returns that tend to continue over short horizons and reverse over long ones, and it adds that such tests have little power. Lo and MacKinlay's [variance-ratio paper](https://www.nber.org/papers/w2168) (NBER working paper 2168, February 1987, later in the Review of Financial Studies, volume 1, 1988) rejected the random walk for weekly US stock returns from 1962 to 1985, and its abstract says the result does not fit a mean-reverting model.

<!-- unique:cross-reference -->
So the published finding is about stock markets, with continuation at short horizons and reversal only at long ones. A 15-minute fade on a crypto perpetual borrows the name and none of the evidence. The man who designed the bands does not endorse the fade either. Rule 8 of John Bollinger's own [Bollinger Band rules](https://www.bollingerbands.com/bollinger-band-rules) (page footer dated 2025, checked 22 November 2026) reads: "Closes outside the Bollinger Bands are initially continuation signals, not reversal signals." His rule 14 warns against statistical assumptions and says the default bands hold about 90% of the data in practice, not the 95% a normal distribution would give.

### What one year of BTCUSDT shows

<!-- unique:firsthand-data -->
We measured it on our own candles: 35,040 BTCUSDT 15-minute bars from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, none missing. Rule 14 holds up. Of 35,021 closes that had a full band, 11.96% were outside it, against 4.55% for a normal distribution.

<!-- unique:original-calc -->
Then the question itself: do 15-minute returns undo themselves? The variance ratio compares the variance of q-bar returns with q times the variance of 1-bar returns. A value of 1 means moves add up like independent draws, and below 1 means part of each move tends to be taken back. To judge the size we shuffled the year's returns 500 times with a fixed seed and recorded where the ratio landed with all order destroyed.

| Horizon | Variance ratio | Middle 95% of 500 shuffles |
| --- | --- | --- |
| 2 bars (30 minutes) | 0.9844 | 0.9900 to 1.0112 |
| 4 bars (1 hour) | 0.9771 | 0.9817 to 1.0197 |
| 16 bars (4 hours) | 0.9436 | 0.9534 to 1.0560 |
| 96 bars (1 day) | 0.9487 | 0.8824 to 1.1138 |

<!-- unique:original-calc -->
Three of the four sit just below the shuffled range, and the one-bar autocorrelation is -0.0156 where shuffles gave -0.0100 to 0.0111. So there is reversal in this data, and it is tiny. Shuffling also removes volatility clustering, which real returns have, so the true range is wider than the one shown and "just below" should be read generously.

<!-- unique:firsthand-data -->
Asked in a trader's terms: after a big bar, what does the next bar do?

| After the largest | Bars | Bar moved at least | Next bar went the other way | Average given back |
| --- | --- | --- | --- | --- |
| 10% of bars | 3,504 | 0.34% | 56.93% | 0.011% |
| 5% of bars | 1,752 | 0.47% | 57.08% | 0.007% |
| 1% of bars | 351 | 0.86% | 54.13% | -0.025% |

<!-- unique:original-calc -->
The next bar went the other way 57% of the time and gave back a hundredth of a percent on average. Those two figures are compatible: the reversals are frequent and small, the continuations rarer and larger. After the largest 1% of bars the average next bar kept going. A round trip at Bybit's base taker rate with our slippage assumption costs 0.15%, about fourteen times the 0.011%.

## The mean reversion rule we tested, in five lines

```
mean, sd:  average and standard deviation of the last 20 closes
bands:     mean - 2 x sd (lower), mean + 2 x sd (upper)

long:      first close below the lower band    -> buy at the next bar's open
short:     first close above the upper band    -> sell at the next bar's open
exit:      a close back at or beyond the mean  -> out at the next bar's open
stop:      2 x ATR(14) from the signal bar's close
```

"First" means the previous bar was not already outside that band, so a run of closes outside it gives one signal. The mean in the exit line is the mean of the later bar. There is no other target and no time limit, and the rule holds one position at a time.

This strategy is not one of the engine's shipped examples. It lives in our research script, `research/mean-reversion-strategy/mean-reversion-strategy_research.py` in this site's source. The script registers the rule in the running Python process and then calls the open-source engine's real command line, so the fills, the costs, the sample split and the look-ahead check are the engine's own. The four numbers (20, 2.0, 14, 2.0) were written into the script's header on 21 November 2026 (UTC), before the first run on real data. They are Bollinger's defaults plus the ATR settings the engine's moving-average example already used. Nothing was changed after the run.

Three choices here are ours, and each has a reasonable alternative:

- **Enter on the first close outside, not on every one.** Re-entering on each bar that stays outside would add trades in exactly the moves that keep going.
- **Exit at the moving mean.** The other common choice is the opposite band, which holds longer.
- **A stop at all.** Many band-fade descriptions have none. The table further down shows what 1, 2 and 4 ATR do.

## Price came back 2,138 times out of 2,138

<!-- unique:firsthand-data -->
We followed every signal for 96 bars, including the ones the one-position rule skipped. There were 2,140 first closes outside a band, 1,108 below and 1,032 above, about 5.9 a day. Two came too late in the data to follow. Of the other 2,138, every one was followed by a close back at the 20-bar mean, after a median 12 bars, or three hours. The slowest tenth took 27 bars or more.

My guess before running this was that the return itself would be near-certain and that roughly 60% of those returns would come at a better price than the entry. The first half held. The second was low: it was 67.73%. That still leaves the average where a coin flip would put it.

| At the close back at the mean, compared with the entry | Signals | Share | Average move |
| --- | --- | --- | --- |
| Better price | 1,448 | 67.73% | +0.458% |
| Same or worse price | 690 | 32.27% | -0.935% |
| All | 2,138 | 100% | +0.009% |

<!-- unique:original-calc -->
Entry here is the open after the signal bar and the exit is the open after the bar that closed back at the mean, before costs and with no stop. Two times in three you gain 0.458%. The third time you lose 0.935%, and the average over all of them is 0.009%. At the signal the mean sat a median 0.51% away from the close. By the time price "returned" to it, the mean had moved a median 0.36% toward the price. The average did most of the travelling.

<!-- unique:firsthand-data -->
The stop does not rescue this, it only chooses which losses to take. On 937 of the 2,138 signals (43.83%), price touched the 2 ATR stop before or on the bar that closed back at the mean. The 1,201 that came back without touching it were better than the entry 96.59% of the time, by 0.471% on average. The worst case went 11.87% against the position before the mean caught up.

## The backtest: 1,731 trades, a loss in both periods

<!-- unique:firsthand-data -->
After costs the rule lost 80.76% in-sample and 51.85% out-of-sample, and both losses are far outside what chance explains. In-sample is the first 70% of the year; out-of-sample starts on 31 July 2026. We ran engine version 0.2.2 on 21 November 2026 (UTC).

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Equity left of 10,000 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 1,214 | 48.52% | -0.30 | -6.92 | -80.76% | 81.49% | 1,924.16 |
| Out-of-sample | 517 | 43.71% | -0.36 | -5.96 | -51.85% | 54.41% | 4,814.51 |
| In-sample, zero cost | 1,214 | 53.13% | +0.01 | 0.86 | +18.99% | 14.28% | 11,899.35 |
| Out-of-sample, zero cost | 517 | 53.00% | +0.03 | 0.43 | +4.60% | 10.31% | 10,460.09 |

Costs in the first two rows are 0.055% per fill, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. Each trade uses 100% of equity with no leverage. The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of per-trade net returns against zero; under 2 in absolute value, a result cannot be told apart from zero.

<!-- unique:original-calc -->
The zero-cost rows are the same trades with fee and slippage set to 0. The average trade goes from -0.133% of notional to +0.017% in-sample and from -0.140% to +0.010% out-of-sample, a difference of 0.15 points each time, which is the round-trip cost. Without costs the rule is slightly positive with t-statistics of 0.86 and 0.43. That matches the 0.009% above: there is nothing underneath for cheaper fees to uncover.

<!-- unique:original-calc -->
A win rate near 50% sounds fine until you look at the sizes. In-sample, 669 trades left at the mean and 88.04% of those were winners, averaging +0.359%. The other 545 hit the stop and averaged -0.738%. Over all trades the average win was 0.424% and the average loss 0.659%, and with those sizes the rule needs to win 60.84% of the time to break even. It won 48.52%. An account that falls 80.76% needs a gain of about 420% to get back, which the [drawdown calculator](/tools/drawdown-calculator/) will confirm.

### Eight settings, sixteen losing blocks

<!-- unique:firsthand-data -->
Band width, lookback and stop are the three numbers a reader would want to change, so we ran seven more settings. The list was written down with the rule, before the first run. It is a sensitivity table and no row is a recommendation.

| Lookback / band / stop | Trades in / out | Win rate in / out | Return in / out | Zero-cost return in / out | Zero-cost t in / out |
| --- | --- | --- | --- | --- | --- |
| 20 / 2.0 sd / 2 ATR (main run) | 1,214 / 517 | 48.52% / 43.71% | -80.76% / -51.85% | +18.99% / +4.60% | 0.86 / 0.43 |
| 20 / 1.5 sd / 2 ATR | 1,645 / 720 | 48.81% / 43.33% | -90.52% / -64.63% | +11.96% / +4.22% | 0.58 / 0.39 |
| 20 / 2.5 sd / 2 ATR | 675 / 290 | 44.59% / 41.38% | -64.27% / -35.56% | -1.59% / -0.42% | 0.01 / 0.01 |
| 20 / 3.0 sd / 2 ATR | 287 / 126 | 42.86% / 36.51% | -37.60% / -18.39% | -3.98% / -1.40% | -0.23 / -0.15 |
| 50 / 2.0 sd / 2 ATR | 687 / 291 | 42.79% / 43.99% | -59.68% / -23.49% | +13.09% / +18.39% | 0.62 / 1.55 |
| 96 / 2.0 sd / 2 ATR | 450 / 211 | 38.00% / 36.97% | -47.72% / -32.07% | +2.72% / -6.76% | 0.23 / -0.55 |
| 20 / 2.0 sd / 1 ATR | 1,378 / 582 | 33.16% / 31.96% | -87.16% / -56.33% | +1.60% / +4.59% | 0.18 / 0.51 |
| 20 / 2.0 sd / 4 ATR | 1,070 / 452 | 57.10% / 50.66% | -68.43% / -48.08% | +57.26% / +2.32% | 1.79 / 0.24 |

<!-- unique:original-calc -->
All sixteen blocks have more than 100 trades, all sixteen lost after costs, and the mildest t-statistic among them is -2.32. A wider band loses less by trading less: the average trade lost between 0.10% and 0.16% of notional in every in-sample row, which is one round trip. At zero cost no block reaches a t-statistic of 2. The row that catches the eye is the 4 ATR stop, +57.26% in-sample at zero cost with a t of 1.79. Its out-of-sample partner is +2.32% with a t of 0.24. A wide stop buys a 57% win rate and pays for it with larger losses.

## What the engine does not model, and how to rerun it

A band fade is usually worked with limit orders resting at the band. The engine has only market orders at the next bar's open, so every fill here pays the taker fee and takes whatever the open is. A resting order would pay Bybit's maker rate instead, 0.02% for the base tier, and would also be filled on every bar that keeps falling. We have not run that version and make no claim about it. The engine counts the stop first when one bar touches both the stop and an exit, and it leaves funding out; with trades lasting 6.7 bars on average, funding is a small omission here.

It is also one coin, one timeframe and one year. Nothing above says anything about daily bars, about pairs, or about a filter that stands aside in trends. What it does say is narrow: this rule, on this market, had no measurable edge before costs and a heavy loss after them.

To reproduce it, install the engine and download the same candles:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then register the rule and call the command line from Python, as the script does:

```python
import types
from perpmath import cli
from perpmath.strategies import STRATEGIES

STRATEGIES["mean_reversion_band"] = types.SimpleNamespace(DEFAULTS=DEFAULTS, generate=generate)
cli.main(["backtest", "mean_reversion_band", "--symbol", "BTCUSDT", "--interval", "15m",
          "--config", "mr.json", "--out", "mr-btcusdt.json", "--lookahead", "every-bar"])
```

`generate` is about twenty lines of NumPy and is in the script; the README's [Writing a strategy](https://github.com/sentinelbotsaas-hub/perpmath/blob/b1c4fd990633343427fe45df30fa9c6206cd2961/README.md#writing-a-strategy) section (checked 22 November 2026) says what it has to return. The last flag is there for a reason we only saw after the first run. The exit rule puts a flag on nearly every bar, so the engine's default look-ahead check sampled 7,543 of 35,020 decision bars. With `every-bar` it cut the data after all of them and found no difference. The trades were identical in both runs.

On Windows the activate line is `.venv\Scripts\activate`. No account or API key is involved. The engine is described in the [bot section](/bot/), and the guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) covers the zero-cost rerun and the look-ahead check in detail.

## FAQ

### Does mean reversion work in crypto?

<!-- unique:firsthand-data -->
Not in the form we tested. On BTCUSDT 15-minute bars a Bollinger Band fade lost 80.76% and 51.85% after costs, and with costs removed it returned +18.99% and +4.60% with t-statistics under 1. Returns at that timeframe do reverse slightly, by about 0.011% after a large bar, which is far below the cost of trading it with market orders.

### Why does a mean reversion strategy show a high win rate and still lose?

The wins are small and the losses are large. In our in-sample trades the average win was 0.424% and the average loss 0.659%, so break-even needed a 60.84% win rate and the rule delivered 48.52%. Trades that reached the mean won 88.04% of the time; the trades that hit the stop paid for all of them.

### Is mean reversion better than trend following?

On this data neither made money. The engine's shipped trend baseline, a 20/50 moving-average cross, lost 62.35% in-sample and 18.46% out-of-sample on the same candles; its report is the [MA cross backtest](/backtests/ma-cross-btcusdt/). A related count is in our [market structure shift](/learn/market-structure-shift/) article, where 52% of swing breaks were followed by a break the other way.

### Which indicator is best for mean reversion trading?

We can't rank them. Only Bollinger Bands with a 20-bar mean have been run here, in eight settings. RSI extremes, distance from VWAP and pairs spreads are different rules with different means, and a result for one says nothing about another.

### Would limit orders at the band fix it?

They would change two things at once: the fee drops from 0.055% to the 0.02% maker rate, and the fill moves to the band itself. They would also buy every bar of a collapse on the way down. Which of those effects wins on a year of 15-minute bars, and what would the fills really have been?
