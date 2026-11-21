---
title: "Grid trading bot: a one-year BTCUSDT backtest of what it earns and what it gives back"
slug: "grid-trading-bot"
description: "What a grid trading bot earns and loses, from a one-year BTCUSDT backtest: 669 completed pairs made 1,366.58 USDT and the position left over gave back 953.84."
date: "2026-11-22"
lastmod: "2026-11-22"
lang: "en"
category: "Backtests"
tags: ["grid trading bot", "grid bot", "backtest", "BTCUSDT", "funding", "leverage"]
keywords: ["grid trading bot", "grid bot", "grid trading", "futures grid bot", "grid bot backtest"]
tldr: "A grid trading bot keeps buy and sell limit orders at fixed price levels and earns the spacing each time a pair completes. What it loses is on the position it builds up when price trends. In our one-year BTCUSDT backtest, 669 completed pairs made 1,366.58 USDT in-sample and the position left at the end lost 953.84, for +3.17% after fees and funding. That figure needed a range chosen with hindsight; out-of-sample (+4.37%) price never left it. With the range taken from the first month instead, the same grid lost 3.88% and price closed outside the range 74.78% of the time."
---

<!-- unique:firsthand-data -->
669 buy-low, sell-high pairs earned a grid bot on BTCUSDT 1,366.58 USDT in eight months of our backtest. It finished that period 316.59 USDT ahead. Where the other thousand went takes up most of what follows, along with the two conditions that kept the final number positive at all.

## What is a grid trading bot?

A grid trading bot is a program that keeps limit orders resting at a ladder of price levels inside a range you choose: buys below the current price, sells above it. Each time price drops through a level and later climbs back through the next one up, a buy and a sell complete a pair and the bot keeps the spacing between them. It makes no forecast. It is paid for price going back and forth.

Between two neighbouring levels sits one cell. A long cell buys at its lower level and sells at its upper level; a short cell does the mirror image. A neutral grid uses long cells below the starting price and short cells above it, and trades nothing at the start. Exchanges offer this as a built-in product. Bybit's [getting started page](https://www.bybit.com/en/help-center/article/How-to-Get-Started-with-Futures-Grid-Bot-on-Bybit) for its futures grid bot (updated 8 April 2026, checked 22 November 2026) lists neutral as the default direction and arithmetic spacing as the default grid type, with geometric as the alternative. What ties this site to Bybit is spelled out on the [disclosure page](/disclosure/).

## The rules and settings we tested, and why these

We tested one configuration, the one the open-source engine ships in [configs/grid.json](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/configs/grid.json): neutral, geometric spacing, 50 cells, leverage 1, and orders left in place if price leaves the range. The engine's README says these were chosen once and that no other grid settings were run to pick them.

- **Range.** 57,755.8 to 97,963.2 USDT, the lowest low and highest high of the in-sample period. Remember that sentence; it comes back.
- **Geometric spacing.** Every cell is 1.0623% wide, so a cell at 60,000 and a cell at 95,000 earn the same percentage.
- **50 cells.** With 10,000 USDT that is 200 USDT of notional per cell. A completed pair costs 0.08% (two maker fees of 0.02% and two fills moved 0.02% against us), so each cell is about 13 times wider than its cost.
- **Fills.** An order fills only when price trades strictly through its level, at the level, never better. The simulator in [grid.py](https://github.com/sentinelbotsaas-hub/perpmath/blob/d06236ec9fd04a5a17854aaed5477bb048ff98ad/src/perpmath/grid.py) (version 0.2.1, checked 22 November 2026) then applies slippage to limit fills too.

The data is the same year used for the other [backtests](/backtests/) on this site: 35,040 fifteen-minute BTCUSDT bars from 18 November 2025 to 18 November 2026, plus 1,095 settled funding rates from Bybit's public [funding history endpoint](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate) (checked 22 November 2026). The first 70% is in-sample, and the rest, from 31 July 2026, is out-of-sample.

```
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath funding BTCUSDT --start 2025-11-18T00:00:00Z --end 2026-11-18T12:00:00Z
perpmath grid --symbol BTCUSDT --interval 15m --config configs/grid.json --out results/grid-btcusdt.json
```

<!-- unique:firsthand-data -->
We ran those three commands on 22 November 2026 in a newly cloned copy. The SHA-256 of both downloaded files matched the ones behind the published result, and our output differed from the engine's `results/grid-btcusdt.json` only in the timestamp and the version number.

| Sample | Completed pairs | Total return | Max drawdown | Fees | Funding paid | Buy and hold, with funding |
| --- | --- | --- | --- | --- | --- | --- |
| In-sample | 669 | +3.17% | 12.52% | 58.04 | 38.09 | -30.39% |
| Out-of-sample | 197 | +4.37% | 7.31% | 15.85 | -53.98 | -2.96% |

Money is in USDT on 10,000 of starting capital. Negative funding paid means the grid received it. Neither row is a forecast: the in-sample range was set with hindsight and the out-of-sample price never left it, and both points get their own section below.

## What does a grid bot earn, and what does it lose?

It earns a small fixed amount per completed pair, and it loses on whatever position it is still holding when price has moved away. The result file lists every fill, so the two can be added up separately:

| USDT | In-sample | Out-of-sample |
| --- | --- | --- |
| Completed pairs, before fees | +1,366.58 | +399.09 |
| Position left at the end, closed at market | -953.84 | -0.29 |
| Fees | -58.04 | -15.85 |
| Funding | -38.09 | +53.98 |
| Net change | +316.59 | +436.92 |

<!-- unique:original-calc -->
In-sample, each pair made 2.04 USDT on a 200 USDT cell. That income is real and it is dull: 669 of them is 1,366.58 USDT. The other line is the position. BTC opened the period at 91,423 and closed it at 64,751.1, and a neutral grid buys all the way down. At its largest, on 25 June 2026, the position was 0.1168 BTC long. At the end it still held 0.0841 BTC, sold for a 953.84 USDT loss. Seventy percent of what the pairs earned went back out through the inventory.

<!-- unique:original-calc -->
Out-of-sample the position line is -0.29 USDT. The grid did not get smarter. Price started that period at 64,751.1 and ended it at 64,124.5, close to where it began, so nearly every cell that opened had also closed. In between, the grid was short 0.0743 BTC at one point, when BTC traded near 87,195 on 21 September 2026. Had the period ended that day, the table would look different.

One comparison needs care. Buy and hold lost 30.39% in-sample and the grid gained 3.17%, but the grid's average position was 3,318.88 USDT, a third of its capital. It was carrying a third of the exposure for most of the fall.

### Fees and funding

They move the result by up to a point of return in this run, which is a lot when the total is three or four points. A grid trades constantly: 1,370 grid fills in-sample. At the 0.02% maker rate they cost 55.04 USDT. The result file also reruns everything with grid fills charged at the 0.055% taker rate, and total fees rise from 58.04 to 154.59 USDT:

| Variant | In-sample | Out-of-sample |
| --- | --- | --- |
| As shipped | +3.17% | +4.37% |
| Grid fills at the taker fee | +2.22% | +4.09% |
| Funding left out | +3.55% | +3.83% |

Both rates are the base tier for perpetuals in Bybit's [fee table](https://www.bybit.com/en/help-center/article/Trading-Fee-Structure) (page updated 20 November 2026, checked 22 November 2026). Which one a built-in bot pays is worth checking on your own statements. Bybit's [P&L page](https://www.bybit.com/en/help-center/article/P-L-Calculations-Futures-Grid-Bot) for the futures grid bot (updated 10 September 2026, checked 22 November 2026) works its example with the taker rate.

<!-- unique:original-calc -->
Funding cuts both ways. A grid pays or receives it on its net position. In-sample the grid was net long 89.0% of the time and paid 38.09 USDT; out-of-sample it was net short 79.2% of the time and received 53.98. Leaving funding out would have understated one period and overstated the other. Current rates are on the [funding rate page](/data/funding-rate/).

### The order of prices inside a candle

For a grid this is the largest modelling assumption. A 15-minute bar does not say whether its high or its low came first, and an order bought on the way down can be sold on the way back up inside the same bar. The simulator walks each bar both ways and, by default, keeps the path that leaves less equity (`worst_of_two`).

<!-- unique:firsthand-data -->
To see how far off 15-minute bars are, we downloaded the year again as 525,600 one-minute bars and ran the shipped config on them:

| Path assumption | In-sample, 15m | Out-of-sample, 15m | In-sample, 1m | Out-of-sample, 1m |
| --- | --- | --- | --- | --- |
| `worst_of_two` (default) | +3.17% | +4.37% | +3.30% | +4.37% |
| `low_first` | +4.70% | +4.78% | +3.36% | +4.49% |
| `high_first` | +4.60% | +4.76% | +3.42% | +4.41% |
| `best_of_two` | +6.09% | +5.15% | +3.48% | +4.52% |

<!-- unique:original-calc -->
On 15-minute bars the optimistic path nearly doubles the in-sample result, from +3.17% to +6.09%, and counts 818 pairs where the default counts 669. On 1-minute bars the four in-sample paths sit within 0.18 points of each other, between +3.30% and +3.48%, and the 15-minute default lands just under that band. So the pessimistic default is the one to quote. In the strategy runs of our [backtesting walkthrough](/learn/how-to-backtest-a-trading-strategy/) this question moved results by under three points on 1.68% of trades; here it touches every bar.

## Two conditions behind the positive numbers

Before any conclusion, both headline results rest on something that cannot be arranged in advance.

**The in-sample range was chosen with hindsight.** Its bounds are that period's own lowest and highest prices, so price could not leave the grid. The result file says so in its warnings. A range like that is only known once the period is over.

<!-- unique:firsthand-data -->
**Out-of-sample, price never left the range.** Not one bar closed outside 57,755.8 to 97,963.2 between 31 July and 18 November 2026, and price finished near its start. The rules for leaving the range were never exercised.

So we exercised them.

## What happens when price leaves the range?

It depends on what the bot is told to do, and the three choices gave three different outcomes on identical prices. The engine's `out_of_range` setting has `continue` (keep every order and position), `stop` (cancel the orders, keep the position to the end) and `close` (cancel the orders and close everything at the bound with a market order).

We set the range from an early stretch of data and tested on what followed, twice:

- **Half-period range.** 59,888.0 to 97,963.2, the low and high of 18 November 2025 to 24 March 2026 (the first half of the in-sample period), tested on 25 March to 30 July 2026.
- **One-month range.** 80,607.9 to 94,550.0, the low and high of the first 29.5 days, tested on 18 December 2025 to 18 November 2026, the way someone who looked at last month's chart would set it.

These runs are here to show the risk. They are not a search for better settings: the list was written before the first one ran, every run on it is reported on this page, and everything else is the shipped config.

| Range | Mode | Completed pairs | Return | Max drawdown |
| --- | --- | --- | --- | --- |
| Half-period | continue | 253 | +3.77% | 2.73% |
| Half-period | stop | 144 | +2.43% | 4.61% |
| Half-period | close | 144 | +0.03% | 2.10% |
| One-month | continue | 1,344 | -3.88% | 11.79% |
| One-month | stop | 271 | +19.32% | 14.84% |
| One-month | close | 271 | -1.41% | 2.44% |

<!-- unique:original-calc -->
Take the one-month range first. Price went out through the top on 5 January 2026, came back, and fell through the bottom on 31 January. Over the whole test period 74.78% of bar closes were outside the range. With `continue`, the grid still completed 1,344 pairs for 750.16 USDT, and still lost: the long position it was left holding cost 964.66 USDT, fees 110.15 and funding 63.75. Minus 3.88%.

<!-- unique:original-calc -->
The +19.32% under `stop` is the number I'd most like nobody to quote. The exit fired at the top on 5 January, with the grid short 0.0642 BTC. `stop` cancels the orders and keeps the position, so the run then sat in an unplanned short for ten and a half months while BTC fell to 64,124.5. That position made 1,683.26 USDT. The 271 pairs made 151.03. It is a directional bet that happened to win, and in the half-period test the same rule left a long position instead.

<!-- unique:original-calc -->
`close` is the tidy one, and tidy costs money. It realised a 269.49 USDT loss at the top of the one-month range and a 255.10 loss at the bottom of the half-period range, where price slipped under 59,888.0 on 5 June 2026, bottomed at 57,755.8 and came back. Waiting (`continue`) beat closing by 3.74 points there. It would not have if price had kept falling.

<!-- unique:original-calc -->
I went in expecting the out-of-range runs to be the disaster section, and at leverage 1 I was wrong: the worst is -3.88%. A neutral grid can be long the cells below its starting price or short the cells above it, never both, so its position is capped; in the shipped run it never exceeded 6,878.10 USDT on 10,000 of capital. The disaster needs leverage.

## What does leverage do to a grid?

It multiplies the pair income and the inventory loss by the same factor, and it moves the worst moment much closer to liquidation. We reran the shipped config and both range tests at leverage 3, then, when nothing was liquidated, the shipped config and the one-month test at 5 and 10. No other values were tried. The one-month rows below are its eleven-month test period; the half-period range at 3x returned +11.32% with a 7.74% drawdown.

| Run | Leverage | Return | Max drawdown | Lowest equity at a bar close |
| --- | --- | --- | --- | --- |
| Shipped, in-sample | 1 | +3.17% | 12.52% | 9,061.00 |
| Shipped, in-sample | 3 | +9.50% | 34.68% | 7,183.01 |
| Shipped, in-sample | 5 | +15.83% | 54.51% | 5,305.02 |
| Shipped, in-sample | 10 | +31.66% | 95.42% | 610.04 |
| One-month range | 1 | -3.88% | 11.79% | 9,108.64 |
| One-month range | 3 | -11.65% | 33.26% | 7,325.93 |
| One-month range | 5 | -19.42% | 52.33% | 5,543.22 |
| One-month range | 10 | -38.84% | 91.80% | 1,086.45 |

<!-- unique:original-calc -->
None of the 14 runs was liquidated, which surprised me. Read the 10x in-sample row, though. Its return column says +31.66%. On 6 February 2026 its equity at one bar close was 610.04 USDT out of 10,000, against a maintenance margin of 211.91 on a 1.0666 BTC long. Holding that position fixed, equity meets the maintenance margin near 59,829, about 0.6% below that bar's close. The next bar's low was 59,888.0. This is a rough measure (it ignores further fills, and the engine uses a simplified tier-1 margin rule), but the size of the gap is the point: roughly 59 USDT of BTC price separated +31.66% from an account at zero.

That run survived on hindsight too. The same simplified rule is what the [liquidation price calculator](/tools/liquidation-price-calculator/) uses, and the [leverage calculator](/tools/leverage-calculator/) shows how fast the distance shrinks. The maintenance margin rate here, 0.33%, is Bybit's first BTCUSDT tier as served by its public [risk limit endpoint](https://bybit-exchange.github.io/docs/v5/market/risk-limit) on 18 November 2026 (documentation checked 22 November 2026).

## How do exchange grid bots differ from this simulator?

In several details, any of which can change a result, so treat these numbers as an accounting example and not as a preview of a particular exchange's bot. Comparing the engine's stated rules with Bybit's help pages for its futures grid bot (all checked 22 November 2026):

- **Size per level.** The simulator opens the same USDT notional in every cell. Bybit's P&L example holds the same BTC quantity at every level.
- **Fees.** The simulator charges the maker rate on grid fills by default. Bybit's worked example uses the taker rate, which is the +2.22% row above.
- **Outside the range.** Bybit's [trailing page](https://www.bybit.com/en/help-center/article/How-Trailing-Up-and-Trailing-Down-Work-in-Futures-Grid-Bot) (updated 11 November 2025) says that with trailing off the bot stops placing new orders until price returns, which is closest to `continue`. With trailing on, the range itself shifts one grid at a time. The simulator has no trailing.
- **Exits.** Bybit offers a stop-loss price, a take-profit price and a trailing stop on equity that end the bot. The simulator's `close` acts only at the range bound.
- **Grid count.** Bybit's P&L page says it limits the number of grids so that grid profit exceeds fees. The simulator lets you set anything and warns when the narrowest cell is not wider than the round-trip cost.
- **Fills and liquidation.** The simulator has no order queue, no partial fills and no latency, prices funding at the bar close instead of the mark price, and liquidates on risk tier 1 only.

## What one year does and does not show

It shows the mechanics. Pair income arrives steadily and is small, and the position left over decides the result.

<!-- unique:original-calc -->
It does not show that grids make money. The two headline numbers came from a range fitted to its own period and from a period that happened to return to its start. Of the two ranges a person could have set in advance, one held 97.33% of the time and returned +3.77%; the other did not hold and lost 3.88%, or 38.84% at 10x. This is one market, one year and one configuration, and there is no t-statistic for it, since the pairs of a grid are not independent bets. We have not tested long or short grids, other coins, or trailing ranges.

The [bot section](/bot/) covers the engine, its grid simulator and the order runner, which trades on the testnet only. If you want to size a position before any of this, the [position size calculator](/tools/position-size-calculator/) is the place to start.

## FAQ

### Are grid trading bots profitable?

<!-- unique:firsthand-data -->
Not as a rule. In our BTCUSDT year the same grid returned +3.17% and +4.37% with a range that held, and -3.88% with a range set from the first month. The sign followed whether price stayed inside the range and came back, which nobody controls.

### How many grids should a grid bot have?

There is no best number, and we did not search for one. The hard floor is cost: a cell must be wider than the round trip, 0.08% under our assumptions. Our 50 cells were 1.06% wide each. The one-month range squeezed those 50 cells to 0.32%, about four times the cost.

### Can a grid bot get liquidated?

<!-- unique:firsthand-data -->
With leverage, yes. None of our 14 runs was, but at 10x the in-sample run was down to 610.04 USDT of its 10,000 at one bar close, a fraction of a percent of BTC price from the engine's liquidation rule.
