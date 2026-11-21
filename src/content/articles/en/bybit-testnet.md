---
title: "Bybit testnet: setup, Demo Trading differences, and prices 1% off mainnet"
slug: "bybit-testnet"
description: "What the Bybit testnet is, how it differs from Demo Trading, and what we measured on 21 November 2026: 0.68% of mainnet's volume and closes a median 1.87% apart."
date: "2026-11-23"
lastmod: "2026-11-23"
lang: "en"
category: "Trading bots"
tags: ["Bybit testnet", "Demo Trading", "paper trading", "trading bot", "BTCUSDT"]
keywords: ["bybit testnet", "bybit demo trading", "bybit testnet api", "bybit testnet vs mainnet", "bybit paper trading"]
tldr: "The Bybit testnet is a separate exchange at testnet.bybit.com with its own accounts, play money and order book. Demo Trading is a mode of the real site that follows mainnet prices. On 21 November 2026 we pulled the same public BTCUSDT data from both networks: over 200 fifteen-minute candles the testnet traded 0.68% of mainnet's volume, its closes sat a median 1.87% away, and its funding rate was at the -0.333% floor. The testnet tells you whether code breaks. It cannot tell you whether a strategy pays."
---

<!-- unique:firsthand-data -->
59,660.0: that was the last price of BTCUSDT on the Bybit testnet for three minutes on 21 November 2026, and it did not move. We read it five times between 17:27 and 17:31 UTC and got that figure each time. Over those same three minutes the real market printed 60,230.2, 60,256.4, 60,243.5, 60,268.9 and 60,133.5. The testnet was between 0.79% and 1.01% below a market it is supposed to stand in for, and it was standing still.

## What is the Bybit testnet?

It is a second, separate copy of the exchange that runs on play money. The website is `testnet.bybit.com`, the REST API is `https://api-testnet.bybit.com` (Bybit's [integration guide](https://bybit-exchange.github.io/docs/v5/guide), checked 22 November 2026), and neither shares accounts, balances or orders with bybit.com. An account on one does not exist on the other.

Bybit's Help Center article on [registering for the testnet](https://www.bybit.com/en/help-center/article/How-to-Request-Test-Coins-on-Testnet) (last updated 16 July 2026, checked 22 November 2026) calls it a "100% replication" of the mainnet's products and services. Hold on to that phrase. For the trading screens and the API it is close to true. For prices it is not, and a second Help Center page says so itself.

### How do you register and get test funds?

You register on the testnet site as if it were a new exchange, then ask for coins. According to the same Help Center article:

1. Open the testnet site in a desktop browser and create an account with an email address or phone number. The article says the testnet can only be reached from a PC browser.
2. Enter the verification code sent to that email or phone.
3. Go to Assets, then Assets Overview, then Request Test Coins, and confirm.

The article says each request credits 10,000 USDT and 1 BTC to the Spot account and that you can ask once every 24 hours. It carries one warning worth repeating: never send real coins to a testnet deposit address. The article says such a deposit is lost for good, and that testnet withdrawals are not processed.

For the API you then create a key on the testnet site itself; the integration guide sends you to each site's own API management page. A mainnet key will not work. Bybit's [error list](https://bybit-exchange.github.io/docs/v5/error) (checked 22 November 2026) says under code `10003` that key and domain must match, and names four environments: mainnet, testnet, and a demo variant of each. Give the key contract trading permission only, with no withdrawal or transfer rights. The reasons and the endpoint that reports a key's permissions are in [the Bybit API article](/learn/bybit-api-python/).

<!-- unique:field-note -->
What we did not do, as of 22 November 2026: we have not registered a testnet account for this article. The amounts, the 24-hour rule and the menu path above are Bybit's description, not our observation. Two details are open. The Help Center says the coins land in the Spot account, while Bybit's [API FAQ](https://bybit-exchange.github.io/docs/faq) (same date) says only to request them on the master account's asset page. And the Demo Trading page mentioned below says identity verification can be needed on the testnet for some features, spot and derivatives trading among them, which the registration article does not mention. We could not find a page that settles either point.

## Testnet or Demo Trading: which one is which?

They are different products with different price sources, and the names get swapped all the time. The testnet is its own exchange with its own order book. Demo Trading is a mode of the real exchange, fed by real prices, in which your orders are simulated.

| | Testnet | Demo Trading |
| --- | --- | --- |
| Where it lives | `testnet.bybit.com` | inside bybit.com and the app |
| Account | registered separately | part of your mainnet account |
| Play money | on request, once per 24 hours | credited at creation |
| Prices | its own order book | follow mainnet |
| Your orders move the price | yes, in the testnet book | no |
| REST host | `api-testnet.bybit.com` | `api-demo.bybit.com` |
| Features | all but deposit and withdrawal | spot and derivatives only |
| Access | desktop browser | web and app |

The rows come from Bybit's [Demo Trading article](https://www.bybit.com/en/help-center/article/Demo-Trading) (last updated 30 October 2026, checked 22 November 2026) and its [demo trading API page](https://bybit-exchange.github.io/docs/v5/demo) (checked 22 November 2026). A demo account starts with 50,000 USDT, 50,000 USDC, 1 BTC and 1 ETH, and its orders never enter the real order book. The API page says demo keys are created while in Demo Trading mode on the mainnet site and that demo orders are kept for 7 days. The Help Center adds that a demo account left unopened for 30 days is wiped.

Here is the sentence that undercuts "100% replication". The Demo Trading article describes the testnet as operating independently of mainnet prices and warns that it may not represent live trading conditions accurately. Two pages of the same Help Center disagree on how faithful the testnet is, and the measurements below side with the second one.

<!-- unique:firsthand-data -->
We checked the price-source row ourselves. At 17:33 UTC on 21 November 2026 we asked the mainnet host, the demo host and the testnet host for the same 50 closed fifteen-minute candles. The demo host's rows were identical to mainnet's in all 50. The testnet's matched in none.

One combination to avoid: a Demo Trading mode also exists on the testnet site. The API FAQ says not to use it and that it inherits the limits of both.

## How far are testnet prices from mainnet? We measured

Far enough that nothing priced on the testnet carries over. We requested public BTCUSDT perpetual data from both hosts in the same instant, each pair of requests sent from two threads at once, with no key and no account. The scripts and every raw response are in this site's source under `research/bybit-testnet/`.

| BTCUSDT perpetual, 21 November 2026 | Mainnet | Testnet |
| --- | --- | --- |
| Last price, 17:27:34 UTC | 60,230.2 | 59,660.0 |
| Index price, same moment | 60,264.43 | 60,264.42 |
| Mark price against index | -0.06% | -0.97% |
| Funding rate shown | -0.0058% | -0.333% |
| 24-hour volume | 188,154 BTC | 1,510 BTC |
| Open interest | 68,018 BTC | 254,543 BTC |
| Volume over 200 candles | 349,018 BTC | 2,384 BTC |
| Candles missing out of 200 | 0 | 0 |
| Median volume per candle | 1,065 BTC | 1.10 BTC |
| Median candle range, high to low | 0.519% | 0.033% |
| Candles with high equal to low | 0 | 11 |
| Linear contracts listed | 939 | 928 |

The 200 candles are fifteen-minute bars from 15:15 UTC on 19 November to 17:15 UTC on 21 November 2026.

<!-- unique:original-calc -->
Read the index row first. Both networks report the same index price, identical in two of our five snapshots and never more than 0.44 USDT apart, so the testnet knows where the real market is. Its own trading just doesn't follow. Testnet volume over the 200 candles was 0.68% of mainnet's, about one part in 146. In 166 of the 200 testnet candles less than 2 BTC changed hands.

<!-- unique:original-calc -->
The closes drift apart and back. Across the 200 bars the testnet close was a median 1.87% away from mainnet's and 4.60% at worst: the bar that opened at 10:15 UTC on 21 November closed at 58,069.9 on mainnet and at 55,399.8 on the testnet. More than 1% separated them in 153 of the 200 bars. It is not a fixed offset you could subtract. The testnet closed below mainnet in 111 bars and above it in 89. Bar-to-bar returns had a correlation of 0.28. Of the 148 steps in which both prices moved, they moved the same way in 88, which is 59% where a coin toss gives 50%. In 51 of 199 steps the testnet close did not change at all.

<!-- unique:firsthand-data -->
Funding is stranger. The contract rules on both networks cap BTCUSDT funding at plus or minus 0.333% per settlement. Mainnet never came near the cap in the last 90 settlements, from 23 October to 21 November 2026: its range was -0.0042% to +0.01%. The testnet sat exactly on the cap or the floor in 22 of the same 90, twelve times at +0.333% and ten at -0.333%. The three settlements of 21 November read +0.333%, +0.333%, -0.333%. A bot that holds positions across settlements would book funding on the testnet up to 33 times larger than the +0.01% that was mainnet's maximum, in either direction. Real rates are on the [funding rate page](/data/funding-rate/).

Open interest looks like a typo and isn't: the testnet shows 3.74 times mainnet's open interest on 0.8% of its daily volume. Play-money positions cost nothing to leave open.

### How thin is the testnet order book?

Thin enough that selling one bitcoin moves it by more than a percent. The top of the book looks normal, with a 0.1 USDT spread on both networks, and that is misleading.

<!-- unique:original-calc -->
We took 500 levels a side from each order book at 17:27:35 UTC and walked a market sell down the bids. The table shows the average fill against the best bid, before fees:

| Market sell of | Mainnet | Testnet |
| --- | --- | --- |
| 0.01 BTC | 0.00% | 0.00% |
| 0.1 BTC | 0.00% | -0.21% |
| 1 BTC | 0.00% | -1.44% |
| 10 BTC | -0.007% | -2.64% |

<!-- unique:firsthand-data -->
Within 1% of the mid price the testnet held bids for 0.136 BTC in total. On mainnet the 500 levels we received reached only 0.15% below the mid and already held 361 BTC. The testnet's 444 bid levels, by contrast, were the whole book: the lowest was a bid at 156.10 USDT. Four more snapshots over the next three minutes gave the same picture, with the 1 BTC sell costing between 1.44% and 1.49%.

<!-- unique:firsthand-data -->
The public trade feed adds one more thing. The last 1,000 mainnet trades covered between 14 and 68 seconds, depending on the snapshot. The last 1,000 testnet trades covered 50 minutes each time, a steady 19.8 to 19.9 a minute. In the first snapshot no two were more than 5.1 seconds apart, and 993 of the 1,000 were buys of a few thousandths of a bitcoin. That is my reading, not a fact I can verify: it looks like a script keeping the tape alive, not like people trading. It would explain why no candle was missing or empty in a market this quiet.

Bybit's API FAQ describes the practical result. Testnet market orders can fail or be cancelled after a partial fill when the book lacks opposing orders. The page offers no sure fix and suggests limit orders, or Demo Trading on the mainnet site as a more liquid place. The default order of the runner described further down is 100 USDT, which is 0.001 BTC at these prices, and the best bid held more than that in each of our five snapshots.

## Same strategy, different candles: do the signals match?

Almost never. A bot on the testnet reads testnet candles, so it makes different decisions from the same code reading the real market.

<!-- unique:firsthand-data -->
We downloaded the same 1,000 fifteen-minute candles from both hosts (07:30 UTC on 11 November to 17:30 UTC on 21 November 2026, none missing on either) and ran the three example strategies of the open-source engine on each set, with the parameters it ships. The table counts entry signals, and how many fell on the same bar in the same direction:

| Strategy | Mainnet candles | Testnet candles | Same bar |
| --- | --- | --- | --- |
| `ma_cross` | 16 | 22 | 0 |
| `fvg` | 42 | 96 | 3 |
| `liquidity_sweep` | 88 | 52 | 1 |

<!-- unique:original-calc -->
The moving-average cross never fired on the same bar in both sets, and for the fair value gap entry 3 of 134 signal bars coincided. Whatever a testnet run of these strategies earns or loses, it is the result of trades the real market never offered. All three lose money in the engine's [published backtests](/backtests/) on mainnet data, the [moving-average cross](/backtests/ma-cross-btcusdt/) included, and nothing here changes that.

## How do you test a trading bot on the testnet without a key?

Start with a dry run, which touches public endpoints only. The engine's runner, described on the [bot page](/bot/), has a `--dry-run` flag that reads testnet candles, runs the strategy and prints the order it would send. It creates its client with no credentials, and the client's signing code refuses to run without them, so a dry run cannot send a signed request.

```text
perpmath live ma_cross --symbol BTCUSDT --interval 15m \
  --config configs/live/ma_cross.json --dry-run --once
```

<!-- unique:firsthand-data -->
```text
2026-11-21T17:30:42Z perpmath live ma_cross BTCUSDT 15m | DRY RUN (no signed requests, no orders) | state .perpmath-live\ma_cross-BTCUSDT-15m-a690e4-dryrun.json
2026-11-21T17:30:42Z limits: order 100 USDT, max position 200 USDT, max daily loss 20 USDT, max 5 consecutive API errors, max clock skew 5000 ms
2026-11-21T17:30:42Z clock offset to Bybit: 897 ms (request timestamps and bar timing use Bybit's clock)
2026-11-21T17:30:42Z bar 2026-11-21T17:15:00Z close 59660.0: no entry
```

<!-- unique:firsthand-data -->
That is the whole output of version 0.2.0 on our machine, exit code 0, with no API key set anywhere. It measured the clock, fetched the contract rules and 500 closed candles, checked the strategy for look-ahead, and decided on the bar that closed at 17:30 UTC. Look at the close it decided on: 59,660.0. The real 17:15 bar closed at 60,267.2. There was no signal on that bar, so no order body was printed; `--once` handles a single bar and exits.

The next step would be a real testnet key and real testnet orders, and here the honest status matters more than the instructions. The runner's signed path (key check, order placement, stop-loss attachment, reconciliation) has been tested against a fake Bybit server written from the documentation, as its [README](https://github.com/sentinelbotsaas-hub/perpmath/blob/85ee44e58a12eace4cd6645331d0d3ca74197da9/README.md#testnet-runner-02) states (commit `85ee44e`, checked 22 November 2026). It has not placed an order with a real testnet key. We are not going to describe an order flow we have not watched.

One more limit: version 0.2 talks to the testnet host and nothing else. It refuses mainnet, and it refuses the Demo Trading host too, so the more realistic prices of Demo Trading are out of its reach for now.

## What can the testnet verify, and what can't it?

It verifies plumbing. Anything that depends on price, volume or other traders it cannot verify, and the numbers above are why.

| Question | Answered? | Why |
| --- | --- | --- |
| Is my signature accepted? | yes | same API and signing rules |
| Are the key's permissions right? | yes | same key-information endpoint |
| Are order sizes and prices valid? | mostly | maximum order size differs |
| Does the code survive a restart? | yes | bookkeeping, not market |
| Do the circuit breakers trip? | yes | play-money losses still count |
| What slippage will I get? | no | 1 BTC moved the book 1.44% |
| Will my orders fill? | no | too little depth |
| What will funding cost? | no | 22 of 90 settlements at the cap or the floor |
| Does the strategy make money? | no | signals differ from mainnet |

"Mostly" needs a footnote. Tick size, minimum quantity and quantity step were the same on both networks when we read them, but the largest allowed limit order was 1,190 BTC on the testnet against 1,500 on mainnet, and the testnet listed 11 fewer contracts. The restart row covers timeouts and duplicate order IDs too: that is order bookkeeping, and it behaves the same whatever the price does.

<!-- unique:operator-view -->
I started this piece assuming the testnet was a slightly noisy copy of the market, good enough for a rough profit check. I was wrong: after the candle comparison I would not use a testnet P&L for anything. A green week there says the bot ran for a week. For sizing and liquidation distance, work from mainnet rules with the [position size calculator](/tools/position-size-calculator/) and the [liquidation price calculator](/tools/liquidation-price-calculator/); the first risk tier matched on both networks, 0.33% maintenance margin up to 300,000 USDT.

The one thing the comparison cannot rank is Demo Trading. Its prices are mainnet's, which removes the signal problem. How it fills orders that never enter a book is something we have not measured, and Bybit's pages do not describe it.

perpmath is independent of Bybit and not endorsed by it. How this site earns money from Bybit links is on the [disclosure page](/disclosure/).

## FAQ

### Can I use my mainnet API key on the testnet?

No. A key works only on the environment that issued it, and Bybit's error list gives a mismatch between key and domain as the usual reason for `10003`. We sent a made-up key to the testnet and got that code back; the request and the answer are in [the API article](/learn/bybit-api-python/).

### Should I test a bot on the testnet or in Demo Trading?

For a first check that orders, stops and restarts behave, either works, and the testnet exposes more of the API. For anything that depends on realistic prices, Demo Trading is the closer of the two, since its candles were identical to mainnet's when we compared them. We can only show the testnet, since that is the one host our own runner supports.

### If my bot is profitable on the testnet, will it be profitable live?

There is no reason to expect so. In our sample the testnet's closes were a median 1.87% from mainnet's, its volume was 0.68% of mainnet's, and the same strategy code produced signals on different bars. A testnet profit was earned in a market that does not exist anywhere else.
