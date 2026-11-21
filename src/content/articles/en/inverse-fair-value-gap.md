---
title: "Inverse fair value gap (IFVG): 1,432 inversions and a losing retest"
slug: "inverse-fair-value-gap"
description: "Inverse fair value gap (IFVG) as a rule a program can check: 74.20% of a year's BTCUSDT gaps were closed through, and trading the retest lost 63.09% after costs."
date: "2026-12-01"
lastmod: "2026-12-01"
lang: "en"
category: "Backtests"
tags: ["inverse fair value gap", "IFVG", "inversion fair value gap", "fair value gap", "backtest", "BTCUSDT"]
keywords: ["inverse fair value gap", "IFVG", "inversion fair value gap", "IFVG trading", "IFVG strategy"]
tldr: "An inverse fair value gap (IFVG), also called an inversion fair value gap, is a fair value gap that price has closed straight through; the zone is then read the other way round and traded on the retest. We coded that on BTCUSDT 15-minute bars from 18 November 2025 to 18 November 2026. Of 1,930 gaps, 1,432 (74.20%) were closed through within 24 hours, and 93.37% of those were retested, most on the very next bar. Entering on the retest lost 63.09% in-sample (621 trades) and 45.44% out-of-sample (301 trades) after costs. With fees and slippage at zero it returned -9.34% and -11.80%, neither distinguishable from zero."
---

<!-- unique:firsthand-data -->
What becomes of a fair value gap that fails? In ICT vocabulary it gets a second life: the zone flips, old support is read as resistance, and the failure is renamed an inverse fair value gap. We followed all 1,930 gaps on a year of BTCUSDT 15-minute candles to see how often that happens. Three in four were closed through within a day. Trading the retest of the flipped zone lost 63.09% in-sample and 45.44% out-of-sample, close to what trading the original gap had lost.

## Inverse fair value gap (IFVG): the definition, and where sources differ

An inverse fair value gap is a [fair value gap](/learn/fair-value-gap/) that price has traded back through and closed beyond. A bullish gap that fails becomes a bearish zone overhead; a bearish gap that fails becomes a bullish zone underneath. "Inversion fair value gap" is the same thing under its other common name, and IFVG abbreviates both. It is the gap's counterpart to the [breaker block](/learn/breaker-block/), which is a failed order block read in reverse, and both sit in the zone family of [ICT trading](/learn/ict-trading/).

<!-- unique:cross-reference -->
Three published descriptions, all read on 22 November 2026, agree on the outline and differ on the detail that decides which candles count.

| Source | What inverts the gap | Entry and stop | What it says about reliability |
| --- | --- | --- | --- |
| [LuxAlgo library](https://www.luxalgo.com/library/concept/inversion-fvg/) (no date shown) | Commonly a body close through the far side; some require the whole gap, others a close past its midpoint. A wick alone is a probe | First return to the zone; stop just beyond its far side | Calls it a hypothesis, and notes that many inverted gaps are reclaimed on the first retest |
| [LuxAlgo's open-source script](https://www.tradingview.com/script/8FHucjY6-Inversion-Fair-Value-Gaps-IFVG-LuxAlgo/) on TradingView (published 1 February 2024) | A close beyond the gap against its direction | Signal when price returns to the zone and rejects, judged on wick or close by a setting | Says backtesting its historical signals is incorrect |
| [Quantum Algo glossary](https://www.quantum-algo.com/glossary/inversion-fair-value-gap/) (published 21 September 2026) | A full body close beyond the far side; a close inside is a partial fill, a wick is a sweep | First retest; stop beyond the far edge | Advises caution on a second retest |

<!-- unique:cross-reference -->
On origin, the script's description says it is based on the inversion FVG concept by ICT, and Quantum Algo ties the idea to an ICT model without crediting anyone with inventing it. None of the three names a dated lecture, and we did not find one, so we attribute the term to nobody in particular. Both publishers sell charting tools.

## The rule, and what happened to 1,930 gaps

The version we tested takes the strict reading at each fork. It is described for a bullish gap; the bearish case is the mirror image.

```
gap:        low[3] > high[1], at least 0.5 x ATR(14) tall     zone = high[1] to low[3]
inversion:  within 96 bars, a bar closes below the bottom of the zone
retest:     within 96 bars of that close, the first bar whose high reaches the bottom
entry:      that bar closes at or below the top of the zone    -> short at the next open
            it closes above the top                            -> zone dropped, no trade
stop:       top of the zone + 0.1 x ATR(14), ATR read on the inverting bar
target:     2 x risk from the fill price
```

This strategy is not one of the engine's shipped examples. It is written in our research script, `research/inverse-fair-value-gap/inverse-fair-value-gap_research.py` in this site's source, which registers it in the running Python process and then calls the open-source engine's real command line. The gap itself is the shipped [fvg.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/b1c4fd990633343427fe45df30fa9c6206cd2961/src/perpmath/strategies/fvg.py) definition (checked 22 November 2026) with its five parameters unchanged: ATR 14, minimum size 0.5 ATR, 96 bars of waiting, 0.1 ATR stop buffer, 2R target. The rules were written into the script's header on 21 November 2026 (UTC), before the first run on real data, and not touched afterwards.

What we decided where the teaching is loose: inversion needs a close beyond the whole gap, not its midpoint. A wick does not count. No minimum size is asked of the bar that closes through, and no liquidity sweep has to come first. The zone keeps its original edges. Each zone is used once.

<!-- unique:firsthand-data -->
The data is 35,040 BTCUSDT 15-minute candles from Bybit's public [kline endpoint](https://bybit-exchange.github.io/docs/v5/market/kline), 11:30 UTC on 18 November 2025 to 11:30 UTC on 18 November 2026, none missing. It holds the same 1,930 gaps as our fair value gap article, 977 bullish and 953 bearish. Here is what became of them.

| Stage | Gaps | Share |
| --- | --- | --- |
| Fair value gaps of at least 0.5 ATR | 1,930 | |
| Closed through the far edge within 96 bars | 1,432 | 74.20% of gaps |
| Closed beyond the midpoint within 96 bars (the looser reading, counted only) | 1,543 | 79.95% of gaps |
| Inverse gaps retested within 96 bars | 1,337 | 93.37% of inverse gaps |
| Retest bar held: entry signal | 1,202 | 83.94% of inverse gaps |
| Retest bar closed back through: dropped | 135 | 9.43% of inverse gaps |
| Never retested | 93 | 6.49% of inverse gaps |

Two inverse gaps were still waiting when the data ended. The 1,202 signals fell on 1,181 bars, since a few bars retested more than one zone.

<!-- unique:original-calc -->
Before counting I would have guessed that about 40% of gaps get closed through within a day. It was 74.20%, and I was wrong by a wide margin. Put next to the fair value gap article's figure it reads more plainly: price came back to 1,776 of the 1,930 gaps, and 1,432 of those, four in five, ended up closed through. The close-through came a median 12 bars after the gap formed. A fair value gap on this chart was mostly a zone price would close through within a few hours.

<!-- unique:original-calc -->
And after the close-through? Measured from the next bar's open, price was further along in that direction 49.44% of the time twenty bars later, and 50.35% after 96 bars. An inversion told us nothing about what came next.

<!-- unique:firsthand-data -->
The retest needs a caution. Of the 1,337 retests, 839 (62.75%) happened on the very next bar after the close-through, and 80.10% within four bars. The bar that closes through a gap usually closes just beyond its edge, so the following bar reaches back to that edge almost by default. The picture in the tutorials, where price leaves and later returns, is the minority case under these rules. A version that demanded some distance first would be a different rule, and we have not run it.

<!-- unique:operator-view -->
There is also a scoring problem, the same one order blocks and breakers have. Of the 1,607 gaps that gave an entry under the fair value gap rule, 1,263 were later closed through, and 1,067 of the same gaps (66.40%) then gave an inverse signal in the opposite direction. Someone marking up a finished chart can count the bounce as a gap that held and the later break as an inversion that worked. Two of every three gaps would offer both. Only a rule with the entry fixed in advance can be scored, and that is the next section.

## The backtest: 922 trades, and about the loss of the gap it came from

<!-- unique:firsthand-data -->
The inverse rule lost money in both periods, and both losses are statistically clear. In-sample is the first 70% of the year and out-of-sample starts on 31 July 2026. We ran engine version 0.2.2 on 21 November 2026 (UTC). The last two rows are the engine's published [FVG backtest](/backtests/fvg-btcusdt/) on the same candles, for comparison.

| Rule | Sample | Trades | Win rate | Avg R | t-stat | Total return | Zero-cost return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inverse gap retest | In | 621 | 29.95% | -0.64 | -5.64 | -63.09% | -9.34% |
| Inverse gap retest | Out | 301 | 23.59% | -1.09 | -7.14 | -45.44% | -11.80% |
| Fair value gap return | In | 801 | 31.46% | -0.57 | -4.93 | -66.94% | +6.03% |
| Fair value gap return | Out | 304 | 27.96% | -0.83 | -5.23 | -42.86% | -10.05% |

Costs are 0.055% per fill, the VIP 0 taker rate for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page last updated 20 November 2026, checked 22 November 2026), plus an assumed 0.02% of slippage per fill. Position size is 100% of equity, no leverage, funding not modelled. The t-statistic is a [one-sample t-test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm) of per-trade net returns against zero. Before simulating, the engine cut the data after all 1,181 signal bars, reran the strategy on each shortened copy, and got the same decisions.

<!-- unique:original-calc -->
A 2R target breaks even at a 33.33% win rate before costs, which the [risk reward calculator](/tools/risk-reward-calculator/) will show for any ratio. The rule won 29.95% and 23.59%. With fees and slippage at zero it won 32.86% and 29.07% and returned -9.34% and -11.80%, with t-statistics of -0.49 and -1.46. So costs are most of the loss, and what is left underneath is a small loss that cannot be told apart from nothing.

<!-- unique:original-calc -->
Costs bite for the reason they did in the gap test: the zone is thin, so the stop is close. The median distance from fill to stop was 0.326% of price in-sample and 0.218% out-of-sample. A 0.15% round trip is 0.46R and 0.69R at those medians. On 100 of the 621 in-sample trades and 102 of the 301 out-of-sample trades, the stop was nearer than the cost of the round trip itself. The [position size calculator](/tools/position-size-calculator/) shows what a 0.2% stop does to position size, and to the fee as a share of risk.

### Five settings, ten losing blocks

<!-- unique:firsthand-data -->
Gap size and the two waiting clocks are the numbers the rule depends on. The list was fixed with the rule, before the first run; it is a sensitivity table and no row is a recommendation. An asterisk marks a block under 100 trades.

| Minimum gap / waiting bars | Trades in / out | t-stat in / out | Return in / out | Zero-cost return in / out |
| --- | --- | --- | --- | --- |
| 0.25 ATR / 96 | 1,132 / 510 | -9.19 / -7.85 | -84.39% / -55.35% | -19.58% / -5.76% |
| 0.5 ATR / 96 (main run) | 621 / 301 | -5.64 / -7.14 | -63.09% / -45.44% | -9.34% / -11.80% |
| 1.0 ATR / 96 | 168 / 94* | -1.42 / -3.91 | -16.45% / -22.75% | +4.07% / -9.61% |
| 0.5 ATR / 24 | 478 / 220 | -5.46 / -6.62 | -54.52% / -35.67% | -9.04% / -7.40% |
| 0.5 ATR / 288 | 694 / 321 | -4.94 / -5.50 | -62.52% / -43.27% | +3.82% / -6.38% |

All ten blocks lost after costs. At zero cost eight of the ten are still negative, and the ten t-statistics run from -1.52 to 0.40. Bigger gaps lose less in total: they trade less and their stops are wider (a median 0.47% of price in-sample at 1.0 ATR against 0.33% at 0.5). After costs nothing turns positive.

## Limits, and how to rerun it

This is one coin, one timeframe and one year in which BTCUSDT fell. The engine has no resting limit orders, so the entry is a market order at the open after the retest bar, and the fill can be anywhere relative to the zone. It counts the stop first when a bar touches both stop and target. The rule has no trend filter, no session filter, and none of the context a discretionary trader would add, such as waiting for a [market structure shift](/learn/market-structure-shift/) first. Nor does it test the midpoint reading or a retest that has to travel some distance.

Install the engine and download the candles:

```
git clone https://github.com/sentinelbotsaas-hub/perpmath.git
cd perpmath
python -m venv .venv
source .venv/bin/activate
pip install -e .
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
```

Then run our script with the engine's Python. It registers `inverse_fvg` in the engine's strategy table, calls `perpmath backtest inverse_fvg` for each of the five settings with published and zero costs, and stops if its gap counts differ from the fair value gap article's. On Windows the activate line is `.venv\Scripts\activate`. Nothing asks for an account or an API key. The engine's README has a section called "Writing a strategy" that describes the function a strategy must provide; its home on this site is the [bot section](/bot/), and the guide on [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/) explains the zero-cost rerun and the look-ahead check.

## FAQ

### What is an inverse fair value gap in simple terms?

A fair value gap that price has closed through, read the other way round afterwards. A bullish gap that fails is treated as resistance and a bearish gap that fails as support, and the usual trade is to enter when price comes back to the zone.

### Is it "inverse" or "inversion" fair value gap?

Both are in use for the same idea, and IFVG abbreviates either. LuxAlgo's library and its TradingView script say "inversion"; "inverse" is common elsewhere. We found no source that separates the two.

### How often does a fair value gap become an inverse fair value gap?

<!-- unique:firsthand-data -->
On our BTCUSDT 15-minute data, 74.20% of gaps were closed through their far edge within 96 bars, and 79.95% saw a close beyond their midpoint. The count covers gaps at least half an ATR tall and says nothing about other timeframes.

### What is the difference between an IFVG and a breaker block?

The thing that failed. A breaker block is an order block, a candle, that price closed through. An IFVG is a gap, the space between two candles, that price closed through. Both are then traded on the retest in the direction of the break. Our breaker block test lost 18.44% in-sample on the same candles.

### Does the IFVG strategy work?

One mechanical version did not. It lost 63.09% and 45.44% after costs, and with costs removed its returns of -9.34% and -11.80% could not be told apart from zero. A trader who picks inversions by context is running a test nobody can check without written rules. One coin and one year cannot say more than that.
