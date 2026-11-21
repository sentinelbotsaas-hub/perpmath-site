---
title: "Silver bullet strategy: ICT's three windows, 162 backtests"
slug: "silver-bullet-strategy"
description: "The ICT silver bullet strategy as a fair value gap rule inside three New York hours, run on 15, 5 and 1-minute BTCUSDT bars. Every readable block lost after costs."
date: "2026-12-03"
lastmod: "2026-12-03"
lang: "en"
category: "Backtests"
tags: ["silver bullet strategy", "ICT silver bullet", "fair value gap", "kill zones", "backtest", "BTCUSDT"]
keywords: ["silver bullet strategy", "ict silver bullet", "silver bullet trading strategy", "ict silver bullet time", "silver bullet backtest"]
tldr: "The ICT silver bullet strategy is a fair value gap entry taken inside one of three one-hour windows in New York time: 03:00 to 04:00, 10:00 to 11:00 and 14:00 to 15:00. We coded the clock part as the open-source engine's fair value gap rule with a time filter and ran it on one year of BTCUSDT, 18 November 2025 to 18 November 2026. On 15-minute bars it traded 71 times, too few to read. On 5-minute bars 300 in-sample trades lost 46.82% and 144 out-of-sample trades lost 18.08%. On 1-minute bars 2,447 and 1,116 trades lost 97.43% and 79.68%. With fees and slippage at zero the 1-minute version returned -2.66% and +2.23%, which can't be told apart from zero. Run on each of the 24 hours of the day by itself, the three taught hours ranked 4th, 15th and 24th before costs on 1-minute bars."
---

<!-- unique:firsthand-data -->
71 trades in a year. That is everything the ICT silver bullet produced on 15-minute BTCUSDT bars once we wrote it as a rule, and it explains why the people who teach it use 1-minute charts. So we ran it there as well: 3,563 trades, and an account that went from 10,000 USDT to 256.61 in the first 70% of the year. The clock was not the problem and it was not the cure. The same rule lost just as much per trade at every other hour of the day.

## What is the ICT silver bullet strategy?

The silver bullet is an entry model from [ICT trading](/learn/ict-trading/) that is defined by the clock: inside a fixed one-hour window, wait for a [fair value gap](/learn/fair-value-gap/) to form and enter when price comes back to it. ICT is The Inner Circle Trader, the name Michael J. Huddleston teaches under. The model is a narrower relative of the [kill zones](/learn/ict-kill-zones/), which are the same idea with windows of two to four hours.

LuxAlgo's [library entry](https://www.luxalgo.com/library/concept/silver-bullet/) (checked 22 November 2026) lays out the fuller sequence. Before the window, mark where orders are likely to rest, such as untouched session highs and lows. Inside the window, wait for a [sweep](/learn/liquidity-sweep/) of one of those levels or a clear shift in structure. Enter on a fair value gap left by the move away, put the stop beyond the swing or beyond the far edge of the gap, and aim for the liquidity on the opposite side. If no valid gap forms before the hour is over, there is no trade.

That entry says the model was popularized through Huddleston's content in the early 2020s. We could not find a dated primary source for the rules, so everything here is attributed to the pages that print it.

## Silver bullet times in New York, UTC and London

There are three windows, all one hour long and all quoted in New York time. LuxAlgo's open-source [ICT Silver Bullet script](https://www.tradingview.com/script/fq4wSUev-ICT-Silver-Bullet-LuxAlgo/) on TradingView (published 4 July 2023, checked 22 November 2026) names them the London open, AM session and PM session silver bullets, and [AudaCity Capital's guide](https://audacity.capital/trading-guides/ict-silver-bullet-strategy/) (updated 24 September 2026, checked 22 November 2026) lists the same three.

| Window | New York time | UTC, winter (EST) | UTC, summer (EDT) |
| --- | --- | --- | --- |
| London open | 03:00-04:00 | 08:00-09:00 | 07:00-08:00 |
| AM session | 10:00-11:00 | 15:00-16:00 | 14:00-15:00 |
| PM session | 14:00-15:00 | 19:00-20:00 | 18:00-19:00 |

New York moves between UTC-5 and UTC-4 on the second Sunday of March and the first Sunday of November, so each window sits one UTC hour earlier in summer. In London the windows are 08:00, 15:00 and 19:00 for most of the year and an hour earlier during the weeks when the two countries are on different sides of their clock change. A test that hard-codes UTC hours is testing a different hour for part of the year; ours converts every bar to New York time and checks itself on a January date, a July date and both switch days.

<!-- unique:cross-reference -->
One source strays. An open-source script by TradingFinder, [Silver Bullet ICT Strategy](https://www.tradingview.com/script/yjZlKGfb-Silver-Bullet-ICT-Strategy-TradingFinder-10-11-AM-NY-Time-FVG/) (published 17 November 2024, checked 22 November 2026), covers only the 10:00 to 11:00 window in its title and introduction, and then speaks of 9:00 to 10:00 and 10:00 to 11:00 in its usage notes. We tested the three windows the other sources agree on.

## What do the silver bullet sources leave open?

Mostly the parts that decide which candles count. The windows are firm. The rest is described in words.

<!-- unique:cross-reference -->
- **Does the entry have to happen inside the hour?** LuxAlgo's two pages and AudaCity's guide all say the gap must form inside the window. LuxAlgo's script hides a gap that has not been retraced by the end of the session, which implies the return has to come inside the hour too. AudaCity says a trade can be opened during the window and take much longer to reach its target, and does not say the entry must be inside.
- **How big must the gap be?** LuxAlgo's script uses a minimum distance of 40 ticks for index futures and 15 pips for forex. Neither translates to a bitcoin perpetual. Its library entry gives no size.
- **Which timeframe?** The script's page says to use anything below 15 minutes and shows 3-minute charts. AudaCity marks levels on a 15-minute chart and executes on 1, 3 or 5 minutes. TradingFinder says 15 minutes or lower.
- **Is a structure shift required?** AudaCity describes confirming a market structure shift as a step some sources skip.
- **Does it work?** LuxAlgo's entry says no audited public statistics exist and that win rates quoted online should be treated as marketing until shown otherwise. AudaCity traces a 55% to 65% win rate quoted by another guide to that author's own observation and says it does not represent a study.

LuxAlgo's entry also says that instruments without a meaningful New York cadence, most crypto included, fit the model poorly. That is a fair warning about what follows. Bitcoin does keep New York's hours in one respect: our hour-by-hour measurement found its busiest bar at 09:30 New York time. Whether a gap at 10:00 is worth more than a gap at 06:00 is a separate question, and it is the one this article tests.

## The silver bullet rule we coded, and what it leaves out

<!-- unique:operator-view -->
We took the fair value gap rule that already ships with the open-source engine, changed nothing in it, and added a clock. The parameters are the shipped ones and the windows are the three above. All of it was written into the research script on 21 November 2026 (UTC), before the first run, and run once.

```
windows    03:00-04:00, 10:00-11:00, 14:00-15:00 New York time
           a bar is inside a window when its open time is

gap        the engine's fair value gap: low[3] > high[1], or the mirror image,
           at least 0.5 x ATR(14) tall
formed     the gap's third candle is inside a window;
           the return may come any time in the next 96 bars
strict     formed, and the return bar is inside the same window that day;
           a gap with no return by the end of the hour is dropped

entry      the return bar closes on the right side of the gap:
           market order at the next bar's open
stop       beyond the far edge of the gap, plus 0.1 x ATR
target     2 x risk; one position at a time
```

These two filters, `sb_formed` and `sb_strict`, are defined in our research script, `research/silver-bullet-strategy/silver-bullet_research.py`. They are not among the strategies shipped with the engine. The script registers them at run time and then calls the engine's own command line, so the look-ahead check, the fills, the costs and the sample split are the engine's. The underlying rule is [fvg.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/b1c4fd990633343427fe45df30fa9c6206cd2961/src/perpmath/strategies/fvg.py) (checked 22 November 2026), the one behind the published [FVG backtest](/backtests/fvg-btcusdt/). With the clock switched off, our copy gives exactly the engine's signals on all 35,040 bars; the script stops if it doesn't.

<!-- unique:field-note -->
What this leaves out is most of the model. There is no sweep before the gap, no map of liquidity, no target at the opposite pool and no judgement about which gaps to skip. The stop is the tight variant, at the far edge of the gap. So this is a test of one claim only: that a fair value gap entry is better inside these three hours than outside them. It is the claim that makes the silver bullet a clock model, and it is the only part a program can check without someone's eyes.

## How often does a silver bullet setup appear?

<!-- unique:firsthand-data -->
On 15-minute bars, almost never; on 1-minute bars, about five times an hour. A year holds 1,095 windows. The table counts, for each bar size, the gaps whose third candle fell inside a window and what became of them under the strict reading. The 5-minute and 1-minute candles are one full year each from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 105,120 and 525,600 bars with none missing, over the same dates as the 15-minute file.

| Bars | Windows with a gap | Gaps formed | Returned to inside the hour | Failed inside the hour | No return by the end | Entry signals |
| --- | --- | --- | --- | --- | --- | --- |
| 15m | 235 of 1,095 | 267 | 72 | 11 | 184 | 72 |
| 5m | 577 of 1,095 | 862 | 458 | 48 | 356 | 456 |
| 1m | 1,092 of 1,095 | 7,760 | 5,500 | 909 | 1,351 | 5,420 |

<!-- unique:original-calc -->
A one-hour window holds four 15-minute bars. A gap needs three candles and then a fourth to come back, so there is barely room: 6.58% of windows produced an entry. We wrote that prediction into the script before running it, and the 15-minute run duly made 50 in-sample trades and 21 out-of-sample. On 1-minute bars 1,087 of the 1,095 windows produced at least one entry and the average window produced 4.95 signals. The model is taught as one trade per window. A mechanical rule on 1-minute bars has no way to know which of the five is the one.

## Backtest results on 15, 5 and 1-minute bars

<!-- unique:firsthand-data -->
Every block with enough trades to read lost money after costs, and the 1-minute version lost nearly everything. "Unfiltered" is the engine's rule with no clock, as the baseline. In-sample is the first 70% of the year and out-of-sample starts on 31 July 2026. Costs are 0.055% per fill, the VIP 0 taker rate in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. Each cell is in-sample / out-of-sample, the last two columns repeat the run with both costs at zero, and an asterisk marks a block with fewer than 100 trades.

| Bars | Rule | Trades | Return | t-stat | Zero-cost return | Zero-cost t |
| --- | --- | --- | --- | --- | --- | --- |
| 15m | Unfiltered | 801 / 304 | -66.94% / -42.86% | -4.93 / -5.23 | +6.03% / -10.05% | 0.38 / -0.97 |
| 15m | Formed | 141 / 63* | -26.34% / -18.86%* | -3.41 / -5.03* | -10.72% / -9.17%* | -1.27 / -2.27* |
| 15m | Strict | 50* / 21* | -12.03%* / -8.77%* | -2.86* / -3.96* | -5.72%* / -6.06%* | -1.34* / -2.80* |
| 5m | Unfiltered | 2,851 / 1,216 | -98.54% / -82.49% | -18.46 / -13.68 | +0.71% / +14.61% | 0.14 / 1.17 |
| 5m | Formed | 440 / 211 | -57.47% / -19.76% | -11.00 / -3.59 | -18.54% / +11.92% | -2.73 / 1.96 |
| 5m | Strict | 300 / 144 | -46.82% / -18.08% | -10.02 / -4.31 | -16.74% / +2.60% | -3.01 / 0.60 |
| 1m | Unfiltered | 18,184 / 8,134 | -100.00% / -100.00% | -107.60 / -89.41 | +40.00% / +37.61% | 1.56 / 2.71 |
| 1m | Formed | 2,776 / 1,268 | -98.38% / -83.28% | -40.76 / -31.75 | -1.09% / +3.40% | -0.07 / 0.68 |
| 1m | Strict | 2,447 / 1,116 | -97.43% / -79.68% | -38.30 / -30.36 | -2.66% / +2.23% | -0.26 / 0.49 |

The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of the average net return per trade against zero; under 2 in absolute value means the average can't be told apart from zero. The asterisked blocks are flagged by the engine as insufficient samples and none of their numbers should be read. Trade counts in the zero-cost runs differ by a few percent, since trades end at different bars.

<!-- unique:original-calc -->
The first thing I looked for was whether the clock helps, and it doesn't show. On 1-minute bars the average trade lost 0.1463% of its notional with no clock and 0.1494% under the strict rule, in-sample; out-of-sample it was 0.1437% and 0.1425%. The filter made the rule trade less, 2,447 times against 18,184, and that is the whole reason the account lasted longer. On 5-minute bars the strict rule was worse than no clock in-sample, 0.2096% against 0.1472% per trade.

<!-- unique:original-calc -->
With costs removed, the strict 1-minute rule sits on zero in both periods, and the strict 5-minute rule is negative in-sample with a t-statistic of -3.01 and flat out-of-sample. The one pre-cost number that looks like something belongs to the rule without a clock: +40.00% and +37.61% on 1-minute bars. That is an average of 0.0017% and 0.0032% per trade, against a round trip cost of 0.15%. It is 47 to 88 times too small to trade, and with the published costs the same run ended with nothing left in the account.

The engine's look-ahead check passed on all 162 runs. On the 15- and 5-minute silver bullet runs it cut the data after every signal bar. On the 1-minute runs it stopped at its default cap, 4,005 of the 5,420 signal bars for the strict rule, and the rest were not checked. All engine runs are from 21 November 2026 (UTC), version 0.2.2.

## Why does the 1-minute version lose fastest?

The stop shrinks with the bar and the cost of a trade stays the same size.

<!-- unique:original-calc -->
A gap on a 1-minute chart is a fraction of the height of a gap on a 15-minute chart, and the stop sits at its far edge. Under the strict rule the median distance from entry to stop was 0.086% of price in-sample on 1-minute bars and 0.179% on 5-minute bars. The round trip of two fees and two fills of slippage is 0.15% whatever the bar size. So the cost was 0.84 times the risk on 5-minute bars and 1.74 times the risk on 1-minute bars. A trade that pays 1.74R to exist needs to win far more often than a 2R target allows.

<!-- unique:firsthand-data -->
Before costs the strict 1-minute rule won 35.46% of its in-sample trades, a little over the 33.33% that a 2R target needs. After costs it won 18.64%, and 1,800 of its 2,447 trades ended at the stop. The account paid 7,357.87 USDT in fees on the way from 10,000 down to 256.61. Put a stop of 0.086% into the [position size calculator](/tools/position-size-calculator/) to see the position it implies for a fixed risk; the fee on that position is the problem in one number.

This is the practical gap between how the model is taught and where it is traded. On the index futures and currency pairs it was written for, costs are a different size relative to a 1-minute gap, and we have not measured them. On a perpetual at taker fees the arithmetic is what you see above.

## Is 10:00 to 11:00 better than any other hour?

No. To give the taught hours something to be compared with, we ran the strict rule on each of the 24 clock hours of the New York day separately, on all three bar sizes, with and without costs: 144 more runs, fixed in advance. Each hour's result is ranked by its average trade over both samples.

| Hour (New York) | 5m rank, zero cost | 1m rank, zero cost | 1m rank, with costs | 1m zero-cost return | 1m zero-cost t |
| --- | --- | --- | --- | --- | --- |
| 03:00 | 20 of 24 | 4 of 24 | 3 of 24 | +6.11% / +5.73% | 1.58 / 2.86 |
| 10:00 | 23 of 24 | 15 of 24 | 13 of 24 | -1.71% / +1.36% | -0.22 / 0.37 |
| 14:00 | 24 of 24 | 24 of 24 | 23 of 24 | -6.68% / -4.47% | -1.57 / -2.21 |
| 04:00 (best on 1m) | 2 of 24 | 1 of 24 | 1 of 24 | +5.80% / +10.41% | 1.57 / 3.45 |

<!-- unique:firsthand-data -->
After costs there is nothing to rank. On 1-minute bars all 48 hour-blocks lost, with t-statistics from -37.44 to -10.51, and on 5-minute bars all 48 lost as well. On 15-minute bars 11 of the 48 blocks show a small gain, each on 3 to 27 trades, which is too few to mean anything; for what it is worth, 10:00 came last of the 24 there.

<!-- unique:original-calc -->
Before costs the picture is a scatter around zero with one corner worth describing. On 1-minute bars 27 of the 48 blocks were positive, 4 had a t-statistic of 2 or more and 2 had -2 or less. No hour reached 2 in both samples. Seven of the 24 hours were positive in both, the 03:00 window and the hour after it among them. That is the nearest thing to support for the model in this article, and I would not lean on it: the 03:00 average was 0.0079% per trade, 19 times smaller than the cost of making the trade, and on 5-minute bars the same hour ranked 20th. The 14:00 window was last or next to last on both 5-minute and 1-minute bars.

<!-- unique:field-note -->
One caution about my own table, written on 22 November 2026. Twenty-four hours, two samples and three bar sizes are a lot of cells. A few of them will clear a t-statistic of 2 by chance, and I picked the 04:00 row to show after seeing which hour came top. Read it as the size of the noise.

## What this test does not cover, and how to rerun it

It does not test the silver bullet as a discretionary trader runs it. The sweep, the structure shift, the choice of one gap per window and the target at opposing liquidity are all missing, and each of them needs to be written down before anyone can test it. It covers one market and one year in which BTCUSDT fell 29.86%. It uses market orders at the next bar's open, where the model is usually drawn with a limit order at the edge of the gap; the engine has no resting orders. Funding is not modelled. And we ran 5-minute and 1-minute bars but not the 3-minute bars two of the sources show.

To reproduce it, check the open-source engine out next to this site's source and install it:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git perpmath-engine
cd perpmath-engine
python -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then, from the site's root folder:

```
../perpmath-engine/.venv/bin/python research/silver-bullet-strategy/download_candles.py
../perpmath-engine/.venv/bin/python research/silver-bullet-strategy/silver-bullet_research.py
```

<!-- unique:field-note -->
A note on the first of those two lines, from running it on 21 November 2026 (UTC). The plain `perpmath download BTCUSDT 1m` command needs 526 requests for a year and was refused part-way by Bybit's rate limit; the 5-minute download went through. `download_candles.py` calls the engine's own downloader with a pause between pages and a retry on that one error code, and with it the full year arrived: 525,600 bars. The second line runs all 162 backtests; the 1-minute ones spend about 17 minutes each in the look-ahead check for the unfiltered rule and 8 minutes for the filtered ones on our desktop.

The engine itself is described in the [bot section](/bot/), and our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) explains the look-ahead check and the 100-trade rule. A related clock pattern, the [judas swing](/learn/judas-swing/), gets the same treatment on the same data.

## FAQ

### What time is the ICT silver bullet?

Three one-hour windows in New York time: 03:00 to 04:00, 10:00 to 11:00 and 14:00 to 15:00. In UTC they are 08:00, 15:00 and 19:00 in winter and one hour earlier in summer.

### Which timeframe is the silver bullet traded on?

Below 15 minutes. LuxAlgo's script page shows 3-minute charts and AudaCity's guide executes on 1, 3 or 5 minutes. On 15-minute bars our rule found an entry in 6.58% of windows.

### Does the fair value gap have to form inside the window?

Yes, by every source we read. They differ on whether the entry must also come inside the hour, so we ran both readings. Neither one made money.

### What is the win rate of the silver bullet strategy?

<!-- unique:firsthand-data -->
No audited figure exists, according to LuxAlgo's own library entry. Our mechanical version on 1-minute BTCUSDT bars won 18.64% of in-sample trades and 16.58% out-of-sample after costs, against a break-even of 33.33% for its 2R target. With costs at zero it won 35.46% and 35.68%.

### Does the silver bullet strategy work on bitcoin?

<!-- unique:firsthand-data -->
As a clock filter on a fair value gap entry, it did not in our year of data. The strict rule lost 46.82% and 18.08% on 5-minute bars and 97.43% and 79.68% on 1-minute bars, and before costs it could not be told apart from zero. The taught hours ranked 4th, 15th and 24th of 24 on 1-minute bars.

### Is 10:00 to 11:00 the best silver bullet window?

Not on BTCUSDT. Before costs it ranked 15th of 24 hours on 1-minute bars and 23rd on 5-minute bars, and after costs it lost 68.67% in-sample on 1-minute bars. That is a result about a clock and a gap, and the model as taught asks for a good deal more than those two things.
