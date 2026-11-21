import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/silver-bullet-strategy: the engine's fair value gap rule, restricted to clock windows.

The "silver bullet" is taught as a fair value gap (FVG) entry inside one of
three one-hour windows in New York time. This script tests the clock part of
that idea and nothing else: the engine's own `fvg` rule, unchanged, with a
filter on when the gap may form and when the entry may happen.

THESE STRATEGIES ARE NOT IN THE ENGINE. They are defined below and registered
in the running Python process only (the README's "Writing a strategy" route),
then the engine's real command-line entry point is called for every run, so
the look-ahead check, the costs, the fills and the in-sample / out-of-sample
split are the engine's own. The engine checkout is only read.

------------------------------------------------------------------------------
Everything below was written down on 2026-11-21 (UTC), before the first run on
real data. It was run once and not changed afterwards.
------------------------------------------------------------------------------

Windows (New York wall-clock time, daylight saving handled by nytime.py):
    03:00-04:00, 10:00-11:00, 14:00-15:00
    Source: LuxAlgo's open-source "ICT Silver Bullet" script on TradingView
    (published 4 July 2023) and LuxAlgo's library entry; AudaCity Capital's
    guide lists the same three. A bar is "inside" a window when its OPEN time
    t satisfies start <= t < end.

Rules. Parameters are the engine's shipped fvg values on every timeframe
(atr_period 14, min_gap_atr 0.5, max_wait_bars 96, stop_buffer_atr 0.1,
r_multiple 2.0). They are counted in bars, so on 5-minute and 1-minute bars
they cover a third and a fifteenth of the clock time. No other value was run.

    fvg         the engine's shipped strategy, no clock filter. The baseline.
    sb_formed   a gap counts only if its THIRD candle is inside a window.
                The return entry may come at any later bar, up to the usual
                96-bar expiry. ("The setup must form inside the window.")
    sb_strict   as sb_formed, and the return bar must be inside the SAME
                window on the same day. A gap that has not been returned to
                when its window ends is dropped. (LuxAlgo's script hides a
                gap that is not retraced by the end of the session.)
    sb_hour_HH  sb_strict with a single window HH:00-(HH+1):00 New York time,
                for HH = 00 ... 23. Twenty-four runs per timeframe, used as
                the "any other hour" baseline for the three taught hours.

    Entry, stop and target are the engine's fvg rules: market order at the
    next bar's open after the return bar closes, stop beyond the far edge of
    the gap, target at 2R. One position at a time.

What is NOT coded, and the article says so: the liquidity sweep or structure
shift that is supposed to come before the gap, the "draw on liquidity" used as
target, and any discretion about which gaps to skip.

Timeframes: 15m (the engine's shipped candle file), 5m and 1m (downloaded by
`perpmath download` into data/, same range 2025-11-18T11:30Z to
2026-11-18T11:30Z). Out-of-sample starts 2026-07-31 in every run.

Costs: every run twice, with the published costs (fee 0.055% per side,
slippage 0.02% per fill) and with both at zero.

Plan: 3 timeframes x (fvg, sb_formed, sb_strict, 24 x sb_hour_HH) x 2 cost
settings = 162 engine runs. All are reported. Fewer than 100 trades in a
block = insufficient sample, numbers not to be read.

Prediction written before the run: on 15-minute bars sb_strict will have far
fewer than 100 trades in either sample (a one-hour window holds four bars).

Self-checks (the script stops if one fails):
  * with no clock filter the local generate() gives exactly the signals of the
    engine's fvg.generate on the shipped 15m file;
  * hand-made bars: a gap formed and returned to inside the 10:00 window gives
    a signal under both rules; formed inside and returned to after 11:00 gives
    one under sb_formed only; formed before 10:00 gives none; the same UTC
    instants are inside the window in January and outside it in July;
  * the published-cost 15m fvg run reproduces the shipped result's metrics;
  * the gap counts agree with the signals the strategies emit;
  * nytime.self_test() (winter, summer and both switch days).

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/silver-bullet-strategy/silver-bullet_research.py [--workers N]
    ... --offline     do not run the engine; rebuild the summary from runs/

Output: research/silver-bullet-strategy/silver-bullet_summary.json. Full
engine outputs with every trade go to runs/ and are not committed.
"""
import contextlib
import hashlib
import json
import math
import statistics
import time
import types
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "ict-kill-zones"))

import nytime  # noqa: E402
import perpmath  # noqa: E402
from perpmath import cli  # noqa: E402
from perpmath.data import Bars, cache_path, iso_utc, load_bars  # noqa: E402
from perpmath.engine import Signals  # noqa: E402
from perpmath.indicators import atr  # noqa: E402
from perpmath.strategies import STRATEGIES, fvg  # noqa: E402

RUNS = HERE / "runs"
DATA = HERE / "data"
OUT = HERE / "silver-bullet_summary.json"
REL = "research/silver-bullet-strategy"

WINDOWS = (("03:00", "04:00"), ("10:00", "11:00"), ("14:00", "15:00"))
PARAMS = dict(fvg.DEFAULTS)
OOS_START = "2026-07-31"
COSTS = {
    "published_costs": {"fee_rate": 0.00055, "slippage": 0.0002},
    "zero_cost": {"fee_rate": 0.0, "slippage": 0.0},
}
ROUND_TRIP_PCT = (0.00055 + 0.0002) * 2 * 100
INTERVALS = ("15m", "5m", "1m")
DOWNLOAD_RANGE = ("2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z")


# --------------------------------------------------------------------------- #
# The strategies
# --------------------------------------------------------------------------- #

def window_ids(ts, windows):
    """For each bar: an integer naming the window instance (day and window) its open time is in, or -1."""
    minute = nytime.ny_minute_of_day(ts)
    day = nytime.ny_day_number(ts)
    out = np.full(len(ts), -1, dtype=np.int64)
    for k, (start, end) in enumerate(windows):
        inside = nytime.in_window(minute, nytime.hhmm(start), nytime.hhmm(end))
        out[inside] = day[inside] * 100 + k
    return out


def make_generate(windows, strict):
    """The engine's fvg.generate with a clock filter. windows=None means no filter."""

    def generate(bars: Bars, params: dict) -> Signals:
        n = len(bars)
        signals = Signals.empty(n)
        high, low, close = bars.high, bars.low, bars.close
        atr_values = atr(high, low, close, params["atr_period"])
        max_wait = params["max_wait_bars"]
        inside = window_ids(bars.ts, windows) if windows is not None else np.zeros(n, dtype=np.int64)

        waiting = []  # (direction, bottom, top, stop, bar the gap formed on, window instance), oldest first
        for i in range(n):
            still_waiting = []
            for gap in waiting:
                direction, bottom, top, stop, born, instance = gap
                if i - born > max_wait:
                    continue
                if strict and inside[i] != instance:
                    continue                                    # its window is over: dropped, unused
                if direction == 1 and low[i] <= top:
                    if close[i] >= bottom:
                        signals.side[i], signals.stop[i] = 1, stop
                    continue
                if direction == -1 and high[i] >= bottom:
                    if close[i] <= top:
                        signals.side[i], signals.stop[i] = -1, stop
                    continue
                still_waiting.append(gap)
            waiting = still_waiting
            if signals.side[i] != 0:
                signals.target_r[i] = params["r_multiple"]

            if i < 2 or not math.isfinite(atr_values[i]) or inside[i] < 0:
                continue                                        # inside[i] < 0: third candle outside every window
            min_size = params["min_gap_atr"] * atr_values[i]
            buffer = params["stop_buffer_atr"] * atr_values[i]
            if low[i] > high[i - 2] and low[i] - high[i - 2] >= min_size:
                bottom, top = float(high[i - 2]), float(low[i])
                waiting.append((1, bottom, top, bottom - buffer, i, int(inside[i])))
            elif high[i] < low[i - 2] and low[i - 2] - high[i] >= min_size:
                bottom, top = float(high[i]), float(low[i - 2])
                waiting.append((-1, bottom, top, top + buffer, i, int(inside[i])))
        return signals

    return generate


def hour_window(hour):
    return ((f"{hour:02d}:00", f"{hour + 1:02d}:00"),)


LOCAL = {"sb_formed": make_generate(WINDOWS, strict=False), "sb_strict": make_generate(WINDOWS, strict=True)}
for _hour in range(24):
    LOCAL[f"sb_hour_{_hour:02d}"] = make_generate(hour_window(_hour), strict=True)
for _name, _generate in LOCAL.items():          # runs at import, so worker processes have them too
    STRATEGIES[_name] = types.SimpleNamespace(DEFAULTS=dict(fvg.DEFAULTS), generate=_generate)
STRATEGY_NAMES = ["fvg", "sb_formed", "sb_strict"] + [f"sb_hour_{h:02d}" for h in range(24)]


# --------------------------------------------------------------------------- #
# Self-checks on hand-made bars
# --------------------------------------------------------------------------- #

def _utc_ms(text):
    from datetime import datetime, timezone
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000)


def hand_bars(third_candle_utc, return_after_bars):
    """24 flat 15m bars, then a bullish gap whose third candle opens at `third_candle_utc`,
    then flat bars above the gap, then one bar that dips back into it `return_after_bars` bars later."""
    step = 900_000
    rows = [(100.0, 100.5, 99.5, 100.0)] * 24            # open, high, low, close: true range 1.0
    rows += [(100.0, 100.5, 99.5, 100.0),                # candle 1: high 100.5 = bottom of the gap
             (100.0, 103.0, 100.0, 103.0),               # candle 2: the move
             (103.0, 103.5, 102.0, 103.0)]               # candle 3: low 102.0 = top of the gap
    rows += [(103.0, 103.5, 102.5, 103.0)] * (return_after_bars - 1)   # stays above the gap
    rows += [(103.0, 103.2, 101.8, 102.5)]               # return bar: low 101.8 <= 102.0, close 102.5 >= 100.5
    rows += [(102.5, 103.0, 102.2, 102.8)] * 3
    third = len(rows) - 3 - 1 - (return_after_bars - 1) - 1
    first_ts = _utc_ms(third_candle_utc) - third * step
    ts = np.array([first_ts + i * step for i in range(len(rows))], dtype=np.int64)
    cols = [np.array(col, dtype=np.float64) for col in zip(*rows)]
    return Bars(ts, cols[0], cols[1], cols[2], cols[3], np.ones(len(rows))), third, third + return_after_bars


def self_checks(bars_15m):
    report = {"nytime": nytime.self_test()}

    # 1. No filter = the engine's own fvg, bar for bar, on the shipped file.
    ours = make_generate(None, strict=False)(bars_15m, PARAMS).fields()
    theirs = fvg.generate(bars_15m, PARAMS).fields()
    for name in theirs:
        a, b = ours[name], theirs[name]
        same = (a == b) | (np.isnan(a) & np.isnan(b)) if a.dtype.kind == "f" else a == b
        assert bool(np.all(same)), f"unfiltered generate differs from the engine's fvg in signals.{name}"
    report["unfiltered_equals_engine_fvg"] = {"bars": len(bars_15m), "entry_signals": int(np.count_nonzero(theirs["side"]))}

    def sides(name, bars):
        return STRATEGIES[name].generate(bars, PARAMS).side

    # 2. Winter, Thursday 15 January 2026: 10:00 New York = 15:00 UTC.
    #    Third candle opens 10:15, return bar opens 10:30: inside the window on both counts.
    bars, third, back = hand_bars("2026-01-15T15:15", 1)
    assert nytime.ny_text(int(bars.ts[third])) == "2026-01-15 10:15 EST"
    assert fvg.generate(bars, PARAMS).side[back] == 1
    assert sides("sb_formed", bars)[back] == 1 and sides("sb_strict", bars)[back] == 1
    assert sides("sb_hour_10", bars)[back] == 1 and not sides("sb_hour_09", bars).any()
    # The stop is the gap's bottom minus 0.1 x ATR(14) read on candle 3. The 14 true ranges
    # ending there are twelve of 1.0, then 3.0 (candle 2) and 1.5 (candle 3: high 103.5, low 102.0).
    expected_stop = 100.5 - 0.1 * (12 * 1.0 + 3.0 + 1.5) / 14
    assert abs(STRATEGIES["sb_strict"].generate(bars, PARAMS).stop[back] - expected_stop) < 1e-9

    #    Third candle 10:45, return bar 11:00: formed inside, returned to outside.
    bars, third, back = hand_bars("2026-01-15T15:45", 1)
    assert nytime.ny_text(int(bars.ts[back])) == "2026-01-15 11:00 EST"
    assert sides("sb_formed", bars)[back] == 1 and not sides("sb_strict", bars).any()

    #    Third candle 09:45, return bar 10:00: formed before the window. Only the unfiltered rule trades it.
    bars, third, back = hand_bars("2026-01-15T14:45", 1)
    assert fvg.generate(bars, PARAMS).side[back] == 1
    assert not sides("sb_formed", bars).any() and not sides("sb_strict", bars).any()

    # 3. Summer, Wednesday 15 July 2026: 10:00 New York = 14:00 UTC.
    #    The winter instants (15:15 and 15:30 UTC) are now 11:15 and 11:30 New York: outside.
    bars, third, back = hand_bars("2026-07-15T15:15", 1)
    assert nytime.ny_text(int(bars.ts[third])) == "2026-07-15 11:15 EDT"
    assert not sides("sb_formed", bars).any() and not sides("sb_strict", bars).any()
    #    One UTC hour earlier is inside.
    bars, third, back = hand_bars("2026-07-15T14:15", 1)
    assert nytime.ny_text(int(bars.ts[third])) == "2026-07-15 10:15 EDT"
    assert sides("sb_formed", bars)[back] == 1 and sides("sb_strict", bars)[back] == 1
    #    ... and that same UTC instant in January is 09:15 New York: outside.
    bars, third, back = hand_bars("2026-01-15T14:15", 1)
    assert not sides("sb_formed", bars).any()

    # 4. Same input, same output.
    a = STRATEGIES["sb_strict"].generate(bars_15m, PARAMS).fields()
    b = STRATEGIES["sb_strict"].generate(bars_15m, PARAMS).fields()
    assert all(np.array_equal(a[k], b[k], equal_nan=True) for k in a)
    report["hand_made_cases"] = "passed: winter in/out, formed-inside-returned-outside, formed-before, summer in/out, stop price"
    return report


# --------------------------------------------------------------------------- #
# Gap counts (descriptive, no trades)
# --------------------------------------------------------------------------- #

def gap_counts(bars, params, windows):
    """What happened to every gap whose third candle is inside a window, under the strict rule."""
    high, low, close = bars.high, bars.low, bars.close
    atr_values = atr(high, low, close, params["atr_period"])
    inside = window_ids(bars.ts, windows)
    instances = sorted(set(int(x) for x in inside[inside >= 0]))
    per_window = {f"{s}-{e}": {"window_instances": 0, "gaps_formed": 0, "entered_inside": 0, "failed_inside": 0,
                               "not_returned_before_window_end": 0, "instances_with_a_gap": 0,
                               "instances_with_an_entry": 0} for s, e in windows}
    names = list(per_window)
    for instance in instances:
        per_window[names[instance % 100]]["window_instances"] += 1
    with_gap, with_entry, entry_bars = set(), set(), set()
    n = len(bars)
    for i in range(2, n):
        if inside[i] < 0 or not math.isfinite(atr_values[i]):
            continue
        min_size = params["min_gap_atr"] * atr_values[i]
        if low[i] > high[i - 2] and low[i] - high[i - 2] >= min_size:
            direction, bottom, top = 1, float(high[i - 2]), float(low[i])
        elif high[i] < low[i - 2] and low[i - 2] - high[i] >= min_size:
            direction, bottom, top = -1, float(high[i]), float(low[i - 2])
        else:
            continue
        row = per_window[names[int(inside[i]) % 100]]
        row["gaps_formed"] += 1
        with_gap.add(int(inside[i]))
        outcome = "not_returned_before_window_end"
        j = i + 1
        while j < n and inside[j] == inside[i] and j - i <= params["max_wait_bars"]:
            if direction == 1 and low[j] <= top:
                outcome = "entered_inside" if close[j] >= bottom else "failed_inside"
                break
            if direction == -1 and high[j] >= bottom:
                outcome = "entered_inside" if close[j] <= top else "failed_inside"
                break
            j += 1
        row[outcome] += 1
        if outcome == "entered_inside":
            with_entry.add(int(inside[i]))
            entry_bars.add(j)
    for instance in with_gap:
        per_window[names[instance % 100]]["instances_with_a_gap"] += 1
    for instance in with_entry:
        per_window[names[instance % 100]]["instances_with_an_entry"] += 1
    total = {key: sum(row[key] for row in per_window.values()) for key in next(iter(per_window.values()))}
    return {"per_window": per_window, "all_windows": total, "distinct_entry_bars": len(entry_bars)}


# --------------------------------------------------------------------------- #
# Engine runs
# --------------------------------------------------------------------------- #

def data_dir_for(interval, engine_root):
    return (engine_root / "data") if interval == "15m" else DATA


def run_name(strategy, interval, cost_label):
    return f"btcusdt-{interval}-{strategy.replace('_', '-')}.{cost_label}"


def run_job(job):
    """One engine run through the real command line. Runs in a worker process."""
    strategy, interval, cost_label, data_dir = job
    name = run_name(strategy, interval, cost_label)
    config_path = RUNS / f"{name}.config.json"
    out_path = RUNS / f"{name}.json"
    config = {
        "strategy": strategy,
        "params": PARAMS,
        "execution": {**COSTS[cost_label], "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
        "split": {"oos_start": OOS_START},
    }
    with open(config_path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")
    if out_path.exists():
        out_path.unlink()
    argv = ["backtest", strategy, "--symbol", "BTCUSDT", "--interval", interval, "--config", str(config_path),
            "--out", str(out_path), "--data-dir", str(data_dir)]
    stdout, stderr = io.StringIO(), io.StringIO()
    started = time.time()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = cli.main(argv)
    return {"name": name, "exit_code": code, "seconds": round(time.time() - started, 1),
            "stderr_tail": stderr.getvalue().strip().splitlines()[-1:] if code else []}


METRIC_KEYS = ("trades", "insufficient_sample", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct",
               "t_stat", "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "avg_bars_held", "final_equity", "exit_reasons")


def block(document, label):
    part = document[label]
    stops = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in part["trades"]]
    median_stop = round(statistics.median(stops), 4) if stops else None
    return {
        "first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
        "metrics": {key: part["metrics"][key] for key in METRIC_KEYS},
        "signals": part["signals"],
        "entry_to_stop_pct_of_price_median": median_stop,
        "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / median_stop, 3) if median_stop else None,
    }


def summarise(strategy, interval, cost_label, seconds):
    name = run_name(strategy, interval, cost_label)
    with open(RUNS / f"{name}.json", encoding="utf-8") as handle:
        document = json.load(handle)
    data_flag = "" if interval == "15m" else f" --data-dir {REL}/data"
    return {
        "name": name, "strategy": strategy, "interval": interval, "costs": cost_label,
        "in_engine": strategy == "fvg",
        "command": f"perpmath backtest {strategy} --symbol BTCUSDT --interval {interval} "
                   f"--config {REL}/runs/{name}.config.json --out {REL}/runs/{name}.json{data_flag}",
        "engine_version": document["package_version"], "generated_at": document["generated_at"],
        "data": document["data"], "split": document["split"],
        "lookahead_check": document["timing"]["lookahead_check"],
        "lookahead_seconds_incl_simulation": seconds,
        "in_sample": block(document, "in_sample"), "out_of_sample": block(document, "out_of_sample"),
        "warnings": document["warnings"],
    }


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    offline = "--offline" in sys.argv
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 12
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    RUNS.mkdir(exist_ok=True)

    bars = {interval: load_bars(cache_path(str(data_dir_for(interval, engine_root)), "BTCUSDT", interval))
            for interval in INTERVALS}
    checks = self_checks(bars["15m"])
    print("self-checks passed:", json.dumps(checks))

    jobs = [(strategy, interval, cost_label, str(data_dir_for(interval, engine_root)))
            for interval in INTERVALS for strategy in STRATEGY_NAMES for cost_label in COSTS]
    seconds = {}
    timing_file = RUNS / "timings.json"
    if offline:
        seconds = json.load(open(timing_file, encoding="utf-8")) if timing_file.exists() else {}
    else:
        # Long 1m jobs first so the pool is never left waiting on one of them at the end.
        jobs.sort(key=lambda job: (INTERVALS.index(job[1]) * -1, job[0] != "fvg"))
        with ProcessPoolExecutor(max_workers=workers) as pool:
            for done in pool.map(run_job, jobs):
                if done["exit_code"] != 0:
                    raise SystemExit(f"engine exited with {done['exit_code']} for {done['name']}: {done['stderr_tail']}")
                seconds[done["name"]] = done["seconds"]
                print(f"  {done['name']:52} {done['seconds']:>8.1f} s", flush=True)
        with open(timing_file, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(seconds, handle, indent=1)

    runs = [summarise(strategy, interval, cost_label, seconds.get(run_name(strategy, interval, cost_label)))
            for interval in INTERVALS for strategy in STRATEGY_NAMES for cost_label in COSTS]

    # The published-cost 15m fvg run must reproduce the engine's shipped result.
    with open(engine_root / "results" / "fvg-btcusdt.json", encoding="utf-8") as handle:
        shipped = json.load(handle)
    ours = next(r for r in runs if r["name"] == run_name("fvg", "15m", "published_costs"))
    assert ours["data"]["file_sha256"] == shipped["data"]["file_sha256"]
    for label in ("in_sample", "out_of_sample"):
        for key in METRIC_KEYS:
            assert ours[label]["metrics"][key] == shipped[label]["metrics"][key], (label, key)
    checks["reproduces_shipped_fvg_result"] = True

    counts = {}
    for interval in INTERVALS:
        counts[interval] = gap_counts(bars[interval], PARAMS, WINDOWS)
        strict_signals = int(np.count_nonzero(STRATEGIES["sb_strict"].generate(bars[interval], PARAMS).side))
        assert counts[interval]["distinct_entry_bars"] == strict_signals, (interval, strict_signals)
        counts[interval]["sb_strict_entry_signals"] = strict_signals
        counts[interval]["sb_formed_entry_signals"] = int(
            np.count_nonzero(STRATEGIES["sb_formed"].generate(bars[interval], PARAMS).side))
        counts[interval]["fvg_entry_signals"] = int(np.count_nonzero(fvg.generate(bars[interval], PARAMS).side))
    checks["gap_counts_agree_with_signals"] = True

    # Where do the three taught hours rank among the 24?
    ranking = {}
    for interval in INTERVALS:
        for cost_label in COSTS:
            rows = []
            for hour in range(24):
                run = next(r for r in runs if r["name"] == run_name(f"sb_hour_{hour:02d}", interval, cost_label))
                trades = [run[s]["metrics"]["trades"] for s in ("in_sample", "out_of_sample")]
                returns = [run[s]["metrics"]["avg_trade_return_pct"] for s in ("in_sample", "out_of_sample")]
                pooled = (sum(t * r for t, r in zip(trades, returns) if r is not None) / sum(trades)) if sum(trades) else None
                rows.append({"hour_ny": hour, "trades_in": trades[0], "trades_out": trades[1],
                             "avg_trade_return_pct_in": returns[0], "avg_trade_return_pct_out": returns[1],
                             "avg_trade_return_pct_both": round(pooled, 4) if pooled is not None else None,
                             "t_stat_in": run["in_sample"]["metrics"]["t_stat"],
                             "t_stat_out": run["out_of_sample"]["metrics"]["t_stat"],
                             "total_return_pct_in": run["in_sample"]["metrics"]["total_return_pct"],
                             "total_return_pct_out": run["out_of_sample"]["metrics"]["total_return_pct"]})
            ordered = sorted((r for r in rows if r["avg_trade_return_pct_both"] is not None),
                             key=lambda r: -r["avg_trade_return_pct_both"])
            for rank, row in enumerate(ordered, start=1):
                row["rank_by_avg_trade_return_both_samples"] = rank
            ranking[f"{interval}.{cost_label}"] = rows

    # Counts read off the hour runs for the article (added after the runs; nothing is re-run).
    digest = {}
    for key, rows in ranking.items():
        blocks = [(row["hour_ny"], sample, row[f"trades_{sample}"], row[f"t_stat_{sample}"], row[f"total_return_pct_{sample}"])
                  for row in rows for sample in ("in", "out")]
        by_hour = {row["hour_ny"]: row for row in rows}
        digest[key] = {
            "blocks": len(blocks),
            "blocks_with_100_trades_or_more": sum(1 for b in blocks if b[2] >= 100),
            "trades_per_block_min": min(b[2] for b in blocks), "trades_per_block_max": max(b[2] for b in blocks),
            "blocks_with_positive_return": sum(1 for b in blocks if b[4] > 0),
            "blocks_with_t_at_least_2": sum(1 for b in blocks if b[3] is not None and b[3] >= 2),
            "blocks_with_t_at_most_minus_2": sum(1 for b in blocks if b[3] is not None and b[3] <= -2),
            "t_stat_min": min(b[3] for b in blocks if b[3] is not None), "t_stat_max": max(b[3] for b in blocks if b[3] is not None),
            "hours_with_t_at_least_2_in_both_samples": [h for h, row in by_hour.items()
                                                        if (row["t_stat_in"] or 0) >= 2 and (row["t_stat_out"] or 0) >= 2],
            "hours_with_positive_return_in_both_samples": [h for h, row in by_hour.items()
                                                           if row["total_return_pct_in"] > 0 and row["total_return_pct_out"] > 0],
            "rank_of_taught_hours_among_24": {f"{h:02d}:00": by_hour[h]["rank_by_avg_trade_return_both_samples"] for h in (3, 10, 14)},
            "best_hour": min(rows, key=lambda r: r["rank_by_avg_trade_return_both_samples"])["hour_ny"],
            "worst_hour": max(rows, key=lambda r: r["rank_by_avg_trade_return_both_samples"])["hour_ny"],
        }

    summary = {
        "article": "en/silver-bullet-strategy",
        "note": "sb_formed, sb_strict and sb_hour_HH are defined in silver-bullet_research.py and are not shipped "
                "with the engine. Every run went through the engine's command line (perpmath backtest).",
        "preregistered_on": "2026-11-21 (UTC)",
        "engine_version": perpmath.__version__,
        "windows_new_york_time": [f"{s}-{e}" for s, e in WINDOWS],
        "params": PARAMS, "oos_start": OOS_START, "costs": COSTS, "round_trip_cost_pct": ROUND_TRIP_PCT,
        "download_commands": [
            f"perpmath download BTCUSDT {interval} --start {DOWNLOAD_RANGE[0]} --end {DOWNLOAD_RANGE[1]} --data-dir {REL}/data"
            for interval in ("5m", "1m")],
        "data_files": {interval: {"file": f"BTCUSDT-{interval}.csv",
                                  "sha256": sha256(cache_path(str(data_dir_for(interval, engine_root)), "BTCUSDT", interval)),
                                  "bars": len(bars[interval]),
                                  "first_bar": iso_utc(int(bars[interval].ts[0])),
                                  "last_bar": iso_utc(int(bars[interval].ts[-1]))}
                       for interval in INTERVALS},
        "self_checks": checks,
        "gap_counts_strict_rule": counts,
        "runs": runs,
        "hour_ranking": ranking,
        "hour_ranking_digest": digest,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")

    print(f"{'run':52}{'trades in/out':>16}{'avgR in/out':>16}{'t in/out':>16}{'return % in/out':>22}")
    for run in runs:
        if run["strategy"].startswith("sb_hour"):
            continue
        a, b = run["in_sample"]["metrics"], run["out_of_sample"]["metrics"]
        fmt = lambda v: "n/a" if v is None else f"{v:.2f}"  # noqa: E731
        print(f"{run['name']:52}{a['trades']:>8}/{b['trades']:<7}{fmt(a['avg_r']):>8}/{fmt(b['avg_r']):<7}"
              f"{fmt(a['t_stat']):>8}/{fmt(b['t_stat']):<7}{fmt(a['total_return_pct']):>11}/{fmt(b['total_return_pct']):<10}")
    print(f"wrote {REL}/silver-bullet_summary.json")


if __name__ == "__main__":
    main()
