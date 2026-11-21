---
title: "ICT trading: 12 concepts written as rules, and what we tested"
slug: "ict-trading"
description: "ICT trading and smart money concepts as a map: 12 terms each written as a rule a program can check, where the definitions are loose, and what our test of each found."
date: "2026-11-25"
lastmod: "2026-11-25"
lang: "en"
category: "Backtests"
tags: ["ICT trading", "smart money concepts", "order block", "fair value gap", "liquidity sweep", "backtest"]
keywords: ["ict trading", "smart money concepts", "ict concepts", "ict trading strategy", "smc trading"]
tldr: "ICT trading is a way of reading price charts taught by Michael J. Huddleston under the name The Inner Circle Trader; smart money concepts (SMC) is the wider community's label for much the same vocabulary. This page writes 12 of its terms as rules a program can check and reports what we found when we tested each one, in one mechanical form, on BTCUSDT from 18 November 2025 to 18 November 2026. Ten were backtested as trading rules; kill zones and the power of 3 have no entry or exit and were counted. On 15-minute bars eight rules made at least 100 trades in-sample and all eight lost money after costs: fair value gap 66.94%, liquidity sweep 93.98%, order block 42.33%, break of structure 43.34%, breaker block 18.44%, inverse fair value gap 63.09%, the displacement form of the market structure shift 24.92% and the judas swing 27.69%. The change of character rule made 88 trades and the silver bullet 50, too few to read; on 1-minute bars the silver bullet lost 97.43%. Out-of-sample on 15-minute bars, the five rules with at least 100 trades lost again and the other five made too few to read. Bitcoin was busy from 09:00 to 12:00 New York time and quiet in the London kill zone, and the power of 3 fit shuffled price paths about as often as real ones. No rule kept a statistically defensible edge after costs."
---

<!-- unique:firsthand-data -->
This page lists twelve ICT terms, and each of them now has a test of ours behind it. Ten could be written as trading rules and backtested. Kill zones and the power of 3 have no entry or exit, so for those two we counted what happened and compared it with a baseline. On a year of BTCUSDT 15-minute candles, eight of the ten rules made at least 100 trades in-sample, and all eight lost money after costs, from 18.44% for the breaker block retest to 93.98% for the liquidity sweep fade. Five of those losses are statistically clear and three cannot be told apart from zero. The other two rules, change of character and the silver bullet, made too few trades on those bars to read; rerun on 1-minute bars, the silver bullet lost 97.43%. With fees and slippage set to zero, none of the eighteen sample blocks of the nine rules other than the silver bullet reached a t-statistic of 2 in either direction. The table below marks which figures can be read and which cannot.

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

Each row has a rule short enough to type into a program, written for the bullish side; the bearish side is the mirror image. The wording is ours and is one way to pin the idea down. `maxHigh(N)` is the highest high of the previous N bars, FVG is a fair value gap, CHoCH is a change of character, and NY time is New York time. A letter such as N or k marks a number somebody has to choose. The third column names what the usual descriptions leave open, and the last gives what our test returned: the total return of a backtest after costs, in-sample and out-of-sample, or "Counted" where the idea gave us nothing to trade.

| Concept | Rule, in short | Left open | Our test, in / out |
| --- | --- | --- | --- |
| Fair value gap | `low[3] > high[1]` | size, fill rule | -66.94% / -42.86% |
| Liquidity sweep | `high > maxHigh(N) > close` | N, wick or close | -93.98% / -69.03% |
| Order block | `down bar, then run closes > swingHigh(k)` | which candle, move size | -42.33% / -18.71% |
| Breaker block | `order block, then closed through` | sweep first? | -18.44% / -15.07% |
| Break of structure | `uptrend, close > swingHigh(k)` | k, wick or close | -43.34% / -3.35%* |
| Change of character | `uptrend, close < higherLow(k)` | which swing | +8.38%* / -2.01%* |
| Market structure shift | `CHoCH right after a sweep` | or a synonym | -24.92% / -15.03%* |
| Inverse fair value gap | `FVG, then closed through` | gap or midpoint | -63.09% / -45.44% |
| Kill zones | `02:00 <= NY time < 05:00` | window edges | Counted, no trade rule |
| Judas swing | `breaks 20:00-00:00 range, closes back in` | range, window | -27.69% / -10.18%* |
| Power of 3 | `low before 05:00, close in top third` | no thresholds | Counted: 37.12% of days |
| Silver bullet | `FVG formed and entered, 10:00-11:00 NY time` | gap, target | -97.43% / -79.68%† |

The last column holds three kinds of entry, and they do not carry the same weight. A plain percentage is a backtest block with at least 100 trades. A percentage with an asterisk is a block with fewer than 100, the number the engine needs before it will call a sample sufficient. "Counted" is not a backtest at all: we counted how often the thing happened and compared the count with a baseline, which says nothing about profit.

The asterisked figures should not be read as results, in either direction. Out-of-sample they are break of structure (42 trades), change of character (45), market structure shift (59) and the judas swing (76). Change of character is short in-sample as well, at 88 trades, so neither of its numbers can be read, the positive one included.

The dagger on the silver bullet row means 1-minute bars. On the 15-minute bars every other row uses, that rule made 50 trades in-sample and 21 out-of-sample, too few to read, so the row shows the 1-minute run over the same dates, with 2,447 and 1,116 trades.

Four rows test something narrower than the one-line rule beside them. The break of structure rule has no definition of trend, so it trades every close beyond the latest swing, changes of character included. The change of character and market structure shift rows take the trend to be the direction of the previous break, and the market structure shift figure is for the version with displacement only; the sweep in its one-line rule was not coded. The silver bullet row is the fair value gap rule with a clock on it, without the sweep and the liquidity target the taught model asks for.

## Each ICT concept as one sentence a program can check

<!-- unique:cross-reference -->
The same twelve, in full sentences, with the job each one does in the ICT account of a move. The roles are how the method describes them. They are not findings of ours.

- **Fair value gap.** Three candles in which the low of the third is above the high of the first, leaving a band only the middle candle traded. Role: the "imbalance" price is expected to revisit, used as an entry zone.
- **Liquidity sweep.** A bar whose high exceeds the highest high of the previous N bars and which closes back below that level. Role: the raid on resting stops that is supposed to come before a reversal.
- **Order block.** The last down-closing candle before a run of up candles that covers x times the ATR and closes above the most recent swing high; the zone is that candle's range. Role: the place where large buying is said to have started, watched for a return.
- **Breaker block.** An order block that a later bar closes through, after which the zone is read in the opposite direction. Role: a failed zone reused as support or resistance.
- **Break of structure.** In an uptrend, a close above the most recent swing high, where a swing high is a bar with k lower highs on each side. Role: confirmation that the trend continues.
- **Change of character.** In an uptrend, the first close below the most recent higher low. Role: the earliest warning that the trend may be turning.
- **Market structure shift.** A change of character that comes right after a sweep of the trend's extreme, on a bar whose range exceeds x times the ATR. Role: a stronger version of the same warning.
- **Inverse fair value gap.** A fair value gap that a later bar closes through to its far edge; the band then flips from support to resistance or back. Role: the gap's counterpart to a breaker.
- **Kill zones.** Bars whose open time falls inside fixed New York-time windows, for example 02:00 to 05:00 and 07:00 to 10:00. Role: a time filter laid over everything else.
- **Judas swing.** Between 00:00 and 05:00 New York time, price trades below the low of the 20:00 to 00:00 range and then closes back inside it. Role: the false move that opens the day.
- **Power of 3.** A day that sets its low between 00:00 and 05:00 New York time and closes above its midnight open, in the top third of its range. Role: a three-phase template of accumulation, manipulation and distribution.
- **Silver bullet.** A fair value gap that forms between 10:00 and 11:00 New York time (or in the 03:00 or 14:00 hour) and is entered when price returns to it inside the same hour. Role: a one-setup-per-window trade model.

## The ten concepts we have backtested

<!-- unique:firsthand-data -->
All ten tests start from the same data: 35,040 BTCUSDT 15-minute bars from Bybit's public endpoint, 18 November 2025 to 18 November 2026, none missing, with the first 70% in-sample and the rest (from 31 July 2026) out-of-sample. The silver bullet was also run on 5-minute and 1-minute bars over the same dates. Costs are 0.055% per side plus 0.02% slippage per fill; funding is not modelled. The engine is open source in the [perpmath repository](https://github.com/sentinelbotsaas-hub/perpmath) (checked 22 November 2026). Five of the rules ship with it, and the other five are written in the research scripts of their own articles and run through the same engine.

| Rule tested | Sample | Trades | Avg R | t-stat | Return | Max drawdown | Zero-cost return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fair value gap | In | 801 | -0.57 | -4.93 | -66.94% | 66.97% | +6.03% |
| Fair value gap | Out | 304 | -0.83 | -5.23 | -42.86% | 43.19% | -10.05% |
| Liquidity sweep | In | 1,639 | -0.67 | -10.91 | -93.98% | 94.35% | -27.12% |
| Liquidity sweep | Out | 688 | -0.79 | -8.48 | -69.03% | 69.31% | -14.58% |
| Order block | In | 325 | -0.61 | -3.77 | -42.33% | 46.92% | -6.27% |
| Order block | Out | 141 | -0.98 | -2.49 | -18.71% | 24.94% | +0.54% |
| Break of structure | In | 149 | -0.17 | -1.57 | -43.34% | 53.72% | -35.56% |
| Break of structure | Out | 42* | +0.06 | -0.11 | -3.35% | 23.57% | +0.91% |
| Breaker block | In | 243 | -0.56 | -1.56 | -18.44% | 21.23% | +16.45% |
| Breaker block | Out | 120 | -0.79 | -2.88 | -15.07% | 16.62% | +0.78% |
| Inverse fair value gap | In | 621 | -0.64 | -5.64 | -63.09% | 64.48% | -9.34% |
| Inverse fair value gap | Out | 301 | -1.09 | -7.14 | -45.44% | 45.84% | -11.80% |
| Change of character | In | 88* | -0.21 | 0.41 | +8.38% | 24.40% | +22.86% |
| Change of character | Out | 45* | +0.07 | -0.08 | -2.01% | 15.41% | +2.63% |
| Market structure shift | In | 135 | -0.15 | -0.90 | -24.92% | 36.57% | -1.37% |
| Market structure shift | Out | 59* | -0.24 | -1.03 | -15.03% | 23.43% | -9.04% |
| Judas swing | In | 164 | -0.75 | -3.74 | -27.69% | 28.52% | -4.84% |
| Judas swing | Out | 76* | -0.71 | -2.34 | -10.18% | 12.09% | -0.93% |
| Silver bullet, 15-minute | In | 50* | -1.00 | -2.86 | -12.03% | 14.54% | -5.72% |
| Silver bullet, 15-minute | Out | 21* | -1.02 | -3.96 | -8.77% | 8.85% | -6.06% |
| Silver bullet, 1-minute† | In | 2,447 | -2.00 | -38.30 | -97.43% | 97.45% | -2.66% |
| Silver bullet, 1-minute† | Out | 1,116 | -2.44 | -30.36 | -79.68% | 79.72% | +2.23% |

An asterisk marks a block with fewer than 100 trades. The engine flags it as an insufficient sample, and nothing on that line should be read, whichever way it points. The dagger marks the one run on 1-minute bars; every other line is on 15-minute bars.

<!-- unique:original-calc -->
All ten rules aim for twice the risk, which needs a win rate of 33.33% before costs. In-sample, the eight with enough trades on 15-minute bars won 31.46% (gap), 29.16% (sweep), 30.77% (order block), 31.54% (break of structure), 33.74% (breaker block), 29.95% (inverse gap), 32.59% (market structure shift) and 28.66% (judas swing) of their trades. The last column is the same rules rerun with fee and slippage at zero. For the nine rules other than the silver bullet, the eighteen zero-cost t-statistics run from -1.46 to 1.30, all inside the band where a result is indistinguishable from zero. For seven of the rules, costs explain most of the loss and removing them uncovers nothing. Break of structure is the exception: its stops are several times wider, costs explain under a fifth of its in-sample loss, and what is left is too noisy to call. The change of character rule has too few trades for the question to be asked, and the silver bullet has its own paragraph under the time terms below.

<!-- unique:firsthand-data -->
The [fair value gap](/learn/fair-value-gap/) write-up has the detail that surprises people: price did return to 92.02% of the 1,930 gaps that passed our size filter, and trading that return still lost. The full report is the [FVG backtest](/backtests/fvg-btcusdt/).

<!-- unique:firsthand-data -->
For the [liquidity sweep](/learn/liquidity-sweep/) we went further and ran 19 settings: four lookbacks, three stop widths, three targets, ETHUSDT and SOLUSDT, and 1-hour bars. Of the 38 sample blocks, 0 were positive after costs. At zero cost all 19 settings had an absolute t-statistic under 2 in both samples. The published run is the [liquidity sweep backtest](/backtests/liquidity-sweep-btcusdt/).

<!-- unique:firsthand-data -->
The [order block](/learn/order-block/) rule finds 801 blocks in the year: a down bar immediately before three or more up bars that cover 2 ATR and close above the latest swing high, or the mirror image. Price came back to 75.41% of them within 24 hours, and entering on that return lost 42.33% and 18.71%. The report is the [order block backtest](/backtests/order-block-btcusdt/).

<!-- unique:firsthand-data -->
The [break of structure](/learn/break-of-structure/) rule follows a close beyond the latest swing point, with swings of 5 bars either side. In-sample it lost 43.34% over 149 trades, with a t-statistic of -1.57. Out-of-sample it made 42 trades, which the engine flags as an insufficient sample: the average R of +0.06 and the 3.35% fall in equity are both noise, and that row is not a pass. Of the 1,631 breaks on the chart, 55.24% were followed within four bars by a close back through the broken level. The report is the [break of structure backtest](/backtests/break-of-structure-btcusdt/).

<!-- unique:firsthand-data -->
The [breaker block](/learn/breaker-block/) rule takes those same 801 order blocks, waits for a close through one, and enters on the first retest in the direction of that close. It lost 18.44% in-sample, which cannot be told apart from zero, and 15.07% out-of-sample, which can. The report is the [breaker block backtest](/backtests/breaker-block-btcusdt/).

<!-- unique:firsthand-data -->
The [inverse fair value gap](/learn/inverse-fair-value-gap/) rule waits for a close through the whole of a fair value gap and enters on the first retest, in the direction of that close. Of the year's 1,930 gaps, 1,432 (74.20%) were closed through within 24 hours, and 62.75% of the retests came on the very next bar. It lost 63.09% and 45.44%, close to what the gap rule itself lost. This rule is written in that article's research script and is not among the engine's shipped strategies, so it has no page under backtests.

<!-- unique:firsthand-data -->
The [market structure shift](/learn/market-structure-shift/) article tests two rules on the break of structure swings, both taking the trend to be the direction of the previous break. The change of character rule trades only breaks against that direction: 854 of the year's 1,630 labelled breaks, which became 88 and 45 trades, too few to read in either sample. The market structure shift rule adds a displacement filter (a breaking bar of at least 1.5 ATR) and leaves out the sweep; it lost 24.92% in-sample over 135 trades with a t-statistic of -0.90, and made 59 trades out-of-sample. Both are in that article's research script, not in the engine.

The judas swing and the silver bullet are clock rules, and their write-ups sit with the other time terms further down.

<!-- unique:cross-reference -->
One check on the phrase "all eight lost". The individual articles also report sensitivity runs: other swing sizes, gap sizes, symbols and bar sizes. In those tables two blocks with at least 100 trades ended above zero after costs. One is the change of character rule with 3-bar swings, in-sample, at +6.11% on 159 trades. The other is the breaker block rule on SOLUSDT, in-sample, at +4.81% on 231 trades. Each has a t-statistic of 0.34, which cannot be told apart from zero, and neither article treats it as a finding.

Each result covers one mechanical reading of one concept, on crypto perpetuals, in a year when BTCUSDT fell 29.86%. None of them tests a trader who combines several of these ideas with judgement.

## Structure terms: where BOS, CHoCH and MSS blur

<!-- unique:cross-reference -->
All three are statements about swing points, and none of them is defined until "swing" is. A break of structure is a break in the direction of the trend. A change of character is the first break against it. LuxAlgo's entries for [break of structure](https://www.luxalgo.com/library/concept/break-of-structure/) and [change of character](https://www.luxalgo.com/library/concept/change-of-character/) (both checked 22 November 2026) agree on that split and then list what is open: whether a wick through the level counts or only a close, which swing is the one that matters, and whether smaller swings inside a larger leg count.

<!-- unique:cross-reference -->
Market structure shift is the least settled of the three. The change of character entry says many traders use the two terms interchangeably, while others keep "market structure shift" for a stronger version: a break delivered with displacement, a forceful one-way move, right after a sweep of the trend's extreme. LuxAlgo's own address for a market structure shift page redirects to its change of character page. Our table follows the stricter reading only so the two rows differ.

<!-- unique:firsthand-data -->
In code, the whole group hangs on one parameter: how many bars on each side make a pivot. We counted them on our year of BTCUSDT 15-minute bars. With k at 2 there are 9,659 swing highs and lows, about 26 a day. With k at 20 there are 1,198, about 3 a day. My guess before counting was a handful per week at k of 20. It was wrong: the real figure is 23 a week. Between the two settings lies an eightfold difference from one number, so a "break of structure strategy" with k left unstated is a family of strategies. The count describes the chart and tests nothing. We have since run five members of that family, with k from 1 to 10; the break of structure article has the table, in which every block with at least 100 trades lost after costs.

## Zone terms: order blocks and their failures

<!-- unique:cross-reference -->
An order block is the last candle that closed against a move before the move took off, and the move is the part that matters. LuxAlgo's [order block entry](https://www.luxalgo.com/library/concept/bullish-bearish-order-block/) (checked 22 November 2026) says the candle alone is not the concept, lists several ways traders draw the zone (the candle's full range, its body only, its open to its extreme, sometimes refined to the midpoint), calls none of them official, and adds that no reliable hit rate exists. The TradingView script goes further on cause, describing order blocks as areas where institutional participants open positions. A chart cannot confirm who traded there.

<!-- unique:cross-reference -->
The other two zone terms are defined by failure. A [breaker block](https://www.luxalgo.com/library/concept/breaker-block/) is an order block that price traded through, after which that zone is read in the opposite direction. LuxAlgo notes two readings in circulation: a strict one in which a sweep of a prior high or low must come first, and a looser one in which any violated order block qualifies. An [inverse fair value gap](https://www.luxalgo.com/library/concept/inversion-fvg/) is the same move applied to a gap, and the open question there is whether price must close through the whole gap or only past its midpoint. On our chart the two readings give 1,432 and 1,543 inverted gaps out of 1,930.

<!-- unique:operator-view -->
Here is the testing problem those two create, seen from the side of someone who has to write the code. A zone that holds gets counted as an order block doing its job. A zone that breaks gets renamed and counted as a breaker doing its job. Each can be coded and tested by itself, with its entry fixed in advance, and we have now done both. On our chart 59.68% of order blocks were closed through within 24 hours of forming, and of the blocks that gave an order block entry signal, 63.60% later gave a breaker block signal in the opposite direction. What cannot be tested is a reading that picks whichever label fits once the candles are in.

## Time terms: kill zones and the silver bullet

<!-- unique:cross-reference -->
Kill zones are clock windows, and the clock is New York's. LuxAlgo's [killzones entry](https://www.luxalgo.com/library/concept/killzones/) (checked 22 November 2026) gives the most cited set as London open 02:00 to 05:00, New York morning 07:00 to 10:00, London close 10:00 to 12:00 and New York afternoon 13:30 to 16:00, plus an Asian window in the evening and a variant of 08:30 to 11:00 for index futures. It also says the boundaries differ by 30 to 90 minutes across sources. A 90-minute shift on a three-hour window moves half of it.

<!-- unique:cross-reference -->
The silver bullet narrows the clock to one hour. LuxAlgo's open-source [ICT Silver Bullet script](https://www.tradingview.com/script/fq4wSUev-ICT-Silver-Bullet-LuxAlgo/), created on 4 July 2023, lists three windows in New York time (03:00 to 04:00, 10:00 to 11:00, 14:00 to 15:00) in which a fair value gap has to form. It sets minimum distances of 40 ticks for index futures and 15 pips for forex. LuxAlgo's [silver bullet entry](https://www.luxalgo.com/library/concept/silver-bullet/) states that no audited public statistics exist for the model.

<!-- unique:cross-reference -->
The [judas swing](https://www.luxalgo.com/library/concept/judas-swing/) and the [power of 3](https://www.luxalgo.com/library/concept/accumulation-manipulation-distribution/) describe the shape of a session: quiet around the open, a false move one way, the real move the other way. Both entries are frank that the shape is read backwards. The first says the pattern is confirmed by the failure and never assumed from the clock. The second calls the template descriptive, not mechanical, and easy to see on a finished candle.

<!-- unique:firsthand-data -->
Crypto perpetuals trade around the clock with no session open, and the sources above set their thresholds in forex pips and index-futures ticks, so we measured whether these windows carry over to BTCUSDT. A kill zone is a filter with no entry or exit, which makes the [kill zones](/learn/ict-kill-zones/) test a count: activity by New York clock hour over the year. The London window, 02:00 to 05:00, ran at 0.83 times the average 15-minute range and took 9.99% of the year's turnover in 12.5% of the clock. The busiest three-hour block, which we picked out after the count was done, was 09:00 to 12:00, at 1.54 times the average with 25.33% of turnover. New York time moves against UTC twice a year, and bitcoin's busiest bar moved with it, from 14:30 UTC to 13:30 UTC, so a backtest that hard-codes UTC hours tests a different window for part of the year.

<!-- unique:field-note -->
The same article regroups our published gap and sweep trades by the hour they were entered. That split was made after the fact, on rules with no clock in them, so it is the weakest evidence here. For what it shows: average R was negative in all 20 window cells, and the kill zones looked worse than the other hours in-sample and better out-of-sample, for both rules. A filter whose sign flips between two parts of one year is noise.

<!-- unique:firsthand-data -->
The [silver bullet](/learn/silver-bullet-strategy/) we ran as the fair value gap rule restricted to the three one-hour windows, with the gap formed and entered inside the same hour. On 15-minute bars that left 50 and 21 trades, too few to read. On 5-minute bars 300 in-sample trades lost 46.82% after costs and 144 out-of-sample trades lost 18.08%. On 1-minute bars 2,447 and 1,116 trades lost 97.43% and 79.68%. With costs at zero the 1-minute returns were -2.66% and +2.23%, with t-statistics of -0.26 and 0.49; the 5-minute rule was negative in-sample even then, with a t-statistic of -3.01, and flat out-of-sample. The clock itself showed nothing: run on each of the 24 hours separately, the three taught hours ranked 4th, 15th and 24th before costs on 1-minute bars.

<!-- unique:firsthand-data -->
For the [judas swing](/learn/judas-swing/) we used the 20:00 to 00:00 New York range. On 240 of 361 days price broke it between 00:00 and 05:00 and closed back inside, and 53 of those moves (22.08%) reached the far side of the range before going back beyond the false move. The same bars with random directions give 19.78%, and the real figure sits inside the band that 95% of those replays fall in. Traded mechanically, the rule lost 27.69% in-sample over 164 trades, with a t-statistic of -3.74, and made 76 trades out-of-sample, too few to read. The power of 3 has no trade rule of its own, so it was counted as a day template: it fit 37.12% of the days, and 35.13% of the same days with every bar's direction randomised.

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
Step 4 is where the gap and sweep tests died. Both rules put the stop just behind a wick or a gap, which makes it tight. The median in-sample stop was 0.323% of price away in the gap test and 0.296% in the sweep test, so a 0.15% round trip in fees and slippage cost 0.46R and 0.51R before the trade had done anything. The order block and breaker block tests have the same problem, with median in-sample stops of 0.330% and 0.310%, and so does the judas swing at 0.274%. The silver bullet on 1-minute bars is the far end of it: a median stop 0.086% of price away, so the same round trip cost 1.74 times the risk. Try a stop that tight in the [position size calculator](/tools/position-size-calculator/) to see what it does to position size, and to the fee as a share of risk.

## What this page does not claim

It does not claim ICT trading fails. All twelve concepts now have a test behind them, but each was tested in one mechanical form, on one year of crypto data. Two of the twelve are counts, not backtests, and five of the ten backtests have a sample too small to read out-of-sample. That is thin ground for a verdict on a method whose own home page speaks to forex traders and which is used with discretion.

It does not claim ICT trading works either. No rule on this page kept a statistically defensible edge once costs were charged, and for the method as a whole we found no verified record. When we publish another test, its row in the table changes and this page's date changes with it.

## FAQ

### Is ICT trading the same as smart money concepts?

Close to it. ICT refers to Michael J. Huddleston's own teaching, and smart money concepts is the wider community's label for the same core ideas, sometimes with renamed terms. In practice the two names are used interchangeably.

### Who created ICT trading?

Michael J. Huddleston, who publishes as The Inner Circle Trader. His own site introduces him under that name and points to his YouTube lectures. We could not find dated primary sources for when each individual term was first used.

### What are the ICT kill zone times?

The most cited set, in New York time, is 02:00 to 05:00 for the London open and 07:00 to 10:00 for the New York morning, with further windows for the London close and the New York afternoon. Sources differ on the edges by 30 to 90 minutes. On BTCUSDT we measured each window, and the London one turned out quieter than the average hour.

### What is the difference between a break of structure and a change of character?

Direction. A break of structure takes out a swing point in the direction of the existing trend. A change of character is the first break against it. Both depend on how a swing is defined, which the terms themselves don't settle. The break of structure rule we backtested does not separate the two. A later test that does, taking the previous break as the trend, counted 776 breaks of structure and 854 changes of character in the year.

### Can ICT concepts be backtested?

Most of them, one at a time, once each is written as a fixed rule. Two of the twelve on this page, kill zones and the power of 3, describe a time of day or the shape of a day with no entry or exit, so they can be counted but not traded as written. The combined discretionary method cannot be tested until the discretion is written down, since a test needs to know in advance which candles count.

### Does ICT trading work?

<!-- unique:firsthand-data -->
Nobody has published evidence that settles it, and we haven't either. We tested one mechanical version of each of twelve concepts on a year of BTCUSDT. Ten were backtests. On 15-minute bars eight of them made enough trades to read in-sample, and all eight lost money after costs, from 18.44% for the breaker block retest to 93.98% for the liquidity sweep fade. The change of character and silver bullet rules made too few trades there, and the silver bullet on 1-minute bars lost 97.43%. In these runs none showed a measurable edge with costs removed. The other two were counts: bitcoin was busy in New York's morning and quiet in the London kill zone, and the power of 3 fit shuffled price paths about as often as real ones. We found no audited performance record for the method.
