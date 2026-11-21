# research/max-drawdown

The script and raw output behind `en/max-drawdown`. No network, no API key.

| Figure in the article | Script | Output |
| --- | --- | --- |
| Max drawdown on closed trades, daily points, bar closes and inside the bar, six strategies | `drawdown_measures.py` | `drawdown_measures.json`, `drawdown_measures_output.txt` |
| Grid: realised only, daily, published, range across intrabar paths | same | same |
| Time under water | same | same (`underwater_daily`, `underwater_bar_close`) |
| Max drawdown by sample length, 30-day windows | same | same |
| Return over max drawdown for the two grid samples | same | same (`return_over_max_drawdown`) |

## Run it

```bash
git clone --branch v0.2.1 https://github.com/sentinelbotsaas-hub/perpmath.git ../perpmath-engine
cd ../perpmath-engine
python -m venv .venv
.venv/Scripts/python -m pip install -e .        # Linux and macOS: .venv/bin/python
.venv/Scripts/python -m perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z
cd ../perpmath
python research/max-drawdown/drawdown_measures.py ../perpmath-engine
```

The script itself needs only the Python standard library. It reads the
engine's `results/*.json` and `data/BTCUSDT-15m.csv` and writes to this folder
alone. The saved output was produced on 2026-11-21 (UTC) from the result
files of tag `v0.2.1`; the four files that already existed in `v0.2.0` are
unchanged between the two tags.

## Checks built into the script

- The candle file's SHA-256 must equal the one recorded in every result file.
- The bar-by-bar equity is rebuilt from each result file's trade list and the
  candle file. Its max drawdown must equal the engine's published
  `max_drawdown_pct` to within 0.01 percentage points and its last value must
  equal `final_equity`, or the script stops. Both held for all twelve samples.

## How each figure is defined

- `closed_trades`: equity after each closed trade (starting capital plus the
  running sum of `pnl`).
- `daily`: the `equity_curve` array of the result file.
- `bar_close`: equity at every 15-minute close, open position marked at the
  close. This is what the engine publishes.
- `intrabar`: peaks at bar closes, troughs at the worst price reached in each
  bar while a position was open (low for a long, high for a short). No fee or
  slippage on the mark.
- `intrabar_outer`: peaks also taken inside the bar. The order of high and low
  inside a bar is unknown, so this is an outer bound.
- Grid `realised_until_final_close`: starting capital plus realised `pnl`
  minus `fee`, fill by fill, up to but not including the end-of-sample close.
  Funding is not itemised per fill and is left out of this series.

## What cannot be computed from the files

An intrabar drawdown for the grid: the grid result lists fills, not the
position held at each bar. The file's `comparisons` block gives the bar-close
max drawdown under four intrabar path assumptions, and that range is reported.
