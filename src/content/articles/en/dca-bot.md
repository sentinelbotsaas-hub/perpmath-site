---
title: "DCA bot: 232 take-profits and two stuck cycles in a one-year BTCUSDT simulation"
slug: "dca-bot"
description: "A DCA bot with safety orders, simulated on a year of BTCUSDT: 232 completed cycles made 2,006.60 USDT and the two left open lost 2,327.59. Rules, costs, leverage."
date: "2026-12-02"
lastmod: "2026-12-02"
lang: "en"
category: "Backtests"
tags: ["DCA bot", "safety orders", "martingale", "backtest", "BTCUSDT", "leverage"]
keywords: ["dca bot", "dca trading bot", "dca bot strategy", "safety orders", "martingale bot"]
tldr: "A DCA bot adds to a position each time price falls a step and sells everything when price climbs back to a set profit above the average. We simulated one on a year of BTCUSDT 15-minute bars with rules fixed in advance. 172 cycles completed in-sample and 60 out-of-sample, earning 2,006.60 USDT in all, and the two cycles still open at the cuts lost 2,327.59. In-sample ended +7.42%, out-of-sample -10.63%. At 10x leverage the same ladder reached its liquidation price on 5 February 2026."
---

<!-- unique:firsthand-data -->
232 times in one year of BTCUSDT candles, the DCA bot we simulated bought, waited for price to climb about 1% above its average cost, and sold at a profit. Those 232 cycles made 2,006.60 USDT on a 10,000 USDT account. The two cycles that were still open when the test periods ended lost 2,327.59 between them.

That is the strategy in one paragraph: a long row of small wins, and now and then a position that takes the whole account and waits. What follows is how those figures were produced. One part of it is kinder to the bot than that opening and one part is harsher. Both are here.

## What is a DCA bot?

A DCA bot is a program that opens a position with a small first order, adds larger orders each time price falls by a set step, and closes everything with one take-profit order a fixed percentage above the average entry price. Then it starts again. The added orders are usually called safety orders.

The name is borrowed. Dollar-cost averaging in the ordinary sense means buying a fixed amount on a schedule, whatever the price. A DCA bot buys on price falls instead, and it sells. The only thing the two share is the arithmetic of an average price, which the [DCA calculator](/tools/dca-calculator/) works through: every fill at a lower price pulls the average down, and it does so by making the position bigger.

Products name the same mechanism differently. 3Commas sells it as the DCA Bot, one of three bot types on its [pricing page](https://3commas.io/pricing) (checked 22 November 2026). Bybit calls it the Futures Martingale Bot; its [parameter guide](https://www.bybit.com/en/help-center/article/Futures-Martingale-Bot-Parameters-Explained) (last updated 10 August 2026, checked 22 November 2026) lists a price decrease that triggers each addition, a position multiplier between 1 and 2, a maximum number of additions per round, a profit target per round, a stop-loss setting, and leverage up to 50x. How this site relates to Bybit is on the [disclosure page](/disclosure/).

<!-- unique:cross-reference -->
The step does not mean the same thing in each. Bybit's guide prices the next order from the average holding cost. The 3Commas [help article on the DCA bot summary](https://help.3commas.io/en/articles/16666593-understanding-the-dca-bot-summary-box) (checked 22 November 2026) gives the next order's price as the previous order's price less the gap, so a 2% gap compounds: five orders land at 98, 96.04, 94.12, 92.24 and 90.39% of the entry. Ours are fixed steps from the first fill: 98, 96, 94, 92 and 90%. Type "2%" into three bots and you get three ladders, which is one reason the numbers below belong to these rules and to no product.

## The rules, written down before the first run

One ladder was the test and it was fixed on 21 November 2026 (UTC), before the script touched real data. It ran once.

- **Market.** BTCUSDT perpetual on Bybit, 15-minute bars, long only, 10,000 USDT, no leverage.
- **Base order.** 312.50 USDT at market, at the open of the bar after the previous cycle closed.
- **Safety orders.** Five resting limit buys at 2, 4, 6, 8 and 10% below the base order's fill price. The first is 312.50 USDT and each one after is double the one before.
- **Take profit.** One limit sell for the whole position at 1% above the average entry price, moved after every fill.
- **Stop-loss.** None. A cycle ends at its take profit, or at the end of the test period, where whatever is open is sold at the last close.

<!-- unique:original-calc -->
| Order | Price, % of base | Size, USDT | Total bought | Average, % of base | Rise to take profit |
| --- | --- | --- | --- | --- | --- |
| Base | 100 | 312.50 | 312.50 | 100.00 | 1.00% |
| Safety 1 | 98 | 312.50 | 625 | 98.99 | 2.02% |
| Safety 2 | 96 | 625 | 1,250 | 97.47 | 2.55% |
| Safety 3 | 94 | 1,250 | 2,500 | 95.70 | 2.83% |
| Safety 4 | 92 | 2,500 | 5,000 | 93.82 | 2.99% |
| Safety 5 | 90 | 5,000 | 10,000 | 91.87 | 3.10% |

Read the last row. With price 10% below where the bot started, the average is only 8.13% below, and a 3.10% bounce from there closes the cycle in profit. That is the appeal. The cost sits one column to the left: half the account went in at the lowest rung, and nothing is left to buy with.

Fills and costs follow the conventions of the open-source engine's grid simulator. A limit order fills only when a bar trades strictly through its level, at the level, and every fill is then moved 0.02% against us. Market orders pay 0.055% and limit fills 0.02%, Bybit's base taker and maker rates as the [engine's README](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.2/README.md#costs-and-funding) records them. Funding is charged at every settlement from Bybit's public [funding history endpoint](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate) (checked 22 November 2026). A 15-minute bar does not say whether its high or its low came first, so one rule settles it against the bot: on a bar in which a safety order fills, the take profit has to wait for a later bar.

<!-- unique:field-note -->
The engine has no DCA mode. Its strategy engine holds one position with one entry, and its grid simulator has no take profit on an average. So this simulation is written in our research script, `research/dca-bot/dca_sim.py` in the site's repository, and is not one of the engine's shipped strategies. The script borrows the engine's loaders, so the candle file is the one behind every other backtest here (35,040 bars, 18 November 2025 to 18 November 2026, SHA-256 starting `ac4acc42`), with the same cut: in-sample to 30 July 2026, out-of-sample from 31 July.

<!-- unique:firsthand-data -->
Code written for one article deserves suspicion, so the script checks itself before it reads any data. Eight groups of cases have answers worked by hand. One example: 312.50 USDT bought at 100 and 312.50 at 98 give an average of 98.9899, a take profit at 99.9798, and a profit of exactly 6.25 with costs set to zero. The script asserts that figure, then runs the real year twice and refuses to continue unless both runs match to the last digit.

## What did the DCA bot make, and what did it lose?

It made money in-sample and lost money out-of-sample, and in both periods the result was decided by the last cycle.

<!-- unique:firsthand-data -->
| | In-sample | Out-of-sample |
| --- | --- | --- |
| BTCUSDT, first open to last close | 91,423.0 to 64,751.1 | 64,751.1 to 64,124.5 |
| Completed cycles | 172 | 60 |
| Net from completed cycles | +1,682.82 | +323.78 |
| Position left at the end | -940.89 | -1,386.70 |
| Total return | +7.42% | -10.63% |
| Max drawdown | 15.70% | 16.42% |
| Buy and hold, with funding | -30.39% | -2.96% |

Money is in USDT after fees and funding. Fees came to 99.04 and 28.12, funding to 52.93 and 25.76. Each period starts flat with 10,000 USDT. Nothing was fitted on the first period, so the two columns are really two consecutive stretches of market, one that fell 29.17% and one that went up to 87,383.6 and came all the way back.

<!-- unique:original-calc -->
Sorting the in-sample cycles by how many safety orders they needed shows where the profit came from:

| Safety orders filled | Cycles | Average net, USDT | Median length |
| --- | --- | --- | --- |
| 0 | 108 | 2.82 | 2.75 hours |
| 1 | 27 | 5.75 | 20.25 hours |
| 2 | 21 | 11.58 | 39.5 hours |
| 3 | 4 | 23.06 | 71 hours |
| 4 | 5 | 46.12 | 114.25 hours |
| 5 | 7 | 93.85 | 73 hours |

<!-- unique:original-calc -->
108 of the 172 cycles, 62.79%, never touched a safety order. They earned 2.82 USDT each and 304.71 in total, which is 18.11% of the profit. The seven cycles that filled the whole ladder and came back earned 656.95, or 39.04% of it. So four percent of the cycles brought in two fifths of the money, and they are the same kind of cycle as the eighth one, the one that did not come back in time.

## The cycle that got stuck

<!-- unique:firsthand-data -->
On 25 May 2026 at 06:15 UTC the bot opened its 173rd cycle at 77,321.76. A little over eight days later all five safety orders had filled and the average stood at 71,047.95. Price kept going. It reached 57,755.8 on 1 July, 25.30% below the base order, and at that moment the position showed a paper loss of 1,870.87 USDT, 18.71% of the account. The in-sample period ended on 31 July with the cycle 66.74 days old, 58.62 of them fully loaded, and the position was sold at 64,738.15 for a loss of 940.89.

<!-- unique:field-note -->
I have to qualify that loss, since part of it is my own cut. The split date was fixed in advance, and it happened to fall while the bot was under water. So after seeing the result I ran the same rules over the whole year in one piece (`full_year.py`, and yes, that is a look taken afterwards). Left alone, the position reached its take profit on 20 August 2026, after 87.11 days. It netted 28.05 USDT: the 1% target on 10,000 is about 100, and 65.80 of that had gone to funding while it waited.

<!-- unique:firsthand-data -->
Over the uncut year the bot completed 222 cycles for 1,993.17 USDT and finished at +6.06%, against -32.38% for buying and holding. It was fully loaded for 91.79 days, 25.15% of the year. Its last cycle is the out-of-sample one from the table: opened on 4 November 2026 at 80,823.86, filled to the bottom, average 74,265.89, low of 61,899.2 on 15 November. On the final bar it was sold at 64,111.68 for -1,386.70. That one loss is 4.28 times what the 60 completed out-of-sample cycles had earned.

<!-- unique:operator-view -->
Is that position a loss or a profit that has not arrived yet? Nobody can say, and that is the honest state of a DCA bot's books at most moments. The February cycle is the one to compare it with. It opened on 3 February at 76,368.77, filled every order, and watched price fall to 59,888.0, which is 21.58% down and 1,465.58 in the red. Then price bounced, and the cycle closed 2.86 days after it began, with +94.32. Same depth of trouble, opposite outcome, and nothing in the rules decided which.

## Fully loaded and still falling: the arithmetic

Once the fifth safety order fills, the bot is a plain long position with an average 8.13% below its starting price, and each further 1% of the base price costs it 108.85 USDT. There is nothing left to average with.

<!-- unique:original-calc -->
| Price, % of base | Ladder's paper loss | One 10,000 buy at base | Rise needed to take profit |
| --- | --- | --- | --- |
| 90 | -203.36 | -1,000 | +3.10% |
| 85 | -747.62 | -1,500 | +9.16% |
| 80 | -1,291.88 | -2,000 | +15.98% |
| 75 | -1,836.14 | -2,500 | +23.72% |
| 70 | -2,380.39 | -3,000 | +32.55% |

These are costs-free figures from the ladder alone, in USDT (`ladder_math.py`). At 90% of the base the ladder has lost a fifth of what a single buy at the top would have. At 70% it has lost 79.35% as much. The further price falls past the last rung, the less the averaging matters, and the more the bot resembles someone who bought everything 8% lower and is waiting.

## What changes with leverage?

Leverage gives the ladder a floor. Below it the position is closed by the exchange and the waiting ends.

The liquidation price here is the one the site's calculators use for a long on isolated margin: average price x (1 - 1/leverage + maintenance margin rate), recomputed after every fill, with 0.33% for BTCUSDT's first risk tier from Bybit's public [risk limit endpoint](https://bybit-exchange.github.io/docs/v5/market/risk-limit) (checked 22 November 2026). With leverage every order is that many times larger on the same 10,000 USDT, so the fills and the average do not change. You can reproduce the row below on the [DCA calculator](/tools/dca-calculator/) by entering the six fills as amounts with a base price of 80,000.

<!-- unique:original-calc -->
| Leverage | Liquidation price, full ladder | Below the last safety order |
| --- | --- | --- |
| 3x | 49,238.93 | 31.61% |
| 5x | 59,038.21 | 18.00% |
| 10x | 66,387.67 | 7.79% |
| 20x | 70,062.40 | 2.69% |

<!-- unique:firsthand-data -->
The average is 73,494.60 and the last safety order sits at 72,000. We fed both of this page's ladders to the function behind that calculator and compared its average and liquidation prices with the Python script's after every fill, at five leverage settings each; all ten checks pass. Then we asked the simulated year which cycles reached those prices:

- **20x.** The fifth cycle, on 21 November 2025, the fourth day of the test.
- **10x.** The 66th cycle, on 5 February 2026. That is the February cycle that bounced at 1x. The 65 take-profits before it were worth 761.59 USDT at 1x, so 7,615.90 at 10x, and the liquidation takes the full 10,000 of margin.
- **5x and 3x.** No cycle in either period. At 5x it was close: the stuck cycle's liquidation price was 57,072.82 and the low of 1 July was 57,755.8, a gap of 1.18%.

Two cautions. The formula is the simplified one explained on the [liquidation price calculator](/tools/liquidation-price-calculator/), without the closing fee or funding. And after a liquidation the real path would differ from the 1x path, so these are the cycles that would not have survived, not a simulation of what comes next.

<!-- unique:original-calc -->
Bybit's guide allows this bot type up to 50x. By the same formula a 50x long with no spare margin is liquidated 1/50 - 0.33% = 1.67% below its entry, which is closer than the first safety order of a 2% ladder. Bybit's bot keeps the rest of its investment as margin, so its own liquidation price sits further away than that. The sum still shows how little room 50x leaves for averaging.

## A second ladder, looked at afterwards

We also ran a ladder with the multiplier set to 1: the same five levels, six equal orders of 1,666.67 USDT. It was defined in the script alongside the main one, but comparing the two is hindsight by nature, since you only learn which was better once the year is over.

<!-- unique:firsthand-data -->
| | Doubling ladder | Equal ladder |
| --- | --- | --- |
| In-sample return | +7.42% | -18.62% |
| Out-of-sample return | -10.63% | -5.77% |
| In-sample max drawdown | 15.70% | 33.50% |
| Completed cycles, both periods | 232 | 91 |
| Longest cycle in-sample | 66.74 days | 197.32 days |
| Share of in-sample bars fully loaded | 25.00% | 76.16% |

The equal ladder's average only comes down to 94.88% of the base, so from the last rung it needs a 6.47% bounce where the doubling ladder needs 3.10%. In-sample, the cycle it opened on 14 January 2026 never closed: 197.32 days in one position, with a paper loss of 3,748.21 at the worst point. Out-of-sample it lost less than the doubling ladder. The ranking flipped between two periods of the same year, so this table does not tell you which multiplier to use. It shows that the choice moves the result by more than the strategy earns.

## What this simulation leaves out

- **One market, one year, one direction.** Bitcoin fell 29.17% in the first period. A year that trends up would complete far more cycles and prove nothing more.
- **No statistics.** There is no t-statistic here. Cycles are not independent bets, and the results hang on two or three of them.
- **Bars, not ticks.** Fills on a strict cross at the level are an assumption, with no queue position or partial fills. The same-bar rule mattered on one bar in each period.
- **Order sizes.** Bybit's quantity step for BTCUSDT is 0.001 BTC, and 312.50 USDT at 80,000 is 0.0039 BTC. Real orders would be rounded; ours are not.
- **Product details.** Exchange bots add start conditions, trailing exits and their own order types, and Bybit's guide measures its profit target against the total investment. This is our rule set, not theirs.
- **It was never run live.** perpmath's order runner works on the testnet only and has no DCA mode at all. Everything on this page is arithmetic on past candles.

A [grid bot](/learn/grid-trading-bot/) fails the same way from a different direction: small completed pairs, then inventory that a trend leaves behind. How a number like 15.70% is measured is in [max drawdown](/learn/max-drawdown/), the general method is in [how to backtest a trading strategy](/learn/how-to-backtest-a-trading-strategy/), and the engine itself is on the [bot page](/bot/).

## FAQ

### Is a DCA bot profitable?

In this test it was in one period (+7.42%) and not in the next (-10.63%), and both results came down to a single open cycle. It completed 232 cycles without a losing one, which says nothing about the cycle it is holding now.

### What is a safety order?

An extra buy placed below the first entry, usually larger than the one before. It lowers the average price and raises the position size by the same act. In our ladder five of them turn 312.50 USDT into 10,000.

### Should a DCA bot use a stop-loss?

We did not test one. The arithmetic says what it would cost: stopping this ladder at 85% of the base price realises about 747.62 USDT before fees, the earnings of roughly 265 cycles that needed no safety order. Without a stop the bot can wait, and in this year one wait lasted 87 days.

### How much capital does a DCA bot need?

Enough for the whole ladder, since the largest order comes last. With five doubling safety orders that is 32 times the base order, and a sixth would make it 64.
