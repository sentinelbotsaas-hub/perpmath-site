---
title: "Judas swing and power of 3: counted on 361 BTC days"
slug: "judas-swing"
description: "The judas swing and the power of 3 (AMD) written as rules a program can check, then counted on 361 days of BTCUSDT: 240 false moves, 53 that ran to the other side."
date: "2026-12-03"
lastmod: "2026-12-03"
lang: "en"
category: "Backtests"
tags: ["judas swing", "power of 3", "AMD", "accumulation manipulation distribution", "BTCUSDT", "backtest"]
keywords: ["judas swing", "power of 3 trading", "accumulation manipulation distribution", "ict judas swing", "amd trading"]
tldr: "A judas swing is ICT's name for a false move early in the trading day: price breaks out of the overnight range one way, comes back inside, and is expected to run the other way. It is the manipulation step of the power of 3, also called AMD (accumulation, manipulation, distribution). We wrote it as a rule on BTCUSDT 15-minute bars: break the 20:00 to 00:00 New York range between 00:00 and 05:00, close back inside, then reach the far side of that range before 16:00 without first passing the false move's extreme. In 361 days from 19 November 2025 to 16 November 2026 there were 240 such false moves. 53 of them (22.08%) completed and 182 (75.83%) failed. The same bars replayed with random directions complete 19.78% of the time, and the same rule anchored at the other 23 hours of the clock has a median of 23.34%."
---

<!-- unique:firsthand-data -->
How often does bitcoin fake one way out of its overnight range and then run all the way to the other side? On the rule we wrote down before looking, 53 times in 361 days. The fake itself is common: 240 of those days had one. What usually came next was a second push through the same side, 182 times, and that is roughly what a coin-flip version of the same candles does too.

## What is a judas swing?

A judas swing is a false move near the start of a trading session: price pushes through an obvious level, fails to stay there, and reverses. The name belongs to [ICT trading](/learn/ict-trading/), the method Michael J. Huddleston teaches as The Inner Circle Trader, and the betrayal in it is aimed at whoever followed the first push.

The [LuxAlgo library entry](https://www.luxalgo.com/library/concept/judas-swing/) (checked 22 November 2026) describes it as a [liquidity sweep](/learn/liquidity-sweep/) with a timing claim attached. It is measured against the midnight New York opening price, and the entry's FAQ says ICT's materials most often place it in the London [kill zone](/learn/ict-kill-zones/), roughly 02:00 to 05:00 New York time. The same page adds that his stated windows vary across different series of teachings, and that the pattern is "an expectation, not a rule".

[TMGM's academy page](https://www.tmgm.com/en/academy/trading-academy/judas-swing) (last updated 20 October 2026, checked 22 November 2026) names the level. In its bullish version the false move breaks below the Asian session low; in the bearish version it breaks above the Asian session high. It gives no clock times for the Asian session and states that there is no universally verified judas swing win rate.

## What is the power of 3 (AMD)?

The power of 3 is a three-step template for a trading day: accumulation, manipulation, distribution. AMD is the same thing by its initials. Price is supposed to sit in a range, make a false move out of it, then travel the other way for the real move of the day.

LuxAlgo's [AMD entry](https://www.luxalgo.com/library/concept/accumulation-manipulation-distribution/) (checked 22 November 2026) gives the common intraday reading: Asia accumulates, the London open manipulates, and London into New York distributes. The judas swing is the middle step taken by itself. The open the template hangs on is, by that page, commonly the midnight New York open for the day.

The entry is frank about what kind of thing this is. It calls the template descriptive, not mechanical, says the anatomy is easy to see on a finished daily candle, and notes that the third phase is what validates the second. Put plainly, you know a move was the manipulation once the distribution has happened.

## Where do the judas swing sources stop being checkable?

At every number. A program needs to know which range, which hours, how far through, how long the return may take and where the move is supposed to end, and the descriptions above give none of these as figures.

<!-- unique:cross-reference -->
The tools that had to choose did not choose alike. Two open-source TradingView scripts both carry the name. [TradingFinder's](https://www.tradingview.com/script/TYoIs4Q3-Judas-Swing-ICT-01-TradingFinder-New-York-Midnight-Opening-M15/) (published 13 October 2024) builds its range from the 15 minutes after New York midnight and wants price to touch one side, then the other, then break back. [Flux Charts'](https://www.tradingview.com/script/vT3NRUzp-ICT-Judas-Swing-Flux-Charts/) (published 4 October 2024) looks for a break of recent pivot highs or lows between 09:30 and 09:45 in New York and requires a [fair value gap](/learn/fair-value-gap/) the other way. Neither uses the Asian range that TMGM's page describes. Three pages and two scripts give at least three different reference levels and three different times of day. All five pages were checked on 22 November 2026.

We could not find a dated primary source in which Huddleston fixes either pattern in numbers, so nothing below is attributed to him. What follows is one way to write the story down, close to the LuxAlgo and TMGM descriptions.

## The judas swing as a rule a program can check

<!-- unique:operator-view -->
We fixed the rule on 21 November 2026 (UTC), before the first run on data, and wrote it into the docstring of the research script. Times are New York wall-clock time, with daylight saving handled, on 15-minute bars.

```
range      the 16 bars from 20:00 to 00:00        RH = highest high, RL = lowest low
window     the 20 bars from 00:00 to 05:00
deadline   16:00

1. break     first window bar with high > RH or low < RL
             (none: "no break";  both on one bar: set aside)
2. reclaim   first bar from the break bar on, still in the window,
             that CLOSES back inside the range
             (none: "break held")
             break + reclaim = one judas swing
             E = the furthest price reached from break to reclaim
3. outcome   on the bars after the reclaim, before the deadline:
             completed   price trades through the OTHER side of the range first
             failed      price trades beyond E first (or does both on one bar)
             neither     16:00 arrives first
```

<!-- unique:operator-view -->
Three choices in there are ours and are debatable. The range is the four hours before midnight, which is the Asian window that LuxAlgo's kill zone entry and two scripts use. The window runs from the midnight open to the end of the London kill zone. "Completed" asks for the far side of the range, which is a strict reading of distribution, and it has to happen before price goes back beyond the false move, since that is where a trader's stop would sit.

For the power of 3 we used a whole-day version on the 64 bars from 00:00 to 16:00. A bullish day sets its low inside the 00:00 to 05:00 window, closes above the midnight open, and closes in the top third of the day's range. A bearish day is the mirror image.

## 361 days of BTCUSDT: how often each step happens

<!-- unique:firsthand-data -->
Two days in three had a judas swing, and about one judas swing in five completed. The data is the file behind every backtest on this site: 35,040 BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 18 November 2025 to 18 November 2026. The count covers the 361 New York days from 19 November 2025 to 16 November 2026, leaving out the two days on which New York's clocks change.

| What happened | Days | Share |
| --- | --- | --- |
| Range not broken between 00:00 and 05:00 | 68 | 18.84% of 361 |
| Broken, and never closed back inside by 05:00 | 53 | 14.68% of 361 |
| Broken, then closed back inside: a judas swing | 240 | 66.48% of 361 |
| Judas swing completed (far side of the range first) | 53 | 22.08% of 240 |
| Judas swing failed (beyond the false move first) | 182 | 75.83% of 240 |
| Neither by 16:00 | 5 | 2.08% of 240 |

No bar broke both sides of the range at once. The false moves split almost evenly, 122 up and 118 down.

<!-- unique:original-calc -->
The completion rate has a plain explanation, and it is distance. At the close of the reclaim bar, the far side of the range was a median 4.26 times as far away as the extreme of the false move. A price with no memory reaches the nearer of two levels first in proportion to the distances, which here gives 1 in 5.26, or 19.0%. The rule delivered 22.08%.

<!-- unique:firsthand-data -->
Two details we looked at after the first run, as breakdowns of the same 240 days. In 151 of them the bar that broke the range also closed back inside it, which makes it a one-bar sweep. And the London kill zone did not help: 192 of the 293 breaks came before 02:00, and of the 75 judas swings whose break came between 02:00 and 05:00, 15 completed. That is 20.00%, against 23.03% for the 165 that broke earlier.

## Is New York midnight special? Two baselines

No. We set two comparisons in advance. The first moves the whole template around the clock: the same four-hour range, five-hour window and sixteen-hour deadline, anchored 1 to 23 hours after New York midnight, on the same days. If midnight matters, its row should look different from the other 23. The second replays each day 500 times with the direction of every 15-minute bar flipped at random, which keeps every bar's size and position and removes any tendency to reverse.

| Measure | New York midnight | Other 23 hours: median (range) | Random directions: mean (95% of replays) |
| --- | --- | --- | --- |
| Days with a judas swing | 66.48% | 70.36% (57.34 to 83.93) | 73.84% (69.66 to 78.12) |
| Breaks that closed back inside | 81.91% | 85.89% (78.32 to 89.29) | 85.34% (81.48 to 88.86) |
| Judas swings that completed | 22.08% | 23.34% (12.50 to 32.41) | 19.78% (15.40 to 24.52) |
| Judas swings that failed | 75.83% | 72.69% (63.79 to 75.67) | 79.05% (74.33 to 83.53) |
| Day closed against the false move | 47.92% | 43.48% (37.02 to 48.35) | 45.23% (39.66 to 51.10) |
| Power of 3 days | 37.12% | 43.77% (31.30 to 49.86) | 35.13% (30.47 to 40.31) |

<!-- unique:original-calc -->
On completion, New York midnight ranks 17th of the 24 anchors, and its failure rate of 75.83% is the highest of all 24. Against random directions, 22.08% sits inside the band that 95% of the replays fall in. The one place the real data leaves that band is the first row: the real year had fewer judas swings than the shuffled version, 66.48% against a band that starts at 69.66%. Most of that gap comes one step earlier. Bitcoin broke out of its evening range on 81.16% of days, and the replays do it on 86.57%. The real overnight hours were a little more range-bound than chance, which is the accumulation half of the story and the only half we could see.

I should own up to the reading I had in mind before the run. I expected a completion rate near a third, since the 2R trades elsewhere on this site win about 30% of the time. That ignored how far away the other side of the range is.

The best of the 24 anchors was nine hours after midnight, at 32.41%. With 24 tries one of them has to be top, and we would not read it as a finding.

## Does the false move tell you the day's direction?

<!-- unique:firsthand-data -->
Barely, and not in a way that separates it from chance. Of the 240 judas swing days, the last close before 16:00 was on the opposite side of the midnight open from the false move on 115, or 47.92%. A coin gives 50%, and the random-direction replay gives 45.23%.

<!-- unique:original-calc -->
The stronger signal runs the other way, and it is the dull one. On the 53 days when the break held to 05:00, the day closed on the break's side of the midnight open 42 times, 79.25%. A break that holds is already beyond the range by 05:00, so the comparison is unfair to begin with, and the replay produces about the same figure (74.05% on average).

<!-- unique:firsthand-data -->
As a daily template, the power of 3 fit 134 of the 361 days, 37.12%: 68 bullish and 66 bearish. Random directions produce 35.13% on average, with 95% of replays between 30.47% and 40.31%. More than a third of all days look like accumulation, manipulation and distribution when each bar's direction is decided by a coin. That is why the template is so easy to find on a finished chart.

## Trading the judas swing through the backtest engine

<!-- unique:firsthand-data -->
It lost money after costs and did nothing measurable before them. To check the count against an account, we wrote the rule as a strategy: at the close of the reclaim bar, enter against the false move with a market order at the next open, stop at the false move's extreme plus 0.1 x ATR(14), target at twice the risk. That strategy is in our research script, `research/judas-swing/judas-swing_research.py`; it is not one of the strategies shipped with the open-source engine. It was registered at run time and run through the engine's own command line (version 0.2.2, 21 November 2026 UTC), so the look-ahead check, the fills and the costs are the engine's. The check cut the data after all 242 signal bars and passed. Two of those signals came while a position was already open and were skipped, which leaves the 240 trades.

| Run | Sample | Trades | Win rate | Avg R | t-stat | Return | Max drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Published costs | In | 164 | 28.66% | -0.75 | -3.74 | -27.69% | 28.52% |
| Published costs | Out | 76* | 32.89% | -0.71 | -2.34 | -10.18% | 12.09% |
| Zero costs | In | 164 | 33.54% | +0.01 | -0.54 | -4.84% | 10.62% |
| Zero costs | Out | 76* | 35.53% | +0.07 | -0.19 | -0.93% | 4.52% |

The asterisk marks fewer than 100 trades. The engine flags that block as an insufficient sample and none of its numbers should be read, the positive average R included. In-sample is the first 70% of the year and out-of-sample starts on 31 July 2026.

<!-- unique:original-calc -->
Published costs are 0.055% per fill, the VIP 0 taker rate in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. The stop was a median 0.274% of price away in-sample, so the 0.15% round trip cost 0.55R before the trade had moved. With costs at zero, the in-sample win rate was 33.54% against the 33.33% that a 2R target needs to break even. The [risk-reward calculator](/tools/risk-reward-calculator/) shows that break-even arithmetic for any target.

## Has anyone else tested the judas swing?

We found one published count, and it points the same way. A [post on the MQL5 blog](https://www.mql5.com/en/blogs/post/778873) by Dobril Karakanchev, dated 31 October 2026 (checked 22 November 2026), tested gold on hourly data from 2008 to 2026 with the same 20:00 to 00:00 Asian range and 16:00 cut-off we used. It reports that when London broke above the Asian range, New York then fell on 48.9% of 2,026 days, and that a judas test comparing the 00:00 to 05:00 move with the rest of the day held on 50.0% of 4,841 days. For bitcoin from 2018 to 2026 it gives 48.2%, 52.3% and 50.1%, without naming the data source.

Two cautions. We have not reproduced those numbers, and the rules differ from ours: hourly bars, and a question about the later session's direction, not a race to the far side of the range. The post also promotes the author's paid trading software, so it is not a disinterested source. We cite it because it publishes counts, which the definitional pages do not.

## What this count leaves out, and how to rerun it

The rule above has no judgement in it. It takes every break of the evening range, where the sources ask for displacement, a structure shift, a daily bias. A trader who uses those filters is running a different rule, and until it is written down nobody can count it. The year also matters: BTCUSDT fell 29.86% over the period, and one year of one market is 361 observations, not a law.

A bitcoin perpetual has no Asian session and no London open in the sense a currency desk does. Our [kill zones measurement](/learn/ict-kill-zones/) found the 02:00 to 05:00 window quieter than the average hour on this market. The pattern may behave differently on the forex pairs it was described for; we did not test them.

To reproduce the numbers, check the open-source engine out next to this site's source and download the candles:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git perpmath-engine
cd perpmath-engine
python -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then, from the site's root folder:

```
../perpmath-engine/.venv/bin/python research/judas-swing/judas-swing_research.py
```

The script checks itself on hand-made days, one per outcome, and stops if its strategy's signals are not exactly the reclaim bars the counting code finds. The engine is described in the [bot section](/bot/), every published run is under [backtests](/backtests/), and the closest shipped strategy is the [liquidity sweep backtest](/backtests/liquidity-sweep-btcusdt/). The one-hour cousin of this idea is the [silver bullet](/learn/silver-bullet-strategy/).

## FAQ

### What is a judas swing in simple terms?

A fake-out at the start of the day. Price breaks an obvious level, pulls in the traders who follow breakouts and stops out the ones on the other side, then comes back. The ICT method expects the real move to go the opposite way.

### What time does the judas swing happen?

Sources most often place it in the London kill zone, 02:00 to 05:00 New York time, measured against the midnight New York open. Others use the 15 minutes after midnight or 09:30 to 09:45.

### Is a judas swing the same as a liquidity sweep?

It is a sweep with a clock and a prediction attached. LuxAlgo's entry puts it as every judas swing being a sweep while most sweeps are not judas swings. In our count 151 of the 240 were a single bar that broke the range and closed back inside.

### What does AMD stand for in trading?

Accumulation, manipulation, distribution. It is the same three-step day template that ICT calls the power of 3.

### How often does a judas swing lead to a reversal?

<!-- unique:firsthand-data -->
On our rule and one year of BTCUSDT, 22.08% of judas swings reached the far side of the evening range before price went back beyond the false move, and 75.83% went back beyond it first. The day closed against the false move 47.92% of the time.

### Does the power of 3 work on bitcoin?

<!-- unique:firsthand-data -->
It describes 37.12% of the days in our year, and it describes 35.13% of the same days with every bar's direction randomised. A mechanical trade built on its middle step lost 27.69% in-sample after costs. If a template fits a coin-flip chart about as often as the real one, what is it telling you that the coin isn't?
