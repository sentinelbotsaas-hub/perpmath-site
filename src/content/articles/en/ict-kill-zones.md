---
title: "ICT kill zones: the times, tested on a year of BTC"
slug: "ict-kill-zones"
description: "ICT kill zone times from five sources, in New York time and UTC, then a year of BTCUSDT bars: the London kill zone runs quieter than average and 09:00 to 12:00 does not."
date: "2026-12-02"
lastmod: "2026-12-02"
lang: "en"
category: "Backtests"
tags: ["ICT kill zones", "kill zone trading", "London kill zone", "New York kill zone", "BTCUSDT", "trading sessions"]
keywords: ["ict kill zones", "kill zone trading", "london kill zone", "new york kill zone", "ict kill zone times"]
tldr: "ICT kill zones are fixed clock windows, quoted in New York time, in which the method expects the day's important moves. The most cited pair is the London open, 02:00 to 05:00, and New York, 07:00 to 10:00; sources move the edges by up to 90 minutes. We measured one year of BTCUSDT 15-minute bars (18 November 2025 to 18 November 2026). The London window was quieter than the average hour: bar range 0.83 times the all-day mean and 9.99% of turnover in 12.5% of the clock. The busy stretch was 09:00 to 12:00 New York time, with 1.54 times the mean range and 25.33% of turnover. Our published fair value gap and liquidity sweep trades lost money inside the kill zones and outside them."
---

<!-- unique:firsthand-data -->
The busiest fifteen minutes of bitcoin's day start at 09:30 in New York, the minute the US stock market opens.

<!-- unique:firsthand-data -->
On a year of BTCUSDT candles that bar moved 0.63% of price on average, almost three times the quietest slot of the day. The London open kill zone, 02:00 to 05:00 New York time, sits at the other end: all twelve of its 15-minute slots were below the day's average. We measured this on Bybit's public data with a script anyone can rerun, and the hour-by-hour table is further down.

## What are ICT kill zones?

ICT kill zones are fixed windows of the clock in which the ICT method expects the important moves of the day to happen. ICT stands for The Inner Circle Trader, the name Michael J. Huddleston teaches under, and the windows sit around the opens and closes of the big foreign-exchange sessions: Asia, London and New York.

A kill zone is a time filter and nothing more. It says when to look. What to look for comes from the rest of [ICT trading](/learn/ict-trading/): a [liquidity sweep](/learn/liquidity-sweep/) of an earlier high or low, a [fair value gap](/learn/fair-value-gap/) left by the move away from it, and so on. "Kill zone trading" means taking those setups only when the clock is inside a window and ignoring them the rest of the day. Two narrower clock ideas build on the same windows: the [silver bullet](/learn/silver-bullet-strategy/), which is one hour long, and the [judas swing](/learn/judas-swing/), a false move in the hours after New York midnight.

The windows were drawn for currencies and US index futures, markets with an opening bell or at least a morning. A bitcoin perpetual trades every minute of the week.

Whether it keeps New York's clock anyway is a question data can answer, so we asked it.

## ICT kill zone times, source by source

All sources quote the windows in New York time, and they do not agree on the hours. We read five pages that state times, all checked on 22 November 2026: the [LuxAlgo library entry](https://www.luxalgo.com/library/concept/killzones/), [LiteFinance's guide](https://www.litefinance.org/blog/for-beginners/trading-strategies/ict-killzones/) (updated 12 June 2026), [Equiti's explainer](https://www.equiti.com/sc-en/news/trading-ideas/ict-kill-zones-explained-why-london-and-new-york-sessions-matter-to-traders/), and two open-source TradingView scripts, [Session Killzones ICT Concept](https://www.tradingview.com/script/b2jn5B1U-Session-Killzones-ICT-Concept/) by mahirtrade and [ICT Killzones + Macros](https://www.tradingview.com/script/3IAWXYpA-ICT-Killzones-Macros-TakingProphets/) by TakingProphets (published 1 February 2025).

| Kill zone | LuxAlgo | LiteFinance | Equiti | mahirtrade | TakingProphets |
| --- | --- | --- | --- | --- | --- |
| Asian | 20:00-00:00 | 20:00-23:00 | no times | 20:00-00:00 | 20:00-00:00 |
| London open | 02:00-05:00 | 03:00-06:00 | 02:00-05:00 | 02:00-05:00 | 02:00-05:00 |
| New York | 07:00-10:00 | 08:00-11:00 | 07:00-10:00 | 08:30-11:00 | 08:30-11:30 |
| London close | 10:00-12:00 | 11:00-13:00 | no times | none | none |
| New York PM | 13:30-16:00 | none | none | 13:30-16:00 | 13:30-18:00 |

<!-- unique:cross-reference -->
The London open is the only row with a majority, four of five on 02:00 to 05:00. New York has four different answers in five sources, and the earliest and latest starts are 90 minutes apart. LuxAlgo's page is open about this. It says boundaries differ by 30 to 90 minutes across ICT sources and platforms, it gives 08:30 to 11:00 as the New York variant for index futures, and its own introduction describes the Asian window as roughly 8 to 10 pm where its calculation section says 20:00 to 00:00. LiteFinance needs a caution. Its table is headed EDT, New York's summer time, and lists the London window as 07:00 to 10:00 UTC. In winter 07:00 UTC is 02:00 in New York, which is LuxAlgo's window. So its London row may be the same window written for the other half of the year. The page doesn't say, and we have taken its New York column as printed.

<!-- unique:original-calc -->
Add the windows up and the filter gets loose. LuxAlgo's five cover 14.5 of the 24 hours, 60.42% of the clock. Accept any window from any of the five sources and 18.5 hours are inside a kill zone, 77.08%. Only 00:00 to 02:00, 06:00 to 07:00, 13:00 to 13:30 and 18:00 to 20:00 are outside all of them.

We could not find a dated primary source, a lecture or a document, in which Huddleston fixes these hours. Every time in this article is attributed to the page that prints it, and none to him.

## Kill zone times in UTC, and why they move twice a year

A kill zone has no fixed UTC time: New York is five hours behind UTC in winter and four in summer, so every window sits one UTC hour earlier from March to November.

| Kill zone (LuxAlgo's hours) | New York time | UTC, winter (EST) | UTC, summer (EDT) |
| --- | --- | --- | --- |
| Asian | 20:00-00:00 | 01:00-05:00 | 00:00-04:00 |
| London open | 02:00-05:00 | 07:00-10:00 | 06:00-09:00 |
| New York | 07:00-10:00 | 12:00-15:00 | 11:00-14:00 |
| London close | 10:00-12:00 | 15:00-17:00 | 14:00-16:00 |
| New York PM | 13:30-16:00 | 18:30-21:00 | 17:30-20:00 |

US daylight time runs from the second Sunday of March to the first Sunday of November, which in 2026 meant 8 March to 1 November according to [NIST](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst) (page updated 9 February 2026, checked 22 November 2026). The UK changes on different Sundays: 29 March and 25 October in 2026, per [GOV.UK](https://www.gov.uk/when-do-the-clocks-change) (checked 22 November 2026). For three weeks in March and one in the autumn, London is four hours ahead of New York, not five, and the "London open" kill zone starts at 06:00 on London's clock where it usually starts at 07:00.

<!-- unique:firsthand-data -->
Our year of data contains both US clock changes, which gives a clean test of whose clock bitcoin keeps. If activity follows New York, the busiest slot of the UTC day should move by exactly one hour. Before running anything we wrote the prediction into the script: 14:30 UTC in the winter months, 13:30 UTC in the summer months, both of them 09:30 in New York. It held. In the EST part of the data the 14:30 UTC bar had the largest mean range, 0.80% against 0.44% for the 13:30 bar. In the EDT part the 13:30 UTC bar led with 0.54%, and 14:30 had dropped to 0.44%.

A backtest or alert that hard-codes kill zones as UTC hours is therefore an hour off for either the winter or the summer part of the year.

The [NYSE](https://www.nyse.com/markets/hours-calendars) core session opens at 9:30 a.m. Eastern time (checked 22 November 2026), and bitcoin's busiest bar moves with it.

## Which hours is bitcoin busy? One year, hour by hour

<!-- unique:firsthand-data -->
New York's morning, 09:00 to 12:00, and not much else. The data is the same file behind every backtest on this site: 35,040 BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, none missing. We converted every bar to New York wall-clock time, kept the 364 New York days that lie wholly inside the data, and measured each bar's range as high minus low over its open.

In the table, "x avg" is the mean range of a 15-minute bar in that hour divided by the all-day mean of 0.308%, so 1.68 means bars of about 0.52% of price. "Turnover" is the hour's share of the year's traded value. An even split would be 4.17% per hour. "Highs" and "Lows" count the days whose high or low was set in that hour, out of 362; the two clock-change days are left out there.

| Hour (New York) | x avg | Turnover | Highs | Lows |
| --- | --- | --- | --- | --- |
| 00:00 | 0.78 | 2.66% | 32 | 34 |
| 01:00 | 0.82 | 3.00% | 17 | 23 |
| 02:00 | 0.79 | 3.01% | 15 | 16 |
| 03:00 | 0.83 | 3.35% | 17 | 13 |
| 04:00 | 0.87 | 3.63% | 23 | 8 |
| 05:00 | 0.79 | 3.12% | 8 | 9 |
| 06:00 | 0.76 | 2.97% | 8 | 7 |
| 07:00 | 0.84 | 3.40% | 9 | 5 |
| 08:00 | 1.06 | 5.06% | 13 | 10 |
| 09:00 | 1.51 | 8.35% | 18 | 33 |
| 10:00 | 1.68 | 9.37% | 26 | 29 |
| 11:00 | 1.44 | 7.61% | 22 | 12 |
| 12:00 | 1.22 | 5.64% | 14 | 16 |
| 13:00 | 1.13 | 4.78% | 11 | 17 |
| 14:00 | 1.02 | 4.14% | 9 | 17 |
| 15:00 | 0.97 | 3.72% | 11 | 12 |
| 16:00 | 0.87 | 3.24% | 11 | 9 |
| 17:00 | 0.92 | 3.01% | 15 | 9 |
| 18:00 | 0.97 | 3.45% | 12 | 14 |
| 19:00 | 0.92 | 3.28% | 9 | 7 |
| 20:00 | 1.04 | 3.52% | 10 | 10 |
| 21:00 | 1.04 | 3.54% | 17 | 10 |
| 22:00 | 0.93 | 3.28% | 12 | 20 |
| 23:00 | 0.82 | 2.85% | 23 | 22 |

<!-- unique:original-calc -->
Three hours, 09:00 to 12:00, carry 25.33% of the year's turnover in 12.5% of the clock, and their bars are 1.54 times the average size. That is the busiest three-hour block that starts on the hour, and the quietest is 00:00 to 03:00 at 0.80. From 00:00 to 08:00 every hour is below average. The slot-level extremes are 09:30 at 0.629% and 23:45 at 0.212%, with 02:45, inside the London kill zone, next at 0.213%.

## How busy are the London and New York kill zones on BTC?

<!-- unique:firsthand-data -->
The London kill zone is quiet on bitcoin, and the New York kill zone is busy only in the versions that start late. Each row below is a window exactly as a source gives it; three near-duplicates are left out and are in the summary file. "Clock" is the window's share of the day, so a window with no special activity would show the same percentage under "Turnover" and 1.00 under "x avg".

| Window (New York time) | Clock | Turnover | x avg |
| --- | --- | --- | --- |
| London open 02:00-05:00 | 12.50% | 9.99% | 0.83 |
| New York 07:00-10:00 | 12.50% | 16.81% | 1.13 |
| New York 08:00-11:00 | 12.50% | 22.79% | 1.41 |
| New York 08:30-11:00 | 10.42% | 20.65% | 1.50 |
| New York 08:30-11:30 | 12.50% | 24.80% | 1.51 |
| London close 10:00-12:00 | 8.33% | 16.98% | 1.56 |
| London close 11:00-13:00 | 8.33% | 13.25% | 1.33 |
| New York PM 13:30-16:00 | 10.42% | 10.16% | 1.02 |
| Asian 20:00-00:00 | 16.67% | 13.19% | 0.96 |
| Any of LuxAlgo's five | 60.42% | 67.14% | 1.06 |
| Outside LuxAlgo's five | 39.58% | 32.86% | 0.91 |

<!-- unique:original-calc -->
I expected the London open to show at least a small bump, since LuxAlgo's page says crypto volatility still clusters near the traditional London and New York opens. On this year of BTCUSDT only half of that sentence survives. Both versions of the London window ran at 0.83 times the average bar and took a tenth of the turnover in an eighth of the day. The New York claim holds, with a catch: the most cited window, 07:00 to 10:00, spends two of its three hours in the quiet part of the morning and scores 1.13. Shift it to 08:30 and the score is 1.50. The busiest named window on bitcoin is the one called the London close, 10:00 to 12:00, at 1.56. The label is a forex one. On this chart those are simply the second and third hours of the US stock session. One script also marks 12:00 to 13:00 as the New York lunch lull to avoid; on BTCUSDT that hour ran at 1.22, busier than every hour of the London kill zone.

## Do the day's high and low form inside the kill zones?

Partly, and the answer needs a baseline first. A window can collect highs and lows for dull reasons: it is long, or it is volatile. There is a third reason people rarely mention. On a random walk the high and low of any period fall near its start or its end far more often than in the middle, so the hours around New York midnight would lead this count even if nothing happened there. Look at the hour table: 00:00 has the most extremes of any hour and 23:00 has the fourth most, and both are among the quietest hours.

<!-- unique:firsthand-data -->
So we built the comparison into the script before running it. Each of the 362 days was replayed 2,000 times with the direction of every 15-minute bar flipped at random. That keeps every bar's size and its place in the day, and removes any tendency for moves to reverse or continue. The table gives the share of all 724 daily highs and lows that fell in each window, what the replays expect, and the range that 95% of replays stayed inside.

| Window (New York time) | Extremes inside | Expected | 95% of replays |
| --- | --- | --- | --- |
| London open 02:00-05:00 | 12.71% | 9.73% | 7.73% to 11.74% |
| New York 07:00-10:00 | 12.15% | 12.06% | 9.94% to 14.23% |
| New York 08:30-11:00 | 16.57% | 15.47% | 13.26% to 17.68% |
| New York PM 13:30-16:00 | 8.70% | 6.82% | 5.11% to 8.56% |
| Asian 20:00-00:00 | 17.13% | 24.19% | 21.82% to 26.52% |
| Any of LuxAlgo's five | 62.98% | 64.68% | 61.60% to 67.82% |

<!-- unique:original-calc -->
The busy New York windows set about as many highs and lows as their volatility predicts.

<!-- unique:original-calc -->
The quiet London window is the surprise: it set 92 of the 724 extremes where the replays expect about 70, and it leans one way, with 55 highs against 37 lows. The New York afternoon is above its band too. The Asian evening is well below, 124 against an expected 175.

<!-- unique:field-note -->
Here is how far I would take that, writing on 22 November 2026. It is one year, we compared 14 windows, and seven of them fell outside their band, so this is more than one stray result. It is also a count of where extremes landed, known only after the day closed. Taken together, LuxAlgo's five windows hold 62.98% of the extremes in 60.42% of the clock, which is inside what random directions produce. We don't know why the evening hours set fewer extremes than the replay expects, and we have not tested whether anything here can be traded.

## Weekends: the same clock on a different market

<!-- unique:firsthand-data -->
The New York morning bump is a weekday event. On the 260 weekdays in the data, the 09:00, 10:00 and 11:00 hours ran at 1.65, 1.85 and 1.53 times the weekday average. On the 104 weekend days the same hours ran at 1.03, 1.06 and 1.10 times the weekend average, which is close to flat. Weekend bars are smaller overall, 0.234% against 0.338%.

<!-- unique:firsthand-data -->
Weekends have their own busy stretch, and no kill zone list covers it: 18:00 to 21:00 New York time ran at 1.47 times the weekend average. That window is outside every source's hours until 20:00. We have not split Saturday from Sunday, so we can't say which evening carries it. A kill zone rule applied seven days a week is two different rules, and the sources, written for markets that close on Friday, never had to say which one they meant.

## Did our backtested trades do better inside a kill zone?

No. This is the weakest evidence on the page, so it comes with its warning first: the split below was made after the fact, on trades from two rules that contain no clock. It can show whether the same rule lost less in some hours. It is not a test of a kill zone strategy.

<!-- unique:firsthand-data -->
The trades are the published runs of the [fair value gap](/backtests/fvg-btcusdt/) and [liquidity sweep](/backtests/liquidity-sweep-btcusdt/) rules from the open-source engine (version 0.2.2, results generated 21 November 2026 UTC), grouped by the New York time of the entry fill. Cells are trades and average R, where R is the profit divided by the amount risked to the stop; the first pair is in-sample, the second out-of-sample (from 31 July 2026). An asterisk marks fewer than 100 trades, too few to read.

| Entry time (New York) | FVG in | FVG out | Sweep in | Sweep out |
| --- | --- | --- | --- | --- |
| All trades | 801, -0.57 | 304, -0.83 | 1,639, -0.67 | 688, -0.79 |
| London open 02:00-05:00 | 113, -0.67 | 40*, -0.34 | 185, -0.99 | 82*, -1.02 |
| New York 07:00-10:00 | 104, -0.61 | 44*, -0.78 | 280, -0.90 | 108, -0.81 |
| London close 10:00-12:00 | 101, -0.59 | 33*, -0.49 | 233, -0.50 | 98*, -0.64 |
| New York PM 13:30-16:00 | 62*, -0.57 | 24*, -0.89 | 139, -0.23 | 40*, -0.33 |
| Asian 20:00-00:00 | 134, -0.62 | 57*, -1.02 | 274, -0.72 | 119, -0.76 |
| Inside any of the five | 514, -0.62 | 198, -0.73 | 1,111, -0.70 | 447, -0.75 |
| Outside all five | 287, -0.48 | 106, -1.02 | 528, -0.59 | 241, -0.87 |

<!-- unique:original-calc -->
Average R is negative in all 20 window cells. Compare the last two rows and the kill zones look worse in-sample for both rules and better out-of-sample for both rules. A filter whose sign flips between two halves of one year is noise. The sweep rule was at its worst in the two windows the method cares most about, London and New York, at -0.99 R and -0.90 R in-sample. The one cell that looks less bad, sweeps entered on a New York afternoon, has a t-statistic of -0.88, and it is one of twenty cells we looked at.

Every one of these trades also paid a round trip of 0.15% in fees and slippage against a stop about 0.3% away. The [position size calculator](/tools/position-size-calculator/) shows what a stop that tight does to position size, and to the fee as a share of risk.

## What this does not show, and how to rerun it

The numbers come from one market in one year in which BTCUSDT fell 29.86%. An hour-of-day profile is a description. It tells you when bitcoin moved, and a bigger range cuts both ways for a trade.

Nothing here tests a discretionary trader who uses a kill zone as one filter among several. It also doesn't test forex or index futures, the markets the windows were drawn for. What it supports is narrow: on BTCUSDT the measurable daily rhythm follows the US stock session, the London window is quiet, and two mechanical ICT entries lost in every window.

To reproduce the tables you need the engine's candle file and one script from this site's source. Check the engine out next to the site and download the candles:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git perpmath-engine
cd perpmath-engine
python -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then, from the site's root folder:

```
../perpmath-engine/.venv/bin/python research/ict-kill-zones/ict-kill-zones_research.py
```

The script is `research/ict-kill-zones/ict-kill-zones_research.py`; its docstring holds the window list and the prediction, both written before the first run. `nytime.py` beside it does the New York conversion and tests itself on a winter date, a summer date and both switch days. The engine is in the [perpmath repository](https://github.com/sentinelbotsaas-hub/perpmath) (checked 22 November 2026) and described in the [bot section](/bot/). Our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) explains why an after-the-fact split like the one above proves so little.

## FAQ

### What time is the London kill zone?

Most sources give 02:00 to 05:00 New York time: 07:00 to 10:00 UTC in winter, 06:00 to 09:00 UTC in summer.

### What time is the New York kill zone?

It depends on the source: 07:00 to 10:00 (LuxAlgo, Equiti), 08:00 to 11:00 (LiteFinance), 08:30 to 11:00 or 08:30 to 11:30 (two TradingView scripts), all in New York time. Bitcoin's busiest three hours in our year were 09:00 to 12:00.

### Are ICT kill zones in EST or UTC?

New York local time: EST (UTC-5) in winter, EDT (UTC-4) in summer. The UTC hours shift by one hour in March and November.

### Do ICT kill zones work for crypto?

<!-- unique:firsthand-data -->
As a description of when BTCUSDT moves, only the New York windows match, and the late versions match best: 08:30 to 11:00 ran at 1.50 times the average bar, while the London open ran at 0.83. As a count of where the day's high and low land, the London window did better than its volatility predicts, 12.71% of extremes against an expected 9.73%, and the Asian evening did worse. As a trade filter we found nothing: two mechanical ICT entries had a negative average R in every kill zone, in-sample and out-of-sample. Nobody, including us, has published a test of the discretionary version on crypto.

### What is the most active kill zone for bitcoin?

<!-- unique:firsthand-data -->
Of the windows the sources name, 10:00 to 12:00 New York time, labelled the London close, had the largest bars at 1.56 times the average. The 08:30 to 11:30 version of the New York window took the most turnover, 24.80% of the year in 12.5% of the clock. Active means large moves in both directions.

### Should kill zones be applied on weekends?

The sources were written for markets that are closed on weekends and don't say. In our data the weekday morning bump almost disappears on Saturday and Sunday, and the weekend's own busy hours, 18:00 to 21:00 New York time, are mostly outside every listed window. If your rule runs seven days a week, which of the two clocks is it really using?
