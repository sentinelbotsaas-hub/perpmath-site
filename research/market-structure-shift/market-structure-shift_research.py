import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/market-structure-shift: trade only the break that goes against the break before it.

The three strategies below are NOT among the engine's shipped examples. They
live in this file only. The script registers them in the running Python
process (the README's "Writing a strategy" route, done at run time) and then
calls the engine's real command-line entry point, so the look-ahead check,
the fills, the costs and the in-sample / out-of-sample split are the engine's
own. The engine checkout is only read.

RULES (fixed on 2026-11-21 UTC, before the first run on real data; run once, not
changed afterwards). Everything is evaluated on a bar's close; orders fill at
the next bar's open.

Rules 1 to 5 are those of the engine's `break_of_structure` example, word for
word in effect:

1. Swing high: a bar whose high is strictly above the highs of the
   swing_left bars before it and the swing_right bars after it. Swing low:
   the mirror image. A tie means no swing.
2. A swing at bar p is known only when bar p + swing_right has closed.
3. Latest swing high / low: the most recently confirmed one, higher or lower.
4. Break up: this bar closes above the latest swing high. Break down: this
   bar closes below the latest swing low. A wick is not a break.
5. Each swing level can be broken once.

What is new here:

6. Direction of structure: the direction of the most recent break, up or
   down, whether or not that break led to a trade. Before the first break of
   the data there is none.
7. A break in the SAME direction as the break before it is a continuation
   (what the usual teaching calls a break of structure, BOS). A break in the
   OPPOSITE direction is a reversal (a change of character, CHoCH). The first
   break of the data is neither.
8. `choch_break`: trade reversals only, in the direction of the new break.
   Long on an up break that follows a down break, short on a down break that
   follows an up break. Continuations give no signal.
9. `mss_displacement`: as rule 8, and the breaking bar's true range must be
   at least min_break_range_atr x ATR. This stands for the stricter reading
   in which a market structure shift is a change of character delivered with
   displacement. The other half of that reading, that the break come right
   after a liquidity sweep of the trend's extreme, is NOT coded.
10. `bos_continuation`: the mirror of rule 8, trade continuations only. It is
    here as the comparison, so that the engine's shipped rule (which trades
    both kinds) can be seen split in two.
11. Stop, target and position handling are the engine's `break_of_structure`
    rules 6 to 9: stop at the latest swing on the other side plus or minus
    stop_buffer_atr x ATR, no signal without a valid stop, target at
    r_multiple x risk, one position at a time.

Judgement calls: "trend" is one break long (rule 6), the simplest definition
that needs no further parameter, and the proxy the break-of-structure article
already used for its counts. A trader who reads trend from higher highs and
higher lows on a larger timeframe would label the same breaks differently.
The level broken is the latest confirmed swing, not specifically "the most
recent higher low". Displacement is one bar's range against ATR; other
readings ask for a fair value gap left behind.

PARAMETERS: the five values of the engine's shipped
configs/break_of_structure.json, unchanged (swing_left 5, swing_right 5,
atr_period 14, stop_buffer_atr 0.1, r_multiple 2.0), plus one new number
written down before the first run: min_break_range_atr 1.5. Costs: fee 0.055%
per side, slippage 0.02% per fill. Out-of-sample starts 2026-07-31.

PLAN OF RUNS (also fixed before the first run; every row is reported). Each
is run with the published costs and with fee and slippage at zero.

    choch_break          swing 1, 2, 3, 5 (the published setting), 10      5 runs
    mss_displacement     swing 5, swing 2                                  2 runs
    bos_continuation     swing 5                                           1 run

The swing sizes are the five the break-of-structure article ran.

Besides the engine runs the script counts, for each of the five swing sizes,
how many breaks were continuations and how many reversals and how long a
"trend" (a streak of breaks in one direction) lasted; and, on the published
swing size, how many reversals came with displacement and what price did
after them. At swing 5 the counts must equal those in
research/break-of-structure/break-of-structure_summary.json, and the signal
bars of the two halves together with the first break must equal the signal
bars of the engine's own break_of_structure, or the script stops.

Usage, from the site's root folder, with the engine's own Python:

    ../perpmath-engine/.venv/Scripts/python research/market-structure-shift/market-structure-shift_research.py [path-to-engine]
        --offline   do not run the engine, rebuild the summary from runs/

Output: research/market-structure-shift/market-structure-shift_summary.json
and market-structure-shift_run_output.txt. The full engine outputs with every
trade (runs/*.json) are not committed. The engine's own printed output for
each run is kept in runs/*.cli.txt.

Run history: the engine runs were made twice on 2026-11-21 (UTC), with the
same rules, parameters and plan. The first pass did not save the engine's
printed output, so the script was run again to record it. Every metric of
the second pass is identical to the first. The summary was last rebuilt with
--offline, which reads the saved runs and changes no number.
"""
import contextlib
import json
import math
import os
import statistics
import types
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True

import perpmath  # noqa: E402
from perpmath import cli  # noqa: E402
from perpmath.data import Bars, file_sha256, load_bars  # noqa: E402
from perpmath.engine import Signals  # noqa: E402
from perpmath.indicators import atr, confirmed_swing_high, confirmed_swing_low, true_range  # noqa: E402
from perpmath.strategies import STRATEGIES, break_of_structure  # noqa: E402

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
RUNS = HERE / "runs"
SLUG = "market-structure-shift"
OUT = HERE / f"{SLUG}_summary.json"
LOG = HERE / f"{SLUG}_run_output.txt"

BASE = {"swing_left": 5, "swing_right": 5, "atr_period": 14, "stop_buffer_atr": 0.1, "r_multiple": 2.0}
MSS_DEFAULTS = {**BASE, "min_break_range_atr": 1.5}
OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
ROUND_TRIP_PCT = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
SWINGS = (1, 2, 3, 5, 10)
PLAN = ([("choch_break", "published" if k == 5 else "swing", k) for k in SWINGS]
        + [("mss_displacement", "displacement", 5), ("mss_displacement", "displacement", 2),
           ("bos_continuation", "comparison", 5)])
HORIZONS = (4, 20, 96)

_lines = []


def say(text=""):
    print(text)
    _lines.append(text)


# --------------------------------------------------------------------------- #
# The strategies
# --------------------------------------------------------------------------- #

def find_breaks(bars, params):
    """Every break of the latest confirmed swing, oldest first (rules 1 to 7).

    One tuple per break: (bar, direction, level broken, kind, stop price or NaN, true range / ATR).
    kind is "first", "same" or "opposite" (rule 7).
    """
    n = len(bars)
    close = bars.close
    new_high = confirmed_swing_high(bars.high, params["swing_left"], params["swing_right"])
    new_low = confirmed_swing_low(bars.low, params["swing_left"], params["swing_right"])
    atr_values = atr(bars.high, bars.low, close, params["atr_period"])
    ranges = true_range(bars.high, bars.low, close)

    swing_high = swing_low = math.nan
    high_open = low_open = False
    previous = 0
    out = []
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
        if not (broke_up or broke_down):
            continue
        direction = 1 if broke_up else -1
        kind = "first" if previous == 0 else "same" if direction == previous else "opposite"
        previous = direction

        stop, size = math.nan, math.nan
        if math.isfinite(atr_values[i]):
            buffer = params["stop_buffer_atr"] * atr_values[i]
            size = float(ranges[i] / atr_values[i]) if atr_values[i] > 0 else math.nan
            if direction == 1 and math.isfinite(swing_low) and swing_low - buffer < close[i]:
                stop = swing_low - buffer
            elif direction == -1 and math.isfinite(swing_high) and swing_high + buffer > close[i]:
                stop = swing_high + buffer
        out.append((i, direction, swing_high if direction == 1 else swing_low, kind, stop, size))
    return out


def make_generate(wanted, displacement=False):
    def generate(bars, params):
        signals = Signals.empty(len(bars))
        for i, direction, _, kind, stop, size in find_breaks(bars, params):
            if kind != wanted or not math.isfinite(stop):
                continue
            if displacement and not size >= params["min_break_range_atr"]:
                continue
            signals.side[i], signals.stop[i], signals.target_r[i] = direction, stop, params["r_multiple"]
        return signals
    return generate


GENERATORS = {
    "choch_break": (make_generate("opposite"), BASE),
    "mss_displacement": (make_generate("opposite", displacement=True), MSS_DEFAULTS),
    "bos_continuation": (make_generate("same"), BASE),
}


def self_checks():
    """Hand-made bars with swings of 1 bar either side: an up break, a second up break, then a down break."""
    params = {"swing_left": 1, "swing_right": 1, "atr_period": 2, "stop_buffer_atr": 0.5, "r_multiple": 2.0,
              "min_break_range_atr": 1.5}
    rows = [                      # (open, high, low, close)
        (10, 11, 9, 10),          # 0
        (10, 13, 10, 12),         # 1  swing high 13 (confirmed on bar 2)
        (12, 12, 8, 9),           # 2  swing low 8 (confirmed on bar 3)
        (9, 12, 9, 11),           # 3
        (11, 15, 11, 14),         # 4  closes above 13: FIRST break, up
        (14, 16, 13, 15),         # 5  swing high 16 (confirmed on bar 6)
        (15, 15, 12, 13),         # 6  swing low 12 (confirmed on bar 7)
        (13, 18, 13, 17),         # 7  closes above 16: up after up -> SAME
        (17, 19, 16, 18),         # 8  swing high 19 (confirmed on bar 9)
        (18, 18, 11, 11.5),       # 9  closes below 12: down after up -> OPPOSITE; range 7
    ]
    o, h, l, c = (np.array(x, dtype=float) for x in zip(*rows))
    bars = Bars(np.arange(len(rows)), o, h, l, c, np.ones(len(rows)))
    found = find_breaks(bars, params)
    assert [(b[0], b[1], b[2], b[3]) for b in found] == [(4, 1, 13.0, "first"), (7, 1, 16.0, "same"),
                                                        (9, -1, 12.0, "opposite")], found
    choch = GENERATORS["choch_break"][0](bars, params)
    assert choch.side.tolist() == [0, 0, 0, 0, 0, 0, 0, 0, 0, -1]
    # Stop of the short: latest swing high 19 plus 0.5 x ATR. True ranges on bars 8 and 9 are 3 and 7 -> ATR 5.
    assert choch.stop[9] == 19.0 + 2.5 and choch.target_r[9] == 2.0
    bos = GENERATORS["bos_continuation"][0](bars, params)
    assert bos.side.tolist() == [0, 0, 0, 0, 0, 0, 0, 1, 0, 0]
    # Stop of that long: latest swing low 12 minus 0.5 x ATR. True ranges on bars 6 and 7 are 3 and 5 -> ATR 4.
    assert bos.stop[7] == 12.0 - 2.0
    # Displacement: bar 9 has a range of 7 against an ATR of 5 = 1.4, short of 1.5 -> no signal; at 1.3 it passes.
    assert not GENERATORS["mss_displacement"][0](bars, params).side.any()
    assert GENERATORS["mss_displacement"][0](bars, {**params, "min_break_range_atr": 1.3}).side[9] == -1
    return "passed"


# --------------------------------------------------------------------------- #
# Engine runs
# --------------------------------------------------------------------------- #

METRIC_KEYS = ("trades", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
               "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "final_equity", "avg_bars_held", "exit_reasons", "insufficient_sample")


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def run_name(strategy, swing):
    return f"btcusdt-15m-{strategy.replace('_', '-')}-swing{swing}"


def block(document, label):
    part = document[label]
    stops = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in part["trades"]]
    return {
        "first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
        "metrics": {key: part["metrics"][key] for key in METRIC_KEYS},
        "signals": part["signals"],
        "entry_to_stop_pct_of_price_median": round(statistics.median(stops), 4) if stops else None,
    }


def engine_cli(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = cli.main(argv)
    return code, out.getvalue().strip(), err.getvalue().strip()


def run_all(data_dir, data_sha, offline):
    RUNS.mkdir(exist_ok=True)
    rel = lambda path: Path(os.path.relpath(path, SITE)).as_posix()  # noqa: E731
    out = []
    for strategy, group, swing in PLAN:
        params = {**GENERATORS[strategy][1], "swing_left": swing, "swing_right": swing}
        name = run_name(strategy, swing)
        entry = {"name": name, "strategy": strategy, "group": group, "symbol": "BTCUSDT", "interval": "15m",
                 "params": params, "data_file": "BTCUSDT-15m.csv", "data_sha256": data_sha}
        for label, costs in (("published_costs", PUBLISHED_COSTS), ("zero_cost", ZERO_COSTS)):
            config = {
                "strategy": strategy,
                "params": params,
                "execution": {**costs, "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
                "split": {"oos_start": OOS_START},
            }
            config_path = RUNS / f"{name}.{label}.config.json"
            result_path = RUNS / f"{name}.{label}.json"
            argv = ["backtest", strategy, "--symbol", "BTCUSDT", "--interval", "15m",
                    "--config", rel(config_path), "--out", rel(result_path), "--data-dir", rel(data_dir)]
            command = "perpmath " + " ".join(argv[:-1]) + " <engine>/data"
            transcript = RUNS / f"{name}.{label}.cli.txt"
            if not offline:
                config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
                code, stdout, stderr = engine_cli(argv)
                transcript.write_text("$ " + command + "\n" + "".join(
                    "  | " + line + "\n" for line in (stderr + "\n" + stdout).strip().splitlines())
                    + f"  exit code {code}\n", encoding="utf-8")
                if code != 0:
                    say(transcript.read_text(encoding="utf-8"))
                    raise SystemExit(f"engine exited with {code}: {command}")
            if label == "published_costs" and group == "published":
                say(transcript.read_text(encoding="utf-8").rstrip())
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
                "command": command,
                "generated_at": document["generated_at"],
                "lookahead_check": document["timing"]["lookahead_check"],
                "warnings": document["warnings"],
                "in_sample": block(document, "in_sample"),
                "out_of_sample": block(document, "out_of_sample"),
            }
        out.append(entry)
        for label in ("published_costs", "zero_cost"):
            m_in, m_out = entry[label]["in_sample"]["metrics"], entry[label]["out_of_sample"]["metrics"]

            def cell(value, width, digits=2):
                return f"{'n/a' if value is None else format(value, f'.{digits}f'):>{width}}"

            say(f"{name:40} {label:15} in {m_in['trades']:>4} trades win {cell(m_in['win_rate_pct'], 6)}% "
                f"{cell(m_in['total_return_pct'], 8)}% t {cell(m_in['t_stat'], 6)} R {cell(m_in['avg_r'], 6)}   "
                f"out {m_out['trades']:>4} trades win {cell(m_out['win_rate_pct'], 6)}% "
                f"{cell(m_out['total_return_pct'], 8)}% t {cell(m_out['t_stat'], 6)} R {cell(m_out['avg_r'], 6)}")
    return out


# --------------------------------------------------------------------------- #
# Counts on the bars
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def streaks(found):
    """Lengths of runs of breaks in one direction: the 'trends' of rule 6."""
    lengths, current, previous = [], 0, 0
    for _, direction, *_ in found:
        if direction == previous:
            current += 1
        else:
            if current:
                lengths.append(current)
            current, previous = 1, direction
    if current:
        lengths.append(current)
    return lengths


def count_by_swing(bars):
    out = []
    days = len(bars) / 96
    for k in SWINGS:
        found = find_breaks(bars, {**BASE, "swing_left": k, "swing_right": k})
        same = sum(b[3] == "same" for b in found)
        opposite = sum(b[3] == "opposite" for b in found)
        lengths = streaks(found)
        out.append({
            "swing_bars_each_side": k, "breaks": len(found), "breaks_per_day": round(len(found) / days, 2),
            "continuations_same_direction": same, "reversals_opposite_direction": opposite,
            "reversals_pct_of_labelled": pct(opposite, same + opposite),
            "reversals_per_day": round(opposite / days, 2),
            "streaks": len(lengths), "streak_length_mean": round(statistics.fmean(lengths), 2),
            "streak_length_median": statistics.median(lengths), "streak_length_max": max(lengths),
            "streaks_of_one_break": sum(x == 1 for x in lengths),
            "streaks_of_one_break_pct": pct(sum(x == 1 for x in lengths), len(lengths)),
            "streaks_of_three_or_more_pct": pct(sum(x >= 3 for x in lengths), len(lengths)),
        })
    return out


def published_detail(bars, bos_summary):
    n = len(bars)
    open_, close = bars.open, bars.close
    found = find_breaks(bars, MSS_DEFAULTS)
    same = [b for b in found if b[3] == "same"]
    opposite = [b for b in found if b[3] == "opposite"]
    reference = bos_summary["published_settings"]["breaks"]
    if (len(found), len(same), len(opposite)) != (reference["total"], reference["same_direction_as_previous_break"],
                                                  reference["opposite_to_previous_break"]):
        raise SystemExit("break counts differ from research/break-of-structure/break-of-structure_summary.json")

    # The two halves plus the first break must be the engine's own break_of_structure signal bars.
    engine_bars = set(np.flatnonzero(break_of_structure.generate(bars, BASE).side != 0).tolist())
    halves = set()
    for name in ("choch_break", "bos_continuation"):
        halves |= set(np.flatnonzero(GENERATORS[name][0](bars, BASE).side != 0).tolist())
    first = {b[0] for b in found if b[3] == "first" and math.isfinite(b[4])}
    if halves | first != engine_bars or halves & first:
        raise SystemExit("the two halves do not add up to the engine's break_of_structure signals")

    threshold = MSS_DEFAULTS["min_break_range_atr"]

    def forward(rows):
        out = {"breaks": len(rows)}
        for h in HORIZONS:
            usable = [b for b in rows if b[0] + h < n]
            moves, closed_back = [], 0
            for i, direction, level, *_ in usable:
                entry = open_[i + 1]
                moves.append(direction * (close[i + h] - entry) / entry * 100)
                window = close[i + 1:i + 1 + h]
                closed_back += bool((window < level).any()) if direction == 1 else bool((window > level).any())
            out[f"after_{h}_bars"] = {
                "breaks_with_data": len(usable),
                "mean_move_pct": round(statistics.fmean(moves), 4) if moves else None,
                "moved_further_pct": pct(sum(m > 0 for m in moves), len(moves)),
                "closed_back_through_level_pct": pct(closed_back, len(usable)),
            }
        return out

    groups = {
        "reversals_all": opposite,
        "reversals_with_displacement": [b for b in opposite if b[5] >= threshold],
        "reversals_without_displacement": [b for b in opposite if not b[5] >= threshold],
        "continuations_all": same,
        "continuations_with_displacement": [b for b in same if b[5] >= threshold],
    }
    sizes = sorted(b[5] for b in opposite if math.isfinite(b[5]))
    return {
        "params": MSS_DEFAULTS, "bars": n,
        "breaks": {"total": len(found), "up": sum(b[1] == 1 for b in found), "down": sum(b[1] == -1 for b in found),
                   "continuations": len(same), "reversals": len(opposite),
                   "reversals_up": sum(b[1] == 1 for b in opposite), "reversals_down": sum(b[1] == -1 for b in opposite),
                   "matches_break_of_structure_summary": True,
                   "halves_plus_first_equal_engine_bos_signals": True},
        "displacement": {
            "threshold_true_range_over_atr": threshold,
            "reversals_with_displacement": len(groups["reversals_with_displacement"]),
            "reversals_with_displacement_pct": pct(len(groups["reversals_with_displacement"]), len(opposite)),
            "continuations_with_displacement": len(groups["continuations_with_displacement"]),
            "continuations_with_displacement_pct": pct(len(groups["continuations_with_displacement"]), len(same)),
            "breaking_bar_range_over_atr_median_reversals": round(statistics.median(sizes), 4),
        },
        "forward": {name: forward(rows) for name, rows in groups.items()},
        "forward_note": ("Moves are measured from the open of the bar after the break to the close h bars after "
                         "the break, in the break's direction, before costs. Windows overlap, so these describe "
                         "the chart; they are not independent trades and no t-statistic is given."),
    }


def trade_stats(document, step_ms):
    out = {}
    for label in ("in_sample", "out_of_sample"):
        rows = document[label]["trades"]

        def stats(trades):
            if not trades:
                return {"trades": 0}
            wins = sum(t["pnl"] > 0 for t in trades)
            return {"trades": len(trades), "wins": wins, "win_rate_pct": pct(wins, len(trades)),
                    "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
                    "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in trades), 4),
                    "sum_of_trade_returns_pct": round(sum(t["return_pct"] for t in trades), 4)}

        distances = sorted(abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in rows)
        middle = statistics.median(distances)
        hours = document[label]["metrics"]["avg_bars_held"] * step_ms / 3_600_000
        out[label] = {
            "long": stats([t for t in rows if t["side"] == "long"]),
            "short": stats([t for t in rows if t["side"] == "short"]),
            "by_exit_reason": {reason: stats([t for t in rows if t["exit_reason"] == reason])
                               for reason in sorted({t["exit_reason"] for t in rows})},
            "entry_to_stop_pct_of_price": {"min": round(distances[0], 4), "median": round(middle, 4),
                                           "max": round(distances[-1], 4)},
            "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / middle, 4),
            "avg_hours_held": round(hours, 2),
            "funding_settlements_per_average_trade_at_8h": round(hours / 8, 2),
        }
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    engine = Path(args[0]).resolve() if args else (SITE.parent / "perpmath-engine").resolve()
    os.chdir(SITE)
    data_dir = engine / "data"
    data_path = data_dir / "BTCUSDT-15m.csv"
    data_sha = file_sha256(data_path)
    bars = load_bars(data_path)
    bos_summary = load(SITE / "research" / "break-of-structure" / "break-of-structure_summary.json")
    shipped_bos = load(engine / "results" / "break-of-structure-btcusdt.json")
    if shipped_bos["data"]["file_sha256"] != data_sha:
        raise SystemExit("the engine's candle file is not the one behind its shipped break_of_structure result")

    say(f"self-checks: {self_checks()}")
    for name, (generate, defaults) in GENERATORS.items():
        STRATEGIES[name] = types.SimpleNamespace(DEFAULTS=dict(defaults), generate=generate)
    say(f"engine perpmath {perpmath.__version__}; strategies {', '.join(GENERATORS)} registered at run time "
        f"from this script")
    say(f"candles: BTCUSDT-15m.csv, {len(bars)} bars, sha256 {data_sha}")
    say()

    runs = run_all(data_dir, data_sha, offline)
    published = load(RUNS / f"{run_name('choch_break', 5)}.published_costs.json")
    counts = count_by_swing(bars)
    detail = published_detail(bars, bos_summary)
    step_ms = int(bars.ts[1] - bars.ts[0])
    trades = {name: trade_stats(load(RUNS / f"{run_name(name, 5)}.published_costs.json"), step_ms)
              for name in ("choch_break", "bos_continuation")}

    summary = {
        "article": "en/market-structure-shift",
        "engine": {"package": "perpmath", "version": perpmath.__version__,
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "strategies": {"names": list(GENERATORS), "defined_in": f"research/{SLUG}/{SLUG}_research.py",
                       "shipped_with_engine": False, "base_params": BASE, "mss_displacement_params": MSS_DEFAULTS,
                       "parameters_fixed_on": "2026-11-21 (UTC), before the first run on real data"},
        "data": {"file": "BTCUSDT-15m.csv", "file_sha256": data_sha, "bars": len(bars),
                 "first_bar": published["data"]["first_bar"], "last_bar": published["data"]["last_bar"],
                 "missing_bars": published["data"]["missing_bars"]},
        "split": published["split"],
        "costs": {"published": PUBLISHED_COSTS, "round_trip_pct": round(ROUND_TRIP_PCT, 4),
                  "funding_modelled": False},
        "plan_note": ("The eight runs were fixed before the first one. This is a sensitivity table, not a search: "
                      "every row is reported and none is a recommendation."),
        "self_checks": "passed",
        "runs": runs,
        "breaks_by_swing_size": counts,
        "published_swing_size": detail,
        "published_trades": trades,
        "shipped_break_of_structure_for_comparison": {
            "file": "<engine>/results/break-of-structure-btcusdt.json",
            "engine_version": shipped_bos["package_version"],
            "in_sample": {k: shipped_bos["in_sample"]["metrics"][k] for k in METRIC_KEYS},
            "out_of_sample": {k: shipped_bos["out_of_sample"]["metrics"][k] for k in METRIC_KEYS},
        },
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    say()
    say(f"wrote research/{SLUG}/{OUT.name}")
    say(json.dumps(counts, indent=1))
    say(json.dumps(detail, indent=1))
    say(json.dumps(trades, indent=1))
    header = (f"# Output of the run behind research/{SLUG}/{OUT.name} (engine perpmath {perpmath.__version__}).\n"
              f"# Command, from the site's root folder: ../perpmath-engine/.venv/Scripts/python "
              f"research/{SLUG}/{SLUG}_research.py" + (" --offline" if offline else "") + "\n"
              f"# The published setting was run by the engine at {published['generated_at']} (UTC).\n\n")
    LOG.write_text(header + "\n".join(_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
