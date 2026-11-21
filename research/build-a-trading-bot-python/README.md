# research/build-a-trading-bot-python

Scripts, inputs and raw outputs behind `en/build-a-trading-bot-python`.
Nothing here needs an API key. The network requests go to public endpoints of
the Bybit **testnet** (`https://api-testnet.bybit.com`): server time,
instruments-info and kline. No request is signed and no order is sent.

All runs were made on 2026-11-21 (UTC), which was 2026-11-22 in Taipei.

| Figure in the article | Script or command | Output |
| --- | --- | --- |
| Line counts by purpose, v0.2.0 | `loc_count.py` on a clean checkout of tag `v0.2.0` | `loc_count_v0.2.0.json`, `loc_count_v0.2.0_output.txt` |
| Line counts after 0.2.1 | `loc_count.py` on a clean checkout of tag `v0.2.1` | `loc_count_v0.2.1.json`, `loc_count_v0.2.1_output.txt` |
| The strategy module | `breakout.py` (51 lines, 25 of code) | |
| Backtest table | `perpmath backtest breakout ...` | `backtest_output.txt`, `breakout-btcusdt.json` |
| Dry-run log, one bar | `perpmath live breakout ... --dry-run --once` | `dryrun_once_output.txt`, `dryrun_state_after_once.json` |
| Dry-run log, several bars | `perpmath live breakout ... --dry-run` | `dryrun_loop_output.txt` |
| Order body, signal count, order IDs | `order_demo.py` | `order_demo.json`, `order_demo_output.txt`, `testnet_bars_15m.csv` |
| Testnet volume, 7.69% move | `testnet_bar_stats.py` | `testnet_bar_stats.json` |
| Test counts | `pytest` in the clone | `pytest_output.txt` |

## Line counts

```bash
git clone --branch v0.2.0 https://github.com/sentinelbotsaas-hub/perpmath.git ../perpmath-v020
git clone --branch v0.2.1 https://github.com/sentinelbotsaas-hub/perpmath.git ../perpmath-v021
python research/build-a-trading-bot-python/loc_count.py ../perpmath-v020
python research/build-a-trading-bot-python/loc_count.py ../perpmath-v021
```

The script reads every tracked `.py` file under `src/` and `tests/`, puts each
in one group, and stops if a file has no group or the checkout is not clean.
`code` = physical lines minus blank lines, comment-only lines and docstring
lines (`ast` for docstrings, `tokenize` for comments). Standard library only.

## The breakout strategy, its backtest and the dry run

The engine was not modified. The runs were made in a separate clone of tag
`v0.2.0` (commit `85ee44e`) with two changes:

1. `breakout.py` copied to `src/perpmath/strategies/breakout.py`;
2. `register_strategy.diff` applied to `src/perpmath/strategies/__init__.py`.

`breakout.config.json` went to `configs/breakout.json` and
`breakout.live.config.json` to `configs/live/breakout.json`. The candle file
was the one behind the engine's shipped results (`BTCUSDT-15m.csv`, 35,040
bars, SHA-256 `ac4acc429d7f33dd10e480195bce85f5639714b5d46869499b4275666f9fa037`;
re-create it with the `perpmath download` line below).

```bash
perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
perpmath backtest breakout --symbol BTCUSDT --interval 15m --config configs/breakout.json --out results/breakout-btcusdt.json
perpmath live breakout --symbol BTCUSDT --interval 15m --config configs/live/breakout.json --dry-run --once
perpmath live breakout --symbol BTCUSDT --interval 15m --config configs/live/breakout.json --dry-run
pytest -q
```

The parameters in `breakout.py` were written down before the first run and
not changed. The backtest was run once. No other parameter set was tried.

`order_demo.py CLONE` imports the clone's `perpmath`, downloads the last 1,000
closed 15-minute testnet bars, counts the strategy's signals and builds the
order for the most recent one with the runner's own `SignalPlanner`. It
overwrites `testnet_bars_15m.csv`, so run it again only if you want new bars;
`testnet_bar_stats.py` then recomputes from the saved CSV without the network.

## What these files do not show

- No signed request was made. The signed endpoints of `perpmath live` have
  only been tested against the fake exchange in the engine's `tests/`.
- The dry-run log covers the bars that closed while it was running. A dry run
  prints an order body only on a bar with a signal.
- The order body in `order_demo.json` is built by the planner from public
  data. It was never sent.
