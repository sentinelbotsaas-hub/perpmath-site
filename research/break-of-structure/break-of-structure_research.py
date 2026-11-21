import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/break-of-structure: swing-size sensitivity, every break counted, stop distances.

Uses the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.1) and its cached candle file, the one behind the published
result `results/break-of-structure-btcusdt.json`. The engine folder is only
read.

Three parts.

1. Engine runs. The list below was written down before the first run and
   nothing was added or removed after seeing results. The swing size is the
   one number the definition hangs on, and the module's own docstring names
   1 and 2 bars each side as common alternatives to its 5. Every row is
   reported; no row is offered as "the setting to use".

       BTCUSDT 15m   swing_left = swing_right = 1, 2, 3, 5 (published), 10     5 runs

   Each setting is run twice: with the published costs (fee 0.055% per side,
   slippage 0.02% per fill) and with both set to zero. Out-of-sample starts on
   2026-07-31 in every run. The published-cost run of the published settings
   must reproduce the shipped result's metric blocks exactly, or the script
   stops.

2. Every break on the published settings, traded or not. The strategy holds
   one position at a time, so most breaks never become trades. For each break
   the script records whether it points the same way as the break before it
   (what the usual teaching calls a break of structure, BOS) or the other way
   (a change of character, CHoCH), how far price had moved 4, 20 and 96 bars
   later, measured from the next bar's open, and whether a later bar closed
   back on the old side of the broken level. These are counts on the bars.
   They ignore costs and are not trades.

3. The published trades: long and short separately, entry-to-stop distance,
   holding time, and the out-of-sample block split by stop distance to show
   why its average R and its total return point in different directions.

Usage (from the site's root folder, engine checked out next to it). The
script imports the engine, so run it with the engine's Python:

    ../perpmath-engine/.venv/Scripts/python research/break-of-structure/break-of-structure_research.py [path-to-engine]
    ... --offline      do not run the engine, rebuild the summary from runs/

Output: research/break-of-structure/break-of-structure_summary.json. The
full engine outputs with every trade (runs/) are not committed; the summary
records the candle file's SHA-256, each config and each command.
"""
import hashlib
import json
import os
import statistics
import subprocess
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
RUNS = HERE / "runs"
OUT = HERE / "break-of-structure_summary.json"
SLUG = "break-of-structure"
STRATEGY = "break_of_structure"

OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
ROUND_TRIP_PCT = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
BASE = {"swing_left": 5, "swing_right": 5, "atr_period": 14, "stop_buffer_atr": 0.1, "r_multiple": 2.0}
SWINGS = (1, 2, 3, 5, 10)
HORIZONS = (4, 20, 96)


def plan():
    return [("published" if k == 5 else "swing", {**BASE, "swing_left": k, "swing_right": k}) for k in SWINGS]


def run_name(params):
    return f"btcusdt-15m-swing{params['swing_left']}"


def engine_python(engine):
    for candidate in (engine / ".venv" / "Scripts" / "python.exe", engine / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def call(command, engine):
    done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                          env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if done.returncode != 0:
        print(done.stdout.strip())
        print(done.stderr.strip())
        raise SystemExit(f"engine exited with {done.returncode}: {' '.join(command)}")
    return done.stdout


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


METRIC_KEYS = ("trades", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
               "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "final_equity", "avg_bars_held", "exit_reasons", "insufficient_sample")


def block(document, label):
    part = document[label]
    stops = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in part["trades"]]
    return {
        "first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
        "metrics": {key: part["metrics"][key] for key in METRIC_KEYS},
        "signals": part["signals"],
        "entry_to_stop_pct_of_price_median": round(statistics.median(stops), 4) if stops else None,
    }


def run_all(engine, offline, shipped):
    RUNS.mkdir(exist_ok=True)
    python = engine_python(engine)
    data_sha = sha256(engine / "data" / "BTCUSDT-15m.csv")
    if data_sha != shipped["data"]["file_sha256"]:
        raise SystemExit("the engine's candle file is not the one behind the published result")
    out = []
    for group, params in plan():
        name = run_name(params)
        entry = {"name": name, "group": group, "symbol": "BTCUSDT", "interval": "15m", "params": params,
                 "data_file": "BTCUSDT-15m.csv", "data_sha256": data_sha}
        for label, costs in (("published_costs", PUBLISHED_COSTS), ("zero_cost", ZERO_COSTS)):
            config = {
                "strategy": STRATEGY,
                "params": params,
                "execution": {**costs, "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
                "split": {"oos_start": OOS_START},
            }
            config_path = RUNS / f"{name}.{label}.config.json"
            result_path = RUNS / f"{name}.{label}.json"
            if not offline:
                config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
                call([python, "-m", "perpmath", "backtest", STRATEGY, "--symbol", "BTCUSDT",
                      "--interval", "15m", "--config", str(config_path), "--out", str(result_path),
                      "--data-dir", str(engine / "data")], engine)
            document = load(result_path)
            if document["data"]["file_sha256"] != data_sha:
                raise SystemExit(f"{name}: result was computed on a different candle file")
            if document["config"]["params"] != params or document["split"]["oos_start"] != OOS_START + "T00:00:00Z":
                raise SystemExit(f"{name}: result does not match the planned settings")
            if not document["timing"]["lookahead_check"]["passed"]:
                raise SystemExit(f"{name}: look-ahead check did not pass")
            entry.setdefault("engine_version", document["package_version"])
            entry[label] = {
                "config": config,
                "command": (f"python -m perpmath backtest {STRATEGY} --symbol BTCUSDT --interval 15m "
                            f"--config research/{SLUG}/runs/{name}.{label}.config.json "
                            f"--out research/{SLUG}/runs/{name}.{label}.json --data-dir <engine>/data"),
                "generated_at": document["generated_at"],
                "in_sample": block(document, "in_sample"),
                "out_of_sample": block(document, "out_of_sample"),
            }
            if group == "published" and label == "published_costs":
                for part in ("in_sample", "out_of_sample"):
                    if document[part]["metrics"] != shipped[part]["metrics"]:
                        raise SystemExit(f"rerun of the published settings differs from the shipped result ({part})")
                entry["reproduces_shipped_result"] = True
        out.append(entry)
        for label in ("published_costs", "zero_cost"):
            m_in, m_out = entry[label]["in_sample"]["metrics"], entry[label]["out_of_sample"]["metrics"]
            print(f"{name:20} {label:15} in {m_in['trades']:>4} trades {m_in['total_return_pct']:>8.2f}% "
                  f"t {m_in['t_stat']:>6.2f} R {m_in['avg_r']:>6.2f}   out {m_out['trades']:>4} trades "
                  f"{m_out['total_return_pct']:>8.2f}% t {m_out['t_stat']:>6.2f} R {m_out['avg_r']:>6.2f}")
    return out


# --------------------------------------------------------------------------- #
# Every break on the published settings
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def break_stats(engine, shipped):
    sys.path.insert(0, str(engine / "src"))
    import math
    import numpy as np
    from perpmath.data import load_bars
    from perpmath.indicators import atr, confirmed_swing_high, confirmed_swing_low
    from perpmath.strategies import break_of_structure

    bars = load_bars(engine / "data" / "BTCUSDT-15m.csv")
    n = len(bars)
    open_, high, low, close, ts = bars.open, bars.high, bars.low, bars.close, bars.ts
    params = dict(BASE)
    signals = break_of_structure.generate(bars, params)

    # Rules 1 to 7 again, keeping every break and not only the ones with a valid stop.
    new_high = confirmed_swing_high(high, params["swing_left"], params["swing_right"])
    new_low = confirmed_swing_low(low, params["swing_left"], params["swing_right"])
    atr_values = atr(high, low, close, params["atr_period"])
    swing_high = swing_low = math.nan
    high_open = low_open = False
    breaks = []          # (bar, direction, level, has_signal)
    for i in range(n):
        if math.isfinite(new_high[i]):
            swing_high, high_open = float(new_high[i]), True
        if math.isfinite(new_low[i]):
            swing_low, low_open = float(new_low[i]), True
        broke_up = high_open and close[i] > swing_high
        broke_down = low_open and close[i] < swing_low
        if broke_up:
            high_open = False
        if broke_down:
            low_open = False
        if broke_up and broke_down:
            raise SystemExit("one bar broke both levels; the module says that cannot happen")
        if broke_up:
            breaks.append((i, 1, swing_high, bool(signals.side[i] == 1)))
        elif broke_down:
            breaks.append((i, -1, swing_low, bool(signals.side[i] == -1)))
    with_signal = [b for b in breaks if b[3]]
    if {b[0] for b in with_signal} != set(np.flatnonzero(signals.side != 0).tolist()):
        raise SystemExit("the replayed breaks differ from the engine's signal bars")
    seen = shipped["in_sample"]["signals"]["seen"] + shipped["out_of_sample"]["signals"]["seen"]
    skipped = (shipped["in_sample"]["signals"]["skipped_in_position"]
               + shipped["out_of_sample"]["signals"]["skipped_in_position"])

    swings = {"swing_highs_confirmed": int(np.isfinite(new_high).sum()),
              "swing_lows_confirmed": int(np.isfinite(new_low).sum())}

    # Label each break by the break before it: same direction = continuation
    # (BOS in the usual teaching), opposite direction = reversal (CHoCH).
    labelled = []
    previous = 0
    for i, direction, level, has_signal in breaks:
        kind = "first" if previous == 0 else "same_direction_as_previous_break" if direction == previous \
            else "opposite_to_previous_break"
        labelled.append((i, direction, level, has_signal, kind))
        previous = direction

    def forward(rows):
        """Move in the break's direction h bars later, from the next bar's open, and failed breaks."""
        out = {"breaks": len(rows)}
        for h in HORIZONS:
            moves, closed_back = [], 0
            usable = [r for r in rows if r[0] + h < n]
            for i, direction, level, _, _ in usable:
                entry = open_[i + 1]
                moves.append(direction * (close[i + h] - entry) / entry * 100)
                window = close[i + 1:i + 1 + h]
                closed_back += bool((window < level).any()) if direction == 1 else bool((window > level).any())
            out[f"after_{h}_bars"] = {
                "breaks_with_data": len(usable),
                "mean_move_pct": round(statistics.fmean(moves), 4) if moves else None,
                "median_move_pct": round(statistics.median(moves), 4) if moves else None,
                "moved_further_pct": pct(sum(m > 0 for m in moves), len(moves)),
                "closed_back_through_level": closed_back,
                "closed_back_through_level_pct": pct(closed_back, len(usable)),
            }
        return out

    def baseline(direction):
        """The same measurement taken from every bar, break or not: the year's drift."""
        out = {}
        for h in HORIZONS:
            entry = open_[1:n - h + 1]
            later = close[h:n]
            moves = direction * (later[:len(entry)] - entry) / entry * 100
            out[f"after_{h}_bars"] = {"bars": int(len(moves)), "mean_move_pct": round(float(moves.mean()), 4),
                                      "moved_further_pct": pct(int((moves > 0).sum()), len(moves))}
        return out

    groups = {
        "all_breaks": labelled,
        "up_breaks": [r for r in labelled if r[1] == 1],
        "down_breaks": [r for r in labelled if r[1] == -1],
        "same_direction_as_previous_break": [r for r in labelled if r[4] == "same_direction_as_previous_break"],
        "opposite_to_previous_break": [r for r in labelled if r[4] == "opposite_to_previous_break"],
    }
    every_break = {name: forward(rows) for name, rows in groups.items()}
    every_break["baseline_every_bar_up"] = baseline(1)
    every_break["baseline_every_bar_down"] = baseline(-1)

    # ---- The published trades.
    step = int(ts[1] - ts[0])

    def side_stats(trades):
        if not trades:
            return {"trades": 0}
        wins = sum(t["pnl"] > 0 for t in trades)
        return {
            "trades": len(trades), "wins": wins, "win_rate_pct": pct(wins, len(trades)),
            "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
            "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in trades), 4),
            "sum_of_trade_returns_pct": round(sum(t["return_pct"] for t in trades), 4),
        }

    def stop_distance(trade):
        return abs(trade["entry_price"] - trade["stop_price"]) / trade["entry_price"] * 100

    trades = {}
    for label in ("in_sample", "out_of_sample"):
        rows = shipped[label]["trades"]
        distances = sorted(stop_distance(t) for t in rows)
        middle = statistics.median(distances)
        near = [t for t in rows if stop_distance(t) <= middle]
        far = [t for t in rows if stop_distance(t) > middle]
        trades[label] = {
            "long": side_stats([t for t in rows if t["side"] == "long"]),
            "short": side_stats([t for t in rows if t["side"] == "short"]),
            "entry_to_stop_pct_of_price": {
                "min": round(distances[0], 4), "median": round(middle, 4), "max": round(distances[-1], 4),
                "p10": round(distances[int(0.1 * (len(distances) - 1))], 4),
                "p90": round(distances[int(0.9 * (len(distances) - 1))], 4),
            },
            "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / middle, 4),
            "trades_with_stop_closer_than_round_trip_cost": sum(d < ROUND_TRIP_PCT for d in distances),
            "avg_hours_held": round(shipped[label]["metrics"]["avg_bars_held"] * step / 3_600_000, 2),
            "funding_settlements_per_average_trade_at_8h": round(
                shipped[label]["metrics"]["avg_bars_held"] * step / 3_600_000 / 8, 2),
            "split_by_stop_distance": {
                "stop_at_or_under_median": side_stats(near),
                "stop_over_median": side_stats(far),
            },
        }

    return {
        "symbol": "BTCUSDT", "interval": "15m", "params": params, "bars": n,
        "round_trip_cost_pct": round(ROUND_TRIP_PCT, 4),
        "breakeven_win_rate_pct_before_costs": round(100 / (1 + params["r_multiple"]), 2),
        "swings": swings,
        "breaks": {
            "total": len(breaks),
            "up": sum(b[1] == 1 for b in breaks), "down": sum(b[1] == -1 for b in breaks),
            "with_a_valid_stop_signal": len(with_signal),
            "without_signal": len(breaks) - len(with_signal),
            "signals_in_shipped_result": seen,
            "signals_ignored_while_in_a_position": skipped,
            "signals_ignored_pct": pct(skipped, seen),
            "same_direction_as_previous_break": len(groups["same_direction_as_previous_break"]),
            "opposite_to_previous_break": len(groups["opposite_to_previous_break"]),
            "breaks_per_day": round(len(breaks) / (n * step / 86_400_000), 2),
        },
        "every_break_forward": every_break,
        "forward_note": ("Moves are measured from the open of the bar after the break to the close h bars after "
                         "the break, in the break's direction, before costs. Windows overlap, so these are "
                         "descriptions of the chart, not independent trades, and no t-statistic is given."),
        "published_trades": trades,
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    shipped = load(engine / "results" / "break-of-structure-btcusdt.json")
    runs = run_all(engine, offline, shipped)
    stats = break_stats(engine, shipped)
    summary = {
        "article": "en/break-of-structure",
        "engine": {"package": "perpmath", "version": shipped["package_version"],
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "shipped_result": {"file": "results/break-of-structure-btcusdt.json",
                           "generated_at": shipped["generated_at"],
                           "data": shipped["data"], "split": shipped["split"], "costs": shipped["costs"],
                           "warnings": shipped["warnings"],
                           "in_sample": shipped["in_sample"]["metrics"],
                           "out_of_sample": shipped["out_of_sample"]["metrics"],
                           "signals": {"in_sample": shipped["in_sample"]["signals"],
                                       "out_of_sample": shipped["out_of_sample"]["signals"]}},
        "plan_note": ("The five swing sizes were fixed before the first run. This is a sensitivity table, "
                      "not a search: every row is reported and none is a recommendation."),
        "runs": runs,
        "published_settings": stats,
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(json.dumps(stats["swings"], indent=1))
    print(json.dumps(stats["breaks"], indent=1))
    print(json.dumps(stats["every_break_forward"], indent=1))
    print(json.dumps(stats["published_trades"], indent=1))


if __name__ == "__main__":
    main()
