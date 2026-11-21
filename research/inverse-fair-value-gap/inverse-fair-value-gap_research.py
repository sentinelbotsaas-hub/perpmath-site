import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/inverse-fair-value-gap: an inverse FVG retest rule, written down before it was run.

The strategy below is NOT one of the engine's shipped examples. It lives in
this file only. The script registers it in the running Python process (the
README's "Writing a strategy" route, done at run time) and then calls the
engine's real command-line entry point, so the look-ahead check, the fills,
the costs and the in-sample / out-of-sample split are the engine's own. The
engine checkout is only read.

RULES (fixed on 2026-11-21 UTC, before the first run on real data; run once, not
changed afterwards). Everything is evaluated on a bar's close; orders fill at
the next bar's open. Described for a bullish gap that turns into a bearish
inverse gap; the other case is the exact mirror image.

1. Fair value gap: exactly the engine's `fvg` rules 1 and 2. Bullish gap: the
   low of bar 3 is above the high of bar 1; the zone runs from the high of
   bar 1 (bottom) to the low of bar 3 (top). It must be at least
   min_gap_atr x ATR tall, ATR being the simple average of the last
   atr_period true ranges on bar 3.
2. Inversion: a later bar CLOSES below the bottom of the zone, the far edge.
   From that close on the zone is a bearish inverse gap. The close must come
   within max_wait_bars bars of the gap forming; after that the gap is
   forgotten. Whether price touched or held the gap before does not matter.
   A wick below the bottom does not invert the gap.
3. The inverse gap waits for price to come back. It expires, unused, after
   max_wait_bars bars counted from the bar that inverted it.
4. Entry: the first later bar whose high reaches the bottom of the zone. If
   that bar closes at or below the top of the zone, go short. If it closes
   above the top, the inverse gap has failed and is dropped.
5. Each inverse gap is used at most once, whether or not it leads to a trade.
6. Stop: the top of the zone plus stop_buffer_atr x ATR, with ATR read on the
   bar that inverted the gap. (For a long from a failed bearish gap: the
   bottom of the zone minus the same buffer.)
7. Target: r_multiple x risk from the fill price, where risk is the distance
   between the fill price and the stop.
8. One position at a time. Signals that arrive while a position is open are
   ignored. If several inverse gaps trigger on the same bar, the one inverted
   most recently is used.

Judgement calls: inversion needs a close beyond the WHOLE gap, not its
midpoint (the looser reading is counted in part A but not traded); no
minimum size for the bar that closes through; no requirement that the
inversion follow a liquidity sweep; the zone keeps its original edges; one
parameter is used for both clocks. As with the engine's `fvg`, the entry is a
market order at the open after the retest bar, not a resting limit order.

PARAMETERS: the five values of the engine's shipped configs/fvg.json,
unchanged: atr_period 14, min_gap_atr 0.5, max_wait_bars 96,
stop_buffer_atr 0.1, r_multiple 2.0. Costs: fee 0.055% per side, slippage
0.02% per fill. Out-of-sample starts 2026-07-31, as in the shipped results.

PLAN OF RUNS (also fixed before the first run; every row is reported). Each
setting is run with the published costs and with fee and slippage at zero.

    published                 min_gap_atr 0.5, max_wait_bars 96
    gap size                  min_gap_atr 0.25, 1.0           (max_wait_bars 96)
    clocks                    max_wait_bars 24, 288           (min_gap_atr 0.5)

Besides the engine runs the script follows every gap of the year (part A):
how many were closed through, how soon, how many of those were then
retested, and what the retest bar did. It also records what the engine's own
`fvg` return rule did with the same gap, so the two ideas can be laid side by
side. The gap counts must equal research/fvg_gap_stats.json and the replayed
signal bars must equal the strategy's, or the script stops.

Usage, from the site's root folder, with the engine's own Python:

    ../perpmath-engine/.venv/Scripts/python research/inverse-fair-value-gap/inverse-fair-value-gap_research.py [path-to-engine]
        --offline   do not run the engine, rebuild the summary from runs/

Output: research/inverse-fair-value-gap/inverse-fair-value-gap_summary.json
and inverse-fair-value-gap_run_output.txt. The full engine outputs with every
trade (runs/*.json) are not committed; the summary records the candle file's
SHA-256, each config and each command. The engine's own printed output for
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
from perpmath.indicators import atr  # noqa: E402
from perpmath.strategies import STRATEGIES  # noqa: E402

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
RUNS = HERE / "runs"
SLUG = "inverse-fair-value-gap"
OUT = HERE / f"{SLUG}_summary.json"
LOG = HERE / f"{SLUG}_run_output.txt"
STRATEGY = "inverse_fvg"

DEFAULTS = {"atr_period": 14, "min_gap_atr": 0.5, "max_wait_bars": 96, "stop_buffer_atr": 0.1, "r_multiple": 2.0}
OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
ROUND_TRIP_PCT = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
PLAN = [
    ("published", {}),
    ("gap size", {"min_gap_atr": 0.25}),
    ("gap size", {"min_gap_atr": 1.0}),
    ("clocks", {"max_wait_bars": 24}),
    ("clocks", {"max_wait_bars": 288}),
]
HORIZONS = (4, 20, 96)

_lines = []


def say(text=""):
    print(text)
    _lines.append(text)


# --------------------------------------------------------------------------- #
# The strategy
# --------------------------------------------------------------------------- #

def walk(bars, params, record=None):
    """Rules 1 to 8 of this file's docstring. `record`, if given, collects one dict per gap."""
    n = len(bars)
    signals = Signals.empty(n)
    high, low, close = bars.high, bars.low, bars.close
    atr_values = atr(high, low, close, params["atr_period"])
    max_wait = params["max_wait_bars"]

    gaps = []       # fair value gaps not yet closed through: [direction, bottom, top, born, row]
    inverse = []    # inverse gaps waiting for a retest: [trade side, bottom, top, stop, inverted at, row]
    for i in range(n):
        # Inverse gaps from earlier bars: has price come back on this bar?
        still = []
        for zone in inverse:
            side, bottom, top, stop, since, row = zone
            if i - since > max_wait:
                if row is not None:
                    row["retest"] = "expired"
                continue
            if side == -1 and high[i] >= bottom:
                held = close[i] <= top
                if held:
                    signals.side[i], signals.stop[i] = -1, stop
            elif side == 1 and low[i] <= top:
                held = close[i] >= bottom
                if held:
                    signals.side[i], signals.stop[i] = 1, stop
            else:
                still.append(zone)
                continue
            if row is not None:
                row["retest"], row["retest_bar"] = ("signal" if held else "failed"), i
        inverse = still
        if signals.side[i] != 0:
            signals.target_r[i] = params["r_multiple"]

        # Gaps from earlier bars: did this bar close through one?
        still = []
        for gap in gaps:
            direction, bottom, top, born, row = gap
            if i - born > max_wait:
                continue
            buffer = params["stop_buffer_atr"] * atr_values[i]
            if direction == 1 and close[i] < bottom:
                inverse.append([-1, bottom, top, top + buffer, i, row])
            elif direction == -1 and close[i] > top:
                inverse.append([1, bottom, top, bottom - buffer, i, row])
            else:
                still.append(gap)
                continue
            if row is not None:
                row["inverted_bar"] = i
        gaps = still

        # Does this bar complete a new gap with the two bars before it?
        if i < 2 or not math.isfinite(atr_values[i]):
            continue
        min_size = params["min_gap_atr"] * atr_values[i]
        new = None
        if low[i] > high[i - 2] and low[i] - high[i - 2] >= min_size:
            new = [1, float(high[i - 2]), float(low[i]), i]
        elif high[i] < low[i - 2] and low[i - 2] - high[i] >= min_size:
            new = [-1, float(high[i]), float(low[i - 2]), i]
        if new is not None:
            row = None
            if record is not None:
                row = {"direction": new[0], "bottom": new[1], "top": new[2], "born": i,
                       "inverted_bar": None, "retest": None, "retest_bar": None}
                record.append(row)
            gaps.append(new + [row])
    return signals


def generate(bars, params):
    """Rules 1 to 8 of this file's docstring (see `walk`)."""
    return walk(bars, params)


def self_checks():
    """Hand-made bars: one bullish gap, closed through, retested, short signal; then the failure case."""
    def make(rows):
        o, h, l, c = (np.array(x, dtype=float) for x in zip(*rows))
        return Bars(np.arange(len(rows)), o, h, l, c, np.ones(len(rows)))

    # min_gap_atr 0.6 lets the one intended gap through (3 tall against an ATR of 4.5) and keeps out the
    # two small bearish gaps the later bars happen to form (1 and 1.5 tall against ATRs of 4 and 3.25).
    params = {"atr_period": 2, "min_gap_atr": 0.6, "max_wait_bars": 10, "stop_buffer_atr": 0.5, "r_multiple": 2.0}
    base = [
        (100, 101, 99, 100),      # 0  bar 1 of the gap, high 101
        (101, 106, 101, 105),     # 1  the fast candle
        (105, 107, 104, 106),     # 2  bar 3, low 104 > 101: bullish gap, zone 101 to 104
        (106, 106, 102, 103),     # 3  dips into the zone, closes inside: nothing for this rule
        (103, 103, 99, 100),      # 4  closes at 100, below 101: inverted. True ranges 4 and 4 -> ATR 4, buffer 2, stop 106
        (100, 100.5, 98, 99),     # 5  high 100.5 < 101: no retest yet
    ]
    held = make(base + [(99, 102, 98.5, 100)])        # 6  high 102 >= 101, close 100 <= 104: short
    record = []
    got = walk(held, params, record)
    assert got.side.tolist() == [0, 0, 0, 0, 0, 0, -1], got.side.tolist()
    assert got.stop[6] == 106.0 and got.target_r[6] == 2.0
    assert len(record) == 1 and record[0]["inverted_bar"] == 4 and record[0]["retest"] == "signal"
    failed = make(base + [(99, 105, 98.5, 104.5)])    # 6  high reaches the zone, close 104.5 > 104: failed
    record = []
    assert not walk(failed, params, record).side.any() and record[0]["retest"] == "failed"
    wick = make(base[:4] + [(103, 103, 99, 101.5), (101.5, 103, 100, 102)])   # a wick below 101 is not an inversion
    record = []
    assert not walk(wick, params, record).side.any() and record[0]["inverted_bar"] is None
    # Mirror image: flip every price around 200.
    mirror = make([(200 - o, 200 - l, 200 - h, 200 - c) for o, h, l, c in base + [(99, 102, 98.5, 100)]])
    got = walk(mirror, params)
    assert got.side.tolist() == [0, 0, 0, 0, 0, 0, 1] and got.stop[6] == 94.0
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


def run_name(params):
    return f"btcusdt-15m-gap{params['min_gap_atr']}-wait{params['max_wait_bars']}".replace(".", "_")


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
    for group, overrides in PLAN:
        params = {**DEFAULTS, **overrides}
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
            argv = ["backtest", STRATEGY, "--symbol", "BTCUSDT", "--interval", "15m",
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
            say(f"{name:28} {label:15} in {m_in['trades']:>4} trades win {m_in['win_rate_pct']:>6.2f}% "
                f"{m_in['total_return_pct']:>8.2f}% t {m_in['t_stat']:>6.2f} R {m_in['avg_r']:>6.2f}   "
                f"out {m_out['trades']:>4} trades win {m_out['win_rate_pct']:>6.2f}% "
                f"{m_out['total_return_pct']:>8.2f}% t {m_out['t_stat']:>6.2f} R {m_out['avg_r']:>6.2f}")
    return out


# --------------------------------------------------------------------------- #
# A. Every gap of the year
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def gap_stats(bars, params, fvg_reference):
    n = len(bars)
    open_, high, low, close = bars.open, bars.high, bars.low, bars.close
    max_wait = params["max_wait_bars"]
    record = []
    signals = walk(bars, params, record)
    if not np.array_equal(signals.side, generate(bars, params).side):
        raise SystemExit("walk() with and without a record disagree")

    # What the engine's own `fvg` rule 4 did with the same gap, and the looser midpoint reading.
    for row in record:
        d, bottom, top, born = row["direction"], row["bottom"], row["top"], row["born"]
        middle = (bottom + top) / 2
        row["fvg"], row["fvg_bar"], row["midpoint_close_bar"] = "expired", None, None
        for j in range(born + 1, min(born + max_wait, n - 1) + 1):
            if row["midpoint_close_bar"] is None and (close[j] < middle if d == 1 else close[j] > middle):
                row["midpoint_close_bar"] = j
            if row["fvg_bar"] is None and (low[j] <= top if d == 1 else high[j] >= bottom):
                row["fvg_bar"] = j
                row["fvg"] = "entered" if (close[j] >= bottom if d == 1 else close[j] <= top) else "failed"
        if born + max_wait > n - 1 and row["fvg_bar"] is None:
            row["fvg"] = "open"

    total = len(record)
    ref = fvg_reference["gaps_passing_size_filter"]
    ours = {"bullish": sum(r["direction"] == 1 for r in record), "bearish": sum(r["direction"] == -1 for r in record)}
    if (ours["bullish"], ours["bearish"], total) != (ref["bullish"], ref["bearish"], ref["total"]):
        raise SystemExit(f"gap counts {ours} differ from research/fvg_gap_stats.json")
    fvg_outcome = {k: sum(r["fvg"] == k for r in record) for k in ("entered", "failed", "expired", "open")}
    if fvg_outcome != fvg_reference["outcome"]:
        raise SystemExit(f"fvg outcomes {fvg_outcome} differ from research/fvg_gap_stats.json")

    inverted = [r for r in record if r["inverted_bar"] is not None]
    retested = [r for r in inverted if r["retest"] in ("signal", "failed")]
    signalled = [r for r in inverted if r["retest"] == "signal"]
    waiting = [r for r in inverted if r["retest"] is None]          # still waiting when the data ended
    signal_bars = sorted({r["retest_bar"] for r in signalled})
    if signal_bars != np.flatnonzero(signals.side != 0).tolist():
        raise SystemExit("the gap records do not reproduce the strategy's signal bars")
    wait_inv = [r["inverted_bar"] - r["born"] for r in inverted]
    wait_ret = [r["retest_bar"] - r["inverted_bar"] for r in retested]
    midpoint = [r for r in record if r["midpoint_close_bar"] is not None]

    def forward(rows):
        """Move in the direction of the close-through, from the next open to the close h bars later."""
        out = {"inversions": len(rows)}
        for h in HORIZONS:
            moves = []
            for r in rows:
                i, d = r["inverted_bar"], -r["direction"]
                if i + h < n:
                    moves.append(d * (close[i + h] - open_[i + 1]) / open_[i + 1] * 100)
            out[f"after_{h}_bars"] = {"with_data": len(moves), "mean_move_pct": round(statistics.fmean(moves), 4),
                                      "median_move_pct": round(statistics.median(moves), 4),
                                      "moved_further_pct": pct(sum(m > 0 for m in moves), len(moves))}
        return out

    def side(direction):
        rows = [r for r in record if r["direction"] == direction]
        inv = [r for r in rows if r["inverted_bar"] is not None]
        return {"gaps": len(rows), "closed_through": len(inv), "closed_through_pct": pct(len(inv), len(rows)),
                "retested": sum(r["retest"] in ("signal", "failed") for r in inv),
                "signal": sum(r["retest"] == "signal" for r in inv),
                "failed_on_retest": sum(r["retest"] == "failed" for r in inv),
                "expired": sum(r["retest"] == "expired" for r in inv)}

    by_fvg = {}
    for outcome in ("entered", "failed", "expired"):
        rows = [r for r in record if r["fvg"] == outcome]
        inv = [r for r in rows if r["inverted_bar"] is not None]
        by_fvg[outcome] = {"gaps": len(rows), "later_closed_through": len(inv),
                           "later_closed_through_pct": pct(len(inv), len(rows)),
                           "gave_inverse_signal": sum(r["retest"] == "signal" for r in inv),
                           "gave_inverse_signal_pct": pct(sum(r["retest"] == "signal" for r in inv), len(rows))}
    entered_then_inverted = [r for r in record if r["fvg"] == "entered" and r["inverted_bar"] is not None]

    return {
        "params": params, "bars": n,
        "gaps_passing_size_filter": {"total": total, **ours, "matches_fvg_gap_stats_json": True},
        "closed_through_far_edge_within_wait": {
            "gaps": len(inverted), "pct_of_gaps": pct(len(inverted), total),
            "not_closed_through": total - len(inverted),
            "bars_from_gap_to_close_through_median": statistics.median(wait_inv),
            "bars_from_gap_to_close_through_mean": round(statistics.fmean(wait_inv), 2),
            "on_the_very_next_bar": sum(w == 1 for w in wait_inv),
            "on_the_very_next_bar_pct": pct(sum(w == 1 for w in wait_inv), len(inverted)),
            "within_4_bars_pct": pct(sum(w <= 4 for w in wait_inv), len(inverted)),
            "within_20_bars_pct": pct(sum(w <= 20 for w in wait_inv), len(inverted)),
        },
        "closed_beyond_midpoint_within_wait": {
            "gaps": len(midpoint), "pct_of_gaps": pct(len(midpoint), total),
            "note": "The looser reading of inversion. Counted only; no strategy was run on it.",
        },
        "retest_of_inverse_gaps": {
            "inverse_gaps": len(inverted),
            "retested_within_wait": len(retested), "retested_pct": pct(len(retested), len(inverted)),
            "bars_from_close_through_to_retest_median": statistics.median(wait_ret),
            "retest_on_the_very_next_bar": sum(w == 1 for w in wait_ret),
            "retest_on_the_very_next_bar_pct": pct(sum(w == 1 for w in wait_ret), len(retested)),
            "retest_within_4_bars_pct": pct(sum(w <= 4 for w in wait_ret), len(retested)),
            "signal": len(signalled), "signal_pct_of_inverse_gaps": pct(len(signalled), len(inverted)),
            "failed_closed_back_through": len(retested) - len(signalled),
            "failed_pct_of_inverse_gaps": pct(len(retested) - len(signalled), len(inverted)),
            "expired_never_retested": sum(r["retest"] == "expired" for r in inverted),
            "expired_pct_of_inverse_gaps": pct(sum(r["retest"] == "expired" for r in inverted), len(inverted)),
            "still_waiting_at_end_of_data": len(waiting),
            "signal_bars": len(signal_bars),
        },
        "by_side": {"bullish_gap_to_bearish_inverse": side(1), "bearish_gap_to_bullish_inverse": side(-1)},
        "same_gap_under_the_fvg_return_rule": {
            "note": ("'entered', 'failed' and 'expired' are what rule 4 of the engine's fvg strategy did with the "
                     "gap on its first return. A gap can give an fvg entry and, later, an inverse-gap entry in "
                     "the opposite direction."),
            **by_fvg,
            "entered_then_closed_through_bars_between_median": statistics.median(
                r["inverted_bar"] - r["fvg_bar"] for r in entered_then_inverted),
            "entered_then_closed_through_on_the_same_bar_or_next": sum(
                r["inverted_bar"] - r["fvg_bar"] <= 1 for r in entered_then_inverted),
        },
        "after_the_close_through": forward(inverted),
        "forward_note": ("Moves are measured from the open after the bar that closed through the gap to the close "
                         "h bars after it, in the direction of that close, before costs. Windows overlap; these "
                         "describe the chart and are not trades."),
    }


def trade_stats(document):
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
        out[label] = {
            "long": stats([t for t in rows if t["side"] == "long"]),
            "short": stats([t for t in rows if t["side"] == "short"]),
            "by_exit_reason": {reason: stats([t for t in rows if t["exit_reason"] == reason])
                               for reason in sorted({t["exit_reason"] for t in rows})},
            "entry_to_stop_pct_of_price": {"min": round(distances[0], 4), "median": round(middle, 4),
                                           "max": round(distances[-1], 4)},
            "round_trip_cost_pct": round(ROUND_TRIP_PCT, 4),
            "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / middle, 4),
            "trades_with_stop_closer_than_round_trip_cost": sum(d < ROUND_TRIP_PCT for d in distances),
            "avg_bars_held": document[label]["metrics"]["avg_bars_held"],
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
    fvg_reference = load(SITE / "research" / "fvg_gap_stats.json")
    if fvg_reference["data"]["file_sha256"] != data_sha:
        raise SystemExit("research/fvg_gap_stats.json was computed on a different candle file")

    say(f"self-checks: {self_checks()}")
    STRATEGIES[STRATEGY] = types.SimpleNamespace(DEFAULTS=dict(DEFAULTS), generate=generate)
    say(f"engine perpmath {perpmath.__version__}; strategy '{STRATEGY}' registered at run time from this script")
    say(f"candles: BTCUSDT-15m.csv, {len(bars)} bars, sha256 {data_sha}")
    say()

    runs = run_all(data_dir, data_sha, offline)
    published = load(RUNS / f"{run_name(DEFAULTS)}.published_costs.json")
    stats = gap_stats(bars, dict(DEFAULTS), fvg_reference)
    seen = published["in_sample"]["signals"]["seen"] + published["out_of_sample"]["signals"]["seen"]
    stats["retest_of_inverse_gaps"]["signals_seen_by_engine"] = seen
    stats["retest_of_inverse_gaps"]["signals_ignored_while_in_a_position"] = (
        published["in_sample"]["signals"]["skipped_in_position"]
        + published["out_of_sample"]["signals"]["skipped_in_position"])
    trades = trade_stats(published)
    shipped_fvg = load(engine / "results" / "fvg-btcusdt.json")

    summary = {
        "article": "en/inverse-fair-value-gap",
        "engine": {"package": "perpmath", "version": perpmath.__version__,
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "strategy": {"name": STRATEGY, "defined_in": f"research/{SLUG}/{SLUG}_research.py",
                     "shipped_with_engine": False, "defaults": DEFAULTS,
                     "parameters_fixed_on": "2026-11-21 (UTC), before the first run on real data"},
        "data": {"file": "BTCUSDT-15m.csv", "file_sha256": data_sha, "bars": len(bars),
                 "first_bar": published["data"]["first_bar"], "last_bar": published["data"]["last_bar"],
                 "missing_bars": published["data"]["missing_bars"]},
        "split": published["split"],
        "costs": {"published": PUBLISHED_COSTS, "round_trip_pct": round(ROUND_TRIP_PCT, 4),
                  "funding_modelled": False},
        "plan_note": ("The five settings were fixed before the first run. This is a sensitivity table, not a "
                      "search: every row is reported and none is a recommendation."),
        "self_checks": "passed",
        "runs": runs,
        "every_gap": stats,
        "published_trades": trades,
        "shipped_fvg_result_for_comparison": {
            "file": "<engine>/results/fvg-btcusdt.json", "engine_version": shipped_fvg["package_version"],
            "in_sample": {k: shipped_fvg["in_sample"]["metrics"][k] for k in METRIC_KEYS},
            "out_of_sample": {k: shipped_fvg["out_of_sample"]["metrics"][k] for k in METRIC_KEYS},
        },
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    say()
    say(f"wrote research/{SLUG}/{OUT.name}")
    say(json.dumps(stats, indent=1))
    say(json.dumps(trades, indent=1))
    header = (f"# Output of the run behind research/{SLUG}/{OUT.name} (engine perpmath {perpmath.__version__}).\n"
              f"# Command, from the site's root folder: ../perpmath-engine/.venv/Scripts/python "
              f"research/{SLUG}/{SLUG}_research.py" + (" --offline" if offline else "") + "\n"
              f"# The published setting was run by the engine at {published['generated_at']} (UTC).\n\n")
    LOG.write_text(header + "\n".join(_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
