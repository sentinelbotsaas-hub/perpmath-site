---
title: "ICT trading: 12 concepts written as rules, and what we tested"
slug: "ict-trading"
description: "ICT trading and smart money concepts as a map: 12 terms each written as a rule a program can check, where the definitions are loose, and the two we have backtested."
date: "2026-11-25"
lastmod: "2026-11-25"
lang: "en"
category: "Backtests"
tags: ["ICT trading", "smart money concepts", "order block", "fair value gap", "liquidity sweep", "backtest"]
keywords: ["ict trading", "smart money concepts", "ict concepts", "ict trading strategy", "smc trading"]
tldr: "ICT trading is a way of reading price charts taught by Michael J. Huddleston under the name The Inner Circle Trader; smart money concepts (SMC) is the wider community's label for much the same vocabulary. This page writes 12 of its terms as rules a program can check and marks which ones we have backtested. Two so far, on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026: a fair value gap entry lost 66.94% in-sample and 42.86% out-of-sample, and a liquidity sweep fade lost 93.98% and 69.03%. The other ten are untested here, and we make no claim about them either way."
---

<!-- unique:firsthand-data -->
This page lists twelve ICT terms, and we have backtested two of them. Both lost money after costs on a year of BTCUSDT 15-minute candles: the fair value gap entry over 801 in-sample trades, the liquidity sweep fade over 1,639. With fees and slippage set to zero, neither result could be told apart from zero. For the other ten terms we have no result, so the table below says "not yet" and nothing more.

## What is ICT trading?

ICT trading is a method of reading price charts taught by Michael J. Huddleston, who publishes as The Inner Circle Trader. Its central idea is that large participants need other people's orders to fill their own, so price is drawn to places where orders rest and leaves recognisable marks when it gets there.

The vocabulary falls into four groups. Liquidity terms say where orders rest, typically beyond obvious highs and lows. Structure terms describe the sequence of swing highs and lows and when it breaks. Zone terms mark candles or gaps that price is expected to return to. Time terms say when in the day all of this is supposed to matter.

Smart money concepts, usually shortened to SMC, is the name the wider online community gives to much the same set of ideas. For this page the two are one map.

## Where does the ICT vocabulary come from?

<!-- unique:cross-reference -->
From Huddleston's own lectures, most of them video, and that is as precise as the public record gets. His site, [theinnercircletrader.com](https://www.theinnercircletrader.com/) (checked 22 November 2026), is written in the first person, gives his name alongside "The Inner Circle Trader", and addresses forex traders. It links to a [YouTube channel](https://www.youtube.com/innercircletrader) and to a [playlist](https://www.youtube.com/playlist?list=PLVgHx4Z63paYzh3KwUFX0UHQUf31CAEXk) titled "2016 ICT Private Mentorship Core Content Month 01". None of the twelve terms on this page appears on that home page, and it carries no dates.

<!-- unique:cross-reference -->
What we could not find is a dated, written primary source for each term. The definitions are spread over years of lectures that we have not catalogued, so this page does not attribute any term to a particular video or year. Third-party summaries give start dates and biographical details that we could not check against a primary source, and we have left them out.

<!-- unique:cross-reference -->
The label "smart money concepts" is younger and its origin is hazier. LuxAlgo's open-source [Smart Money Concepts script](https://www.tradingview.com/script/CnB3fSph-Smart-Money-Concepts-SMC-LuxAlgo/) on TradingView, created on 11 October 2022, describes it as a fairly new term coined and popularised within the forex community and by ICT. LuxAlgo's [library entry](https://www.luxalgo.com/library/concept/smart-money-concepts/) (checked 22 November 2026) puts it this way: ICT is Huddleston's own body of teaching, and SMC is the community's label for the same core ideas, often with renamed or simplified terms. We found no source for who used the label first.

A word on that source. LuxAlgo sells charting indicators and did not originate any of this. We lean on its library here for one reason: it writes the rules down precisely enough to disagree with, and it says where conventions differ.

## The map: 12 ICT concepts at a glance

Each row has a rule short enough to type into a program, written for the bullish side; the bearish side is the mirror image. The wording is ours and is one way to pin the idea down. `maxHigh(N)` is the highest high of the previous N bars, FVG is a fair value gap, CHoCH is a change of character, and NY time is New York time. A letter such as N or k marks a number somebody has to choose. The third column names what the usual descriptions leave open, and the last gives the total return of our backtest in-sample and out-of-sample, where one exists.

| Concept | Rule, in short | Left open | Our backtest, in / out |
| --- | --- | --- | --- |
| Fair value gap | `low[3] > high[1]` | size, fill rule | -66.94% / -42.86% |
| Liquidity sweep | `high > maxHigh(N) > close` | N, wick or close | -93.98% / -69.03% |
| Order block | `down bar, then close > maxHigh(N)` | body or range | Not yet |
| Breaker block | `order block, then closed through` | sweep first? | Not yet |
| Break of structure | `uptrend, close > swingHigh(k)` | k, wick or close | Not yet |
| Change of character | `uptrend, close < higherLow(k)` | which swing | Not yet |
| Market structure shift | `CHoCH right after a sweep` | or a synonym | Not yet |
| Inverse fair value gap | `FVG, then closed through` | gap or midpoint | Not yet |
| Kill zones | `02:00 <= NY time < 05:00` | window edges | Not yet |
| Judas swing | `sweeps session low, close > open` | size, session | Not yet |
| Power of 3 | `low < open, close in top third` | no thresholds | Not yet |
| Silver bullet | `first FVG, 10:00-11:00 NY time` | gap, target | Not yet |

"Not yet" means exactly that. We have not run it, and this page says nothing about whether it works.

## Each ICT concept as one sentence a program can check

<!-- unique:cross-reference -->
The same twelve, in full sentences, with the job each one does in the ICT account of a move. The roles are how the method describes them. They are not findings of ours.

- **Fair value gap.** Three candles in which the low of the third is above the high of the first, leaving a band only the middle candle traded. Role: the "imbalance" price is expected to revisit, used as an entry zone.
- **Liquidity sweep.** A bar whose high exceeds the highest high of the previous N bars and which closes back below that level. Role: the raid on resting stops that is supposed to come before a reversal.
- **Order block.** The last down-closing candle before a rise that closes above the highest high of the previous N bars; the zone is that candle's range. Role: the place where large buying is said to have started, watched for a return.
- **Breaker block.** An order block that a later bar closes through, after which the zone is read in the opposite direction. Role: a failed zone reused as support or resistance.
- **Break of structure.** In an uptrend, a close above the most recent swing high, where a swing high is a bar with k lower highs on each side. Role: confirmation that the trend continues.
- **Change of character.** In an uptrend, the first close below the most recent higher low. Role: the earliest warning that the trend may be turning.
- **Market structure shift.** A change of character that comes right after a sweep of the trend's extreme, on a bar whose range exceeds x times the ATR. Role: a stronger version of the same warning.
- **Inverse fair value gap.** A fair value gap that a later bar closes through to its far edge; the band then flips from support to resistance or back. Role: the gap's counterpart to a breaker.
- **Kill zones.** Bars whose open time falls inside fixed New York-time windows, for example 02:00 to 05:00 and 07:00 to 10:00. Role: a time filter laid over everything else.
- **Judas swing.** Early in a session, price trades below the prior session's low and then closes back above the day's midnight New York open. Role: the false move that opens the day.
- **Power of 3.** A day that trades below its midnight open first and closes above it, in the top third of its range. Role: a three-phase template of accumulation, manipulation and distribution.
- **Silver bullet.** The first fair value gap that forms between 10:00 and 11:00 New York time, entered when price returns to it. Role: a one-setup-per-window trade model.

## The two concepts we have backtested

<!-- unique:firsthand-data -->
Both tests use the same data: 35,040 BTCUSDT 15-minute bars from Bybit's public endpoint, 18 November 2025 to 18 November 2026, none missing, with the first 70% in-sample and the rest (from 31 July 2026) out-of-sample. Costs are 0.055% per side plus 0.02% slippage per fill; funding is not modelled. The rules and the engine are open source in the [perpmath repository](https://github.com/sentinelbotsaas-hub/perpmath) (checked 22 November 2026).

| Rule tested | Sample | Trades | Avg R | t-stat | Return | Max drawdown | Zero-cost return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fair value gap | In | 801 | -0.57 | -4.93 | -66.94% | 66.97% | +6.03% |
| Fair value gap | Out | 304 | -0.83 | -5.23 | -42.86% | 43.19% | -10.05% |
| Liquidity sweep | In | 1,639 | -0.67 | -10.91 | -93.98% | 94.35% | -27.12% |
| Liquidity sweep | Out | 688 | -0.79 | -8.48 | -69.03% | 69.31% | -14.58% |

<!-- unique:original-calc -->
The gap rule enters when price returns to the gap; the sweep rule trades against the sweep bar. Both aim for twice the risk and won 31.46% and 29.16% of their in-sample trades, short of the 33.33% that target needs. The last column is the same rules rerun with fee and slippage at zero. Its t-statistics are 0.38 and -0.97 for the gap entry and -1.14 and -1.11 for the sweep fade, all inside the band where a result is indistinguishable from zero. Costs explain most of each loss, and removing them uncovers nothing.

<!-- unique:firsthand-data -->
The [fair value gap](/learn/fair-value-gap/) write-up has the detail that surprises people: price did return to 92.02% of the 1,930 gaps that passed our size filter, and trading that return still lost. The full report is the [FVG backtest](/backtests/fvg-btcusdt/).

<!-- unique:firsthand-data -->
For the [liquidity sweep](/learn/liquidity-sweep/) we went further and ran 19 settings: four lookbacks, three stop widths, three targets, ETHUSDT and SOLUSDT, and 1-hour bars. Of the 38 sample blocks, 0 were positive after costs. At zero cost all 19 settings had an absolute t-statistic under 2 in both samples. The published run is the [liquidity sweep backtest](/backtests/liquidity-sweep-btcusdt/).

Each result covers one mechanical reading of one concept, on crypto perpetuals, in a year when BTCUSDT fell 29.86%. Neither tests a trader who combines several of these ideas with judgement.

## Structure terms: where BOS, CHoCH and MSS blur

<!-- unique:cross-reference -->
All three are statements about swing points, and none of them is defined until "swing" is. A break of structure is a break in the direction of the trend. A change of character is the first break against it. LuxAlgo's entries for [break of structure](https://www.luxalgo.com/library/concept/break-of-structure/) and [change of character](https://www.luxalgo.com/library/concept/change-of-character/) (both checked 22 November 2026) agree on that split and then list what is open: whether a wick through the level counts or only a close, which swing is the one that matters, and whether smaller swings inside a larger leg count.

<!-- unique:cross-reference -->
Market structure shift is the least settled of the three. The change of character entry says many traders use the two terms interchangeably, while others keep "market structure shift" for a stronger version: a break delivered with displacement, a forceful one-way move, right after a sweep of the trend's extreme. LuxAlgo's own address for a market structure shift page redirects to its change of character page. Our table follows the stricter reading only so the two rows differ.

<!-- unique:firsthand-data -->
In code, the whole group hangs on one parameter: how many bars on each side make a pivot. We counted them on our year of BTCUSDT 15-minute bars. With k at 2 there are 9,659 swing highs and lows, about 26 a day. With k at 20 there are 1,198, about 3 a day. My guess before counting was a handful per week at k of 20. It was wrong: the real figure is 23 a week. Between the two settings lies an eightfold difference from one number, so a "break of structure strategy" with k left unstated is a family of strategies. The count describes the chart and tests nothing.

## Zone terms: order blocks and their failures

<!-- unique:cross-reference -->
An order block is the last candle that closed against a move before the move took off, and the move is the part that matters. LuxAlgo's [order block entry](https://www.luxalgo.com/library/concept/bullish-bearish-order-block/) (checked 22 November 2026) says the candle alone is not the concept, lists several ways traders draw the zone (the candle's full range, its body only, its open to its extreme, sometimes refined to the midpoint), calls none of them official, and adds that no reliable hit rate exists. The TradingView script goes further on cause, describing order blocks as areas where institutional participants open positions. A chart cannot confirm who traded there.

<!-- unique:cross-reference -->
The other two zone terms are defined by failure. A [breaker block](https://www.luxalgo.com/library/concept/breaker-block/) is an order block that price traded through, after which that zone is read in the opposite direction. LuxAlgo notes two readings in circulation: a strict one in which a sweep of a prior high or low must come first, and a looser one in which any violated order block qualifies. An [inverse fair value gap](https://www.luxalgo.com/library/concept/inversion-fvg/) is the same move applied to a gap, and the open question there is whether price must close through the whole gap or only past its midpoint.

<!-- unique:operator-view -->
Here is the testing problem those two create, seen from the side of someone who has to write the code. A zone that holds gets counted as an order block doing its job. A zone that breaks gets renamed and counted as a breaker doing its job. Each can be coded and tested by itself, with its entry fixed in advance. What cannot be tested is a reading that picks whichever label fits once the candles are in.

## Time terms: kill zones and the silver bullet

<!-- unique:cross-reference -->
Kill zones are clock windows, and the clock is New York's. LuxAlgo's [killzones entry](https://www.luxalgo.com/library/concept/killzones/) (checked 22 November 2026) gives the most cited set as London open 02:00 to 05:00, New York morning 07:00 to 10:00, London close 10:00 to 12:00 and New York afternoon 13:30 to 16:00, plus an Asian window in the evening and a variant of 08:30 to 11:00 for index futures. It also says the boundaries differ by 30 to 90 minutes across sources. A 90-minute shift on a three-hour window moves half of it.

<!-- unique:cross-reference -->
The silver bullet narrows the clock to one hour. LuxAlgo's open-source [ICT Silver Bullet script](https://www.tradingview.com/script/fq4wSUev-ICT-Silver-Bullet-LuxAlgo/), created on 4 July 2023, lists three windows in New York time (03:00 to 04:00, 10:00 to 11:00, 14:00 to 15:00) in which a fair value gap has to form. It sets minimum distances of 40 ticks for index futures and 15 pips for forex. LuxAlgo's [silver bullet entry](https://www.luxalgo.com/library/concept/silver-bullet/) states that no audited public statistics exist for the model.

<!-- unique:cross-reference -->
The [judas swing](https://www.luxalgo.com/library/concept/judas-swing/) and the [power of 3](https://www.luxalgo.com/library/concept/accumulation-manipulation-distribution/) describe the shape of a session: quiet around the open, a false move one way, the real move the other way. Both entries are frank that the shape is read backwards. The first says the pattern is confirmed by the failure and never assumed from the clock. The second calls the template descriptive, not mechanical, and easy to see on a finished candle.

<!-- unique:field-note -->
Two practical notes from our side, written on 22 November 2026. Crypto perpetuals trade around the clock with no session open, and the sources above set their thresholds in forex pips and index-futures ticks, so whether these windows carry over to BTCUSDT is an open question that we have not measured. And New York time moves against UTC twice a year, so a backtest that hard-codes UTC hours tests a different window for part of the year.

## Why is ICT trading hard to test?

Three things get in the way: the trader's discretion, labels applied after the fact, and evidence that reaches the public already filtered. We can put numbers on the first two from our own data.

<!-- unique:firsthand-data -->
Discretion first. One year of BTCUSDT 15-minute bars holds 7,176 fair value gaps of any size and 1,930 once a minimum size of half an ATR is required. It holds 5,177 liquidity sweeps with a 10-bar lookback and 1,228 with a 100-bar lookback. Count any poke through the 20-bar level and there are 6,402 events; require a close back inside and there are 3,374. Two people who both "trade sweeps" can be looking at samples that differ by a factor of four, and any test result can be answered with "that isn't how I define it".

<!-- unique:original-calc -->
Then hindsight. Of the liquidity sweeps in our data, 11.00% had an extreme that was still untouched 96 bars later. Those are the ones that get circled on a chart. Splitting our published trades by that after-the-fact knowledge gives 275 trades that won 94.91% of the time and 2,046 that won 20.04%. Same rule, same year. The only difference is information nobody had at entry.

The third is survivorship, and here we have no numbers at all. Screenshots of winning trades and testimonials are a sample chosen by outcome, and nothing public says how many losing accounts sit behind them. We found no audited record for the method and no figure for what share of people trading it make money. The TradingView script page itself says there is no supporting data on the validity of these teachings. The status is unknown, and unknown is not the same as zero.

## How do you make a discretionary concept testable?

By removing every decision that depends on seeing what happened next. In practice that is a short list.

1. Write the pattern so a program can find it using only bars that have closed.
2. Fix every number (lookback, minimum size, stop, target) and write it down before the first run.
3. Enter at a price you could have had. Ours is the next bar's open.
4. Charge fees and slippage, and compare them with the size of the stop.
5. Hold back part of the data and look at it once.
6. Count the trades. Under 100, treat the numbers as noise.
7. Report every variant you ran, including the bad ones.

Our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) goes through each step with the mistakes that usually sink it. The open-source engine described in the [bot section](/bot/) enforces several of them: it refuses to run a strategy whose signals change when later bars are removed, fills at the next open, and reports a t-statistic with the trade count. All published runs are under [backtests](/backtests/).

<!-- unique:original-calc -->
Step 4 is where both of our tests died. Both rules put the stop just behind a wick or a gap, which makes it tight. The median in-sample stop was 0.323% of price away in the gap test and 0.296% in the sweep test, so a 0.15% round trip in fees and slippage cost 0.46R and 0.51R before the trade had done anything. Try a stop that tight in the [position size calculator](/tools/position-size-calculator/) to see what it does to position size, and to the fee as a share of risk.

## What this page does not claim

It does not claim ICT trading fails. Two of twelve concepts have been tested, each in one mechanical form, on one year of crypto data. That is thin ground for a verdict on a method whose own home page speaks to forex traders and which is used with discretion.

It does not claim ICT trading works either. For ten of the twelve rows we have nothing, and for the method as a whole we found no verified record. When we publish another test, its row in the table changes and this page's date changes with it.

## FAQ

### Is ICT trading the same as smart money concepts?

Close to it. ICT refers to Michael J. Huddleston's own teaching, and smart money concepts is the wider community's label for the same core ideas, sometimes with renamed terms. In practice the two names are used interchangeably.

### Who created ICT trading?

Michael J. Huddleston, who publishes as The Inner Circle Trader. His own site introduces him under that name and points to his YouTube lectures. We could not find dated primary sources for when each individual term was first used.

### What are the ICT kill zone times?

The most cited set, in New York time, is 02:00 to 05:00 for the London open and 07:00 to 10:00 for the New York morning, with further windows for the London close and the New York afternoon. Sources differ on the edges by 30 to 90 minutes.

### What is the difference between a break of structure and a change of character?

Direction. A break of structure takes out a swing point in the direction of the existing trend. A change of character is the first break against it. Both depend on how a swing is defined, which the terms themselves don't settle.

### Can ICT concepts be backtested?

One at a time, yes, once each is written as a fixed rule. The combined discretionary method cannot be tested until the discretion is written down, since a test needs to know in advance which candles count.

### Does ICT trading work?

<!-- unique:firsthand-data -->
Nobody has published evidence that settles it, and we haven't either. We tested mechanical versions of two concepts: the fair value gap entry lost 66.94% in-sample and the liquidity sweep fade lost 93.98%, with no measurable edge before costs. Ten other concepts are untested here. We found no audited performance record for the method.
