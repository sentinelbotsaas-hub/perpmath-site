---
title: "Monte Carlo simulation in trading: 10,000 reorderings of four real trade lists"
slug: "monte-carlo-simulation-trading"
description: "Monte Carlo simulation for trading backtests, run on real trade lists: shuffling moved one max drawdown between 21.57% and 37.51% and left the final return untouched."
date: "2026-12-02"
lastmod: "2026-12-02"
lang: "en"
category: "Backtests"
tags: ["monte carlo simulation", "monte carlo backtest", "bootstrap", "max drawdown", "risk of ruin"]
keywords: ["monte carlo simulation trading", "monte carlo backtest", "monte carlo trading", "bootstrap trades", "sequence risk"]
tldr: "A Monte Carlo simulation of a backtest redraws the order of its trades thousands of times and reports the spread of outcomes. We ran 10,000 paths on four real trade lists. Shuffling never changes the final return, only the path: one list's 28.83% max drawdown became a range of 21.57% to 37.51%. Resampling with replacement moves the ending too, and 19.39% of paths from a list that lost 18.46% finished in profit. It measures luck in the ordering. It cannot find an edge, and on a grid bot's trade list it showed 0.0029% drawdown where the account had been down 7.31%."
---

What would this backtest have looked like if the same trades had arrived in a different order?

<!-- unique:firsthand-data -->
That is the whole question a Monte Carlo simulation of a backtest answers, and we put it to four real trade lists 10,000 times each. The lists are the in-sample and out-of-sample blocks of two strategies shipped with the open-source [perpmath engine](https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.2) (version 0.2.2, checked 22 November 2026): a moving-average cross and a fair value gap entry, both on a year of BTCUSDT 15-minute bars. All four lose money, which turns out to be useful. It shows plainly what this tool can and cannot change.

## How a Monte Carlo backtest works

You take the list of closed trades from a backtest, build many alternative histories out of those same trades, and look at the spread of results instead of the one path that happened. There are two standard ways to build the alternatives.

**Shuffle.** Keep every trade exactly once and put them in a random order. This asks about sequence only.

**Bootstrap.** Draw as many trades as the list holds, with replacement, so a trade can appear twice or not at all. Wikipedia's [bootstrapping article](https://en.wikipedia.org/wiki/Bootstrapping_%28statistics%29) (checked 22 November 2026) credits the method to Bradley Efron in 1979. This asks a wider question: what if the future is drawn from the same pool of outcomes, but is not the same draw?

Either way each trade has to be expressed as the share of the account it moved. We used two versions. "As run" is the trade's profit divided by its entry notional; the engine puts 100% of equity into every trade, so that is its return on the account. "1% risk" multiplies each trade's R multiple by 0.01, the way a trader who risks a fixed 1% per trade would experience the same list. Stripped of bookkeeping, the script comes down to five lines of NumPy:

```
shuffled  = rng.permuted(np.tile(moves, (10_000, 1)), axis=1)
resampled = moves[rng.integers(0, len(moves), size=(10_000, len(moves)))]
equity    = np.cumprod(1 + shuffled, axis=1)
peaks     = np.maximum.accumulate(np.c_[np.ones(10_000), equity], axis=1)[:, 1:]
max_dd    = ((peaks - equity) / peaks).max(axis=1)
```

`permuted` shuffles each row independently, per NumPy's [reference page](https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.permuted.html) (version 2.5 manual, checked 22 November 2026). The seed is fixed at 20261202, so a rerun prints the same percentiles. Path count, seed and both sizing rules were written at the top of the script before the first run, which we did on 21 November 2026 (UTC).

One detail governs how the tables below should be read. Drawdown here is measured after each closed trade. The engine's published figure is measured at every bar close with open positions marked to market, and it is deeper: 31.18% against 28.83% for the moving-average cross out-of-sample. The [max drawdown article](/learn/max-drawdown/) explains that gap. A Monte Carlo run on a trade list inherits the shallower definition.

## Shuffling: the ending never moves, the drawdown does

Reordering trades cannot change where a compounding account ends up, since multiplication does not care about order. The script asserts it: across 10,000 shuffles of each list the final return is identical to nine significant figures. What moves is the path.

| Trade list | Trades | Final return | Backtest max drawdown | Shuffles: 5th pct | Median | 95th pct | Shuffles deeper than backtest |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MA cross, in-sample | 572 | -62.35% | 62.81% | 62.35% | 64.67% | 69.60% | 83.06% |
| MA cross, out-of-sample | 263 | -18.46% | 28.83% | 21.57% | 29.20% | 37.51% | 52.44% |
| FVG, in-sample | 801 | -66.94% | 66.94% | 66.94% | 67.85% | 69.97% | 92.65% |
| FVG, out-of-sample | 304 | -42.86% | 43.04% | 42.86% | 43.39% | 45.42% | 70.54% |

<!-- unique:original-calc -->
Three of the four rows barely spread, and the reason is arithmetic, not luck. The starting balance counts as the first peak, so an account that ends 62.35% down has a drawdown of at least 62.35% in every possible order. That floor is the 5th percentile in three rows. A strategy that loses steadily leaves sequence almost nothing to decide. Between the 1st and the 99th percentile the in-sample MA cross drawdown only moves from 62.35% to 71.66%.

<!-- unique:original-calc -->
The out-of-sample MA cross row is the one where order matters. Its loss is small enough that the path has room: the same 263 trades give a max drawdown of 21.57% at the 5th percentile and 37.51% at the 95th, with 40.39% at the 99th. The backtest's own 28.83% sits almost exactly in the middle, with 52.44% of shuffles deeper. So the published figure was neither lucky nor unlucky. The in-sample backtest was on the kind side: 83.06% of orderings had a deeper drawdown than the one that happened.

That is the practical use of the shuffle. A backtest hands you one drawdown, and the shuffle tells you which percentile of its own possibilities that number was. Put the 95th percentile through the [drawdown calculator](/tools/drawdown-calculator/), not the backtest figure, when you ask what recovery would take.

## Resampling with replacement: now the ending moves too

A bootstrap path can contain the best trade three times or leave it out, so final equity becomes a distribution as well.

| Trade list | Final return: 5th pct | Median | 95th pct | Paths ending in profit | Max drawdown: 5th pct | 95th pct |
| --- | --- | --- | --- | --- | --- | --- |
| MA cross, in-sample | -76.92% | -62.77% | -36.35% | 0.18% | 45.64% | 78.04% |
| MA cross, out-of-sample | -43.26% | -20.05% | +24.34% | 19.39% | 16.68% | 45.86% |
| FVG, in-sample | -76.89% | -66.84% | -52.60% | 0.00% | 55.06% | 77.57% |
| FVG, out-of-sample | -51.96% | -42.96% | -31.94% | 0.00% | 33.63% | 52.42% |

<!-- unique:original-calc -->
Look at the second row. A list that lost 18.46% produces a profitable ending on 1,939 of 10,000 resampled paths. That is no hidden edge. It is the bootstrap restating what the t-statistic of that block already said in [the backtesting guide](/learn/how-to-backtest-a-trading-strategy/): at t = -0.68 the average trade cannot be told apart from zero, so a fifth of the plausible re-draws come out positive. The other three lists, with t-statistics between -2.95 and -5.23, give a profitable path 18 times in 30,000.

<!-- unique:firsthand-data -->
Then we asked the bootstrap for a forecast it could be held to. We resampled each in-sample list to the length of its out-of-sample list and compared the range with what really came next. This part was added after the first run; its settings were written down before it ran. For the MA cross the 5th to 95th percentile band of final return was -53.79% to -9.12%, and the real out-of-sample result was -18.46%, better than 87.66% of the paths. For FVG the band was -47.08% to -17.88% and the real result was -42.86%, worse than 85.55% of them. Both landed inside the band, on opposite sides of the median. Two cases prove little, and I would not read the bands as tighter than they look: the widths are 44.67 and 29.20 points.

## What Monte Carlo cannot tell you

It cannot tell you whether the strategy has an edge. Every path is built from the trades the backtest produced. If those trades came from an overfitted rule, a look-ahead bug or costs set too low, all 10,000 paths inherit the flaw and the percentiles look reassuringly precise. Resampling a losing list gave us losing paths; resampling a fitted list would give flattering ones.

It assumes the trades are interchangeable. Shuffling and the plain bootstrap both treat each trade as an independent draw, and Wikipedia's article notes that simple resampling fails on correlated data since it cannot reproduce the correlation, which is what block bootstraps (Künsch 1989, per that article) are for. If losses cluster in real life, a shuffle breaks the clusters apart and understates drawdown.

<!-- unique:firsthand-data -->
We checked our four lists for that, three ways. The lag-1 autocorrelation of trade returns is between -0.05 and +0.04. A runs test on the win/loss sequence, the statistic in NIST's [handbook](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35d.htm) (checked 22 November 2026), gives z-values of 1.59, 0.81, -0.45 and 0.65, all inside the ±1.96 that would signal non-randomness at the 5% level. And a block bootstrap that keeps runs of 20 consecutive trades together moved the 95th percentile drawdown by 1.19 points at most. I expected clustering in a trend-following rule and did not find it. For these lists the independence assumption does little harm. That is a finding about four lists and not a licence.

<!-- unique:firsthand-data -->
The worse blind spot is risk that never enters the trade list. The engine's grid result closed 197 round trips out-of-sample, none of them at a loss, plus a final close that cost 0.29 USDT. We shuffled those 198 profits 10,000 times, adding them up instead of compounding, since a grid uses a fixed size per cell, and leaving fees out. The deepest drawdown on any path was 0.0029%. The account itself, marked to market, had been 7.31% below its high. In-sample it is the same picture at larger size: 669 winning round trips and a final close of -953.84 USDT shuffle into drawdowns of 8.40% at the 1st percentile and 9.54% at the deepest, against 12.52% marked to market. Run the simulation before that final close, on winners alone, and every path shows zero. A strategy that holds losers open, such as the [grid bot](/learn/grid-trading-bot/), has a trade list that describes its income and omits its risk.

NIST's page on the [bootstrap plot](https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm) (checked 22 November 2026) adds a general caution that fits here: the bootstrap is not appropriate for every statistic, and it names statistics that depend heavily on the tails. Max drawdown is the extreme point of a path, so I would put it in that group and trust its upper percentiles less than its median. None of this replaces testing on unseen data, which is the job of an out-of-sample split or a [walk-forward analysis](/learn/walk-forward-analysis/).

## Monte Carlo against the risk-of-ruin calculator

The site's [risk-of-ruin calculator](/tools/risk-of-ruin-calculator/) answers a similar question from four numbers and no trade list. Its model is a coin: each trade wins with probability p and adds b times the risk, or loses the risk, every trade independent. "Ruin" is the balance touching a chosen drawdown measured from the start, not from a peak. Both tools assume independence and a fixed sizing rule. The difference is that the bootstrap keeps the real spread of wins and losses.

We fed the calculator's own code each list's win rate, average win over average loss, and average loss, and counted the same event on the bootstrap paths.

| Trade list, as run | Win rate | Payoff b | Risk per trade | Threshold | Calculator | Bootstrap of real trades |
| --- | --- | --- | --- | --- | --- | --- |
| MA cross, out-of-sample | 19.01% | 3.52 | 0.47% | 20% down | 49.97% | 66.45% |
| MA cross, out-of-sample | 19.01% | 3.52 | 0.47% | 50% down | 0.00% | 1.11% |
| FVG, out-of-sample | 27.96% | 1.17 | 0.46% | 50% down | 4.51% | 11.55% |
| MA cross, in-sample | 20.80% | 2.56 | 0.63% | 50% down | 90.73% | 86.61% |
| FVG, in-sample | 31.46% | 1.39 | 0.55% | 50% down | 99.28% | 97.88% |

<!-- unique:original-calc -->
The two disagree in both directions. In the out-of-sample rows the coin understates: for the MA cross it says a 20% hole is a toss-up, and the real trades say two in three. In the in-sample rows, where reaching 50% down was close to certain anyway, the coin overstates by 1.40 and 4.12 points. My reading is that both come from the shape of the winners. The coin pays every winner the average win, 1.66% of the account in the MA cross out-of-sample list. In the real list the median winner made 0.73% and one trade made 19.46%. Remove that single trade and the list ends at -31.74%, not -18.46%. A typical path gets the small winners and misses the big one, so it does worse than the coin, while a few paths draw the big one more than once and escape. The standard deviation of the real trade returns is 1.58%; the coin's is 0.84%.

<!-- unique:original-calc -->
Sizing by R makes it starker. At 1% risk per trade that same winner is worth 92R, since the stop was tight, and losing trades cost 1.13R on average once fees and slippage are added to the planned 1R. With those inputs the calculator gives 12.88% for touching 50% down within 263 trades; the bootstrap of the real R multiples gives 58.02%. In the FVG out-of-sample list the average loser costs 1.68R. If your own Monte Carlo is fed R multiples, measure them after costs, or every path starts from a fiction.

The calculator is still the right first stop. It needs no backtest, and for all four lists its long-run verdict is the correct one: expected log growth is negative, so the threshold is reached eventually with certainty. Use the bootstrap when you have a real trade list and want to know how far the two-outcome shortcut is off. Position sizes for either can be worked out in the [position size calculator](/tools/position-size-calculator/).

## FAQ

### How many simulations does a Monte Carlo backtest need?

<!-- unique:firsthand-data -->
Enough that the percentile you care about stops moving between seeds. NIST's bootstrap page says 500 to 1,000 resamples are typical. We used 10,000 since the 95th and 99th percentiles are tail figures, and the whole run over four lists takes under a minute.

### Can a Monte Carlo simulation make a losing strategy look profitable?

Shuffling cannot: the final return is the same on every path. A bootstrap can show profitable paths from a list that lost money, as 19.39% of ours did for one block. That measures how uncertain the average trade is. It is not a forecast of profit.

### How do I run this on my own backtest?

<!-- unique:firsthand-data -->
Export the closed trades with their profit and entry notional (or R multiples measured after costs), then adapt our script, `research/monte-carlo-simulation-trading/monte_carlo.py` in this site's source. It reads the engine's result files, refuses to continue unless the trade list rebuilds the engine's final equity to within 0.05 USDT, and checks its drawdown arithmetic against all six orders of a three-trade example worked by hand. The engine that writes those result files is on the [bot page](/bot/) and its reports are under [backtests](/backtests/). We have only run the script on these four lists and the grid, so start your own list with the question it starts ours with: do the trades, multiplied out, land on the backtest's final equity?
