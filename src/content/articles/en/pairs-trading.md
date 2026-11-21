---
title: "Pairs trading: a BTC and ETH z-score strategy, tested with costs on both legs"
slug: "pairs-trading"
description: "Pairs trading explained with a BTCUSDT and ETHUSDT z-score backtest: two in three trades won, the account lost 9.26%, and the stops and four fills show why."
date: "2026-12-04"
lastmod: "2026-12-04"
lang: "en"
category: "Backtests"
tags: ["pairs trading", "statistical arbitrage", "mean reversion", "BTCUSDT", "ETHUSDT"]
keywords: ["pairs trading", "pairs trading strategy", "pairs trading crypto", "z-score pairs trading", "BTC ETH pairs trade"]
tldr: "Pairs trading goes long one asset and short a related one when the gap between them is unusually wide, and closes when the gap is back to normal. We tested the plainest version on BTCUSDT and ETHUSDT perpetuals, 15-minute bars, one year: a rolling 7-day regression, entry at a z-score of 2, exit at 0, stop at 4. In-sample 78 trades won 66.67% of the time and lost 9.26% after costs; out-of-sample 35 trades lost 0.95%. Both samples are under 100 trades, so neither can be judged. Before costs the average trade made 0.03%, against a round trip that costs 0.15%."
---

Pairs trading bets that two prices which usually move together will close a gap after it opens. You buy the one that has fallen behind, sell the one that has run ahead, and wait.

<!-- unique:firsthand-data -->
We built the textbook version for the two largest crypto perpetuals and ran it on one year of 15-minute bars, with every rule fixed before the first run. Two out of three trades made money. The account still ended 9.26% down in-sample, and the reason was sitting in the sizes of the wins and the losses. The whole test is on this page, including the parts that did not behave the way the idea says they should.

## What is pairs trading?

Pairs trading is a market-neutral strategy that holds a long position in one asset and a short position in a related one, sized so that a move shared by both roughly cancels. What is left is a bet on the spread between them. Wikipedia's [pairs trade article](https://en.wikipedia.org/wiki/Pairs_trade) (checked 22 November 2026) says the approach was pioneered by Gerry Bamberger and later led by Nunzio Tartaglia's quantitative group at Morgan Stanley in the 1980s.

The study most people cite is Gatev, Goetzmann and Rouwenhorst, [NBER working paper 7032](https://www.nber.org/papers/w7032) (March 1999, checked 22 November 2026). Its abstract describes daily US stock data from 1962 to 1997, pairs matched by minimum distance between normalised prices, and average annualised excess returns of up to 12 percent for portfolios of the best pairs. It also says part of those profits may come from market microstructure effects. Keep the setting in mind: portfolios of stock pairs, daily bars, six-month trading periods. A single crypto pair on 15-minute bars is a different animal, and that study is not evidence about it.

The recipe has four parts, and each is a decision:

- **Which two assets.** They need a reason to stay together, not just a history of it.
- **The hedge ratio.** How much of B offsets one unit of A.
- **A measure of "unusually wide".** Almost always a z-score: how many standard deviations the spread is from its recent average.
- **Entry, exit and stop levels** on that z-score.

## Do BTC and ETH actually move together?

Bar by bar they do. Whether the gap between them comes back is a separate question, and the evidence there is weaker.

<!-- unique:firsthand-data -->
We downloaded both perpetuals from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline) (checked 22 November 2026) with the open-source [perpmath engine](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.2): 35,040 fifteen-minute bars each, 18 November 2025 to 18 November 2026, same timestamps, none missing. The correlation of their 15-minute log returns is 0.89 over the year. In rolling 7-day windows it ranged from 0.74 to 0.94.

Correlation of returns says the two wiggle together. It says nothing about whether their price levels stay tied, and a pairs trade needs the second thing. Two prices can be 0.89 correlated bar by bar and still drift apart for months.

<!-- unique:original-calc -->
So we fitted one fixed line to the in-sample period, log ETH price against log BTC price. The slope was 1.51: a 1% move in BTC went with a 1.51% move in ETH. The leftover, the spread, had a standard deviation of 0.046 in log terms, roughly 4.6%, and pulled back toward zero with a half-life of 1,050 bars, about 10.94 days. Freeze that line and carry it into the out-of-sample period and the spread stays within 2.57 in-sample standard deviations, with a half-life of 13.92 days. That is slow but not broken. Fit a fresh line on the out-of-sample period alone, though, and the slope is 1.22, not 1.51.

<!-- unique:original-calc -->
The hedge ratio moves even more when it is estimated the way a trading rule has to estimate it, on recent data only. Over rolling 7-day windows the slope ranged from 0.05 to 2.76, with a median of 1.22 and 90% of values between 0.64 and 1.91. At a slope of 0.05 the "pair" is an ETH position with a token BTC hedge.

**What we did not do.** We did not run a formal cointegration test. The usual one, Engle and Granger's two-step method, runs a unit-root test on the residual of that fitted line, and Wikipedia's [cointegration article](https://en.wikipedia.org/wiki/Cointegration) (checked 22 November 2026) notes that the critical values are non-standard when the line is estimated. Our script uses NumPy only. It prints a plain Dickey-Fuller t-ratio without lag terms, -2.79 in-sample and -1.77 out-of-sample with the in-sample line, and we attach no verdict to either. A reader who wants the real test can use `coint` in [statsmodels](https://www.statsmodels.org/stable/generated/statsmodels.tsa.stattools.coint.html) (version 0.15.0 page, checked 22 November 2026), whose null hypothesis is no cointegration.

## The z-score rules we tested

Everything below was written into the script's first comment block before it touched real data, and run once.

1. On each bar's close, fit a least-squares line of log ETH on log BTC over the last 672 bars (7 days), the current bar included. The slope is the hedge ratio b.
2. The z-score is the current bar's distance from that line divided by the regression's standard error.
3. **Entry:** flat, and the absolute z-score has just crossed above 2.0. At the next bar's open, if z is positive (ETH dear against BTC) short ETH and long BTC; if negative, the reverse.
4. **Size:** the two legs add up to 100% of equity, split 1 to b between ETH and BTC. No leverage. The split is frozen for the life of the trade.
5. **Exit,** decided on a close and filled at the next open: z has crossed zero; or z has reached 4.0 against the trade (stop); or the trade is 672 bars old.
6. In-sample is the first 70% of the year, cut at a UTC midnight, 31 July 2026. Each sample starts flat with 10,000 USDT.

Costs follow the engine's defaults on every fill of every leg: a 0.055% fee, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), and 0.02% slippage, which is an assumption. How this site relates to Bybit is on the [disclosure page](/disclosure/).

**This simulation is not the engine.** The engine trades one symbol at a time, so the two-leg accounting lives in our research script, `research/pairs-trading/pairs_backtest.py` in this site's source, and has not had the engine's test suite run over it. We compensated with checks of its own, described near the end.

<!-- unique:firsthand-data -->
The first trade shows the mechanics. On 25 November 2025 the z-score closed at 2.05 with a hedge ratio of 1.26. At the 13:00 UTC open the script shorted 4,424.14 USDT of ETH and bought 5,575.86 USDT of BTC. The z-score crossed zero 38 hours later. Before costs the two legs together had made 0.81% of the account. Fees on the four fills came to 11.23 USDT, slippage took about 4.16 more, and the trade netted 65.80 USDT.

## What happened: 113 trades over one year

It lost money after costs in both periods, by an amount that cannot be told apart from zero, on samples too small to judge.

| Costs | Sample | Trades | Win rate | Avg trade | t-stat | Return | Max drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Published | In | 78 | 66.67% | -0.119% | -0.98 | -9.26% | 13.04% |
| Fee only | In | 78 | 66.67% | -0.079% | -0.65 | -6.38% | 11.04% |
| Zero | In | 78 | 67.95% | +0.031% | 0.26 | +2.01% | 10.47% |
| Published | Out | 35 | 54.29% | -0.022% | -0.13 | -0.95% | 3.82% |
| Fee only | Out | 35 | 54.29% | +0.018% | 0.10 | +0.46% | 3.73% |
| Zero | Out | 35 | 65.71% | +0.129% | 0.74 | +4.42% | 3.62% |

The average trade lasted 143 bars, a little under 36 hours. Returns are on the whole account, and max drawdown is measured at every bar close with both legs marked to market, the definition in the [max drawdown article](/learn/max-drawdown/).

<!-- unique:original-calc -->
Both blocks have fewer than 100 trades, the threshold under which the engine marks a result as an insufficient sample, and we hold our own script to it. So read the table as an accounting example. Nothing in it is a finding about pairs trading. The largest t-statistic in any direction is 0.98. The one honest sentence it supports is narrow: with these rules, on this pair and year, the price moves captured were smaller than the cost of capturing them.

For scale, simply holding either coin was far rougher. Over the in-sample period BTCUSDT fell 29.17% and ETHUSDT 37.39%. The pair's 13.04% drawdown is what market neutrality bought, and the 9.26% loss is what it cost.

## Why did a 66.67% win rate lose money?

The wins were small and frequent, the losses rare and large. That profile is built into any strategy that takes profit at "back to normal" and only gives up at "much worse".

| In-sample exit | Trades | Avg price move, before costs | Avg result, after costs | Avg length |
| --- | --- | --- | --- | --- |
| z back to zero | 63 | +0.317% | +0.167% | 140 bars |
| Stop at z = 4 | 13 | -1.205% | -1.355% | 99 bars |
| 672-bar time limit | 1 | -2.259% | -2.410% | 672 bars |
| End of sample | 1 | +0.425% | +0.276% | 323 bars |

<!-- unique:original-calc -->
Add them up. The 63 reverting trades contributed +10.50 percentage points between them. The 13 stops took away 17.62. One stopped trade undid the work of about eight winners. Across the whole in-sample list the average winner made 0.46% and the average loser cost 1.28%, so the strategy needed to win about 74% of the time just to stand still, and it won 66.67%. Out-of-sample it was the same shape: 28 reverting trades made +9.30 points, 7 stops lost 10.07.

<!-- unique:firsthand-data -->
The worst trade is worth a look. On 2 June 2026 the z-score went below -2 and the script bought ETH against BTC with a hedge ratio of 0.59. ETH kept falling against BTC for more than two days, the z-score reached -4, and the trade closed 5.01% down. A day after it closed, the best in-sample trade, in the same direction, made 1.77%.

Before you size a strategy with this profile, put its stop loss, not its average loss, into the [position size calculator](/tools/position-size-calculator/), and its win rate and payoff into the [risk-of-ruin calculator](/tools/risk-of-ruin-calculator/). A two-thirds win rate feels safe. The payoff ratio here is 0.36.

## The z-score came back. Did the prices?

Not always, and this is the part the idea glosses over. A rolling z-score can return to zero in two ways: the spread comes back to the line, or the line moves to the spread.

<!-- unique:firsthand-data -->
In-sample, 11 of the 63 trades that exited on "z back to zero" had lost money on price alone, before any cost. The z-score did what the rule waited for, and the two prices had not converged. The 7-day window had simply absorbed the new level and redrawn its line through it. After costs, 12 of the 63 "successful" reversions were losers; out-of-sample it was 9 of 28.

<!-- unique:original-calc -->
The numbers from the stationarity section explain why this should be expected. The spread's measured half-life was about 11 days. Our window was 7. A line refitted on a window shorter than the time the spread takes to come back will often get to the spread first.

<!-- unique:firsthand-data -->
The moving hedge ratio causes a second problem. The best out-of-sample trade, on 14 September 2026, was entered when the rolling slope was 0.14. The script duly sold 8,701.10 USDT of ETH and bought 1,240.98 USDT of BTC: 87.5% of the position was one coin. It made 2.05%, and that was a short on ETH with a small hedge. The worst out-of-sample trade, three days earlier at a slope of 0.34, was stopped after four bars for -3.31%. A rule that lets the data set the hedge ratio also lets the data switch the hedge off.

## Costs on two legs, and funding

A pairs trade has four fills where a single position has two. With the legs adding up to 100% of equity, each fill charges 0.055% plus 0.02% on its own leg, so a round trip costs 0.15% of the account, the same as one full-size trade in the engine's single-symbol strategies.

<!-- unique:original-calc -->
Against that, the average in-sample trade captured 0.031% before costs. Costs were nearly five times the edge. The 78 in-sample trades paid 826.00 USDT in fees alone on a 10,000 USDT account. Set fees and slippage to zero and the same trades return +2.01% and +4.42%, with t-statistics of 0.26 and 0.74: no visible edge even for free.

**Funding is not modelled.** A perpetual pays or receives funding at each settlement, every eight hours for BTCUSDT according to the engine's README. A pair is long one contract and short the other, so the net is the difference between two rates times the leg sizes. It can help or hurt, and with an average holding time of 36 hours a trade would cross four or five eight-hour settlements. We did not download funding for this test. The [funding rate page](/data/funding-rate/) shows current levels.

## Would different settings have worked?

The script also runs eight neighbouring combinations, and we label them for what they are: hindsight. They were listed before anything ran, as a sensitivity check, with the time limit set equal to the window in each. None was used to choose the settings above.

| Window | Entry z | In: trades | In: return | In: t | Out: trades | Out: return | Out: t |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 192 bars | 1.5 | 311 | -25.34% | -3.49 | 154 | -22.56% | -3.52 |
| 192 bars | 2.0 | 244 | -27.25% | -3.65 | 115 | -19.90% | -3.13 |
| 192 bars | 2.5 | 187 | -21.58% | -3.41 | 90 | -16.27% | -2.83 |
| 672 bars | 1.5 | 101 | -15.11% | -1.58 | 47 | -4.17% | -0.59 |
| 672 bars (tested) | 2.0 | 78 | -9.26% | -0.98 | 35 | -0.95% | -0.13 |
| 672 bars | 2.5 | 53 | -9.25% | -1.20 | 30 | -1.13% | -0.15 |
| 2,880 bars | 1.5 | 28 | -4.90% | -0.56 | 11 | -2.86% | -0.66 |
| 2,880 bars | 2.0 | 22 | -4.50% | -0.55 | 11 | -0.79% | -0.14 |
| 2,880 bars | 2.5 | 16 | -8.30% | -1.21 | 10 | +2.11% | 0.45 |

<!-- unique:original-calc -->
Seventeen of eighteen cells are negative. The one positive cell rests on 10 trades and is noise. The pattern across rows is the one the [backtesting guide](/learn/how-to-backtest-a-trading-strategy/) found for moving averages: the more often a setting trades, the more it loses. The 2-day window is the only one with enough trades to read (five of its six cells have 100 or more), and it reads clearly, with t-statistics between -2.83 and -3.65. With costs removed those three rows return +19.09%, +4.96% and +3.87% in-sample and -2.41%, -4.79% and -4.15% out-of-sample. A reader hunting for the setting that works would stop at the in-sample +19.09% and be wrong by the next period.

Choosing among settings like these on past data and judging them on the next stretch is exactly what [walk-forward analysis](/learn/walk-forward-analysis/) formalises. We have not done that for this pair.

## What this test does not show, and how to rerun it

It covers one pair, one year, one timeframe and one family of rules. It says nothing about baskets of pairs, daily bars, pairs chosen by a cointegration screen, or maker orders in place of taker fills. Funding, borrowing limits, margin on two positions and the risk of one leg filling without the other are all outside it. The fills assume both legs trade at the next bar's open.

<!-- unique:firsthand-data -->
The script checks itself before and during the run. Twelve hand-worked cases must pass first: for example a short spread of 5,000 USDT a leg where ETH falls from 100 to 95 and BTC rises from 200 to 202 has to make exactly 300 USDT, and 280.20 after a 0.1% fee per fill. The fast rolling regression is compared with a plain refit on 953 bars and agrees to within 0.000000003. The z-score on 292 bars is recomputed with every later bar removed and must not change, the same idea as the engine's look-ahead check. Each simulation is run twice and must match itself. And the BTCUSDT file's SHA-256 has to equal the one recorded in the engine's published results.

To rerun it, clone and install the engine as its README describes, then from this site's root folder:

```
../perpmath-engine/.venv/Scripts/perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/pairs-trading/data
../perpmath-engine/.venv/Scripts/perpmath download ETHUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/pairs-trading/data
../perpmath-engine/.venv/Scripts/python research/pairs-trading/pairs_backtest.py
```

We ran it on 21 November 2026 (UTC). Every trade is in `pairs_trades.json` next to the script. The engine itself, and the testnet-only order runner that goes with it, are on the [bot page](/bot/); its single-symbol reports are under [backtests](/backtests/).

## FAQ

### Is pairs trading profitable in crypto?

<!-- unique:firsthand-data -->
This test cannot say. With 78 and 35 trades the samples are too small, the after-cost result was a loss in both, and the before-cost average of 0.03% a trade is a fifth of the round-trip cost. A rule that survives would need wider gaps, cheaper fills or both, and it would still have to hold up on data it was not designed on.

### What z-score should a pairs trade use for entry and exit?

Entry near 2 and exit at 0 is the common textbook choice and the one we fixed in advance. In our hindsight table, moving the entry between 1.5 and 2.5 changed how often the rule traded far more than whether it made money.

### Is pairs trading market neutral?

Only as neutral as the hedge ratio is right. In our test the estimated ratio ranged from 0.05 to 2.76 over the year, and some trades were close to a one-coin position. "Market neutral" describes the design, and the hedge ratio on the day decides whether a given trade lives up to it.
