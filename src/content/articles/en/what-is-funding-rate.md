---
title: "What is a funding rate? Bybit's formula, settlement times, and a year of BTCUSDT that cost 2.86%"
slug: "what-is-funding-rate"
description: "A funding rate is the fee longs and shorts on a perpetual pay each other. How Bybit calculates and settles it, plus 1,095 BTCUSDT settlements over 365 days."
date: "2026-11-23"
lastmod: "2026-11-23"
lang: "en"
category: "Perpetual basics"
tags: ["funding rate", "perpetual futures", "holding cost", "BTCUSDT"]
keywords: ["funding rate", "what is funding rate", "funding rate calculation", "funding fee", "perpetual futures"]
tldr: "A funding rate is the fee that longs and shorts on a perpetual contract pay each other at fixed times; when the rate is positive, longs pay shorts. Bybit settles BTCUSDT every 8 hours (00:00, 08:00 and 16:00 UTC), and the fee is position value times the funding rate. Across 1,095 settlements from 18 November 2025 to 17 November 2026, 72.24% were positive, the mean was 0.00261% and the median 0.00272%. A long kept at 1,000 USDT of notional paid a net 28.58 USDT over the year, about 2.86%."
---

"A funding rate of 0.01%, three times a day, comes to about 11% a year." That is the handy mental sum, and it was my working figure too before I downloaded any data. Added up over a full year of Bybit BTCUSDT settlements, the real figure is 2.86%, close to four times smaller. The trouble is the 0.01%.

## What is a funding rate? Money longs and shorts pay each other, not an exchange fee

A funding rate is the rate at which long and short holders of a perpetual contract pay each other at set intervals. When the rate is positive, longs pay shorts; when it is negative, shorts pay longs. Bybit's [funding fee calculation article](https://www.bybit.com/en/help-center/article/Funding-fee-calculation) (page dated 12 May 2026, checked 22 November 2026) says funding fees are exchanged directly between long and short position holders, and that only traders who hold a position at the funding time pay or receive anything.

The reason it exists is that a perpetual contract never expires. An ordinary futures contract lines up with the spot price at expiry. A perpetual has no such day, so something else has to pull its price back toward spot: longs pay when the contract trades above spot, shorts pay when it trades below, and the further it drifts the more they pay. For the academic treatment, see [Fundamentals of Perpetual Futures](https://arxiv.org/abs/2212.06888) by He, Manela, Ross and von Wachter (first posted 13 December 2022, checked 22 November 2026). They call perpetuals the most popular crypto derivative and derive what the contract should cost when no arbitrage is possible.

Funding and trading fees are two separate bills. A trading fee goes to the exchange when you open or close. Funding passes between longs and shorts while the position is held.

## How does Bybit calculate the funding rate? Interest plus premium, then clamped

Bybit's funding rate has two parts, an interest rate and an average premium index, and the result is held between an upper and a lower limit. The [introduction to funding rate](https://www.bybit.com/en/help-center/article/Introduction-to-Funding-Rate) (page dated 19 November 2026, checked 22 November 2026) gives this formula:

```
funding rate  = clamp[ P + clamp(I - P, 0.05%, -0.05%), upper limit, lower limit ]
interest rate = 0.03% / (24 / funding interval in hours)
P = average premium index, I = interest rate
```

The interest rate is fixed at 0.03% a day, so a contract with an 8-hour interval gets 0.01% per settlement. The premium index measures how far the contract's bid and ask prices sit from the index price. It is calculated every minute, and the minutes closer to settlement carry more weight.

The inner clamp is the part that matters. As long as the average premium index stays between −0.04% and +0.06%, the difference between interest and premium is not cut off, the two terms cancel, and the funding rate equals the interest rate, 0.01%. When the premium is below −0.04%, the funding rate becomes premium + 0.05%, which is under 0.01% and turns negative if the premium falls further.

<!-- unique:cross-reference -->
That page now carries a notice that was not there when I pulled the data: an updated formula is to be rolled out in phases from 24 November 2026. Bybit's [announcement](https://announcements.bybit.com/en/article/update-to-funding-rate-calculation-formula-for-perpetual-contracts--art9f3b40f8766e/) (dated 19 November 2026, checked 22 November 2026) multiplies the bracketed term by N ÷ 8, where N is the contract's funding interval in hours, and says rates may change for contracts whose interval is shorter than 8 hours. For an 8-hour contract N ÷ 8 is 1, so on my reading the BTCUSDT arithmetic here stays as it is. The sample symbol lists in the announcement don't name BTCUSDT, and I have not seen a settlement under the new formula. Every number below was settled under the old one.

<!-- unique:cross-reference -->
For the limits I went straight to the endpoint. On 18 November 2026, `instruments-info` ([docs](https://bybit-exchange.github.io/docs/v5/market/instrument)) returned for BTCUSDT a funding interval of 480 minutes, an upper funding rate of 0.00333 and a lower one of −0.00333, which is ±0.333% per settlement. Binance's [funding rate FAQ](https://www.binance.com/en/support/faq/360033525031) (checked 22 November 2026) is built on the same skeleton: settlement every 8 hours by default at 00:00, 08:00 and 16:00 UTC, the same 0.01% of interest per interval, and a different way of setting the cap and floor. The "0.01%" on both exchanges is the same thing: the default value when the premium is small.

## When is funding charged, and how much? Only if you hold a position at the settlement

BTCUSDT settles every 8 hours, at 00:00, 08:00 and 16:00 UTC, and the amount is position value times the funding rate. Bybit writes it as:

```
funding fee    = position value x funding rate
position value = contract quantity x mark price
```

Position value uses the mark price at the settlement, not your entry price and not the margin you put up. A 1,000 USDT position at a 0.01% rate pays 0.1 USDT, whether it was opened at 1x or at 50x.

Three details on that Bybit page are easy to miss. A position fully closed before the funding time neither pays nor receives, but if you open or close within 5 seconds either side of it, the system does not guarantee whether you are counted. The fee comes out of the available balance first and out of the position margin only when the balance is short, which in isolated mode moves the liquidation price toward the mark price. And if the funding rate hits its upper or lower limit at a settlement, the settlement frequency switches automatically to once an hour.

<!-- unique:firsthand-data -->
That last rule never came into play this year. I checked the timestamps of all 1,095 settlements: every gap between neighbours is 8 hours, and the only hours that appear are 00, 08 and 16. The rate also stayed far from the ±0.333% limits, with a high of 0.01% and a low of −0.0162% for the year.

## What did funding cost over the past 365 days? A net 28.58 USDT on a 1,000 USDT long

<!-- unique:firsthand-data -->
A BTCUSDT long kept at 1,000 USDT of notional paid a net 28.58 USDT in funding over 365 days, which is 2.86% of the notional. The data is the funding rate history returned by Bybit's `https://api.bybit.com/v5/market/funding/history` ([endpoint docs](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate)): every settlement from 00:00 UTC on 18 November 2025 to 16:00 UTC on 17 November 2026, 1,095 records, downloaded on 18 November 2026.

| Item | Value |
| --- | --- |
| Settlements | 1,095 |
| Positive rate (longs pay) | 791 settlements, 72.24% |
| Negative rate (longs receive) | 304 settlements, 27.76% |
| Mean rate | 0.00261% |
| Median rate | 0.00272% |
| Sum of rates | 2.8582% |
| Paid by the long (the 791 positive settlements) | 37.01 USDT |
| Received by the long (the 304 negative settlements) | 8.43 USDT |
| Net paid by the long | 28.58 USDT |

<!-- unique:original-calc -->
"1,000 USDT of notional" can be held in two ways, and they give different answers. The table assumes the position is worth exactly 1,000 USDT at every settlement. If you had bought 0.01084934 BTC at the mark price of 92,171.5 on 18 November 2025 and left it alone, the position value would have shrunk with the price. At the last settlement on 17 November 2026 the mark price was 64,087.79, and on that basis the year's net funding comes to 23.90 USDT. The gap is the fall of about 30% in price over the year: a smaller position pays less.

<!-- unique:original-calc -->
Month by month it swings a lot. The most expensive month was August 2026, when 88 of 93 settlements were positive and the long paid 4.40 USDT. The cheapest was April 2026, when 51 of 90 settlements were negative and the long collected 0.75 USDT. From July to October 2026 every month cost between 3.9 and 4.4 USDT, more than any month before them.

| Month | Settlements | Positive | Net paid by a long per 1,000 USDT |
| --- | --- | --- | --- |
| 2025-11 (from the 18th) | 39 | 21 | 0.56 USDT |
| 2025-12 | 93 | 67 | 2.70 USDT |
| 2026-01 | 93 | 69 | 2.74 USDT |
| 2026-02 | 84 | 51 | 1.19 USDT |
| 2026-03 | 93 | 47 | −0.13 USDT |
| 2026-04 | 90 | 39 | −0.75 USDT |
| 2026-05 | 93 | 64 | 1.75 USDT |
| 2026-06 | 90 | 57 | 1.15 USDT |
| 2026-07 | 93 | 79 | 3.93 USDT |
| 2026-08 | 93 | 88 | 4.40 USDT |
| 2026-09 | 90 | 81 | 3.90 USDT |
| 2026-10 | 93 | 81 | 4.05 USDT |
| 2026-11 (to the 17th) | 51 | 47 | 3.09 USDT |

## Is 0.01% the normal funding rate? This year it was the ceiling, reached 77 times

No. This year 0.01% was the highest funding rate on record. Of the 1,095 settlements only 77 were exactly 0.01%, which is 7.03%. None was higher, and the other 1,018 were lower.

<!-- unique:original-calc -->
That is where the opening sum goes wrong. If every settlement had been 0.01%, a 1,000 USDT long would have paid 109.5 USDT for the year. It paid 28.58 USDT, about a quarter of that. I used to treat 0.01% as "the usual rate", and the data says it is the cap. It first appeared at 16:00 UTC on 18 November 2025 and last appeared at 00:00 UTC on 13 November 2026, thinly scattered in between.

<!-- unique:original-calc -->
Working backwards through the formula shows why. A rate below 0.01% means the average premium index for those 8 hours was below −0.04%, and the median rate of 0.00272% corresponds to a premium of roughly −0.047%. Put another way, in 93% of this year's settlement intervals the BTCUSDT perpetual was quoted, on average, under its index price, and in no interval did the average premium rise above +0.06%. I derived this from Bybit's published formula, assuming the limits and the formula were not adjusted temporarily between 18 November 2025 and 17 November 2026. I have not rebuilt the weighted average from Bybit's premium index history to check the answer.

A contract that sits at a discount for most of a year fits that year's price action: the BTC mark price fell 30.47% over the same period. My reading is that appetite for longs was weak, which kept quotes pressed under the index, but that is only a reading. What a strongly rising year looks like, I have no data for, and I won't guess.

## The two largest settlements: +0.01% and −0.0162%

The largest single rate was +0.01%, shared by 77 settlements. The lowest was −0.016192%, at 00:00 UTC on 15 April 2026, when a 1,000 USDT long received 0.16 USDT.

<!-- unique:firsthand-data -->
The longest unbroken run of negative rates was 14 settlements, from 08:00 UTC on 28 April 2026 to 16:00 UTC on 2 May 2026: close to five days of shorts paying longs. April as a whole was a month in which longs were net receivers, one of only two in the year. The other was March.

<!-- unique:cross-reference -->
The days of the most violent price action are the interesting part. 5 February 2026 had the largest one-day drop of the year, 14.88% from the open to the low (the method is in the [liquidation article](/learn/what-is-liquidation/)). The three funding rates that day were 0.00471%, 0.002503% and 0.002066%: all positive and all tiny. The next day the rate turned negative at 08:00 UTC (−0.000784%) and reached −0.009333% at 16:00 UTC. What took out 10x longs that day was price. Funding did not amount to a rounding error.

## Does leverage make funding more expensive? Same amount, larger share of your margin

It doesn't raise the amount, but it raises the share of your own money that the amount represents. Funding is calculated on position value, so a 1,000 USDT position pays 28.58 USDT a year regardless of how much margin sits behind it.

<!-- unique:original-calc -->
The proportions are another matter. Take the same 1,000 USDT position. At 5x you post 200 USDT of margin, and 28.58 USDT is 14.29% of it. At 10x you post 100 USDT, and it is 28.58%. At 20x you post 50 USDT, and it is 57.16%. At 50x you post only 20 USDT, and a year of funding is 142.91% of the margin, more than the margin itself. This is pure arithmetic. In practice a 50x position rarely lasts a year, because price deals with it first.

To see how far your own position is from liquidation, use the [liquidation price calculator](/tools/liquidation-price-calculator/). To size a position from the amount you are prepared to lose, use the [position size calculator](/tools/position-size-calculator/). The other calculators are on the [tools page](/tools/). Rates updated every day are on the [funding rate data page](/data/funding-rate/) and in the [bitcoin daily report](/daily/btc/). Funding is also a cost that a grid has to carry while it waits, and the open-source backtester on the [bot page](/bot/) charges it in its grid backtests.

## Limits of these numbers

This is one contract, one year and one exchange, and it does not carry over directly to other coins or other years. Bybit's article states that funding intervals and limits can differ from one trading pair to the next, and I have not computed the distribution for any other contract.

The 28.58 USDT assumes a position worth exactly 1,000 USDT at each settlement. A real position's value moves with price, and the gap was shown above. Trading fees, slippage and the profit or loss on price itself are not included. Past rates say little about future ones either: from July to October 2026 each month cost more than any earlier month, and nothing in the June data pointed to it. And from 24 November 2026 the formula itself changes for some contracts, as noted earlier.

## FAQ

### What does a negative funding rate mean?

It means shorts pay longs. Under Bybit's formula this happens when the average premium index is below −0.05%, that is, when the contract is quoted clearly under the index price. It happened at 304 of this year's 1,095 settlements.

### Can I avoid funding by closing one second before settlement?

Not reliably. Bybit says that when a position is opened or closed within 5 seconds before or after the funding time, the system does not guarantee whether it falls into that cycle, and there is no reimbursement afterwards. To stay out of a settlement you need to leave more time than that.

### How often does Bybit settle funding?

Every 8 hours for BTCUSDT: 00:00, 08:00 and 16:00 UTC. Other contracts can have different intervals, and when the rate hits a limit the frequency switches to once an hour, so the number to trust is `fundingInterval` from the `instruments-info` endpoint.

### Can I stay short and keep collecting funding?

Over this year a 1,000 USDT short collected a net 28.58 USDT, but shorts were the ones paying at 304 settlements, 14 of them in a row at one point. Scale matters more. A full year of funding adds up to 2.86%, while the median one-day adverse move in BTC is above 1%. When price rises, the short loses far more than funding brings in.

### How do I recompute these numbers?

Use Bybit's public `funding/history` endpoint. It needs no API key and returns at most 200 records per call, so you page backwards to cover a year. The script and the raw CSV are in the `research/` folder of this site's source code, and the main file is `funding_btcusdt.py`. What I have not done yet is run the same calculation on other contracts, to see what BTC's 2.86% turns into on altcoins.
