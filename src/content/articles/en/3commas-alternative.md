---
title: "3Commas alternative: free, open source trading bots and who holds your API key"
slug: "3commas-alternative"
description: "3Commas costs $20 to $140 a month. Five open source trading bots compared from their own docs: licence, Bybit support, backtesting, and where your API key lives."
date: "2026-11-30"
lastmod: "2026-11-30"
lang: "en"
category: "Trading bots"
tags: ["3Commas", "open source trading bot", "free trading bot", "API key", "Bybit"]
keywords: ["3commas alternative", "free trading bot", "open source trading bot", "3commas free alternative", "self-hosted trading bot"]
tldr: "On 22 November 2026 the 3Commas pricing page listed three plans at $20, $50 and $140 a month and no free plan; futures start at the $50 plan. Freqtrade, Hummingbot, Jesse and OctoBot are open source and can be run on your own computer, each with its own catch, and Jesse's live trading needs a licence from $899. Our own bot, perpmath, installed and reached a dry run in 24 seconds, but it only connects to the Bybit testnet and cannot place a real order. The lasting difference is where the API key is stored."
---

"Automation that pays for itself" is the headline on the 3Commas pricing page. Below it sit three plans, the cheapest at $20 a month, and no free one. If that is why you are searching for a 3Commas alternative, the free options are real, and every one of them hands you a job that 3Commas does for its customers.

<!-- unique:field-note -->
A note on what this page is. On 22 November 2026 I read the pricing and security pages of 3Commas and the documentation of four open source bots, and wrote down what each says about itself. We have not traded with any of the five, so there are no impressions of them here, no scores and no ranking. Two things on this page are our own work: we installed our own bot, perpmath, into an empty folder and timed it, and we gave six made-up API key descriptions to the check it runs before trading. perpmath is in the table for one reason: it is ours. It cannot place a real order, and the table says so.

## What 3Commas charges, as of 22 November 2026

Three paid plans, billed monthly or annually. The figures below are from the [3Commas pricing page](https://3commas.io/pricing) (checked 22 November 2026), read with each billing toggle selected in turn. Prices carry a dollar sign; the page does not name the currency.

| Plan | Monthly billing | Annual billing, per month | Markets | DCA bots | Grid bots | Signal bots |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | $20 | $15 | Spot, 1 exchange | 5 | 2 | 2 |
| Pro | $50 | $38 | Spot and futures | 20 | 10 | 20 |
| Expert | $140 | $105 | Spot and futures | 1,000 | 1,000 | 1,000 |

The bot counts are active bots. Every plan includes a demo account, webhook execution and access to nine exchanges, which the pricing page does not name. Its feature table lists backtesting under both the DCA bot and the grid bot, TradingView automation under the signal bot, and a read-and-write developer API on the Expert card.

<!-- unique:original-calc -->
Two sums the page leaves to you. Paid annually, the plans come to $180, $456 and $1,260 a year, against $240, $600 and $1,680 at the monthly rate. And since Starter is spot only, the cheapest way to run a 3Commas bot on perpetual futures is Pro: $50 for a single month, or $456 for a year paid up front.

No free plan is listed. Each plan has a trial button, and the page's FAQ mentions a trial period without saying how long it lasts. I could not find the length on the pricing page.

## What do the free, open source trading bots offer?

Four well-known projects publish their code under an open licence and let you run it on your own machine. The table is built from each project's own repository and documentation, read on 22 November 2026; the licence column is the licence field GitHub's API returned for each repository that day. "Not found" means the pages I read did not say. It does not mean the feature is missing.

| Project | Licence | Bybit perpetuals | Backtesting | Practice mode | Interface | Real orders |
| --- | --- | --- | --- | --- | --- | --- |
| Freqtrade | GPL-3.0 | Listed, isolated margin | Yes | Dry-run | Web UI, Telegram | Yes |
| Hummingbot | Apache-2.0 | Connector listed | For controllers | Paper trade, testnet | Terminal | Yes |
| Jesse | MIT | Listed | Yes | Paper, with licence | Dashboard | With licence |
| OctoBot | GPL-3.0 | Listed, see note | Yes | Paper trading | Web, mobile | Yes |
| perpmath (ours) | MIT | Testnet only | Yes | Dry run, testnet | Command line | No |

**Freqtrade.** Its [documentation](https://www.freqtrade.io/en/stable/) lists seven futures exchanges, Bybit among them, and describes backtesting, a dry-run mode, parameter optimisation, a web UI and Telegram control. Strategies are Python with pandas. The [exchange notes](https://www.freqtrade.io/en/stable/exchanges/) say Bybit futures run in isolated margin, that the bot sets one-way position mode on startup, and that Bybit's demo trading mode cannot be combined with dry-run. I found no paid tier on the pages I read.

**Hummingbot.** The [repository](https://github.com/hummingbot/hummingbot) describes a Python framework aimed at market making, with a terminal client. Its [Bybit page](https://hummingbot.org/exchanges/bybit/) lists a spot and a perpetual connector, says the perpetual one supports the testnet, and offers a paper-trade version of the spot connector. Backtesting is mentioned for one kind of strategy, the "controllers"; the home page does not mention it at all.

**Jesse.** The framework is MIT-licensed and its [exchange list](https://docs.jesse.trade/docs/supported-exchanges) includes Bybit USDT perpetuals for backtesting and for live trading. Backtesting is free. Live trading is a separate, pre-built plugin that the [docs](https://docs.jesse.trade/docs/livetrade) limit to holders of a licence, and the [pricing page](https://jesse.trade/pricing) puts lifetime licences at $899, $999 and $1,599. On its free plan that page lists live trading on testnet exchanges only and paper trading as "No".

**OctoBot.** The [README](https://github.com/Drakkar-Software/OctoBot) presents a bot with a visual interface and ready-made grid, DCA and TradingView modes, a backtesting engine and paper trading. It lists Bybit spot and futures, followed by a note that the Bybit API "will soon be available again". Whether Bybit works in OctoBot today: not found. It points to a hosted version on its cloud site; prices are not in the README, and that site refused our automated request.

<!-- unique:cross-reference -->
Put the Jesse row next to ours. Jesse's free plan stops at testnet exchanges, for commercial reasons: live trading is the product. perpmath stops at the testnet too, for a different reason: nobody has yet run its order code against a real account, and it refuses mainnet until a position guard exists. From the outside the two limits look the same. If "free" has to include real orders, the table leaves Freqtrade, Hummingbot and OctoBot, by their own description.

<!-- unique:cross-reference -->
Free software still gets paid somehow, and the READMEs show how. Hummingbot's lists exchange sign-up links that carry fee discounts, and its [exchanges page](https://hummingbot.org/exchanges/) offers exchanges a partnership starting at $50,000. OctoBot's Bybit link is an invite link. Ours is no different in kind: perpmath has a `broker_id` setting for Bybit's broker programme, empty by default, and this site earns from Bybit links as described on the [disclosure page](/disclosure/). None of that makes a bot bad. It is worth knowing whose fees fund the code you run.

## Who holds the API key: their server or your computer?

With a cloud bot the key and its secret are stored by the company; with a self-hosted bot they stay on a machine you control. That is the part of the comparison that outlasts any price list.

Bybit's own guide to [creating an API key](https://www.bybit.com/en/learn/bybit-guide/how-to-create-a-bybit-api-key) (published 14 June 2023, checked 22 November 2026) walks through the 3Commas case. You create a key, choose the third-party application option, pick 3Commas from a list, set permissions such as order placement and position information, then paste the key and the secret into 3Commas. Bybit's API marks such keys: the [key information endpoint](https://bybit-exchange.github.io/docs/v5/user/apikey-info) (checked 22 November 2026) returns `type` 2 for a key connected to a third-party app and 1 for a personal one.

On its [security page](https://3commas.io/security) (checked 22 November 2026) 3Commas says the keys are kept in a storage system it calls the Sign Center, which signs each trade request on its servers, that its system has no ability to withdraw or transfer, and that you can restrict a key to official 3Commas IP addresses. I have no way to audit any of that, and no reason to doubt it. The point is narrower: the secret leaves your hands, and you rely on the company's storage from then on.

The same Bybit endpoint lists what a key can do. `ContractTrade` holds `Order` and `Position`, and `Wallet` holds `AccountTransfer` and `Withdraw`, among others. A key with only the first group cannot move money off the exchange. It can still place any order the account allows, so whoever holds it can lose your balance by trading it. That is true on a company's server and on your laptop alike.

| | Cloud bot | Self-hosted bot |
| --- | --- | --- |
| Where the secret is stored | The provider's servers | Your machine or server |
| Who must keep it safe | The provider | You |
| IP binding | To the provider's addresses | To your own address |
| If the service shuts down | Delete the key on the exchange | Nothing changes |
| Bot runs while your PC is off | Yes | Only on a server |

Bybit adds a deadline for careless keys. Its [API FAQ](https://bybit-exchange.github.io/docs/faq) (checked 22 November 2026) says a key created without binding an IP address expires after 90 days. Freqtrade's Bybit notes ask for read-write access with contract orders and positions, and recommend limiting every key to your own IP.

<!-- unique:firsthand-data -->
Self-hosting moves the duty to you, so we looked at what our own bot does with it. Before perpmath places an order it asks Bybit what the key may do and refuses some keys outright. We handed that function six key descriptions written by hand in the shape Bybit documents, with no real key involved:

<!-- unique:firsthand-data -->
```text
trade only, bound to an IP             ACCEPTED
trade only, no IP bound                ACCEPTED  warning: key is not bound to an IP address; Bybit recommends binding one
trade plus withdrawal                  REFUSED   this API key can withdraw or transfer funds (Wallet:AccountTransfer, Wallet:Withdraw). Refusing to start: create a testnet key with trade permission only, no withdrawal or transfer.
trade plus transfer between accounts   REFUSED   this API key can withdraw or transfer funds (Wallet:AccountTransfer). Refusing to start: create a testnet key with trade permission only, no withdrawal or transfer.
read-only                              REFUSED   this API key is read-only and cannot place orders; create a testnet key with Contract trade (Order + Position) permission
spot trading only                      REFUSED   this API key has no ContractTrade 'Order' permission, so it cannot trade USDT perpetuals; enable Contract -> Orders and Positions on the testnet key
```

<!-- unique:field-note -->
Four of six refused, on 21 November 2026 (UTC), version 0.2.2. Read that for what it is: the output of [one function](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.2/src/perpmath/live/executor.py#L276-L311) given input we typed. It has never seen the answer Bybit gives for a real key. The signing and permission rules it depends on are walked through in [Bybit API with Python](/learn/bybit-api-python/).

## From an empty folder to a dry run in 24 seconds

Installing perpmath took 22 seconds, and the first dry run finished 2 seconds after that. We ran the README's steps in an empty folder on a Windows desktop with Python 3.12.10 already installed, and kept the transcript. Lines starting with `$` are the commands; some output is trimmed here and all of it is in the site's repository under `research/3commas-alternative/`.

<!-- unique:firsthand-data -->
```text
start 2026-11-21T19:46:14Z
$ git clone https://github.com/sentinelbotsaas-hub/perpmath.git
$ python -m venv .venv
$ pip install -e .
$ pip list
numpy==2.5.5
perpmath==0.2.2
installed 2026-11-21T19:46:36Z
$ perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once
2026-11-21T19:46:38Z perpmath live ma_cross BTCUSDT 15m | DRY RUN (no signed requests, no orders) | state .perpmath-live\ma_cross-BTCUSDT-15m-a690e4-dryrun.json
2026-11-21T19:46:38Z limits: order 100 USDT, max position 200 USDT, max daily loss 20 USDT, max 5 consecutive API errors, max clock skew 5000 ms
2026-11-21T19:46:38Z clock offset to Bybit: 1014 ms (request timestamps and bar timing use Bybit's clock)
2026-11-21T19:46:38Z bar 2026-11-21T19:30:00Z close 59188.9: no entry
end 2026-11-21T19:46:39Z
```

<!-- unique:firsthand-data -->
One dependency, NumPy. No account, no key, no database. The dry run read public testnet candles, ran the moving-average strategy on the bar that closed at 19:45 UTC and decided to do nothing. Then we tried to make it do more than it should:

<!-- unique:firsthand-data -->
```text
$ perpmath live ma_cross ... --config configs/live/ma_cross.json   (no --dry-run, no key in the environment)
error: set BYBIT_TESTNET_API_KEY and BYBIT_TESTNET_API_SECRET (testnet keys, trade permission only), or use --dry-run, which needs no key
exit=1
$ perpmath live ma_cross ... --dry-run --once --mainnet
error: perpmath 0.2 only connects to the Bybit testnet. Live (mainnet) trading is planned for 0.3 and will not be enabled before the position guard exists.
exit=1
```

A config file with `"network": "mainnet"` got the same answer. So here is the row we cannot dress up. perpmath connects to the Bybit testnet and nowhere else. It has no graphical interface. It ships six example strategies, all of which lose money in their [published backtests](/backtests/), and anything else you write yourself in Python. Its order code has been tested against a fake exchange built from Bybit's documentation and has not placed an order with a real testnet key, let alone a real account. What it has that the table's other rows do not is this site's worked numbers: the [bot page](/bot/) and [how to build a trading bot in Python](/learn/build-a-trading-bot-python/) go through the same code line by line.

## Which one fits? Four questions, no ranking

Start from what you need the bot to do next month, not from the price.

**Do you need real orders now?** Then perpmath is out, and so is Jesse without a licence. Freqtrade, Hummingbot and OctoBot each say they trade live, and 3Commas does it for a monthly fee. For Bybit in particular, check OctoBot's note first.

**Will you write Python?** Freqtrade, Jesse, Hummingbot and perpmath expect it. 3Commas and OctoBot's built-in modes are configured, not coded. A grid or a DCA preset is one form to fill in there. Here it is a simulation you have to read: we backtested [a grid bot](/learn/grid-trading-bot/) with the engine and [a DCA bot](/learn/dca-bot/) in a script, and neither result is an advertisement for the idea.

**Can you keep a machine running and patched?** A self-hosted bot stops when the computer sleeps, and the key on it is yours to guard. If that sounds like a chore you would skip, a hosted service is the honest choice.

**Have you tested the strategy at all?** A free bot runs a losing strategy for free. Whichever tool you pick, [backtest it](/learn/how-to-backtest-a-trading-strategy/) with costs included, then watch it run without money: [paper trading](/learn/paper-trading-crypto/) and the [Bybit testnet](/learn/bybit-testnet/) each catch different mistakes. Size the first real position with the [position size calculator](/tools/position-size-calculator/) before any bot does it for you.

## FAQ

### Is there a free version of 3Commas?

The pricing page listed none on 22 November 2026. It shows three paid plans from $20 a month, a trial of unstated length, and a demo account included in every plan.

### Is an open source trading bot safer than 3Commas?

Not by default. Open source means you can read the code and keep the API key on your own machine. It also means the machine, its updates and the key's permissions are your job. A trade-only key bound to your IP limits the damage in both setups.

### Are free trading bots really free?

The code is. Jesse charges $899 or more for live trading, a server costs money, and every order still pays the exchange's fees. The largest cost is usually the strategy: all six of ours lose in backtests.

### Can perpmath replace 3Commas?

No. It places orders on the Bybit testnet only, has no interface beyond the command line, and offers no ready-made DCA or grid bot to switch on. Treat it as a way to learn how a bot's accounting and order handling work before you trust any bot, paid or free, with an account.
