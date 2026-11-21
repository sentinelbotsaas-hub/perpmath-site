import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/order-block: block counts, fill geometry and a small sensitivity table.

Uses the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.1) and its cached candle file, the one behind the published
result `results/order-block-btcusdt.json`. The engine folder is only read.

Three parts.

1. Engine runs. The list below was written down before the first run and
   nothing was added or removed after seeing results. It is a sensitivity
   table for the two numbers that decide "how big a move counts": every row
   is reported, and no row is offered as "the setting to use".

       BTCUSDT 15m   published settings (impulse_bars 3, min_impulse_atr 2.0)    1 run
       BTCUSDT 15m   min_impulse_atr 1.0 and 3.0 (impulse_bars 3)                2 runs
       BTCUSDT 15m   impulse_bars 2 and 4 (min_impulse_atr 2.0)                  2 runs

   Each of the 5 settings is run twice: with the published costs (fee 0.055%
   per side, slippage 0.02% per fill) and with both set to zero. Out-of-sample
   starts on 2026-07-31 in every run, the date the published result uses. The
   published-cost run of the published settings must reproduce the metric
   blocks of the engine's shipped result file exactly, or the script stops.

2. Counts on the published settings, independent of the trade simulation:
   how many candles survive each condition of the definition (the funnel),
   and what happened to every block (entry signal, failed on the return bar,
   expired untouched).

3. The published trades: long and short separately, where the market-order
   fill landed relative to the zone, and the round-trip cost measured against
   each trade's stop distance.

Usage (from the site's root folder, engine checked out next to it). The
script imports the engine, so run it with the engine's Python:

    ../perpmath-engine/.venv/Scripts/python research/order-block/order-block_research.py [path-to-engine]
    ... --offline      do not run the engine, rebuild the summary from runs/

Output: research/order-block/order-block_summary.json. The full engine
outputs with every trade (runs/) are large and are not committed; the
summary records the candle file's SHA-256, each config and each command.
"""
import hashlib
import json
import os
import statistics
import subprocess
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
RUNS = HERE / "runs"
OUT = HERE / "order-block_summary.json"
SLUG = "order-block"
STRATEGY = "order_block"

OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
ROUND_TRIP_PCT = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
BASE = {"atr_period": 14, "swing_left": 5, "swing_right": 5, "impulse_bars": 3, "min_impulse_atr": 2.0,
        "max_wait_bars": 96, "stop_buffer_atr": 0.1, "r_multiple": 2.0}


def plan():
    """The fixed list of settings. Order is the order of the article's table."""
    return [
        ("published", dict(BASE)),
        ("min_impulse_atr", {**BASE, "min_impulse_atr": 1.0}),
        ("min_impulse_atr", {**BASE, "min_impulse_atr": 3.0}),
        ("impulse_bars", {**BASE, "impulse_bars": 2}),
        ("impulse_bars", {**BASE, "impulse_bars": 4}),
    ]


def run_name(params):
    return f"btcusdt-15m-ib{params['impulse_bars']}-mi{params['min_impulse_atr']:g}"


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
    return {
        "first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
        "metrics": {key: part["metrics"][key] for key in METRIC_KEYS},
        "signals": part["signals"],
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
        m_in = entry["published_costs"]["in_sample"]["metrics"]
        m_out = entry["published_costs"]["out_of_sample"]["metrics"]
        z_in = entry["zero_cost"]["in_sample"]["metrics"]
        z_out = entry["zero_cost"]["out_of_sample"]["metrics"]
        print(f"{name:26} in {m_in['trades']:>4} trades {m_in['total_return_pct']:>8.2f}% t {m_in['t_stat']:>6.2f}   "
              f"out {m_out['trades']:>4} trades {m_out['total_return_pct']:>8.2f}% t {m_out['t_stat']:>6.2f}   "
              f"zero cost {z_in['total_return_pct']:>7.2f}% / {z_out['total_return_pct']:>7.2f}%")
    return out


# --------------------------------------------------------------------------- #
# Counts on the published settings
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def median(values, digits=4):
    return round(statistics.median(values), digits) if values else None


def to_ms(text):
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)


def pattern_stats(engine, shipped):
    sys.path.insert(0, str(engine / "src"))
    import math
    import numpy as np
    from perpmath.data import load_bars
    from perpmath.indicators import atr, carry_forward, confirmed_swing_high, confirmed_swing_low
    from perpmath.strategies import order_block

    bars = load_bars(engine / "data" / "BTCUSDT-15m.csv")
    n = len(bars)
    open_, high, low, close, ts = bars.open, bars.high, bars.low, bars.close, bars.ts
    params = dict(BASE)
    signals = order_block.generate(bars, params)
    formed = order_block.find_order_blocks(bars, params)
    blocks = [b for b in formed if b is not None]

    # ---- The funnel: how many candles survive each condition of the definition.
    # The engine asks for all conditions on one and the same bar of the run, so
    # the stages below are nested and evaluated bar by bar; a candle counts for
    # a stage when some bar of its run (of at least impulse_bars bars) passes it.
    atr_values = atr(high, low, close, params["atr_period"])
    swing_high = carry_forward(confirmed_swing_high(high, params["swing_left"], params["swing_right"]))
    swing_low = carry_forward(confirmed_swing_low(low, params["swing_left"], params["swing_right"]))
    stages = ["run_of_3_same_direction_bars", "candle_before_it_closed_the_other_way",
              "run_covers_2_atr", "run_closes_beyond_the_candle", "run_closes_beyond_latest_swing"]
    reached = {name: set() for name in stages}
    direction, run = 0, 0
    for i in range(n):
        bar_direction = 1 if close[i] > open_[i] else -1 if close[i] < open_[i] else 0
        run = run + 1 if bar_direction == direction else 1
        direction = bar_direction
        candle = i - run
        if direction == 0 or run < params["impulse_bars"] or candle < 0:
            continue
        if not math.isfinite(atr_values[candle]):
            continue
        level = swing_high[i] if direction == 1 else swing_low[i]
        if not math.isfinite(level):
            continue
        reached[stages[0]].add(candle)
        if not direction * (close[candle] - open_[candle]) < 0:
            continue
        reached[stages[1]].add(candle)
        if not direction * (close[i] - open_[candle + 1]) >= params["min_impulse_atr"] * atr_values[candle]:
            continue
        reached[stages[2]].add(candle)
        if not (close[i] > high[candle] if direction == 1 else close[i] < low[candle]):
            continue
        reached[stages[3]].add(candle)
        if not direction * (close[candle] - level) <= 0 < direction * (close[i] - level):
            continue
        reached[stages[4]].add(candle)
    if reached[stages[4]] != {b.candle for b in blocks}:
        raise SystemExit("the funnel's last stage is not the engine's set of order blocks")
    funnel = [{"stage": name, "candles": len(reached[name])} for name in stages]
    for row in funnel:
        row["pct_of_first_stage"] = pct(row["candles"], funnel[0]["candles"])

    # ---- What happened to every block (rules 4 to 6), replayed block by block.
    max_wait = params["max_wait_bars"]
    fates = []
    for b in blocks:
        fate, at = "data_ended_first", None
        for i in range(b.formed + 1, n):
            if i - b.formed > max_wait:
                fate = "expired_untouched"
                break
            touched = low[i] <= b.top if b.direction == 1 else high[i] >= b.bottom
            if touched:
                held = close[i] >= b.bottom if b.direction == 1 else close[i] <= b.top
                fate, at = ("entry_signal" if held else "failed_on_return_bar"), i
                break
        fates.append((b, fate, at))
    signal_bars = {at for _, fate, at in fates if fate == "entry_signal"}
    if signal_bars != set(np.flatnonzero(signals.side != 0).tolist()):
        raise SystemExit("the replayed entry bars differ from the engine's signal bars")
    seen = shipped["in_sample"]["signals"]["seen"] + shipped["out_of_sample"]["signals"]["seen"]

    def census(subset):
        total = len(subset)
        counts = {}
        for _, fate, _ in subset:
            counts[fate] = counts.get(fate, 0) + 1
        returned = [(b, fate, at) for b, fate, at in subset if at is not None]
        waits = [at - b.formed for b, _, at in returned]
        return {
            "blocks": total,
            "entry_signal": counts.get("entry_signal", 0),
            "failed_on_return_bar": counts.get("failed_on_return_bar", 0),
            "expired_untouched": counts.get("expired_untouched", 0),
            "data_ended_first": counts.get("data_ended_first", 0),
            "returned_within_wait": len(returned),
            "returned_pct": pct(len(returned), total),
            "entry_signal_pct_of_blocks": pct(counts.get("entry_signal", 0), total),
            "failed_pct_of_returns": pct(counts.get("failed_on_return_bar", 0), len(returned)),
            "bars_until_return_median": median(waits, 1),
            "returned_on_the_next_bar": sum(w == 1 for w in waits),
            "returned_on_the_next_bar_pct_of_returns": pct(sum(w == 1 for w in waits), len(returned)),
            "returned_within_4_bars_pct_of_returns": pct(sum(w <= 4 for w in waits), len(returned)),
        }

    heights_pct = [(b.top - b.bottom) / close[b.candle] * 100 for b in blocks]
    heights_atr = [(b.top - b.bottom) / b.atr for b in blocks]
    blocks_census = {
        "all": census(fates),
        "bullish": census([f for f in fates if f[0].direction == 1]),
        "bearish": census([f for f in fates if f[0].direction == -1]),
        "zone_height_pct_of_price_median": median(heights_pct),
        "zone_height_in_atr_median": median(heights_atr),
        "bars_from_candle_to_block_existing_median": median([b.formed - b.candle for b in blocks], 1),
        "signal_bars": len(signal_bars),
        "signal_bars_in_shipped_result": seen,
        "note": ("signal bars can be fewer than blocks with an entry signal when two blocks trigger on one bar; "
                 "the shipped result counts signal bars inside each sample"),
    }

    # ---- The published trades: where did the market order fill, relative to the zone?
    step = int(ts[1] - ts[0])
    index_of = {int(t): i for i, t in enumerate(ts)}
    block_at = {}
    for b, fate, at in fates:      # oldest first, so the most recently formed block wins, as in the engine
        if fate == "entry_signal":
            block_at[at] = b

    def fill_stats(trades):
        where = {"beyond_near_edge": 0, "inside_zone": 0, "past_far_edge": 0}
        risk_ratio, stop_pct, cost_r = [], [], []
        tighter_than_cost = 0
        for trade in trades:
            i = index_of[to_ms(trade["entry_time"])] - 1      # the signal bar is the bar before the fill
            b = block_at[i]
            raw = float(open_[i + 1])                          # fill before slippage
            buffer = params["stop_buffer_atr"] * b.atr
            if b.direction == 1:
                stop, near = b.bottom - buffer, b.top
                key = "beyond_near_edge" if raw > b.top else "inside_zone" if raw >= b.bottom else "past_far_edge"
            else:
                stop, near = b.top + buffer, b.bottom
                key = "beyond_near_edge" if raw < b.bottom else "inside_zone" if raw <= b.top else "past_far_edge"
            if abs(stop - trade["stop_price"]) > 1e-3:
                raise SystemExit("a published trade's stop does not match its block")
            where[key] += 1
            risk_ratio.append(abs(raw - stop) / abs(near - stop))
            distance = abs(trade["entry_price"] - trade["stop_price"]) / trade["entry_price"] * 100
            stop_pct.append(distance)
            cost_r.append(ROUND_TRIP_PCT / distance)
            tighter_than_cost += distance < ROUND_TRIP_PCT
        total = len(trades)
        return {
            "trades": total,
            "fill_vs_zone": {k: {"trades": v, "pct": pct(v, total)} for k, v in where.items()},
            "risk_at_fill_over_risk_at_near_edge_median": median(risk_ratio),
            "entry_to_stop_pct_of_price_median": median(stop_pct),
            "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / statistics.median(stop_pct), 4),
            "trades_with_stop_closer_than_round_trip_cost": int(tighter_than_cost),
            "trades_with_r_below_minus_2": sum(t["r_multiple"] < -2 for t in trades),
            "stopped_on_the_entry_bar": sum(t["exit_reason"] == "stop" and t["bars_held"] == 0 for t in trades),
        }

    def side_stats(trades):
        if not trades:
            return {"trades": 0}
        wins = sum(t["pnl"] > 0 for t in trades)
        return {
            "trades": len(trades), "wins": wins, "win_rate_pct": pct(wins, len(trades)),
            "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
            "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in trades), 4),
            "exit_reasons": {r: sum(t["exit_reason"] == r for t in trades)
                             for r in sorted({t["exit_reason"] for t in trades})},
        }

    trades = {}
    for label in ("in_sample", "out_of_sample"):
        rows = shipped[label]["trades"]
        trades[label] = {
            "fills": fill_stats(rows),
            "long": side_stats([t for t in rows if t["side"] == "long"]),
            "short": side_stats([t for t in rows if t["side"] == "short"]),
            "avg_hours_held": round(shipped[label]["metrics"]["avg_bars_held"] * step / 3_600_000, 2),
        }

    first_open, last_close = float(open_[0]), float(close[-1])
    return {
        "symbol": "BTCUSDT", "interval": "15m", "params": params, "bars": n,
        "price": {"first_open": first_open, "last_close": last_close,
                  "change_pct": round((last_close / first_open - 1) * 100, 2)},
        "round_trip_cost_pct": round(ROUND_TRIP_PCT, 4),
        "breakeven_win_rate_pct_before_costs": round(100 / (1 + params["r_multiple"]), 2),
        "funnel": funnel,
        "blocks": blocks_census,
        "blocks_per_day": round(len(blocks) / (n * step / 86_400_000), 2),
        "published_trades": trades,
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    shipped = load(engine / "results" / "order-block-btcusdt.json")
    runs = run_all(engine, offline, shipped)
    stats = pattern_stats(engine, shipped)
    summary = {
        "article": "en/order-block",
        "engine": {"package": "perpmath", "version": shipped["package_version"],
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "shipped_result": {"file": "results/order-block-btcusdt.json", "generated_at": shipped["generated_at"],
                           "data": shipped["data"], "split": shipped["split"], "costs": shipped["costs"],
                           "in_sample": shipped["in_sample"]["metrics"],
                           "out_of_sample": shipped["out_of_sample"]["metrics"],
                           "signals": {"in_sample": shipped["in_sample"]["signals"],
                                       "out_of_sample": shipped["out_of_sample"]["signals"]}},
        "plan_note": ("The five settings were fixed before the first run. This is a sensitivity table, "
                      "not a search: every row is reported and none is a recommendation."),
        "runs": runs,
        "published_settings": stats,
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(json.dumps(stats["funnel"], indent=1))
    print(json.dumps(stats["blocks"], indent=1))
    print(json.dumps(stats["published_trades"], indent=1))


if __name__ == "__main__":
    main()
