---
title: "What is liquidation in crypto? One year of BTCUSDT: a 100x long was liquidated on 254 days"
slug: "what-is-liquidation"
description: "Liquidation is the exchange closing your position when its margin runs out. We counted same-day liquidations on 365 BTCUSDT daily candles, from 2x to 100x."
date: "2026-11-22"
lastmod: "2026-11-22"
lang: "en"
category: "Perpetual basics"
tags: ["liquidation", "leverage", "forced liquidation", "margin", "BTCUSDT"]
keywords: ["liquidation", "crypto liquidation", "what is liquidation", "liquidation price", "leverage"]
tldr: "Liquidation is the exchange force-closing a position whose margin has fallen below the maintenance margin; in isolated margin mode you lose that position's margin. We counted it on 365 Bybit BTCUSDT daily candles from 18 November 2025 to 17 November 2026, entering at each day's open: a 100x long was liquidated the same day on 254 days and a 100x short on 253 days. At 50x it was 147 and 118 days, at 20x 20 and 21 days, at 10x 2 days and 1 day, and at 5x and below 0 days."
---

I wanted one plain number: at what leverage does a position get wiped out inside a single day? Most answers stop at "high leverage is dangerous", which is true and has no figure in it. So I pulled 365 daily candles of the Bybit BTCUSDT perpetual and counted, one day at a time. The results are below, along with the places where my own guess pointed the wrong way.

## What is liquidation? The exchange closes the position when margin runs out

Liquidation is the moment the margin in a position falls below the maintenance margin and the exchange closes the position without asking you. In isolated margin mode on a USDT perpetual, what you lose is the margin assigned to that one position. The rest of the account is not touched.

Bybit's [liquidation process article](https://www.bybit.com/en/help-center/article/UTA-Trading-Rules-Liquidation-Process) (page dated 15 October 2026, checked 22 November 2026) says it plainly: in isolated mode each position is managed independently with its own allocated margin, and liquidation is triggered when the mark price hits the liquidation price. At the lowest risk limit tier the system first cancels any orders that would make the position bigger. If the margin is still short, the whole position is closed at the bankruptcy price.

Cross margin follows different rules. This article only counts isolated positions.

## How is the liquidation price calculated? Room = 1 ÷ leverage − maintenance margin rate

How far the liquidation price sits from your entry depends on two numbers: leverage and the maintenance margin rate (MMR). The simplified version looks like this.

```
room                    = 1 / leverage - maintenance margin rate
long liquidation price  = entry price x (1 - room)
short liquidation price = entry price x (1 + room)
```

Bybit's published formula has more in it: any extra margin you add, a maintenance margin deduction, and (1 ∓ MMR) in the denominator. The page also notes that the actual liquidation price can differ slightly on account of the fee to close. With no margin added and a position in the first tier, the two versions barely differ: for a 100x long the simplified room is 0.67% and the full formula gives 0.6722%. I ran both, and the counts come out almost the same, as a later table shows.

<!-- unique:cross-reference -->
The maintenance margin rate has to be looked up in the right place. Bybit's [maintenance margin article](https://www.bybit.com/en/help-center/article/Maintenance-Margin-USDT-Contract) (page dated 16 April 2026, checked 22 November 2026) gives this example: a BTCUSDT position worth 2,000,000 USDT or less needs an MMR of 0.5%. When I called the [risk limit endpoint](https://bybit-exchange.github.io/docs/v5/market/risk-limit) directly on 18 November 2026, the first tier it returned was a position value up to 300,000 USDT, an MMR of 0.33% and a maximum leverage of 150x. The 0.5% is the second tier's rate. The help article's example has fallen behind the parameters. Everything here uses the endpoint's 0.33%, and anyone holding more than 300,000 USDT has less room than the table below shows.

The table below also turns the room into USDT at the 17 November 2026 close of 64,919.9. For your own entry price, the [liquidation price calculator](/tools/liquidation-price-calculator/) applies the same formula.

## How many of 365 days ended in a same-day liquidation? 254 at 100x, 2 at 10x

<!-- unique:firsthand-data -->
A 100x long opened at the daily open was liquidated the same day on 254 of 365 days, and a 100x short on 253 days. At 10x it was 2 days and 1 day. At 5x and below it never happened. The data is the daily candles (last traded price) of the Bybit BTCUSDT perpetual for the 365 complete UTC days from 18 November 2025 to 17 November 2026, downloaded on 18 November 2026 from `https://api.bybit.com/v5/market/kline` ([endpoint docs](https://bybit-exchange.github.io/docs/v5/market/kline)). The assumption is an entry at the open, 00:00 UTC, every day, in isolated mode with no margin added. A long counts as liquidated when (open − low) ÷ open reaches the room, and a short when (high − open) ÷ open does.

| Leverage | Room | At a price of 64,919.9 | Longs liquidated | Shorts liquidated | Both sides, same day |
| --- | --- | --- | --- | --- | --- |
| 2x | 49.67% | 32,245.71 USDT | 0 days | 0 days | 0 days |
| 5x | 19.67% | 12,769.74 USDT | 0 days | 0 days | 0 days |
| 10x | 9.67% | 6,277.75 USDT | 2 days (0.55%) | 1 day (0.27%) | 0 days |
| 20x | 4.67% | 3,031.76 USDT | 20 days (5.48%) | 21 days (5.75%) | 1 day |
| 50x | 1.67% | 1,084.16 USDT | 147 days (40.27%) | 118 days (32.33%) | 21 days |
| 100x | 0.67% | 434.96 USDT | 254 days (69.59%) | 253 days (69.32%) | 160 days |

<!-- unique:original-calc -->
The right-hand column surprised me most. At 100x there were 160 days on which both sides were liquidated: whether you went long or short at 00:00 UTC, the ending was the same. Only 18 days in the whole year left both sides standing. At 50x both sides went on 21 days, and at 20x on a single day, 6 February 2026.

<!-- unique:original-calc -->
Longs and shorts are not symmetric. At 50x, longs were liquidated on 147 days and shorts on 118 days, a gap of 29 days. Over this year BTC went from 92,171.4 to 64,919.9, a fall of 29.57%, with 189 down days against 176 up days, so there were more downward wicks to begin with. In a rising year the ugly column would probably be the short one. That part is a guess. These 365 days are all I have.

### How big is the move against you in one day? Median 1.24%, maximum 14.88%

<!-- unique:original-calc -->
For a long, the largest drop from the open within the day had a median of 1.24% and a mean of 1.78%. For a short, the largest rise from the open had a median of 1.08% and a mean of 1.61%. Put those next to the room column: the 1.67% at 50x is only a little wider than an ordinary day, and the 0.67% at 100x is about half of one.

<!-- unique:firsthand-data -->
The extremes cluster in early February 2026. The worst day for longs was 5 February 2026: open 73,130.3, low 62,250.0, a fall of 14.88%. The next day, 6 February 2026, it was the shorts' turn: open 62,872.7, high 71,719.9, a rise of 14.07%. Only three days in the year hurt a 10x position, and they are those two plus 31 January 2026 (down 10.13%).

<!-- unique:original-calc -->
The 90th percentile is 3.86% for longs and 3.63% for shorts, so roughly one day in ten moves further against you than that. The 4.67% room at 20x sits a little outside that line, which is why 20x goes about 20 days a year and no more.

## Where the method is off: entry time, mark price, and what a daily candle hides

The table departs from real trading in four ways: the entry time is assumed, liquidation is triggered by the mark price and not by the last traded price, a daily candle hides the order of events, and only the day of entry is counted. I checked the three that the data can check.

<!-- unique:original-calc -->
Entry time first, the one I worried about most. The daily open is not a special moment, only the point where the UTC date changes. Nobody enters at exactly 00:00 UTC every day, and I expected the assumption to skew the result. So I recounted on 1-hour candles: one entry at every full hour from 00:00 on 18 November 2025 to 00:00 on 17 November 2026, 8,737 entries in all, each held for 24 hours. A 100x long was liquidated on 70.29% of those entries, against 69.59% in the daily version. At 50x it was 39.29% against 40.27%, and at 20x 5.94% against 5.48%. Split by the hour of entry, the 100x long figure runs from 68.13% to 73.63%. I guessed wrong. The hour of entry hardly changes the conclusion.

<!-- unique:original-calc -->
The mark price mattered less than I expected as well. Bybit states that liquidation follows the mark price, and the [mark price](https://www.bybit.com/en/help-center/article/Mark-Price-Calculation-Perpetual-Expiry-Contracts) (page dated 4 September 2026, checked 22 November 2026) is the median of three values: two prices derived from the index price, plus the last traded price. I downloaded daily mark price candles too (the `mark-price-kline` endpoint, [docs](https://bybit-exchange.github.io/docs/v5/market/mark-kline)) and recounted. That is the second row below. Across six leverage levels and both directions, the two price series disagree on only 9 day-and-direction pairs, and in all 9 the last traded price reached the level while the mark price did not.

| Method | 20x long / short | 50x long / short | 100x long / short |
| --- | --- | --- | --- |
| Daily candles, last traded price (table above) | 20 / 21 days | 147 / 118 days | 254 / 253 days |
| Daily candles, mark price | 19 / 21 days | 145 / 117 days | 252 / 250 days |
| Daily candles, Bybit's full formula | 19 / 21 days | 146 / 118 days | 254 / 253 days |
| Entry every hour, held 24 hours | 5.94% / 5.56% | 39.29% / 34.76% | 70.29% / 69.07% |

What the daily candle hides is harder to deal with. A candle has four prices: open, high, low and close. It doesn't say whether the high or the low came first, or at what hour the liquidation happened. For "does it get liquidated" that makes no difference. For "how long does it last" it makes a large one.

<!-- unique:original-calc -->
Going back to the 1-hour candles: of the 254 days on which a 100x long was liquidated, 38 days were over within the first hour, 131 days within the first four hours and 171 days within the first eight. For the 253 short days the counts are 39, 110 and 147. More than half of those 100x longs were gone before 04:00 UTC.

The remaining limits can't be patched with this data. Fees and funding are left out, and under Bybit's rules a funding fee that the available balance can't cover is taken from the position margin, which pulls the liquidation price a little closer. Only the day of entry is counted, and the longer a position stays open, the more chances price gets to reach the level. And the sample is one coin and one year, a falling year at that.

## How to read the table: it measures room, not direction

The table measures whether price touches your liquidation level within one day. It has nothing to say about whether you had the direction right. The 160 days on which both sides were liquidated are the evidence: on those days a trader who was right about direction, at 100x, was closed out first, and the market went where they expected afterwards.

My own reading is that the leverage setting decides how much room you have, and the relationship is far from linear. In the long column, going from 10x to 20x adds 18 liquidation days a year; going from 50x to 100x adds 107 days. To work back from a stop distance to a leverage ceiling, use the [leverage calculator](/tools/leverage-calculator/). To fix the most you're willing to lose on a trade and size the position from that, use the [position size calculator](/tools/position-size-calculator/).

In [policy statement PS20/10](https://www.fca.org.uk/publications/policy-statements/ps20-10-prohibiting-sale-retail-clients-investment-products-reference-cryptoassets) (published 6 October 2020, checked 22 November 2026) the UK Financial Conduct Authority banned the sale of crypto-asset derivatives to retail clients, with the rules applying from 6 January 2021. One of the reasons it lists is extreme volatility in crypto-asset prices. Readers outside the UK aren't covered by that rule, but the risk it describes is the one in the table above.

The latest daily reading is in the [bitcoin daily report](/daily/btc/), and statistics across several contracts are on the [liquidation data page](/data/liquidation/). The other running cost of a position is funding, and current rates are on the [funding rate data page](/data/funding-rate/). If you'd like to test an exit rule on a year of candles before trusting it with margin, the open-source backtester is described on the [bot page](/bot/).

Two things are not counted yet: cross margin, and holding for longer than a day. The second will look a good deal worse, but I haven't run it, so I won't put a number on it.

## FAQ

### What is the difference between a liquidation price and a stop-loss?

A stop-loss is a price you set. The liquidation price is worked out by the exchange from your leverage and the maintenance margin rate. A stop placed further away than the liquidation price never gets its turn. At 100x the room is only 0.67%, which is 434.96 USDT at a price of 64,919.9, so there is very little space to fit a stop inside it.

### Can I be liquidated when the chart never touched my liquidation price?

Mechanically, yes. Liquidation is triggered by the mark price, while the default chart draws the last traded price. They are different lines, and Bybit's liquidation article warns about exactly this. In these 365 daily candles it never happened, though. The 9 disagreements all ran the other way: a wick in the last traded price reached the liquidation distance and the mark price didn't follow.

### Is 5x leverage safe from liquidation?

In this data a 5x position was liquidated on its day of entry on 0 days, and that is not a guarantee. The room at 5x is 19.67%, and the largest one-day adverse move of the year was 14.88%, less than 5 percentage points short of it. This also counts the day of entry only, on a sample of 365 days.

### Can I recompute these numbers myself?

Yes. Everything comes from Bybit's public endpoints, with no API key: `kline`, `mark-price-kline` and `risk-limit`. The script and the raw CSV downloads are in the `research/` folder of this site's source code, and the main file is `liquidation_btcusdt.py`. I'd check what the `risk-limit` endpoint returns before rerunning it, since the day counts move as soon as the maintenance margin rate changes.
