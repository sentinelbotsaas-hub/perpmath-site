---
title: "Break of structure: 1,631 breaks counted, and a test too thin to read"
slug: "break-of-structure"
description: "Break of structure (BOS) as a rule a program can check, 1,631 breaks followed on a year of BTCUSDT, and a backtest whose out-of-sample block has too few trades."
date: "2026-11-22"
lastmod: "2026-11-22"
lang: "en"
category: "Backtests"
tags: ["break of structure", "BOS", "market structure", "change of character", "backtest", "BTCUSDT"]
keywords: ["break of structure", "BOS trading", "market structure break", "BOS vs CHoCH", "break of structure strategy"]
tldr: "A break of structure (BOS) is a close beyond the most recent swing high or low, read as the trend carrying on. We coded it with swings of 5 bars either side and followed every break on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026. Of 1,631 breaks, 55.24% had closed back through the broken level within four bars. Trading them lost 43.34% in-sample over 149 trades, with a t-statistic of -1.57 that cannot be told apart from zero. Out-of-sample the rule made 42 trades, too few to read: their average R is +0.06 and equity still fell 3.35%."
---

<!-- unique:firsthand-data -->
Six signal strategies ship with the engine, and this is the only one with a block we can't read. Out-of-sample, the break of structure rule made 42 trades. Their average R is +0.06, and the account still ended 3.35% down. The engine flags any sample under 100 trades as insufficient, and here that flag is the whole result: it is neither a win nor a loss. What the data does support is a count of what price did after 1,631 breaks, and that count is harder on the idea than the backtest is.

## What is a break of structure?

A break of structure is price breaking through the most recent swing high in an uptrend, or the most recent swing low in a downtrend. "Structure" is the sequence of those swing points. While price keeps breaking them in one direction, the trend is said to be intact, and each break is read as confirmation that it continues.

"Market structure break" is the plain-English name for the same event. The vocabulary of [ICT trading and smart money concepts](/learn/ict-trading/) then splits it by direction. A break that goes with the trend is a break of structure, BOS for short. The first break against the trend is a change of character, or CHoCH, and is read as a warning that the trend may be turning.

<!-- unique:cross-reference -->
On origin we found less than for other terms. [TMGM's guide](https://www.tmgm.com/en/academy/trading-academy/break-of-structure) (last updated 5 November 2026, checked 22 November 2026) says BOS is commonly associated with smart money concepts and Inner Circle Trader terminology, and that the underlying principle belongs to traditional price action analysis. The [LuxAlgo library entry](https://www.luxalgo.com/library/concept/break-of-structure/) (checked 22 November 2026) names no originator at all. We found no dated primary source for who first used the phrase, so we attribute it to nobody.

## What must be decided before a program can find one?

Three things: how many bars make a swing, whether a wick through the level counts, and what "trend" means. The sources we read on 22 November 2026 are frank that all three are open.

LuxAlgo's entry on [swing highs and lows](https://www.luxalgo.com/library/concept/swing-high-low/) says the number of bars checked on each side is the only parameter and that there is no universal setting for it. Small values mark every wiggle, large ones keep only major turns. It also points out the awkward part: a swing with a strength of 5 is only knowable five bars after it printed. Its break of structure entry says many traders want a candle body to close beyond the level, others accept a wick, and some sources use BOS loosely for any structural break. TMGM says no single way of picking swings is universally required and warns that changing the definition after seeing the outcome introduces hindsight bias.

Here is the version we tested, from the docstring of [break_of_structure.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/strategies/break_of_structure.py) in the open-source engine (checked 22 November 2026):

```
swing high:  a high above the highs of the 5 bars before it and the 5 after it
swing low:   a low below the lows of the same neighbours (a tie means no swing)
known:       only once the 5 later bars have closed;
             a newly confirmed swing replaces the older one, higher or lower

break up:    close > latest swing high   -> long at the next bar's open
break down:  close < latest swing low    -> short at the next bar's open
             a wick through the level is not a break; each level breaks once

stop:        long:  latest swing low  - 0.1 x ATR(14)
             short: latest swing high + 0.1 x ATR(14)
target:      2 x risk from the fill price
```

That settles the three open points like this, and none of the answers is the only reasonable one.

- **Swing size.** Five bars either side. The module's own notes say the three-candle swing (1 each side) and the five-bar fractal (2 each side) are also common.
- **Wick or close.** A close is required.
- **BOS or CHoCH.** Telling them apart needs a definition of trend, and the module does not make one. Every break of the latest swing is traded the same way, so this is a test of structure breaks in general.
- **Entry.** A market order at the open after the breaking bar. LuxAlgo's entry says most BOS-based models do not buy the break itself and wait for a retracement instead. No retest entry is used here.
- **Stop distance.** Whatever the distance to the opposite swing happens to be. It is not capped.

The engine holds one position at a time. According to its [changelog](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/CHANGELOG.md), the parameters were written down on 21 November 2026 (UTC) before the first run on real data, run once and not changed.

## What happened after 1,631 breaks?

<!-- unique:firsthand-data -->
More than half were undone within an hour. The data is 35,040 BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, none missing. The rule confirmed 2,214 swing highs and 2,225 swing lows on it, and price closed through the latest of them 1,631 times: 801 upward, 830 downward, about 4.5 breaks a day.

The backtest can't use most of them, as we'll see, so we measured them directly. For every break we asked two things. Did a later bar close back on the old side of the broken level? And, measured from the next bar's open, was price further along in the break's direction 20 bars later?

| Breaks | Count | Closed back within 4 bars | Within 20 bars | Within 96 bars | Further along after 20 bars |
| --- | --- | --- | --- | --- | --- |
| All | 1,631 | 55.24% | 76.61% | 88.20% | 45.79% |
| Upward | 801 | 55.81% | 76.75% | 88.74% | 45.00% |
| Downward | 830 | 54.70% | 76.48% | 87.68% | 46.56% |
| Same direction as the break before | 776 | 56.44% | 75.64% | 86.73% | 46.65% |
| Opposite to the break before | 854 | 54.10% | 77.46% | 89.53% | 44.95% |

<!-- unique:original-calc -->
A break that "confirms the trend" should at least stay broken. On this chart 55.24% of breaks had a close back through the level within four bars, and 76.61% within twenty. The last column is no better. Twenty bars on, price was further along in the break's direction 45.79% of the time. Take any bar of the year, break or not, and the same measurement comes out at 50.10% upward and 49.89% downward. The average move after a break was -0.016% over those twenty bars, which is nothing.

<!-- unique:firsthand-data -->
The last two rows are our attempt at the BOS and CHoCH split. With no trend definition in the rule, we used the simplest proxy available: a break in the same direction as the previous break counts as continuation, a break in the opposite direction as reversal. By that measure there were more reversals (854) than continuations (776), and the two groups behaved alike. Continuation breaks were further along after 20 bars 46.65% of the time, reversal breaks 44.95%. The first break of the year has no predecessor and is in neither row.

Three cautions about this table. The windows overlap, so these are descriptions of one chart and not independent trades, and we give no t-statistic for them. Nothing here includes costs. And a proxy for trend is still a proxy: someone who labels BOS and CHoCH from higher highs and higher lows on a larger timeframe would sort these 1,631 breaks differently.

## The backtest, and the block we can't read

<!-- unique:firsthand-data -->
In-sample the rule lost 43.34%, and out-of-sample it has too few trades to say anything. In-sample is the first 70% of the year; out-of-sample starts on 31 July 2026. The full report is the [break of structure backtest page](/backtests/break-of-structure-btcusdt/).

| Sample | Trades | Win rate | Avg R | t-stat | Total return | Max drawdown | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| In-sample | 149 | 31.54% | -0.17 | -1.57 | -43.34% | 53.72% | Cannot be told apart from zero |
| Out-of-sample | 42 | 40.48% | +0.06 | -0.11 | -3.35% | 23.57% | Too few trades |

Costs are 0.055% per fill, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. Position size is 100% of equity, with no leverage. The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of per-trade net returns against zero, and the verdict column is the fixed rule printed on our [backtests](/backtests/) page: under 100 trades, too few; otherwise a clear result needs an absolute t of 2.

<!-- unique:original-calc -->
Start with the in-sample row, which looks contradictory. The account lost 43.34% of its money and the verdict is "cannot be told apart from zero". Both are true. The average trade lost 0.345% of notional, more than twice the 0.15% round-trip cost, but the trades vary enormously: backing the spread out of the published t-statistic gives a standard deviation of about 2.7% per trade, against about 0.8% for the [order block](/learn/order-block/) rule on the same candles. With 149 trades that noisy, a loss this size could be bad luck. It could also be a real negative edge. The test can't separate the two.

<!-- unique:original-calc -->
Now the out-of-sample row. A positive average R next to a negative return is not a misprint. R counts every trade equally, whatever the distance to its stop. The return is compounded on the full position, so trades with a far stop move it more. Splitting the 42 trades at their median stop distance shows it plainly:

| Out-of-sample trades | Trades | Win rate | Avg R | Sum of trade returns |
| --- | --- | --- | --- | --- |
| Stop at or under the median distance | 21 | 47.62% | +0.27 | +8.49% |
| Stop beyond the median distance | 21 | 33.33% | -0.14 | -10.42% |

The half with nearer stops did well in R and in money. The half with farther stops lost a little in R and a lot in money. Average the R column and you get +0.06; add the money column and you get a loss. At 42 trades neither figure is a result, and splitting 42 into two piles of 21 is illustration, not evidence.

<!-- unique:firsthand-data -->
Why so few trades from 1,631 breaks? The stop sits at the opposite swing, so positions last a long time: 147.54 bars on average in-sample (36.88 hours) and 234.26 bars out-of-sample (58.56 hours). The rule ignores new breaks while it is in a position, and 1,440 of the 1,631 signals, 88.29%, arrived at such a time. The parameters were not changed to get more trades.

<!-- unique:original-calc -->
Longs and shorts, for the record: in-sample 65 longs won 26.15% and 84 shorts won 35.71%, in a year when BTCUSDT fell 29.86%. Out-of-sample it was 21 of each, winning 42.86% and 38.10%. A 2R target breaks even at 33.33% before costs.

## Five swing sizes: every block with 100 trades lost

<!-- unique:firsthand-data -->
The swing size is the number the whole definition hangs on, so we reran the engine with 1, 2, 3 and 10 bars either side next to the published 5. The list was fixed before the first of these runs, on 21 November 2026 (UTC), after the published result already existed. Nothing was added or dropped afterwards. It is a sensitivity table and no row in it is a recommendation. An asterisk marks a block with under 100 trades.

| Swing bars each side | Trades in / out | t-stat in / out | Return in / out | Zero-cost return in / out |
| --- | --- | --- | --- | --- |
| 1 | 342 / 142 | -2.66 / -0.84 | -62.70% / -16.11% | -33.68% / -0.52% |
| 2 | 225 / 105 | -0.42 / -0.16 | -19.69% / -4.04% | +15.32% / +1.64% |
| 3 | 206 / 80* | -1.14 / 0.31 | -37.06% / +3.91% | -21.90% / +12.13% |
| 5 (published) | 149 / 42* | -1.57 / -0.11 | -43.34% / -3.35% | -35.56% / +0.91% |
| 10 | 72* / 21* | 1.06 / -0.12 | +38.22% / -3.67% | +51.29% / -1.05% |

<!-- unique:original-calc -->
Six of the ten blocks have at least 100 trades, and all six lost money after costs. Only one of them, the 1-bar swing in-sample, has a t-statistic beyond -2. The other five lost without the loss being distinguishable from zero.

<!-- unique:original-calc -->
Two blocks are positive after costs, and both are under 100 trades. The eye goes straight to the 10-bar swing in-sample: +38.22%. It rests on 72 trades with a t-statistic of 1.06, and the same setting lost 3.67% out-of-sample on 21 trades. Presenting that row as "the swing length that works" would be picking a parameter after seeing five outcomes, on a sample the engine itself refuses to read. We are not doing that, and you shouldn't either.

The table does show one mechanical thing. Smaller swings mean nearer stops (a median 0.75% of price at 1 bar against 1.46% at 5) and more trades, so costs take a bigger share: the 1-bar row goes from -62.70% to -33.68% when costs are removed, while the published row moves by under 8 points.

## Why costs are not the story this time

<!-- unique:original-calc -->
In the [fair value gap](/learn/fair-value-gap/) and [liquidity sweep](/learn/liquidity-sweep/) tests the stop sat a third of a percent from the entry, and the 0.15% round trip ate about half the risk on every trade. Here the median distance from fill to stop is 1.46% of price in-sample and 1.41% out-of-sample, so the round trip is about a tenth of the risk, 0.10R and 0.11R. No trade in either sample had a stop closer than the cost. The distances are also all over the place, from 0.25% to 7.33% in-sample, which is where the noisy returns come from. If you size positions by risk, the nearest and the farthest of those stops call for positions almost thirty times apart in size; the [position size calculator](/tools/position-size-calculator/) shows the effect.

<!-- unique:firsthand-data -->
With fees and slippage at zero, the published setting returned -35.56% in-sample (145 trades, t of -1.23) and +0.91% out-of-sample (43 trades). Costs account for under a fifth of the in-sample loss. The rest is the trades themselves, and the test can't say whether that part is edge or luck.

One cost the engine leaves out matters more here than in the other tests. Perpetuals pay or charge funding, every eight hours on BTCUSDT, and the average trade here stayed open for 36.88 hours in-sample and 58.56 hours out-of-sample. That is 4.6 and 7.3 funding settlements a trade that the backtest does not count. Our [funding rate page](/data/funding-rate/) shows what those payments have been running at.

## Limits, and the commands to rerun it

This is one coin, one timeframe and one falling year. The engine fills at the next bar's open, counts the stop first when a bar touches both stop and target, and ignores funding. The rule has no higher-timeframe bias, no session filter and no retest entry, and it does not separate continuation from reversal. A trader who waits for a pullback into an order block or a [breaker block](/learn/breaker-block/) after the break is running a different rule, which this test does not cover.

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest break_of_structure --symbol BTCUSDT --interval 15m --config configs/break_of_structure.json --out results/break-of-structure-btcusdt.json
```

On Windows the activate line is `.venv\Scripts\activate`. No account or API key is involved. For the other swing sizes, copy `configs/break_of_structure.json`, set `swing_left` and `swing_right`, and point `--config` at the copy. Our rerun of the published setting gave the published metrics exactly. The engine is described in the [bot section](/bot/), and our guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) covers why a block under 100 trades gets no verdict.

## FAQ

### What does BOS mean in trading?

Break of structure: price closing beyond the most recent swing high in an uptrend or swing low in a downtrend. It is read as the trend continuing. In our test it is a close above the latest confirmed swing high, or below the latest swing low, where a swing needs 5 lower highs or 5 higher lows on each side.

### What is the difference between BOS and CHoCH?

Direction relative to the trend. A break with the trend is a BOS; the first break against it is a change of character. The difference depends entirely on how trend is defined. Using the direction of the previous break as the definition, we found 776 continuation breaks and 854 reversal breaks, and no visible difference in what price did next.

### Does a break of structure need a candle close?

Conventions differ. Many traders want a body close beyond the level and treat a wick through it as a possible [liquidity sweep](/learn/liquidity-sweep/); others count the wick. Our rule requires a close. Whichever you use, fix it before looking at results.

### How often does a break of structure fail?

<!-- unique:firsthand-data -->
On our BTCUSDT 15-minute data, 55.24% of breaks were followed within four bars by a close back on the old side of the level, 76.61% within 20 bars and 88.20% within 96 bars. A close back through the level is not the same as a losing trade, since the stop in our rule sits at the opposite swing.

### Which swing length is best?

None of the five we ran can be called best. Every block with at least 100 trades lost after costs, and the two positive blocks had 72 and 80 trades, below the minimum the engine will read. Choosing among them now would be fitting a parameter to one year.

### Did the break of structure strategy work out-of-sample?

It can't be judged. The out-of-sample block has 42 trades, the engine marks it as an insufficient sample, and its average R of +0.06 sits next to a 3.35% fall in equity. That is not a pass and not a fail. More data would settle it, and until someone runs that, what would you be trading on?
