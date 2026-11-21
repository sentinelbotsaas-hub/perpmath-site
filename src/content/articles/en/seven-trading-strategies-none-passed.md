---
title: "Seven trading strategies tested, none passed: a post-mortem"
slug: "seven-trading-strategies-none-passed"
description: "Seven pre-registered research lines on Nasdaq, gold and crude oil futures: thresholds, t-statistics, sample sizes, and the replay bug behind the one rising signal."
date: "2026-11-25"
lastmod: "2026-11-25"
lang: "en"
category: "Backtests"
tags: ["post-mortem", "backtest", "pre-registration", "multiple testing", "trading costs", "futures"]
keywords: ["trading strategy post-mortem", "failed trading strategies", "backtest overfitting", "pre-registered backtest", "out-of-sample test"]
tldr: "In September 2026 we ran seven pre-registered research lines on micro Nasdaq, micro gold and crude oil futures. None cleared its threshold: three were killed, a fourth was killed in three of its four session windows, one had no evidence, one was unproven and one stayed under observation at t = 1.77. The only signal whose t-statistic rose with sample size (1.17, 1.49, 2.01) fell to 0.67 once a replay bug at the daily file boundary was fixed."
---

<!-- unique:firsthand-data -->
For three weeks one of our signals did what a real edge is supposed to do. Its t-statistic climbed as trades came in: 1.17 at 25 trades, 1.49 at 36, 2.01 at 54. Then a reviewer asked at which minute of the hour the entries happened, and the answer took the signal apart. With the replay fixed, the same rule on the same days scored 0.67.

That was line E of seven. In September 2026 we ran seven research lines looking for a trading edge, each with its hypothesis and pass mark written down before any number was computed. None passed. This page records what each line claimed, what came out, and where we came close to believing something false.

## What was tested, on which markets, under what rules

The seven lines, lettered A to G, were run on 5 September 2026 and corrected the next day. The instruments were CME Group futures: micro Nasdaq-100, micro gold and crude oil. They are not crypto. This site is about crypto perpetual futures, and nothing below is a result about BTCUSDT or any coin. What carries over is the method: fixed rules, measured costs, a held-out sample, one look at it. The same method on a perpetual is in our [fair value gap backtest](/learn/fair-value-gap/), which also lost.

<!-- unique:firsthand-data -->
The data came from three places. Daily gold from Yahoo Finance: the front-month future from 30 August 2000 to 4 September 2026 (6,528 bars), with the GLD fund as a cross-check. One-second quotes and trade prints from Databento's CME Globex feed: 13 months of micro gold, plus trades on 12 sample days for gold and 28 for Nasdaq. And a tick tape we recorded ourselves over 22 trading days, 6 August to 4 September 2026.

Several lines trade one signal, an order-flow fade. When the z-score of aggressive buying minus aggressive selling over the last 300 seconds reaches 1.5, trade against it and hold 300 seconds, with no stop and at most five trades per window. The windows are one hour each: Asia (20:00 to 21:00 New York time), London (03:00 to 04:00), the metals open (08:20 to 09:20) and the US equity open (09:30 to 10:30).

The plan fixed the rules of evidence first. Judge a signal by which way its t-statistic moves as the sample grows, more than by its level. Write the hypothesis, threshold and sample into the report before running. Measure costs from quotes, never estimate them.

It was specific about multiple testing too. Four instruments times four windows is 16 cells, so one cell needs a t-statistic near 2.95 after a [Bonferroni correction](https://www.itl.nist.gov/div898/handbook/prc/section4/prc473.htm) (NIST handbook, checked 22 November 2026), and 3.4 on a 72-cell grid. Harvey, Liu and Zhu reach a similar bar another way: their [multiple-testing paper](https://www.nber.org/papers/w20592) (NBER working paper 20592, October 2014, checked 22 November 2026) argues that a newly claimed factor should clear a t-ratio of 3.0, not 2.0.

One convention: no money amounts. Per-trade results are in ticks or index points for a single contract. The file `research/seven-strategies/sources.md` in this site's source lists the report and section behind every number, with the conversions.

## The seven lines in one table

<!-- unique:firsthand-data -->
Each threshold below was written before the run. OOS means out-of-sample, the data held back for one final look.

| Line | Hypothesis | Threshold set in advance | Result | Sample | Verdict |
| --- | --- | --- | --- | --- | --- |
| A | Gold trends over 20 to 250 days | OOS Sharpe above 0.5, t above 2, same sign in both samples | OOS Sharpe 0.22, t 0.80 (in-sample 0.95, t 3.26) | 3,271 OOS days | Killed, not disproved |
| B | Gold's 60-second momentum reverses and pays after a 2-tick round trip | Net average above 2 ticks and t above 2, in both judged cells | All hours -2.15 ticks, t -6.14. US open +0.15 ticks, t +0.07 | 27,247 and 1,324 OOS trades | Killed |
| C | The Nasdaq US-open fade survives realistic timing | t above 2 keep, 1.5 to 2 observe, below 1.5 stop | t 1.77 (2.46 with instant fills) | 110 trades, 22 days | Observe, no size increase |
| D | Skipping trend days improves the fade's worst days | Worst day better by over 30%, average no worse | 41% on the ideal replay, 23% on the realistic one | 4 trigger days in 22 | Unproven |
| E | Gold follows order flow in the Asia hour (z at least 2, hold 900 s) | One cell only, t above 2 | t 2.01 on the flawed replay, 0.67 fixed | 54 trades, then 60 | Killed |
| F | The fade on crude oil after measured spread, four windows | Net t above 2. Kill if net average below 0 at 40 or more trades | Three windows net negative. Metals open +2.87 ticks, t 1.17 | 40 to 52 trades per window | Three windows killed, one accumulating |
| G | Price continues after large gold trades, more than on Nasdaq | Gold 60 s continuation above 0 with t above 2, and Welch t above 2 | Gold -1.30 ticks, t -4.56 (a reversal). Welch +0.96 | 8,562 gold events | No evidence |

<!-- unique:original-calc -->
The count: A, B and E killed outright, three of F's four windows killed and the fourth short of its sample, G with no evidence, D unproven, C under observation. Zero lines reached "passed".

## Line E: the rising t-statistic was a file boundary

<!-- unique:firsthand-data -->
The Asia window runs 20:00 to 21:00 in New York, which is 00:00 to 01:00 UTC. Our tape files are cut by UTC day, confirmed from the first and last timestamps of three files. So the Asia window is the first hour of every file, and the replay program restarted its z-score history at each new file.

<!-- unique:firsthand-data -->
A z-score needed more than 60 readings at five-second spacing, so none existed until about 00:05 UTC. For the rest of the hour the mean and standard deviation came from between 61 and 720 readings, all from inside the window. A short history understates the standard deviation and inflates z, which produces entries a full baseline would never produce. The other three windows open 7 to 14 hours into the file and were untouched. The live logger runs continuously and does not reset at midnight, so the replay was trading signals production would never see.

<!-- unique:firsthand-data -->
A reviewer found it by rebuilding the newest block trade by trade. Of its 18 trades, the 14 that closed inside the window summed to slightly below zero. Nearly all the profit sat in the other four, entered between 00:53 and 00:59 UTC on four consecutive sessions. We then reran all 22 days twice: resetting per file, which had to reproduce the old numbers exactly, and carrying the history across files the way production does.

| Block (2026) | Reset per file: trades, avg ticks, t | History carried: trades, avg ticks, t |
| --- | --- | --- |
| 6 to 19 August, the registration sample | 26, +13.85, +0.96 | 32, -0.53, -0.05 |
| 20 to 26 August | 10, +10.65, +0.45 | 12, +33.96, +1.42 |
| 27 August to 4 September | 16, +28.19, +1.83 | 14, -12.57, -0.91 |
| All 22 days | 54, +19.12, +2.01 | 60, +5.49, +0.67 |

The three blocks add up to 52 and 58 trades, two short of the report's own totals in each column. The report does not say which two trades fall outside the blocks.

<!-- unique:firsthand-data -->
The control reproduced 54 trades, +19.1 ticks and t 2.01. With the history carried, the win rate went from 61% to 50% and the three blocks stopped agreeing: -0.05, +1.42, -0.91. The control had no entry in the first five minutes of the window; the corrected run had 11. Its largest block of profit had come from minutes 5 to 15, where the history was shortest.

<!-- unique:operator-view -->
The symptom was printable the whole time. List the minute of the first entry in each window and Asia says 5 where the other three say 0. Nobody printed it. A signal with a rising t-statistic is not one you go looking for reasons to distrust.

## Lines B and G: a t-statistic near -10 that cannot pay the spread

<!-- unique:firsthand-data -->
Line B started from the strongest statistic we had. Across 258 trading days, the daily rank correlation between micro gold's last 60 seconds of price change and its next 300 seconds averaged -0.0222, with a cross-day t of -9.8. It was negative on 73% of days and held out-of-sample at -0.0250 (t -6.9). The reversal is real.

<!-- unique:original-calc -->
It is also tiny. The most negative fifth of momentum readings was followed by +0.84 ticks, and the most positive fifth, traded short, earned +0.17. The round trip costs 2 ticks. The registered rule traded 62,913 times in 13 months, about 206 a day, and averaged -2.15 ticks out-of-sample after costs: roughly zero gross, minus the spread. Passing needed over 4 ticks gross, which the report puts at 4 to 20 times what was there. The t-statistic is large for one reason, about 17,000 sample points a day.

<!-- unique:firsthand-data -->
Line G tested a story we had been telling ourselves, that large gold trades carry information. If so, price should keep going after a burst of one-sided volume. After the 8,564 gold events in the top 1% of one-second signed volume, price 60 seconds later had moved 1.30 ticks against the burst (t -4.56), and 11 of 12 sample days were negative. Nasdaq reversed too, by 1.69 ticks. Following the burst and paying 2 ticks came to -3.30 ticks per trade.

<!-- unique:field-note -->
G had a trap that favoured the hypothesis. A second pass swapped last-trade prices for one-second midpoints, and the snapshot stamped with second T turned out to be the book at the start of that second, before the burst. Measuring from it counts the burst's own impact (3.6 ticks on gold, 7.2 on Nasdaq) as continuation and returns a false +5 to +8 ticks. From the next snapshot, gold's figure is -0.67 ticks, t -2.36.

## Line C: realistic timing, and a rule of thumb that did not replicate

<!-- unique:firsthand-data -->
The US-open Nasdaq fade was the one signal that had ever passed. Line C put measured timing into its replay: enter 4 seconds late, hold 303 seconds. The control first had to reproduce two old results to the digit (60 trades at t 2.59, 55 at t 1.81), and did. Over 22 days the instant-fill version averaged 11.3 index points per trade at t 2.46. With realistic timing it averaged 7.76 points at t 1.77. Timing took 31% of the average trade. The measured spread, half a point, was small beside that.

<!-- unique:original-calc -->
The t-statistic did not climb with the sample. At 8, 10, 12, 14, 16, 18, 20 and 22 days it read 1.01, 1.61, 1.76, 1.58, 1.34, 1.36, 1.49, 1.77. The newest seven days alone gave 0.96, and a single day produced 37% of the total. By the registered wording that is "observe, no size increase".

<!-- unique:cross-reference -->
Here our own records disagree. A [note we published in August 2026](https://edgeautopsy.com/notes/backtest-winrate-timing/) (checked 22 November 2026) says entry delay moved the win rate from 60% in the model to 51% live, and that costs move the average while timing moves the hit rate. In line C's replay the win rate was 55% without the delay and 56% with it. Delay cost size and left the hit rate alone. The August comparison set a live account against an ideal model, with each round then overrunning by about 18 seconds, so it held every difference between the two at once. We have not reconciled the two.

<!-- unique:field-note -->
The first draft also compared the replay with live trades and found an average near zero. The column it read as profit was the z-score at entry, which came out when someone read the format string of the program that writes the journal. That section was withdrawn.

## Line D: a filter that passed on paper

<!-- unique:firsthand-data -->
The fade's two worst days were one-directional days, so line D tested a filter: once ten minutes of z readings exist in the window, if the mean of their signs is beyond 0.70 either way, skip the rest of the day. On the ideal replay the worst day improved by 41% and the average trade rose slightly. Formally, a pass.

<!-- unique:original-calc -->
It triggered on four days. Two were real trend days; on the other two it threw away profitable sessions. So the tail evidence is two observations. On the realistic-timing replay the improvement was 23%, under the 30% line, and a 900-second warm-up in place of the registered 600 made the worst day 25% worse than no filter at all. The verdict was "unproven": a filter that fails under the timing it would run with has not passed. The first draft had said three of the four triggers discarded profit. The count was two, and that correction made the filter look better.

## Line A: 26 years of gold and a verdict that had to be reworded

<!-- unique:firsthand-data -->
Twelve momentum variants were scored on gold up to August 2013, and the best was taken to the remaining 13 years once. In-sample its Sharpe ratio was 0.95 (t 3.26). Out-of-sample it was 0.22 (t 0.80), with an alpha against buy-and-hold of -0.12% a year. Read cumulatively, the out-of-sample t was 0.02 after three years, -1.14 after six and -0.77 after nine, and it ended positive only on the strength of 2024 (+17.4%) and 2025 (+31.1%).

<!-- unique:cross-reference -->
The first draft called this a formal disproof with ample power. Review recomputed it: with 3,271 days the 95% interval for the Sharpe ratio runs from -0.32 to 0.77, and if the true value were 0.5 the test would pass only 42% of the time. The verdict stayed "killed under the registered rule" and the wording became "did not pass", a weaker statement than "does not exist". One alternative split even lets a different variant clear both thresholds (Sharpe 0.54, t 2.16), stopped only by the 12-cell correction at 2.87. For scale, [Moskowitz, Ooi and Pedersen](https://pages.stern.nyu.edu/~lpederse/papers/TimeSeriesMomentum.pdf) (Journal of Financial Economics, 2012, checked 22 November 2026) document this effect in each of 58 futures and forwards and report returns for a diversified portfolio of them. We tested a single market.

## Line F: a wrong cost assumption and a feed that died quietly

<!-- unique:firsthand-data -->
One crude oil tick is worth 20 micro Nasdaq ticks, so the spread decides everything. The plan assumed quotes would be wider at fade entries than across the window. We measured them at 192 of 193 entry timestamps, and the ratio of entry spread to window spread was 1.00 in all four windows. The assumption was false.

<!-- unique:firsthand-data -->
What did move was sample length. Four days of quotes put the London median at 1 tick; all 12 valid days put it at 2. After costs, Asia netted -1.01 ticks per trade, London -4.86 and the US open -0.14, each on 40 or more trades, which was the registered kill condition. The metals-open window netted +2.87 ticks at t 1.17 on 49 trades and needs 144 to 202 to reach t 2.

<!-- unique:field-note -->
Those 12 valid days are out of 22. The crude subscription went dead while the recorder kept writing files for the other instruments. Our documents count the hole three ways: 7 trading days in the plan, 9 days plus a half in two reports, 10 full days once dates were read by file instead of by New York calendar day. The clue had been on screen: a 16-day replay returned the same crude trade count as a 10-day one.

## The errors pointed both ways

<!-- unique:original-calc -->
On an earlier equity backtest of ours, [every bug flattered the result](https://edgeautopsy.com/practice/backtest-audit-en/) (checked 22 November 2026). This round was mixed. Three errors made a strategy or hypothesis look better: the file boundary in E, the midpoint alignment in G, the four-day London spread in F. Three went the other way: D's miscount, A's overstated disproof and F's assumed wider entry spread. The flattering one in E lasted three weeks. The rest were caught within a day of the drafts.

<!-- unique:firsthand-data -->
The review was automated and is unfinished. Each report was read twice, once recomputing numbers from source files and once against its pre-registration, for 96 findings. Of the 48 that went through a rebuttal round, 46 stood. The other 48 never got one.

## November 2026: do the lines work as a portfolio?

<!-- unique:firsthand-data -->
No. In November 2026 we pooled the lines' daily results into sets of 12, 20 and 33 strategies and searched for combinations. No single strategy had t above 2. The best of 4,095 subsets in the 22-day pool reached t 2.13, which sounds like something until the same search runs on copies of the data with every mean set to zero: selection alone gave a median best Sharpe of 9.45, against 7.21 for the real data. Chosen on a training part and scored on the rest, the median Sharpe was negative in all three pools. Bailey and López de Prado describe the mechanism in [The Deflated Sharpe Ratio](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf) (2014, checked 22 November 2026): leave the number of trials out of the calculation and the best one looks better than it is.

The same report notes what line C's signal did next. Run live from 7 September 2026, it stood at 45 trades with t -0.03 by 20 September. The report flags that figure as copied from notes, not pulled again from the broker's records.

## What this round changed in how we test

1. Thresholds and verdict wording go into the report before the run.
2. Costs are measured first, at the entry timestamps, over the whole sample. Four days gave the wrong London number.
3. The held-out sample gets one look, and the report shows what other splits would have said.
4. Data defects are the first suspect, for good news most of all. Compare every trading window with the file boundaries, print the first-entry minute per window, check that each instrument's count grows when days are added, and make the control run reproduce the old numbers before the new run counts.

The step-by-step version for a crypto perpetual is in [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/). The open-source engine behind this site's [backtests](/backtests/) splits in-sample from out-of-sample and charges fees and slippage on every fill; its home here is the [bot section](/bot/). A perpetual has a longer cost list than these futures, with [funding](/data/funding-rate/) settled while you hold. For sizing and loss arithmetic in your own tests there are the [position size calculator](/tools/position-size-calculator/) and the [drawdown calculator](/tools/drawdown-calculator/).

## What this does not show

It does not show that these markets cannot be beaten or that the ideas are worthless. Seven specific rules, on this data, did not clear thresholds set in advance. Most of the tape evidence is 22 days. Line A could not rule out a Sharpe ratio of 0.5. C and one window of F ended these reports unresolved, and half the review findings were never contested. The August note says its live figures came from a simulated evaluation account; the reports do not say what kind of account the September run used. And all of it is futures: anyone testing a perpetual has to measure fees, funding and fills on that market.

## FAQ

### Does this mean these strategies can never work?

No. "Killed" means the line failed a rule written before the run and we stopped spending time on it. For line A the data could not tell a Sharpe ratio of 0.22 from 0.5, and the report says so.

### Why judge by the direction of the t-statistic and not by t above 2?

A reading above 2 turns up by chance when many cells are tested, about 0.8 times in 16 tests by the plan's arithmetic. A real effect should strengthen as trades accumulate. Line E shows the limit of the rule, since its rise came from a bug.

### Do these results apply to crypto perpetual futures?

The numbers do not. They come from CME Group futures with different hours, tick sizes and costs. The method does, and this site applies it to BTCUSDT in its backtest pages.

### Can I reproduce these numbers?

Only in part. The source list in this site's repository gives the report and section for each figure, but the reports and the recorded tape are not public. The Yahoo Finance and Databento data can be obtained by anyone, and several earlier write-ups are public on edgeautopsy.com.
