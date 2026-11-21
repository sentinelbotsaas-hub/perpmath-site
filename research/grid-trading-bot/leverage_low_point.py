import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/grid-trading-bot: how close did the leveraged runs come to liquidation?

The result files hold one equity point per day and the maximum drawdown, but
not the lowest bar-close equity itself. This script calls the engine's own
simulator (read only, nothing in the engine folder is changed) with the same
normalised configs that `perpmath grid` uses, and reports for each sample:

  - the lowest equity at any bar close, when it happened and the close price;
  - the net position at that moment and the maintenance margin it required
    (maintenance_margin_rate x |net quantity| x price, the engine's rule);
  - how much further price would have had to move against the position for
    equity to reach that maintenance margin, holding the position fixed.

The last figure is an approximation: it ignores further grid fills and
funding, and it uses bar closes, while the engine checks liquidation inside
bars as well. It is here to show distance, not to predict a liquidation price.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/grid-trading-bot/leverage_low_point.py [data-dir]

Output: research/grid-trading-bot/leverage_low_point.json
"""
import json
from pathlib import Path

import numpy as np

import perpmath
from perpmath.backtest import _split_time
from perpmath.data import cache_path, file_sha256, interval_ms, iso_utc, load_bars, parse_date_ms
from perpmath.funding import funding_cache_path, load_funding
from perpmath.grid import simulate_grid
from perpmath.grid_backtest import _grid_config, load_grid_config

HERE = Path(__file__).resolve().parent
RUNS = {
    "shipped": ("grid.config.json", None),
    "shipped-3x": ("grid-shipped-3x.config.json", None),
    "shipped-5x": ("grid-shipped-5x.config.json", None),
    "shipped-10x": ("grid-shipped-10x.config.json", None),
    "month-continue": ("grid-month-continue.config.json", None),
    "month-continue-3x": ("grid-month-continue-3x.config.json", None),
    "month-continue-5x": ("grid-month-continue-5x.config.json", None),
    "month-continue-10x": ("grid-month-continue-10x.config.json", None),
    "half-continue-3x": ("grid-half-continue-3x.config.json", "2026-07-31"),
}


def low_point(bars, config, funding, start, end, step):
    result = simulate_grid(bars, config, start, end, funding, step)
    i = int(np.argmin(result.equity))
    index = start + i
    net = 0.0
    for event in result.events:
        if event[0] > index or event[1] == "range_stop":
            continue
        net += event[6] if event[2] == "buy" else -event[6]
    close = float(bars.close[index])
    equity = float(result.equity[i])
    maintenance = config.maintenance_margin_rate * abs(net) * close
    # equity falls by |net| for every unit price moves against the position; the
    # maintenance margin moves with price too, so solve for the price directly
    side = 1.0 if net > 0 else -1.0
    liq_price = None
    if abs(net) > 0:
        # equity + net * (p - close) = mmr * |net| * p
        liq_price = (equity - net * close) / (config.maintenance_margin_rate * abs(net) - net)
    return {
        "lowest_bar_close_equity": round(equity, 2),
        "time_bar_open": iso_utc(int(bars.ts[index])),
        "close_price": close,
        "net_quantity": round(net, 6),
        "position_notional": round(abs(net) * close, 2),
        "maintenance_margin_required": round(maintenance, 2),
        "equity_above_maintenance": round(equity - maintenance, 2),
        "approx_price_where_equity_meets_maintenance": round(liq_price, 1) if liq_price else None,
        "approx_move_to_that_price_pct": round((liq_price / close - 1) * 100, 2) if liq_price else None,
        "direction_of_that_move": ("down" if side > 0 else "up") if liq_price else None,
        "liquidated_in_engine_run": bool(result.liquidated),
        "final_equity": round(float(result.equity[-1]), 2),
        "max_equity_bar_close": round(float(np.max(result.equity)), 2),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    data_dir = Path(args[0]).resolve() if args else engine_root / "data"
    path = cache_path(str(data_dir), "BTCUSDT", "15m")
    funding = load_funding(funding_cache_path(str(data_dir), "BTCUSDT"))
    step = interval_ms("15m")
    out = {"article": "en/grid-trading-bot", "engine_version": perpmath.__version__,
           "candle_file_sha256": file_sha256(path), "note": "lowest bar-close equity per sample and its distance from the engine's maintenance-margin "
                   "rule, position held fixed; an approximation, see the comment at the top of the script",
           "runs": {}}
    for name, (config_name, end_date) in RUNS.items():
        bars = load_bars(path, None, parse_date_ms(end_date) if end_date else None)
        config = load_grid_config(str(HERE / config_name))
        split_index = int(np.searchsorted(bars.ts, _split_time(bars, step, config["split"])))
        params, execution = config["params"], config["execution"]
        if params["bounds"] == "in_sample_range":
            lower, upper = float(np.min(bars.low[:split_index])), float(np.max(bars.high[:split_index]))
        else:
            lower, upper = float(params["bounds"]["lower"]), float(params["bounds"]["upper"])
        grid_config = _grid_config(params, execution, lower, upper)
        out["runs"][name] = {
            "lower": lower, "upper": upper, "leverage": params["leverage"],
            "in_sample": low_point(bars, grid_config, funding, 0, split_index, step),
            "out_of_sample": low_point(bars, grid_config, funding, split_index, len(bars), step),
        }
    with open(HERE / "leverage_low_point.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")
    for name, run in out["runs"].items():
        for label in ("in_sample", "out_of_sample"):
            r = run[label]
            print(f"{name:20} {label:14} low {r['lowest_bar_close_equity']:>9} at {r['time_bar_open']} close {r['close_price']} "
                  f"net {r['net_quantity']:>9} mm {r['maintenance_margin_required']:>7} "
                  f"gap {r['equity_above_maintenance']:>9} approx liq {r['approx_price_where_equity_meets_maintenance']} "
                  f"({r['approx_move_to_that_price_pct']}% {r['direction_of_that_move']}) final {r['final_equity']} "
                  f"peak {r['max_equity_bar_close']} liq={r['liquidated_in_engine_run']}")
    print(f"wrote {HERE / 'leverage_low_point.json'}")


if __name__ == "__main__":
    main()
