import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/liquidity-sweep: sensitivity table and pattern counts.

Runs the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath)
with the `liquidity_sweep` strategy on a fixed list of settings. The list
below was written down before the first run and nothing was added or removed
after seeing results. It is a sensitivity table: every row is reported, and
no row is offered as "the setting to use".

    BTCUSDT 15m   lookback 10/20/50/100  x  stop buffer 0.1/0.5/1.0 ATR, target 2R   12 runs
    BTCUSDT 15m   target 1R and 3R at lookback 20, stop buffer 0.1 ATR                2 runs
    ETHUSDT 15m, SOLUSDT 15m   published settings (20, 0.1 ATR, 2R)                   2 runs
    BTCUSDT 1h, ETHUSDT 1h, SOLUSDT 1h   published settings                           3 runs

Each of the 19 settings is run twice: with the published costs (fee 0.055% per
side, slippage 0.02% per fill) and with both set to zero. Out-of-sample starts
on 2026-07-31 in every run, the same date the published result uses.

Data: BTCUSDT 15m is the engine's own cached file (the one behind the
published result; its SHA-256 is checked). The other five files are downloaded
from Bybit's public kline endpoint into research/liquidity-sweep/data/:

    perpmath download ETHUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/liquidity-sweep/data
    perpmath download SOLUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/liquidity-sweep/data
    perpmath download BTCUSDT 1h  --start 2025-11-18T12:00:00Z --end 2026-11-18T11:00:00Z --data-dir research/liquidity-sweep/data
    perpmath download ETHUSDT 1h  --start 2025-11-18T12:00:00Z --end 2026-11-18T11:00:00Z --data-dir research/liquidity-sweep/data
    perpmath download SOLUSDT 1h  --start 2025-11-18T12:00:00Z --end 2026-11-18T11:00:00Z --data-dir research/liquidity-sweep/data

Usage (from the site's root folder, engine checked out next to it). The
script imports the engine, so run it with the engine's Python:

    ../perpmath-engine/.venv/Scripts/python research/liquidity-sweep/liquidity-sweep_sensitivity.py [path-to-engine]
    ... --download     fetch the five files above first (overwrites them)
    ... --offline      do not run the engine, rebuild the summary from runs/

Output: research/liquidity-sweep/liquidity-sweep_summary.json. The candle
files (data/) and the full engine outputs with every trade (runs/) are
large and are not committed; the summary records each file's SHA-256, each
config and each command. The engine folder is only read.
"""
import hashlib
import json
import os
import statistics
import subprocess
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RUNS = HERE / "runs"
OUT = HERE / "liquidity-sweep_summary.json"

OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
BASE = {"lookback": 20, "atr_period": 14, "stop_buffer_atr": 0.1, "r_multiple": 2.0}

DOWNLOADS = [
    ("ETHUSDT", "15m", "2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z"),
    ("SOLUSDT", "15m", "2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z"),
    ("BTCUSDT", "1h", "2025-11-18T12:00:00Z", "2026-11-18T11:00:00Z"),
    ("ETHUSDT", "1h", "2025-11-18T12:00:00Z", "2026-11-18T11:00:00Z"),
    ("SOLUSDT", "1h", "2025-11-18T12:00:00Z", "2026-11-18T11:00:00Z"),
]


def plan():
    """The fixed list of settings. Order is the order of the article's table."""
    rows = []
    for lookback in (10, 20, 50, 100):
        for buffer in (0.1, 0.5, 1.0):
            rows.append(("BTCUSDT", "15m", {**BASE, "lookback": lookback, "stop_buffer_atr": buffer}, "grid"))
    for r in (1.0, 3.0):
        rows.append(("BTCUSDT", "15m", {**BASE, "r_multiple": r}, "target"))
    for symbol in ("ETHUSDT", "SOLUSDT"):
        rows.append((symbol, "15m", dict(BASE), "symbol"))
    for symbol in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
        rows.append((symbol, "1h", dict(BASE), "interval"))
    return rows


def run_name(symbol, interval, params):
    return (f"{symbol.lower()}-{interval}-lb{params['lookback']}"
            f"-sb{params['stop_buffer_atr']}-r{params['r_multiple']:g}")


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


def price_change(path):
    """First open, last close and the change between them, read from the CSV itself."""
    with open(path, encoding="utf-8") as handle:
        lines = [line for line in handle.read().splitlines() if line]
    first, last = lines[1].split(","), lines[-1].split(",")
    first_open, last_close = float(first[1]), float(last[4])
    return {"first_open": first_open, "last_close": last_close,
            "change_pct": round((last_close / first_open - 1) * 100, 2)}


def call(command, engine):
    done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                          env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if done.returncode != 0:
        print(done.stdout.strip())
        print(done.stderr.strip())
        raise SystemExit(f"engine exited with {done.returncode}: {' '.join(command)}")
    return done.stdout


def download(engine):
    DATA.mkdir(exist_ok=True)
    python = engine_python(engine)
    for symbol, interval, start, end in DOWNLOADS:
        print(call([python, "-m", "perpmath", "download", symbol, interval,
                    "--start", start, "--end", end, "--data-dir", str(DATA)], engine).strip())


def data_dir_for(engine, symbol, interval):
    """BTCUSDT 15m is read from the engine's cache, everything else from data/."""
    if (symbol, interval) == ("BTCUSDT", "15m"):
        return engine / "data", "<engine>/data"
    return DATA, "research/liquidity-sweep/data"


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


def run_all(engine, offline):
    RUNS.mkdir(exist_ok=True)
    python = engine_python(engine)
    out = []
    for symbol, interval, params, group in plan():
        name = run_name(symbol, interval, params)
        data_dir, data_label = data_dir_for(engine, symbol, interval)
        entry = {"name": name, "group": group, "symbol": symbol, "interval": interval, "params": params,
                 "data_file": f"{symbol}-{interval}.csv",
                 "data_sha256": sha256(data_dir / f"{symbol}-{interval}.csv"),
                 "price": price_change(data_dir / f"{symbol}-{interval}.csv")}
        for label, costs in (("published_costs", PUBLISHED_COSTS), ("zero_cost", ZERO_COSTS)):
            config = {
                "strategy": "liquidity_sweep",
                "params": params,
                "execution": {**costs, "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
                "split": {"oos_start": OOS_START},
            }
            config_path = RUNS / f"{name}.{label}.config.json"
            result_path = RUNS / f"{name}.{label}.json"
            if not offline:
                config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
                call([python, "-m", "perpmath", "backtest", "liquidity_sweep", "--symbol", symbol,
                      "--interval", interval, "--config", str(config_path), "--out", str(result_path),
                      "--data-dir", str(data_dir)], engine)
            document = load(result_path)
            if document["data"]["file_sha256"] != entry["data_sha256"]:
                raise SystemExit(f"{name}: result was computed on a different candle file")
            if document["config"]["params"] != params or document["split"]["oos_start"] != OOS_START + "T00:00:00Z":
                raise SystemExit(f"{name}: result does not match the planned settings")
            if not document["timing"]["lookahead_check"]["passed"]:
                raise SystemExit(f"{name}: look-ahead check did not pass")
            entry.setdefault("data", {k: document["data"][k] for k in ("first_bar", "last_bar", "bars", "missing_bars")})
            entry.setdefault("engine_version", document["package_version"])
            entry[label] = {
                "config": config,
                "command": ("python -m perpmath backtest liquidity_sweep "
                            f"--symbol {symbol} --interval {interval} "
                            f"--config research/liquidity-sweep/runs/{name}.{label}.config.json "
                            f"--out research/liquidity-sweep/runs/{name}.{label}.json --data-dir {data_label}"),
                "generated_at": document["generated_at"],
                "in_sample": block(document, "in_sample"),
                "out_of_sample": block(document, "out_of_sample"),
            }
        out.append(entry)
        m_in = entry["published_costs"]["in_sample"]["metrics"]
        m_out = entry["published_costs"]["out_of_sample"]["metrics"]
        print(f"{name:34} in {m_in['trades']:>5} trades {m_in['total_return_pct']:>8.2f}%   "
              f"out {m_out['trades']:>5} trades {m_out['total_return_pct']:>8.2f}%")
    return out


# --------------------------------------------------------------------------- #
# Counts on the published setting (BTCUSDT 15m, lookback 20)
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def pattern_stats(engine, published):
    """What the bars did, independent of the trade simulation."""
    sys.path.insert(0, str(engine / "src"))
    import numpy as np
    from perpmath.data import load_bars
    from perpmath.indicators import prior_high, prior_low
    from perpmath.strategies import liquidity_sweep

    bars = load_bars(engine / "data" / "BTCUSDT-15m.csv")
    n = len(bars)
    high, low, close, ts = bars.high, bars.low, bars.close, bars.ts
    ph, pl = prior_high(high, BASE["lookback"]), prior_low(low, BASE["lookback"])
    signals = liquidity_sweep.generate(bars, BASE)

    took_high = high > ph
    took_low = low < pl
    both = took_high & took_low
    took_any = took_high | took_low
    # The strategy's rules 2 to 4: a sweep is a take of one level with a close
    # back on the old side of that level, and a bar that does this on both
    # sides at once gives no signal. A bar that takes both levels and closes
    # beyond one of them still counts as a sweep of the other one.
    swept_high = took_high & (close < ph)
    swept_low = took_low & (close > pl)
    high_back_inside = swept_high & ~swept_low
    low_back_inside = swept_low & ~swept_high
    high_beyond = took_high & ~both & (close > ph)
    low_beyond = took_low & ~both & (close < pl)

    # The engine's own signal bars must be exactly the bars this script calls sweeps.
    short_bars = signals.side == -1
    long_bars = signals.side == 1
    if not (np.array_equal(short_bars, high_back_inside) and np.array_equal(long_bars, low_back_inside)):
        raise SystemExit("sweep bars counted here differ from the engine's signal bars")
    seen = (published["in_sample"]["signals"]["seen"] + published["out_of_sample"]["signals"]["seen"])
    if int(short_bars.sum() + long_bars.sum()) != seen:
        raise SystemExit("signal count differs from the published result")

    def held(mask, is_high, horizon):
        """Of the bars in ``mask`` with ``horizon`` later bars available, on how
        many was the bar's own extreme NOT traded through during those bars?"""
        idx = np.flatnonzero(mask)
        idx = idx[idx + horizon < n]
        kept = 0
        for i in idx:
            window = high[i + 1:i + 1 + horizon] if is_high else low[i + 1:i + 1 + horizon]
            kept += bool(window.max() <= high[i]) if is_high else bool(window.min() >= low[i])
        return {"bars": int(len(idx)), "extreme_held": int(kept), "extreme_held_pct": pct(kept, len(idx))}

    horizons = (1, 4, 20, 96)
    after = {}
    for label, hi_mask, lo_mask in (("sweep_closed_back_inside", high_back_inside, low_back_inside),
                                    ("break_closed_beyond", high_beyond, low_beyond)):
        after[label] = {}
        for h in horizons:
            hi, lo = held(hi_mask, True, h), held(lo_mask, False, h)
            total_bars, total_held = hi["bars"] + lo["bars"], hi["extreme_held"] + lo["extreme_held"]
            after[label][f"next_{h}_bars"] = {
                "high_side": hi, "low_side": lo,
                "both_sides": {"bars": total_bars, "extreme_held": total_held,
                               "extreme_held_pct": pct(total_held, total_bars)},
            }

    # Hindsight selection: split the published trades by whether the sweep
    # bar's extreme was still untouched 96 bars (24 hours) later. Nobody can
    # know that at entry; a chart marked afterwards shows only the first group.
    step = int(ts[1] - ts[0])
    index_of = {int(t): i for i, t in enumerate(ts)}
    from datetime import datetime, timezone

    def to_ms(text):
        return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)

    groups = {"extreme_held_96_bars": [], "extreme_broken_within_96_bars": [], "fewer_than_96_bars_left": []}
    for label in ("in_sample", "out_of_sample"):
        for trade in published[label]["trades"]:
            i = index_of[to_ms(trade["entry_time"]) - step]  # the signal bar is the bar before the fill
            if signals.side[i] == 0:
                raise SystemExit("a published trade does not follow a signal bar")
            if i + 96 >= n:
                groups["fewer_than_96_bars_left"].append(trade)
                continue
            if trade["side"] == "short":
                ok = high[i + 1:i + 97].max() <= high[i]
            else:
                ok = low[i + 1:i + 97].min() >= low[i]
            groups["extreme_held_96_bars" if ok else "extreme_broken_within_96_bars"].append(trade)

    def trade_group(trades):
        if not trades:
            return {"trades": 0}
        return {
            "trades": len(trades),
            "win_rate_pct": pct(sum(t["pnl"] > 0 for t in trades), len(trades)),
            "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
            "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in trades), 4),
            "exit_reasons": {r: sum(t["exit_reason"] == r for t in trades)
                             for r in sorted({t["exit_reason"] for t in trades})},
            "stop_exits_within_96_bars": sum(t["exit_reason"] == "stop" and t["bars_held"] <= 96 for t in trades),
            "target_exits_with_a_net_loss": sum(t["exit_reason"] == "target" and t["pnl"] <= 0 for t in trades),
        }

    with_96 = len(groups["extreme_held_96_bars"]) + len(groups["extreme_broken_within_96_bars"])
    hindsight = {name: trade_group(trades) for name, trades in groups.items()}
    hindsight["extreme_held_share_pct_of_trades_with_96_bars_left"] = pct(len(groups["extreme_held_96_bars"]), with_96)

    defined = np.isfinite(ph)
    return {
        "symbol": "BTCUSDT", "interval": "15m", "lookback": BASE["lookback"],
        "bars": n,
        "bars_with_a_prior_range": int(defined.sum()),
        "bars_that_took_the_prior_high": int(took_high.sum()),
        "bars_that_took_the_prior_low": int(took_low.sum()),
        "bars_that_took_both": int(both.sum()),
        "bars_that_took_either_side": int(took_any.sum()),
        "bars_that_took_either_side_pct_of_bars": pct(int(took_any.sum()), n),
        "sweeps": {
            "high_side": int(high_back_inside.sum()), "low_side": int(low_back_inside.sum()),
            "total": int(high_back_inside.sum() + low_back_inside.sum()),
            "of_which_on_bars_that_took_both_sides": int(((high_back_inside | low_back_inside) & both).sum()),
            "pct_of_bars_that_took_either_side": pct(int(high_back_inside.sum() + low_back_inside.sum()),
                                                     int(took_any.sum())),
            "pct_of_bars": pct(int(high_back_inside.sum() + low_back_inside.sum()), n),
            "per_day": round(float(high_back_inside.sum() + low_back_inside.sum()) / (n * step / 86_400_000), 2),
        },
        "one_sided_take_closed_beyond": {
            "high_side": int(high_beyond.sum()), "low_side": int(low_beyond.sum()),
            "total": int(high_beyond.sum() + low_beyond.sum()),
            "pct_of_bars_that_took_either_side": pct(int(high_beyond.sum() + low_beyond.sum()), int(took_any.sum())),
        },
        "takes_that_are_neither": {
            "total": int((took_any & ~high_back_inside & ~low_back_inside & ~high_beyond & ~low_beyond).sum()),
            "swept_both_sides_on_one_bar_no_signal": int((swept_high & swept_low).sum()),
            "closed_exactly_on_the_level": int((took_any & ~both & ~high_back_inside & ~low_back_inside
                                                & ~high_beyond & ~low_beyond).sum()),
        },
        "what_happened_to_the_bar_extreme_afterwards": after,
        "published_trades_split_by_hindsight": hindsight,
    }


def trade_shape(published):
    """Stop distance and per-side figures, straight from the published trade list."""
    out = {}
    for label in ("in_sample", "out_of_sample"):
        trades = published[label]["trades"]
        risk = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in trades]
        sides = {}
        for side in ("long", "short"):
            part = [t for t in trades if t["side"] == side]
            sides[side] = {
                "trades": len(part),
                "win_rate_pct": pct(sum(t["pnl"] > 0 for t in part), len(part)),
                "avg_r": round(statistics.fmean(t["r_multiple"] for t in part), 4),
                "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in part), 4),
            }
        ordered = sorted(risk)
        metrics = published[label]["metrics"]
        out[label] = {
            # gain needed on what is left to get back to the starting 10,000
            "gain_needed_to_recover_pct": round((10000 / metrics["final_equity"] - 1) * 100, 1),
            "break_even_win_rate_before_costs_pct": round(100 / (1 + published["config"]["params"]["r_multiple"]), 2),
            "avg_hours_held": round(metrics["avg_bars_held"] * 15 / 60, 2),
            "median_stop_distance_pct": round(statistics.median(risk), 4),
            "p25_stop_distance_pct": round(ordered[len(ordered) // 4], 4),
            "p75_stop_distance_pct": round(ordered[3 * len(ordered) // 4], 4),
            # 0.15% round trip = two fees of 0.055% plus two fills of 0.02% slippage
            "round_trip_cost_in_r_at_median_stop": round(0.15 / statistics.median(risk), 2),
            "trades_with_stop_closer_than_round_trip_cost": sum(r < 0.15 for r in risk),
            "by_side": sides,
        }
    return out


def tally(runs):
    """Plain counts over the 19 settings, so the article does not have to eyeball them."""
    def count(label, test):
        return sum(1 for run in runs if test(run[label]["in_sample"]["metrics"],
                                             run[label]["out_of_sample"]["metrics"]))
    def t_range(label):
        values = [run[label][part]["metrics"]["t_stat"] for run in runs for part in ("in_sample", "out_of_sample")]
        return {"lowest": min(values), "highest": max(values)}

    def return_range(label):
        values = [run[label][part]["metrics"]["total_return_pct"] for run in runs for part in ("in_sample", "out_of_sample")]
        return {"lowest": min(values), "highest": max(values)}

    btc_15m = [run["published_costs"][part]["metrics"]["avg_trade_return_pct"]
               for run in runs if (run["symbol"], run["interval"]) == ("BTCUSDT", "15m")
               for part in ("in_sample", "out_of_sample")]

    return {
        "settings": len(runs),
        "sample_blocks": len(runs) * 2,
        "avg_trade_return_pct_range_btcusdt_15m_published_costs": {
            "settings": len(btc_15m) // 2, "lowest": min(btc_15m), "highest": max(btc_15m)},
        "t_stat_range": {"published_costs": t_range("published_costs"), "zero_cost": t_range("zero_cost")},
        "total_return_pct_range": {"published_costs": return_range("published_costs"),
                                   "zero_cost": return_range("zero_cost")},
        "sample_blocks_with_abs_t_below_2_at_published_costs": [
            f"{run['name']} {part}" for run in runs for part in ("in_sample", "out_of_sample")
            if abs(run["published_costs"][part]["metrics"]["t_stat"]) < 2],
        "zero_cost_settings_positive_in_both": [
            run["name"] for run in runs
            if run["zero_cost"]["in_sample"]["metrics"]["total_return_pct"] > 0
            and run["zero_cost"]["out_of_sample"]["metrics"]["total_return_pct"] > 0],
        "signal_bars_btcusdt_15m_by_lookback": {
            str(run["params"]["lookback"]): run["published_costs"]["in_sample"]["signals"]["seen"]
            + run["published_costs"]["out_of_sample"]["signals"]["seen"]
            for run in runs
            if (run["symbol"], run["interval"]) == ("BTCUSDT", "15m")
            and run["params"]["stop_buffer_atr"] == 0.1 and run["params"]["r_multiple"] == 2.0},
        "published_costs": {
            "positive_return_in_sample": count("published_costs", lambda a, b: a["total_return_pct"] > 0),
            "positive_return_out_of_sample": count("published_costs", lambda a, b: b["total_return_pct"] > 0),
            "positive_return_in_both": count("published_costs", lambda a, b: a["total_return_pct"] > 0 and b["total_return_pct"] > 0),
            "t_stat_below_minus_2_in_both": count("published_costs", lambda a, b: a["t_stat"] < -2 and b["t_stat"] < -2),
        },
        "zero_cost": {
            "positive_return_in_sample": count("zero_cost", lambda a, b: a["total_return_pct"] > 0),
            "positive_return_out_of_sample": count("zero_cost", lambda a, b: b["total_return_pct"] > 0),
            "positive_return_in_both": count("zero_cost", lambda a, b: a["total_return_pct"] > 0 and b["total_return_pct"] > 0),
            "t_stat_above_2_in_sample": count("zero_cost", lambda a, b: a["t_stat"] > 2),
            "t_stat_above_2_out_of_sample": count("zero_cost", lambda a, b: b["t_stat"] > 2),
            "t_stat_above_2_in_both": count("zero_cost", lambda a, b: a["t_stat"] > 2 and b["t_stat"] > 2),
            "abs_t_stat_below_2_in_both": count("zero_cost", lambda a, b: abs(a["t_stat"]) < 2 and abs(b["t_stat"]) < 2),
        },
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    offline = "--offline" in sys.argv
    if "--download" in sys.argv:
        download(engine)

    published = load(engine / "results" / "liquidity-sweep-btcusdt.json")
    btc_file = engine / "data" / "BTCUSDT-15m.csv"
    if sha256(btc_file) != published["data"]["file_sha256"]:
        raise SystemExit("BTCUSDT-15m.csv is not the file the published result was computed on")

    runs = run_all(engine, offline)

    # The rerun of the published setting must give the published numbers.
    base = next(run for run in runs if run["name"] == run_name("BTCUSDT", "15m", BASE))
    reproduced = all(base["published_costs"][label]["metrics"] == block(published, label)["metrics"]
                     for label in ("in_sample", "out_of_sample"))
    if not reproduced:
        raise SystemExit("the rerun of the published setting does not reproduce the published metrics")

    summary = {
        "article": "en/liquidity-sweep",
        "note": ("Sensitivity table, fixed before the first run. Every setting is reported; none was "
                 "added or dropped after seeing results. Not a parameter search."),
        "engine": {"package": published["package"], "rerun_version": base["engine_version"],
                   "published_result": "results/liquidity-sweep-btcusdt.json",
                   "published_result_version": published["package_version"],
                   "published_result_generated_at": published["generated_at"]},
        "checks": {
            "btcusdt_15m_sha256_matches_published": True,
            "rerun_of_published_setting_reproduces_published_metrics": reproduced,
            "lookahead_check_passed_in_every_run": True,
        },
        "costs": {"published_costs": PUBLISHED_COSTS, "zero_cost": ZERO_COSTS, "funding_modelled": False},
        "oos_start": OOS_START,
        "downloads": [f"perpmath download {s} {i} --start {a} --end {b} --data-dir research/liquidity-sweep/data"
                      for s, i, a, b in DOWNLOADS],
        "tally": tally(runs),
        "published_setting_trade_shape": trade_shape(published),
        "published_setting_pattern_stats": pattern_stats(engine, published),
        "runs": runs,
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(json.dumps(summary["tally"], indent=2))


if __name__ == "__main__":
    main()
