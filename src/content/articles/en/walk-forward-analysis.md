---
title: "Walk-forward analysis: nine re-optimisations of one moving-average rule, fold by fold"
slug: "walk-forward-analysis"
description: "Walk forward analysis in steps, then a real run: 13 moving-average settings re-picked 9 times on BTCUSDT. Training said +46.84% a year, the test windows lost 13.67%."
date: "2026-12-01"
lastmod: "2026-12-01"
lang: "en"
category: "Backtests"
tags: ["walk-forward analysis", "walk-forward optimization", "out-of-sample testing", "overfitting", "BTCUSDT"]
keywords: ["walk forward analysis", "walk forward optimization", "walk forward testing", "walk forward efficiency", "rolling window backtest"]
tldr: "Walk-forward analysis re-optimises a strategy on a training window, trades the winner on the next unseen window, slides both forward and joins the unseen pieces into one result. We did it nine times with 13 moving-average settings on BTCUSDT 15-minute bars: the pick made money in 8 of 9 training windows (+46.84% a year on average) and the nine test windows together lost 13.67% on 298 trades, t = -0.31. Picking once at the start and never touching it again lost 11.37%."
---

<!-- unique:firsthand-data -->
13 moving-average settings, 9 test windows, 234 runs of the backtester. In eight of the nine training windows the setting we picked had made money, and the best of them showed +25.90% in 90 days. Traded on the 30 days that followed each pick, the nine pieces joined together lost 13.67%. Every number on this page comes from that run, which we did on 21 November 2026 (UTC) with the open-source [perpmath engine](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.2), version 0.2.2 (checked 22 November 2026).

## What is walk-forward analysis?

Walk-forward analysis is a backtest in which the parameters are chosen again and again, each time on past data only, and the strategy is judged solely on the stretches that came after each choice. Wikipedia's [walk forward optimization](https://en.wikipedia.org/wiki/Walk_forward_optimization) article (checked 22 November 2026) credits the method to Robert E. Pardo's book Design, Testing and Optimization of Trading Systems, first published in 1992. We have not read the book, so that attribution is Wikipedia's.

One round goes like this. Optimise on a training window, which the literature calls in-sample. Take the winning parameters to the window right after it, the test or out-of-sample window, and record what they do there. Then move both windows forward by the length of the test window and repeat. The test windows end up back to back, so they can be joined into one equity curve in which no trade was ever placed with parameters fitted on its own data.

People call the same procedure walk-forward optimization or walk-forward testing. The single in-sample/out-of-sample split in [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) is a walk-forward with one fold. Doing it nine times answers a question one split cannot: does choosing on the past keep working as the past moves?

There are two common shapes. In a rolling walk-forward the training window has a fixed length and drops old data as it moves. In an anchored one it always starts at the first bar and grows. Machine-learning libraries have the same idea under another name: scikit-learn's [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) (version 1.9.1 page, checked 22 November 2026) is anchored by default, with successive training sets that are supersets of the earlier ones, and its `max_train_size` setting turns it into the rolling kind.

## How to run a walk-forward analysis, step by step

Decide five things before you run anything, and write them down where you cannot quietly change them. In our script they sit in the first comment block.

1. **The data and where it is cut.** We used the engine's BTCUSDT 15-minute file from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 22 November 2026) and kept the 360 days from 19 November 2025 to 14 November 2026, cut at UTC midnights.
2. **The window lengths.** Training 90 days, test 30 days, step 30 days. That gives nine folds whose test windows run back to back from 17 February to 14 November 2026.
3. **The parameter grid.** The 13 fast/slow pairs already used in the backtesting guide: fast 5, 10, 20 or 50 bars, slow 20, 50, 100 or 200, fast shorter than slow. The ATR stop was left alone.
4. **The objective.** Highest net return in the training window, after fees and slippage. Ties go to the pair listed first.
5. **What you will compare it with.** An anchored version, a version that picks by t-statistic, each pair held fixed, and the pair picked once on the first training window.

Then the loop. For each fold, run every pair on the training window, keep the best, run that pair on the test window, and write the test result down before looking at the next fold.

<!-- unique:firsthand-data -->
Each of our 234 runs is one call of the engine's own `run_backtest`: we load the bars of training plus test and put the engine's split at the start of the test window, so its in-sample block is our training window and its out-of-sample block is our test window. The look-ahead check ran and passed every time. Costs are the published ones, 0.055% a side and 0.02% slippage per fill, at full position size with no leverage. Each window starts flat with 10,000 USDT, and a position still open at a window's last bar is closed there with costs charged.

## What happened in each of the nine folds?

The pick looked good on its training window almost every time and lost on the following window six times out of nine.

| Fold | Test window starts | Pair picked | Training return | Training trades | Test return | Test trades | Rank in test, of 13 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 17 Feb 2026 | 50/100 | -6.03% | 100 | +14.54% | 30 | 1 |
| 2 | 19 Mar 2026 | 50/100 | +25.90% | 91 | -2.69% | 35 | 1 |
| 3 | 18 Apr 2026 | 50/100 | +23.78% | 93 | -3.68% | 28 | 3 |
| 4 | 18 May 2026 | 50/100 | +6.14% | 91 | -13.80% | 35 | 10 |
| 5 | 17 Jun 2026 | 20/200 | +6.38% | 67 | -2.41% | 26 | 1 |
| 6 | 17 Jul 2026 | 20/200 | +10.29% | 68 | -7.22% | 25 | 3 |
| 7 | 16 Aug 2026 | 20/200 | +5.54% | 73 | +9.54% | 34 | 5 |
| 8 | 15 Sep 2026 | 20/100 | +3.55% | 107 | -6.34% | 43 | 3 |
| 9 | 15 Oct 2026 | 20/100 | +1.82% | 115 | +0.41% | 42 | 1 |

<!-- unique:original-calc -->
Read the two return columns against each other. The picked pair was profitable in 8 of 9 training windows, +8.60% on average. It was profitable in 3 of 9 test windows, -1.29% on average. Fold 1 is the odd one out in both directions: no pair at all made money in that training window, we took the least bad at -6.03%, and it went on to post the best month of the whole run.

<!-- unique:original-calc -->
The training profits were never strong evidence in the first place. The best one, +25.90%, came from 91 trades with a t-statistic of 1.32, and six of the nine training windows gave the picked pair fewer than 100 trades, which the engine flags as an insufficient sample. Across all 13 pairs and nine folds there are 117 training results, and only 13 of them are positive. Pick the best of 13 noisy numbers and you will usually be holding a positive one. That is selection, and the test column is what it was worth.

No single test window can be judged. They hold between 25 and 43 trades each. Only the nine together are worth reading.

## Walk-forward result against choosing once

Joined end to end, the nine test windows lost 13.67% on 298 trades, with a t-statistic of -0.31. Re-optimising every 30 days did not beat the pair we would have picked once, at the start, and left alone.

| Method, same nine test windows | Trades | Win rate | t-stat | Return | Max drawdown |
| --- | --- | --- | --- | --- | --- |
| Walk-forward, rolling 90 days, pick by return | 298 | 19.46% | -0.31 | -13.67% | 37.76% |
| Walk-forward, anchored, pick by return | 282 | 21.99% | -0.32 | -11.37% | 35.85% |
| Walk-forward, rolling, pick by t-statistic | 309 | 20.06% | -0.36 | -15.33% | 37.76% |
| Walk-forward, anchored, pick by t-statistic | 303 | 19.47% | -0.88 | -27.15% | 42.67% |
| Picked once on the first 90 days (50/100), held | 282 | 21.99% | -0.32 | -11.37% | 35.85% |
| Best single pair, chosen with hindsight (50/100) | 282 | 21.99% | -0.32 | -11.37% | 35.85% |
| Shipped pair (20/50), held | 610 | 21.31% | -2.20 | -53.82% | 61.40% |
| A random pair every fold, expected | n/a | n/a | n/a | -62.40% | n/a |

Returns compound from window to window. Max drawdown is measured at every 15-minute bar close across the joined curve, the definition in our [max drawdown article](/learn/max-drawdown/). The last row is the product of each fold's average over the 13 pairs.

<!-- unique:original-calc -->
Three rows are identical, and that is not a typo. The anchored walk-forward picked 50/100 in all nine folds, so it is the same thing as picking 50/100 once. And 50/100 also turns out to be the best of the 13 pairs over the whole 270 days. Optimising once over all nine windows with full hindsight therefore gives -11.37%. That is the ceiling for any fixed pair, and normally a number nobody could have had in advance. The honest rolling procedure gives -13.67%, 2.30 points under it. The surprise is the row in between: the pair chosen on the first 90 days alone, with no hindsight at all, sits on the ceiling. All 13 pairs lost money over the test span, from -11.37% down to -95.44% for 5/20.

<!-- unique:original-calc -->
I expected the rolling version to chase noise and land somewhere in the middle of the table. It did better than that, and the reason is not flattering. Its picks ranked first of 13 in the following window four times and in the top three seven times, and across the nine folds the rank correlation between a pair's training return and its test return averaged 0.70. Something does carry over from one window to the next. It is trade frequency. Every pick was one of the four least active pairs in its training window, and over the full span the pairs with fewer trades have higher returns with a rank correlation of 0.93. Slow pairs pay the 0.15% round trip less often. The walk-forward learned to trade less, which the fixed-pair [sweep in the backtesting guide](/learn/how-to-backtest-a-trading-strategy/) had already shown on a single split.

The baseline matters for a second reason. Against the shipped 20/50 pair or a random pick, a loss of 13.67% looks like a rescue. Against "choose the slowest sensible pair and stop", it is slightly worse. Per-trade detail for the shipped pair is in the [MA cross report](/backtests/ma-cross-btcusdt/).

## What is walk-forward efficiency, and what was ours?

Walk-forward efficiency compares what the strategy earned out-of-sample with what the optimiser promised in-sample, both annualised. TradeStation's [Walk-Forward Optimizer help](https://help.tradestation.com/09_01/tswfo/topics/walk-forward_summary_out-of-sample.htm) (checked 22 November 2026) says its table compares annualised rates of return for the two, and that 50% or more is considered a successful analysis. That is their rule of thumb, not a statistical test.

<!-- unique:original-calc -->
Ours: the picked pairs averaged +46.84% a year in training and the joined test windows ran at -18.02% a year. The ratio is -0.38, a fail by any reading. The number is still worth computing, since it puts the size of the optimiser's promise next to the size of what arrived. Be careful with the ratio itself when the training return is negative: two losses divide into a positive "efficiency", and our fold 1 would have scored below zero for making money.

<!-- unique:original-calc -->
A second way to size the result is to treat the nine test-window returns as nine monthly returns. Pasted into the [Sharpe ratio calculator](/tools/sharpe-ratio-calculator/) with 12 periods a year, they give a mean of -1.29%, a standard deviation of 8.64%, an annualised Sharpe ratio of -0.52 and a 95% interval from -2.79 to +1.76. Nine observations cannot tell that apart from zero, in either direction. The calculator says so too: it flags any sample under 30.

## What a walk-forward test cannot prove

It cannot prove that a strategy works. A pass shows that one way of choosing parameters survived a handful of unseen windows in one market. Ours covers one symbol and 270 test days over which BTCUSDT went from 68,863.8 to 68,280.8, close to flat, having fallen from 92,925 while the first training window ran. Funding payments are not in the engine's strategy runs at all (the [funding rate page](/data/funding-rate/) shows their size).

It does not remove overfitting. It moves it up a level. Window lengths, the grid and the objective are parameters too, and nothing stops anyone from trying several designs and publishing the kindest.

<!-- unique:original-calc -->
Our own table shows the room for that. Four designs, all reasonable and all written down in advance, gave -11.37%, -13.67%, -15.33% and -27.15%. Had one of them come out positive, reporting that row alone would have been a walk-forward-validated strategy made of nothing. Harvey, Liu and Zhu's [NBER working paper 20592](https://www.nber.org/papers/w20592) (October 2014, checked 22 November 2026) makes the general point about testing many variants: the usual t-ratio hurdle of 2.0 stops making sense, and they put the bar for a newly found factor above 3.0. Our t-statistics run from -0.31 to -0.88.

Two smaller assumptions sit inside the joined curve. Restarting flat at every window boundary closes positions a continuous run would have kept: the 50/100 pair run straight through the same 270 days lost 14.16%, not 11.37%. And a t-statistic treats trades as independent. Whether the order of those trades matters is a separate question, which [Monte Carlo simulation](/learn/monte-carlo-simulation-trading/) addresses and a walk-forward does not.

## Rerun it

Clone the engine, install it and download the same candles. Then run our script, which is in this site's source under `research/walk-forward-analysis/`, with the engine's Python from the site's root folder:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git perpmath-engine
cd perpmath-engine
python -m venv .venv
.venv/Scripts/python -m pip install -e .
.venv/Scripts/perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
cd ../perpmath-site
../perpmath-engine/.venv/Scripts/python research/walk-forward-analysis/walk_forward.py
```

On Linux or macOS the folder is `.venv/bin/`. The script stops unless the candle file's SHA-256 matches the one in the engine's published result. It also checks its own arithmetic on small cases worked by hand before it touches real data: two windows of +10% and -50% must join to -45% with a 58.33% drawdown. The run took about five minutes on a desktop PC, most of it the engine's look-ahead check. Results land in `research/walk-forward-analysis/walk_forward.json`, with every pair's training and test block for every fold.

To try it on a rule of your own, register the strategy the way the engine's README describes and change the grid. The engine and its testnet-only order runner are described on the [bot page](/bot/), and all shipped results are under [backtests](/backtests/).

## FAQ

### How long should the training and test windows be?

<!-- unique:firsthand-data -->
Long enough to hold a usable number of trades, and decided before you look at results. Our 90-day training windows gave the picked pair between 67 and 115 trades and the 30-day test windows between 25 and 43, which is thin: only the joined 298 trades clear the engine's 100-trade minimum.

### Is walk-forward optimization better than a single out-of-sample test?

It uses the data more fully and shows whether the choice of parameters is stable, since you see nine picks, not one. It is not automatically stricter. In our run the single pick made on the first 90 days ended at -11.37% and the nine-pick version at -13.67%.

### Does passing a walk-forward analysis mean a strategy is profitable?

No. It means the selection procedure held up on the windows tested, under the costs assumed. Our run failed, and a pass on 298 trades would have deserved the same caution as the failure.
