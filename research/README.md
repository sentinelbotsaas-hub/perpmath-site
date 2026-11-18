# research

Scripts and raw data behind the numbers in the articles. Every figure in an
article comes from a JSON file in this folder or from the engine's published
result file. Nothing here needs an API key: all requests go to Bybit's public
market-data endpoints under `https://api.bybit.com/v5/market/`.

Python 3.10 or newer, standard library only (the two FVG scripts also need the
perpmath engine, see below). Run everything from the site's root folder.

| Article | Script | Output |
| --- | --- | --- |
| `zh-hant/what-is-liquidation` | `liquidation_btcusdt.py` | `liquidation_btcusdt.json` |
| `zh-hant/what-is-funding-rate` | `funding_btcusdt.py` | `funding_btcusdt.json` |
| `en/fair-value-gap` | `fvg_cost_rerun.py` | `fvg-btcusdt-zero-cost.json`, `fvg-btcusdt-fee-only.json`, `fvg_cost_summary.json` |
| `en/fair-value-gap` | `fvg_gap_stats.py` | `fvg_gap_stats.json` |

`bybit_public.py` holds the shared download helpers. `data/` holds the raw
downloads exactly as Bybit returned them, as CSV.

## Reproduce the saved numbers exactly

The date range is fixed in each script (UTC days 2025-11-18 to 2026-11-17), so
the result does not depend on the day you run it. `--offline` skips the
download and recomputes from the CSV files in `data/`:

```bash
python research/liquidation_btcusdt.py --offline
python research/funding_btcusdt.py --offline
```

## Download again from Bybit

Without `--offline` each script downloads the same range again, overwrites the
CSV files and recomputes. Closed candles and settled funding rates should not
change, but the risk-limit tiers and funding limits are whatever Bybit serves
on the day you run it, and a different maintenance margin rate changes every
count in the liquidation table.

```bash
python research/liquidation_btcusdt.py
python research/funding_btcusdt.py
```

Endpoints used:

- `kline` (last traded price), `interval=D` and `interval=60`
- `mark-price-kline`, `interval=D` and `interval=240`
- `risk-limit` (maintenance margin tiers)
- `funding/history`
- `instruments-info` (funding interval and funding rate limits)

The saved files were fetched on 2026-11-18 (UTC); the exact time is the
`fetched_at` field of each JSON file.

## The fair value gap reruns

These two scripts run the open-source engine,
<https://github.com/sentinelbotsaas-hub/perpmath> (version 0.1.0, commit
`2fdc9de`), on the same candle file as its published result
`results/fvg-btcusdt.json`. Check the engine out next to this site (or pass
its path as the first argument) and download the same candles:

```bash
git clone https://github.com/sentinelbotsaas-hub/perpmath.git ../perpmath-engine
cd ../perpmath-engine
python -m venv .venv
.venv/Scripts/python -m pip install -e .        # Linux and macOS: .venv/bin/python
.venv/Scripts/python -m perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
cd ../perpmath
```

Then:

```bash
python research/fvg_cost_rerun.py
../perpmath-engine/.venv/Scripts/python research/fvg_gap_stats.py
```

`fvg_cost_rerun.py` runs the strategy twice with the published parameters and
only the cost settings changed (`fvg-zero-cost.config.json`: fee 0, slippage
0; `fvg-fee-only.config.json`: fee 0.055% per side, slippage 0), refuses to
continue if the candle file hash, the parameters or the split date differ
from the published run, and writes the comparison to `fvg_cost_summary.json`.
The two engine commands it runs are recorded in that file under `commands`.

`fvg_gap_stats.py` counts what happened to each gap (entered, failed, expired)
with the same rules, and stops if its signal bars are not identical to the
ones the engine's own `fvg.generate` produces.

The engine folder is only read. Both scripts write to this folder alone.

## What the numbers do not cover

- Liquidation counts use the simplified distance `1 / leverage - MMR` with the
  tier-1 rate, ignore fees and funding, and only ask about the day of entry.
  The JSON also holds the same count on mark-price candles, with Bybit's exact
  formula, and with an entry at every hour.
- Funding cost is computed for a position worth 1,000 USDT at every
  settlement and, separately, for a fixed BTC quantity.
- The backtest covers one symbol, one timeframe, one year and one parameter
  set. Funding is not modelled by the engine.
