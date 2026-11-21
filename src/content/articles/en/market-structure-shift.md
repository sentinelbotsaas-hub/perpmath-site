---
title: "Market structure shift (MSS) and CHoCH: 854 reversal breaks, tested"
slug: "market-structure-shift"
description: "Market structure shift (MSS) and change of character (CHoCH) as rules a program can check, how five sources tell them apart, and a one-year BTCUSDT backtest."
date: "2026-12-01"
lastmod: "2026-12-01"
lang: "en"
category: "Backtests"
tags: ["market structure shift", "MSS", "change of character", "CHoCH", "break of structure", "backtest", "BTCUSDT"]
keywords: ["market structure shift", "MSS trading", "change of character", "CHoCH", "MSS vs CHoCH", "CHoCH vs BOS"]
tldr: "A change of character (CHoCH) is the first break of a swing point against the trend. A market structure shift (MSS) is either the same thing or a stricter version with displacement, depending on the source. We coded both on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026, calling a break a reversal when it points the other way from the break before it. Of 1,630 labelled breaks, 854 (52.39%) were reversals. Trading only those made 88 trades in-sample and 45 out-of-sample, both under the 100 the engine needs, so the +8.38% and -2.01% next to them are not results. Adding a displacement filter gave 135 in-sample trades and a 24.92% loss that cannot be told apart from zero."
---

<!-- unique:firsthand-data -->
A market structure shift is taught as the moment a trend turns, something rare enough to wait for. On a year of BTCUSDT 15-minute candles it was the ordinary case. We labelled each of 1,630 breaks of a swing point by the break before it: 776 pointed the same way and 854 pointed the other way. Then we traded only the 854. That rule made 133 trades in the year, too few for a verdict, and the stricter version with a displacement filter lost 24.92% in-sample.

## What do MSS, CHoCH and BOS mean?

All three name a close beyond a swing high or a swing low. They differ in what the break is supposed to say about the trend.

- **Break of structure (BOS).** Price breaks a swing point in the direction the trend was already going. It is read as continuation, and our [break of structure](/learn/break-of-structure/) article covers it.
- **Change of character (CHoCH).** The first break against the trend. In an uptrend that is a break of a recent higher low. It is read as a warning that the trend may be turning.
- **Market structure shift (MSS).** Depending on who is speaking, another name for a change of character or a stricter version of it, usually one that needs a forceful move (displacement) and sometimes a [liquidity sweep](/learn/liquidity-sweep/) first.

The terms belong to the vocabulary of [ICT trading and smart money concepts](/learn/ict-trading/). They describe one mechanical event, a close through a level, and attach three stories to it. Which story applies depends on something none of the terms defines: what the trend was.

## How do five sources separate MSS from CHoCH?

<!-- unique:cross-reference -->
They don't agree, and two of them say so outright. We read five published explanations on 22 November 2026 and put the same questions to each.

| Source | Change of character | Market structure shift | Sweep needed for MSS? | Wick or close |
| --- | --- | --- | --- | --- |
| [LuxAlgo library](https://www.luxalgo.com/library/concept/change-of-character/) (no date shown) | First structural break against the prevailing trend | Used interchangeably by many; others keep it for a break with displacement right after a sweep. Calls neither usage official | Only in the stricter usage | A body close is the usual filter |
| [TMGM academy](https://www.tmgm.com/en/academy/trading-academy/market-structure-shift) (updated 5 November 2026) | Not consistently separated from MSS across frameworks | A break of a meaningful swing against the trend; a stricter ICT-style reading adds displacement | Not universally | A body close is clearer; wicks are not excluded |
| [ATAS blog](https://atas.net/blog/understanding-market-structure-and-market-structure-shift-mss/) (24 February 2025) | An early warning | Stronger evidence, often with a fast impulsive move | No, liquidity is context | Not addressed |
| [LiteFinance](https://www.litefinance.org/blog/for-beginners/trading-strategies/ict-market-structure-shift/) (11 November 2026) | Break of a significant higher low or lower high; no sweep or displacement needed | Stricter: typically a sweep, then a decisive move | Optional in one section, asked for in another | Close required |
| [Backtrex](https://backtrex.com/en/blog/market-structure-shift-vs-choch) (6 November 2026, updated 13 November) | First break against the trend; no sweep or displacement | Needs all three: a prior sweep, a displacement candle that leaves a fair value gap, a close beyond the last major swing | Yes | Close |

<!-- unique:cross-reference -->
Read down the third column and there are three positions. A market structure shift is the same thing as a change of character (LuxAlgo and TMGM both report this as common usage). It is the same thing plus displacement (TMGM's stricter reading, ATAS, LuxAlgo's second usage). Or it needs a sweep, displacement and a close together (Backtrex). LiteFinance sits between the last two and disagrees with itself about the sweep. LuxAlgo's own address for a market structure shift page redirects to its change of character entry.

<!-- unique:cross-reference -->
On origin we found nothing we can date. LiteFinance and Backtrex credit the method to Michael Huddleston, the Inner Circle Trader, and Backtrex refers to an official ICT definition. Neither points to a lecture or a document where either term is defined, and we did not find one, so this article attributes no wording to him. All five sources are companies with something to sell: indicators, brokerage, charting or backtesting software. Keep that in mind when one of them calls a signal stronger.

## What counts as the trend?

<!-- unique:cross-reference -->
Every definition above leans on that question, and none answers it with a number. LuxAlgo's entry gives two readings of which level has to break. The strictest uses the higher low that produced the trend's final high. A looser one accepts any recent higher low, smaller internal ones included, and gets earlier signals with more false alarms. TMGM says there is no universally accepted mechanical definition of a valid shift, and warns that indicators which confirm pivots late make historical signals look cleaner than live ones.

A program needs one answer. We picked the one that adds no new parameter: **the trend is the direction of the most recent break.** An up break after an up break is a continuation. A down break after an up break is a reversal. It is the proxy the break of structure article already used for its counts, and it is crude. Someone reading trend from a 4-hour chart would label these breaks differently.

<!-- unique:firsthand-data -->
With that definition, a count needs no backtest. Swings and breaks follow the rules of the engine's `break_of_structure` example: a swing high is a high above the highs of k bars on each side, known only once the k later bars have closed, and a break is a close beyond the latest one. Here is the year at five values of k.

| Swing bars each side | Breaks | Continuations | Reversals | Reversal share | Average streak | Streaks of one break |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4,899 | 2,363 | 2,535 | 51.76% | 1.93 breaks | 50.39% |
| 2 | 3,205 | 1,511 | 1,693 | 52.84% | 1.89 breaks | 52.48% |
| 3 | 2,416 | 1,152 | 1,263 | 52.30% | 1.91 breaks | 51.11% |
| 5 | 1,631 | 776 | 854 | 52.39% | 1.91 breaks | 52.51% |
| 10 | 890 | 429 | 460 | 51.74% | 1.93 breaks | 51.41% |

A streak is a run of breaks in one direction, which is as close as this definition gets to "a trend". The first break of the year has no predecessor and is in neither middle column.

<!-- unique:original-calc -->
At every swing size a break was followed by a break the other way a little more often than by one the same way. Flip a coin for each break's direction and you would expect a 50% reversal share, an average streak of 2 breaks, and half of all streaks ending after one. The chart gives about 52%, 1.9 and 51%. On the 5-bar setting the year had 855 streaks. Of those, 449 were a single break and only 21.64% reached three. The longest ran to 11.

<!-- unique:original-calc -->
So under this definition a change of character is not a rare warning. It is what follows most breaks, 2.34 times a day at 5 bars. Two cautions: the five rows share one chart and are not five independent confirmations, and a two-point lean is small. It does line up with something we measured on the same candles for the [mean reversion](/learn/mean-reversion-strategy/) article, where 15-minute returns showed a faint tendency to undo themselves.

## The rules we ran

```
swing high / low:  5 bars either side, known 5 bars later
break up:          close > latest swing high
break down:        close < latest swing low      (a wick is not a break)
direction:         that of the most recent break, traded or not

continuation:      a break in the same direction as the one before    "BOS"
reversal:          a break in the opposite direction                  "CHoCH"

choch_break:       trade reversals only, in the direction of the new break
mss_displacement:  the same, and the breaking bar's true range >= 1.5 x ATR(14)
bos_continuation:  trade continuations only (the comparison)

stop:              latest swing on the other side, 0.1 x ATR(14) beyond it
target:            2 x risk from the fill, which is the next bar's open
```

These three strategies are not among the engine's shipped examples. They are written in our research script, `research/market-structure-shift/market-structure-shift_research.py` in this site's source, which registers them in the running Python process and then calls the engine's real command line. Swing, break, stop and target are the rules of the shipped [break_of_structure.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/b1c4fd990633343427fe45df30fa9c6206cd2961/src/perpmath/strategies/break_of_structure.py) (checked 22 November 2026) with its five parameters untouched. The one new number, 1.5 for displacement, and the list of runs were written into the script's header on 21 November 2026 (UTC), before the first run on real data. Nothing was changed afterwards.

The vague parts of the teaching, and what we decided for each:

- **Trend.** One break long, as above.
- **Which level.** The latest confirmed swing, whatever its height. It is not specifically the higher low that produced the high.
- **Displacement.** The breaking bar's true range, at least 1.5 times the 14-bar ATR. Backtrex's reading asks for a fair value gap left behind, which is only known one bar later.
- **Sweep.** Not coded. The strictest reading of a market structure shift is therefore not what we tested.
- **Entry.** A market order at the next bar's open, with no retest.

## Trading only the reversals: 133 trades and no verdict

<!-- unique:firsthand-data -->
Both blocks have fewer than 100 trades, so neither return is a result. The data is 35,040 BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, none missing. In-sample is the first 70% of the year and out-of-sample starts on 31 July 2026. We ran engine version 0.2.2 on 21 November 2026 (UTC).

| Sample | Signals | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 583 | 88 | 30.68% | -0.21 | 0.41 | +8.38% | 24.40% | Too few trades |
| Out-of-sample | 271 | 45 | 40.00% | +0.07 | -0.08 | -2.01% | 15.41% | Too few trades |

Costs are 0.055% per fill, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. Position size is 100% of equity with no leverage, and funding is not modelled. The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of per-trade net returns against zero. Before simulating, the engine cut the data after all 854 signal bars and after 4,419 of the 34,185 other bars, reran the strategy on each shortened copy, and got the same decisions every time.

<!-- unique:original-calc -->
The in-sample row is the dangerous one, because it says +8.38%. It rests on 88 trades with a t-statistic of 0.41, and its average R is negative. Both can be true because R counts every trade equally and the account does not. The 61 stopped trades lost 1.57% of notional on average and the 26 that reached their target made 4.09% (the 88th was still open when the sample ended and was closed there): the winners happened to be the trades with wide stops. Add up the returns and there is a gain. Average the R multiples and you get -0.21.

<!-- unique:firsthand-data -->
Why only 133 trades from 854 signals? The stop sits at the opposite swing, a median 1.37% of price away in-sample, and the target is twice that distance. A trade lasted 242.75 bars on average in-sample, about 60.69 hours, and the rule was in a position for 87.4% of all in-sample bars. It ignored 721 of the 854 signals, 84.43%, since it was already in one.

<!-- unique:original-calc -->
Longs and shorts, for the record: in-sample 38 longs won 26.32% and 50 shorts won 34.00%; out-of-sample 26 longs won 30.77% and 19 shorts won 52.63%. A 2R target breaks even at 33.33% before costs.

## The same breaks, split in two

<!-- unique:firsthand-data -->
The engine's shipped break of structure rule trades every break, continuation or reversal alike; its report is the [break of structure backtest](/backtests/break-of-structure-btcusdt/). Splitting it in two shows where that rule's loss sat, with a caveat that follows the table. An asterisk marks a block under 100 trades.

| Breaks traded | Sample | Trades | Win rate | Avg R | t-stat | Return | Zero-cost return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All (shipped rule) | In | 149 | 31.54% | -0.17 | -1.57 | -43.34% | -35.56% |
| All (shipped rule) | Out | 42* | 40.48% | +0.06 | -0.11 | -3.35% | +0.91% |
| Continuations only | In | 151 | 32.45% | -0.17 | -1.61 | -42.64% | -28.20% |
| Continuations only | Out | 56* | 25.00% | -0.42 | -2.00 | -28.74% | -23.05% |
| Reversals only | In | 88* | 30.68% | -0.21 | 0.41 | +8.38% | +22.86% |
| Reversals only | Out | 45* | 40.00% | +0.07 | -0.08 | -2.01% | +2.63% |

<!-- unique:original-calc -->
The continuation half looks like the shipped rule: nearly the same number of in-sample trades and the same 43% loss. The reversal half does not lose. It is tempting to read that as "CHoCH works and BOS doesn't", and the table doesn't support it. Each rule holds one position at a time, so each ends up taking a different subset of the signals; 151 and 88 trades in the halves against 149 for both together is not a sum. Neither block of the reversal rule reaches 100 trades. And the continuation rule's in-sample t-statistic is -1.61, inside the range where a loss of that size can be luck.

## Does displacement make it a market structure shift?

<!-- unique:firsthand-data -->
It made the test readable and the result worse. Start with the count. Of the 854 reversals, 454 (53.16%) came on a bar whose true range was at least 1.5 times ATR. The median reversal bar measured 1.56 ATR, so the filter sits almost exactly on the typical breaking bar: a bar that closes through a swing level is usually a big bar already. Continuations were displaced a little more often, 450 of 776, or 57.99%.

| Reversal breaks | Count | Closed back within 4 bars | Within 96 bars | Further along after 20 bars |
| --- | --- | --- | --- | --- |
| All | 854 | 54.10% | 89.53% | 44.95% |
| With displacement | 454 | 47.36% | 85.84% | 44.81% |
| Without | 400 | 61.75% | 93.72% | 45.11% |

<!-- unique:original-calc -->
"Closed back" means a later bar closed on the old side of the broken level. A displaced break stays broken a little longer, which is close to arithmetic: a bigger bar closes further past the level, so price has further to come back. The last column is the one that matters for a trade. Twenty bars on, measured from the next bar's open, price had gone further in the break's direction 44.81% of the time after a displaced reversal and 45.11% after a quiet one. The break of structure article measured the same thing from every bar of the year and got about 50%.

<!-- unique:firsthand-data -->
The backtest of `mss_displacement` at 5 bars: 317 in-sample signals became 135 trades that won 32.59% and lost 24.92% (average R -0.15, t-statistic -0.90, maximum drawdown 36.57%). Out-of-sample, 137 signals became 59 trades and a 15.03% loss, which is under 100 trades and not readable. With fees and slippage at zero the two blocks returned -1.37% and -9.04%. The in-sample block is the only one in this section with enough trades, and its verdict is that the loss cannot be told apart from zero.

<!-- unique:operator-view -->
I had assumed a filter could only cut the trade count. It went up, from 88 to 135 in-sample, on barely half the signals, and my first thought was a bug in the script. There wasn't one. The filtered trades were over in 109.39 bars on average where the unfiltered ones took 242.75, so the rule was free more often: in a position 60.4% of the time, down from 87.4%. Which trades a one-position rule takes depends on which earlier ones it took, and a filter reshuffles that. Two versions of "the same strategy" can share almost no trades.

## Five swing sizes, every row reported

<!-- unique:firsthand-data -->
The swing size is the number everything else hangs on. The list below is the one the break of structure article ran, and it was fixed before the first of these runs. It is a sensitivity table. No row in it is a setting to use.

| Swing bars each side | Trades in / out | t-stat in / out | Return in / out | Zero-cost return in / out |
| --- | --- | --- | --- | --- |
| 1 | 322 / 156 | -1.33 / -0.99 | -36.94% / -15.46% | +8.50% / +8.22% |
| 2 | 217 / 114 | -0.05 / -1.72 | -6.00% / -24.42% | +26.66% / -12.04% |
| 3 | 159 / 90* | 0.34 / -2.13 | +6.11% / -27.50% | +28.65% / -18.00% |
| 5 (published) | 88* / 45* | 0.41 / -0.08 | +8.38% / -2.01% | +22.86% / +2.63% |
| 10 | 69* / 32* | 0.27 / -0.18 | +3.96% / -3.53% | +11.13% / +0.62% |
| 2, with displacement | 246 / 99* | -1.81 / -0.87 | -39.29% / -11.71% | -15.23% / +2.12% |

<!-- unique:original-calc -->
Five blocks of the plain reversal rule have at least 100 trades. Four lost after costs, one gained 6.11%, and none has a t-statistic beyond 2 in either direction. All five out-of-sample blocks lost. A hopeful reader will spot the zero-cost in-sample figures, positive in all five rows of the plain rule. Their t-statistics run from 0.41 to 0.96, and the out-of-sample figures next to them include two double-digit losses. Five overlapping versions of one rule on one chart will produce a column like that from noise alone.

## What is not tested, and how to rerun it

Four things a believer in the idea could fairly point at. The sweep clause of the strict definition is not coded. Trend is one break long, with no higher timeframe. The entry is at the open after the break, where most teaching waits for a pullback into a [fair value gap](/learn/fair-value-gap/) or an [inverse fair value gap](/learn/inverse-fair-value-gap/). And it is one coin, one timeframe, one year in which BTCUSDT fell.

<!-- unique:original-calc -->
The engine fills at the next bar's open, counts the stop first when a bar touches both stop and target, and leaves funding out. That last one matters here: perpetuals settle funding every eight hours on BTCUSDT, so the average in-sample trade of 60.69 hours sat through about 7.6 settlements the backtest does not count. Our [funding rate page](/data/funding-rate/) shows what those have been running at. Stops ranged from 0.34% to 9.02% of price in-sample, and the [position size calculator](/tools/position-size-calculator/) shows how far apart the position sizes for those two would be if you sized by risk.

To rerun it, install the engine and download the same candles:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then register the strategy and call the engine's command line from Python, which is what our script does:

```python
import types
from perpmath import cli
from perpmath.strategies import STRATEGIES

STRATEGIES["choch_break"] = types.SimpleNamespace(DEFAULTS=BASE, generate=generate)
cli.main(["backtest", "choch_break", "--symbol", "BTCUSDT", "--interval", "15m",
          "--config", "choch.json", "--out", "choch-btcusdt.json"])
```

`BASE` is the parameter dictionary and `generate` is the function that returns the engine's `Signals` object; both are in the script, and the README's [Writing a strategy](https://github.com/sentinelbotsaas-hub/perpmath/blob/b1c4fd990633343427fe45df30fa9c6206cd2961/README.md#writing-a-strategy) section describes what such a function must do. Going through the command line means the engine runs its look-ahead check before it simulates anything. On Windows the activate line is `.venv\Scripts\activate`. No account or API key is involved. The engine's home on this site is the [bot section](/bot/), every published run is under [backtests](/backtests/), and the guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) explains why a block under 100 trades gets no verdict.

## FAQ

### What does MSS mean in trading?

Market structure shift: a break of a swing point against the prevailing trend, read as a sign that the trend may be turning. Some sources use it as another name for a change of character. Others require the break to come with a forceful move, and some also want a liquidity sweep first.

### Is a change of character the same as a market structure shift?

Often, but not always. LuxAlgo says many traders use the two interchangeably and TMGM says some do, while stricter readings keep "market structure shift" for a break with displacement. Ask which definition a chart tool or a teacher uses before comparing notes with anyone.

### What is the difference between CHoCH and BOS?

Direction relative to the trend. A break of structure goes with it and a change of character is the first break against it, so the labels depend entirely on how trend is defined. On our BTCUSDT data, taking the previous break as the trend, 854 breaks were changes of character and 776 were breaks of structure.

### How often does a change of character lead to a reversal?

<!-- unique:firsthand-data -->
On our chart, no more often than chance. Twenty bars after a reversal break, price was further along in the new direction 44.95% of the time, and 54.10% of those breaks saw a close back through the broken level within four bars. These are counts on overlapping windows, before costs, with our one-break definition of trend.

### Does displacement make a market structure shift more reliable?

Not in our data. Reversal breaks on a bar of at least 1.5 ATR were further along after 20 bars 44.81% of the time, against 45.11% for the rest, and trading only the displaced ones lost 24.92% in-sample over 135 trades with a t-statistic of -0.90.

### Did the CHoCH strategy make money?

It can't be judged. The published setting made 88 trades in-sample and 45 out-of-sample, the engine marks both as insufficient samples, and the +8.38% and -2.01% next to them are noise. With smaller swings there are enough trades, and four of the five readable blocks lost after costs. We have not tested the sweep clause or a higher-timeframe trend filter.
