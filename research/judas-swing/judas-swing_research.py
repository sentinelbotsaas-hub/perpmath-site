import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/judas-swing: the judas swing and the power of 3 as rules, counted on one year of BTCUSDT.

Reads the engine's cached candle file (BTCUSDT 15m, 2025-11-18 11:30 UTC to
2026-11-18 11:30 UTC). The engine folder is only read.

------------------------------------------------------------------------------
Written down on 2026-11-21 (UTC) before the first run on the data. Run once.
------------------------------------------------------------------------------

The sources (ict-kill-zones_sources.json and judas-swing_sources.json) agree
on a story and give no numbers: price builds a range in the Asian session,
makes a false move out of it early in the day (the judas swing, most often
placed in the London kill zone, measured against the midnight New York open),
then runs the other way (distribution). Accumulation, manipulation,
distribution: the power of 3. The rule below is ONE way to write that down.

Template, anchored at an instant A. For the ICT reading A is New York
midnight (nytime.py handles daylight saving).

    range      the 16 bars that open in [A - 4h, A)          Asian range, 20:00-00:00 New York
               RH = their highest high, RL = their lowest low
    window     the 20 bars that open in [A, A + 5h)          00:00-05:00, to the end of the London kill zone
    deadline   A + 16h                                       16:00 New York
    O          the open of the bar at A                      the midnight open

    1. BREAK. The first window bar whose high > RH or whose low < RL. None:
       "no break". Both on that one bar: "both sides", set aside.
       Direction is up if it took RH, down if it took RL.
    2. RECLAIM. The first bar from the break bar on, still inside the window,
       that CLOSES back inside the range (below RH after an up break, above
       RL after a down break). None before the window ends: "break held".
       A break followed by a reclaim is what we count as a JUDAS SWING.
       E = the extreme price reached from the break bar to the reclaim bar.
    3. OUTCOME, on the bars after the reclaim bar that open before the
       deadline. Which comes first:
         completed   price trades through the OTHER side of the range
                     (below RL after an up judas, above RH after a down one)
         failed      price trades beyond E again; also when one bar does both
         neither     the deadline arrives first

    Also recorded for every judas swing: whether the last close before the
    deadline is on the other side of O from the false move.

Power of 3, as a whole-period template on the 64 bars that open in [A, A+16h):
    bullish  the period's low is set inside the window, the last close is
             above O and in the top third of the period's range
    bearish  the mirror image
    A "power of 3 day" is either.

Baselines, both fixed in advance:
  a. "Any other clock time": the same template with A moved 1, 2, ... 23 hours
     later, on the same days. If New York midnight is special, shift 0 should
     stand out from the other 23.
  b. "Same bars, random directions": each day's 80 bars replayed 500 times
     with the direction of every bar flipped at random (seed 20261122), which
     keeps every bar's size and position and removes any tendency to reverse.

Days: New York days 2025-11-19 to 2026-11-16 (so that every shift has its
full 20 hours of data), without the two days on which the clock changes
(2026-03-08, 2026-11-01). All days, and Monday to Friday separately.

Engine run (2 runs: published costs, zero costs). A strategy `judas_swing`,
DEFINED IN THIS FILE AND NOT SHIPPED WITH THE ENGINE, registered at run time
and run through the engine's command line: at the close of the reclaim bar
(shift 0 only) enter against the false move; stop at E plus/minus 0.1 x
ATR(14); target 2R, the same exit convention as every other strategy on the
site; one position at a time. Out-of-sample from 2026-07-31. Fewer than 100
trades in a block = insufficient sample.

Added after the first run, as a breakdown of the same days and not a new
rule: the judas swings split by when the break came (before 02:00, or inside
the London kill zone 02:00-05:00, where the sources most often place it), and
the number of bars between the break and the reclaim.

Self-checks (the script stops if one fails): nytime.self_test(); five
hand-made days, one per outcome; a hand-made power of 3 day; the strategy's
entry signals must fall on exactly the reclaim bars the counting code finds;
the replay with no flips must reproduce the real classification; the
computation is run twice and must give identical output.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/judas-swing/judas-swing_research.py
    ... --offline    do not run the engine; reuse runs/

Output: research/judas-swing/judas-swing_summary.json
"""
import contextlib
import hashlib
import json
import statistics
import types
from collections import Counter
from datetime import datetime, timezone
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
from perpmath.strategies import STRATEGIES  # noqa: E402

RUNS = HERE / "runs"
OUT = HERE / "judas-swing_summary.json"
REL = "research/judas-swing"
STEP = 900_000
RANGE_BARS, WINDOW_BARS, PERIOD_BARS = 16, 20, 64           # 4 h, 5 h, 16 h
TEMPLATE_BARS = RANGE_BARS + PERIOD_BARS                      # 80 bars = 20 h
SEED, REPLAYS = 20261122, 500
OOS_START = "2026-07-31"
STRATEGY_DEFAULTS = {"atr_period": 14, "stop_buffer_atr": 0.1, "r_multiple": 2.0}
COSTS = {"published_costs": {"fee_rate": 0.00055, "slippage": 0.0002}, "zero_cost": {"fee_rate": 0.0, "slippage": 0.0}}


# --------------------------------------------------------------------------- #
# The rule
# --------------------------------------------------------------------------- #

def classify(o, h, l, c):
    """One template of 80 bars (16 range, 20 window, 44 more). Returns a dict; see the module docstring."""
    rh, rl = float(np.max(h[:RANGE_BARS])), float(np.min(l[:RANGE_BARS]))
    a, w_end, end = RANGE_BARS, RANGE_BARS + WINDOW_BARS, TEMPLATE_BARS
    anchor_open, last_close = float(o[a]), float(c[end - 1])
    out = {"outcome": None, "direction": None, "break_bar": None, "reclaim_bar": None,
           "closed_against_false_move": None, "opposite_side_reached_by_deadline": None, "risk_reward": None}

    brk = None
    for i in range(a, w_end):
        up, down = h[i] > rh, l[i] < rl
        if up or down:
            brk = i
            break
    if brk is None:
        out["outcome"] = "no_break"
    elif up and down:
        out["outcome"], out["break_bar"] = "both_sides", brk - a
    else:
        direction = 1 if up else -1
        out["direction"], out["break_bar"] = ("up" if up else "down"), brk - a
        rest_low, rest_high = float(np.min(l[brk:end])), float(np.max(h[brk:end]))
        out["opposite_side_reached_by_deadline"] = bool(rest_low < rl) if direction == 1 else bool(rest_high > rh)
        out["closed_against_false_move"] = bool(last_close < anchor_open) if direction == 1 else bool(last_close > anchor_open)
        reclaim = None
        for j in range(brk, w_end):
            if (direction == 1 and c[j] < rh) or (direction == -1 and c[j] > rl):
                reclaim = j
                break
        if reclaim is None:
            out["outcome"] = "break_held"
        else:
            out["reclaim_bar"] = reclaim - a
            extreme = float(np.max(h[brk:reclaim + 1])) if direction == 1 else float(np.min(l[brk:reclaim + 1]))
            to_extreme = abs(extreme - float(c[reclaim]))
            to_other_side = (float(c[reclaim]) - rl) if direction == 1 else (rh - float(c[reclaim]))
            out["risk_reward"] = (to_other_side / to_extreme) if to_extreme > 0 else None
            out["outcome"] = "neither"
            for k in range(reclaim + 1, end):
                beyond = (h[k] > extreme) if direction == 1 else (l[k] < extreme)
                other = (l[k] < rl) if direction == 1 else (h[k] > rh)
                if beyond:                       # also when the same bar reaches the other side: counted as failed
                    out["outcome"] = "failed"
                    break
                if other:
                    out["outcome"] = "completed"
                    break

    # Power of 3 on the 64 bars from the anchor.
    period_h, period_l = h[a:end], l[a:end]
    high, low = float(np.max(period_h)), float(np.min(period_l))
    low_bar, high_bar = int(np.argmin(period_l)), int(np.argmax(period_h))
    third = (high - low) / 3
    bullish = low_bar < WINDOW_BARS and last_close > anchor_open and last_close >= high - third
    bearish = high_bar < WINDOW_BARS and last_close < anchor_open and last_close <= low + third
    out["power_of_3"] = "bullish" if bullish else "bearish" if bearish else None
    out["extreme_against_close_set_in_window"] = bool(low_bar < WINDOW_BARS) if last_close > anchor_open else \
        bool(high_bar < WINDOW_BARS) if last_close < anchor_open else None
    return out


def tally(rows):
    """Counts and rates for a list of classify() results."""
    n = len(rows)
    outcomes = Counter(r["outcome"] for r in rows)
    judas = [r for r in rows if r["outcome"] in ("completed", "failed", "neither")]
    held = [r for r in rows if r["outcome"] == "break_held"]
    one_sided = judas + held
    po3 = Counter(r["power_of_3"] for r in rows)

    def pct(part, whole):
        return round(part / whole * 100, 2) if whole else None

    ratios = [r["risk_reward"] for r in judas if r["risk_reward"] is not None]
    return {
        "days": n,
        "no_break": outcomes["no_break"], "both_sides": outcomes["both_sides"], "break_held": outcomes["break_held"],
        "judas_swings": len(judas), "judas_up": sum(1 for r in judas if r["direction"] == "up"),
        "judas_down": sum(1 for r in judas if r["direction"] == "down"),
        "completed": outcomes["completed"], "failed": outcomes["failed"], "neither": outcomes["neither"],
        "break_pct_of_days": pct(len(one_sided) + outcomes["both_sides"], n),
        "judas_pct_of_days": pct(len(judas), n),
        "reclaim_pct_of_one_sided_breaks": pct(len(judas), len(one_sided)),
        "completed_pct_of_judas": pct(outcomes["completed"], len(judas)),
        "failed_pct_of_judas": pct(outcomes["failed"], len(judas)),
        "neither_pct_of_judas": pct(outcomes["neither"], len(judas)),
        "judas_closed_against_false_move_pct": pct(sum(1 for r in judas if r["closed_against_false_move"]), len(judas)),
        "break_held_closed_against_break_pct": pct(sum(1 for r in held if r["closed_against_false_move"]), len(held)),
        "judas_other_side_reached_by_deadline_pct": pct(sum(1 for r in judas if r["opposite_side_reached_by_deadline"]), len(judas)),
        "break_held_other_side_reached_by_deadline_pct": pct(sum(1 for r in held if r["opposite_side_reached_by_deadline"]), len(held)),
        "median_distance_to_other_side_over_distance_to_extreme": round(statistics.median(ratios), 3) if ratios else None,
        "power_of_3_bullish": po3["bullish"], "power_of_3_bearish": po3["bearish"],
        "power_of_3_pct_of_days": pct(po3["bullish"] + po3["bearish"], n),
        "extreme_against_close_set_in_window_pct": pct(sum(1 for r in rows if r["extreme_against_close_set_in_window"]), n),
    }


# --------------------------------------------------------------------------- #
# The strategy (not shipped with the engine)
# --------------------------------------------------------------------------- #

def switch_day_numbers(ts):
    """New York day numbers on which the clock changes, for the years the data touches."""
    years = range(datetime.fromtimestamp(int(ts[0]) / 1000, tz=timezone.utc).year - 1,
                  datetime.fromtimestamp(int(ts[-1]) / 1000, tz=timezone.utc).year + 2)
    days = set()
    for year in years:
        for instant in nytime.us_dst_bounds_ms(year):
            days.add(int(nytime.ny_day_number(np.array([instant - 1]))[0]))    # the local day the switch happens on
    return days


def judas_generate(bars: Bars, params: dict) -> Signals:
    """Enter against a reclaimed break of the 20:00-00:00 New York range, inside 00:00-05:00. Bar by bar, no look-ahead."""
    n = len(bars)
    signals = Signals.empty(n)
    if n == 0:
        return signals
    high, low, close = bars.high, bars.low, bars.close
    atr_values = atr(high, low, close, params["atr_period"])
    minute = nytime.ny_minute_of_day(bars.ts)
    day = nytime.ny_day_number(bars.ts)
    switch_days = switch_day_numbers(bars.ts)

    range_day, rh, rl, range_count = None, None, None, 0      # the range being built belongs to the NEXT day
    state, direction, extreme = "idle", 0, None
    for i in range(n):
        m, d = int(minute[i]), int(day[i])
        if m >= 1200:                                         # 20:00-23:45: build tomorrow's range
            if range_day != d + 1:
                range_day, rh, rl, range_count = d + 1, float(high[i]), float(low[i]), 1
            else:
                rh, rl, range_count = max(rh, float(high[i])), min(rl, float(low[i])), range_count + 1
            state = "idle"
            continue
        if m >= 300:                                          # after 05:00: nothing to do until the evening
            state = "idle"
            continue
        if range_day != d or range_count != RANGE_BARS or d in switch_days:
            continue                                          # no complete range for today, or a clock-change day
        if m == 0:
            state = "waiting"
        if state == "waiting":
            up, down = high[i] > rh, low[i] < rl
            if up and down:
                state = "done"
                continue
            if not (up or down):
                continue
            direction = 1 if up else -1
            extreme = float(high[i]) if up else float(low[i])
            state = "broken"
        elif state == "broken":
            extreme = max(extreme, float(high[i])) if direction == 1 else min(extreme, float(low[i]))
        if state == "broken":
            reclaimed = close[i] < rh if direction == 1 else close[i] > rl
            if reclaimed:
                state = "done"
                if np.isfinite(atr_values[i]):
                    buffer = params["stop_buffer_atr"] * atr_values[i]
                    signals.side[i] = -direction
                    signals.stop[i] = extreme + buffer if direction == 1 else extreme - buffer
                    signals.target_r[i] = params["r_multiple"]
    return signals


STRATEGIES["judas_swing"] = types.SimpleNamespace(DEFAULTS=dict(STRATEGY_DEFAULTS), generate=judas_generate)


# --------------------------------------------------------------------------- #
# Counting on the real data
# --------------------------------------------------------------------------- #

def anchors(bars):
    """(day number, index of the bar that opens at New York midnight) for the days used."""
    minute = nytime.ny_minute_of_day(bars.ts)
    day = nytime.ny_day_number(bars.ts)
    switch_days = switch_day_numbers(bars.ts)
    out = []
    for i in np.flatnonzero(minute == 0):
        d = int(day[i])
        if d in switch_days:
            continue
        first, last = i - RANGE_BARS, i + 23 * 4 + PERIOD_BARS       # the latest shift needs this many bars
        if first < 0 or last > len(bars):
            continue
        out.append((d, int(i)))
    return out


def template(bars, anchor_index):
    lo, hi = anchor_index - RANGE_BARS, anchor_index + PERIOD_BARS
    return bars.open[lo:hi], bars.high[lo:hi], bars.low[lo:hi], bars.close[lo:hi]


def replay(bars, day_anchors, replays, seed):
    """Baseline b: every day's 80 bars with random directions. Returns tallies per replay, and the no-flip check."""
    rng = np.random.default_rng(seed)
    real = [classify(*template(bars, i)) for _, i in day_anchors]
    per_replay = [[] for _ in range(replays)]
    reproduced = 0
    for (_, i), real_row in zip(day_anchors, real):
        o, h, l, c = template(bars, i)
        r, up, dn = np.log(c / o), np.log(h / o), np.log(l / o)

        def path(signs):
            signed = signs * r
            before = np.cumsum(signed) - signed
            base = float(o[0])
            return (base * np.exp(before), base * np.exp(before + np.where(signs > 0, up, -dn)),
                    base * np.exp(before + np.where(signs > 0, dn, -up)), base * np.exp(before + signed))

        same = classify(*path(np.ones(TEMPLATE_BARS)))
        reproduced += int(same["outcome"] == real_row["outcome"] and same["power_of_3"] == real_row["power_of_3"])
        all_signs = rng.integers(0, 2, size=(replays, TEMPLATE_BARS)) * 2 - 1
        for k in range(replays):
            per_replay[k].append(classify(*path(all_signs[k])))
    tallies = [tally(rows) for rows in per_replay]
    keys = ("judas_pct_of_days", "reclaim_pct_of_one_sided_breaks", "completed_pct_of_judas", "failed_pct_of_judas",
            "judas_closed_against_false_move_pct", "break_held_closed_against_break_pct", "power_of_3_pct_of_days",
            "break_pct_of_days", "extreme_against_close_set_in_window_pct")
    summary = {}
    for key in keys:
        values = np.array([t[key] for t in tallies if t[key] is not None], dtype=np.float64)
        summary[key] = {"mean": round(float(values.mean()), 2), "p2_5": round(float(np.percentile(values, 2.5)), 2),
                        "p97_5": round(float(np.percentile(values, 97.5)), 2)}
    return summary, reproduced, len(real)


def count_all(bars):
    day_anchors = anchors(bars)
    weekday = {d: (d + 3) % 7 for d, _ in day_anchors}
    by_shift = []
    for shift in range(24):
        rows = [(d, classify(*template(bars, i + shift * 4))) for d, i in day_anchors]
        by_shift.append({"shift_hours": shift,
                         "all_days": tally([r for _, r in rows]),
                         "weekdays": tally([r for d, r in rows if weekday[d] < 5]),
                         "weekends": tally([r for d, r in rows if weekday[d] >= 5])})
    keys = ("judas_pct_of_days", "reclaim_pct_of_one_sided_breaks", "completed_pct_of_judas", "failed_pct_of_judas",
            "judas_closed_against_false_move_pct", "power_of_3_pct_of_days", "break_pct_of_days",
            "extreme_against_close_set_in_window_pct")
    comparison = {}
    for group in ("all_days", "weekdays"):
        comparison[group] = {}
        for key in keys:
            values = [row[group][key] for row in by_shift]
            others = sorted(values[1:])
            comparison[group][key] = {
                "shift_0_new_york_midnight": values[0],
                "other_23_min": others[0], "other_23_median": statistics.median(others), "other_23_max": others[-1],
                "rank_of_shift_0_among_24_highest_first": 1 + sum(1 for v in values[1:] if v > values[0]),
            }
    detail = [{"day": nytime.day_number_text(d), **classify(*template(bars, i))} for d, i in day_anchors]
    return day_anchors, by_shift, comparison, detail


def breakdown(detail):
    """Added after the first run: the shift-0 days split by when the break came. No new rule."""
    judas = [r for r in detail if r["outcome"] in ("completed", "failed", "neither")]
    london_start = 8                                              # bar 8 of the window opens at 02:00

    def part(rows):
        counts = Counter(r["outcome"] for r in rows)
        return {"judas_swings": len(rows), "completed": counts["completed"], "failed": counts["failed"],
                "neither": counts["neither"],
                "completed_pct": round(counts["completed"] / len(rows) * 100, 2) if rows else None}

    breaks = [r for r in detail if r["break_bar"] is not None]
    lag = Counter(r["reclaim_bar"] - r["break_bar"] for r in judas)
    out = {
        "days_with_a_break": len(breaks),
        "first_break_before_0200": sum(1 for r in breaks if r["break_bar"] < london_start),
        "first_break_in_london_kill_zone_0200_0500": sum(1 for r in breaks if r["break_bar"] >= london_start),
        "judas_break_before_0200": part([r for r in judas if r["break_bar"] < london_start]),
        "judas_break_in_london_kill_zone": part([r for r in judas if r["break_bar"] >= london_start]),
        "judas_up": part([r for r in judas if r["direction"] == "up"]),
        "judas_down": part([r for r in judas if r["direction"] == "down"]),
        "reclaim_on_the_break_bar_itself": lag[0],
        "reclaim_one_bar_later": lag[1], "reclaim_two_or_more_bars_later": sum(v for k, v in lag.items() if k >= 2),
    }
    assert out["judas_break_before_0200"]["judas_swings"] + out["judas_break_in_london_kill_zone"]["judas_swings"] == len(judas)
    assert out["first_break_before_0200"] + out["first_break_in_london_kill_zone_0200_0500"] == len(breaks)
    return out


# --------------------------------------------------------------------------- #
# Self-checks
# --------------------------------------------------------------------------- #

def hand_day(window, after, last_close=None):
    """Range bars between 99 and 101 (16), then `window` rows (padded to 20 flat bars), then `after` rows
    (padded to 44). Each row is (open, high, low, close)."""
    flat = (100.0, 100.4, 99.6, 100.0)
    rows = [(100.0, 101.0, 99.0, 100.0)] * RANGE_BARS
    rows += list(window) + [flat] * (WINDOW_BARS - len(window))
    rows += list(after) + [flat] * (PERIOD_BARS - WINDOW_BARS - len(after))
    if last_close is not None:
        o, h, l, _ = rows[-1]
        rows[-1] = (o, max(h, last_close), min(l, last_close), last_close)
    return [np.array(col, dtype=np.float64) for col in zip(*rows)]


def self_checks(bars):
    report = {"nytime": nytime.self_test()}
    flat = (100.0, 100.4, 99.6, 100.0)

    # 1. Up judas that completes: break to 101.5, close back at 100.8, later a bar trades down to 98.9.
    r = classify(*hand_day([flat, (100.0, 101.5, 99.9, 100.8)], [(100.0, 100.2, 98.9, 99.2)], last_close=99.2))
    assert (r["outcome"], r["direction"], r["break_bar"], r["reclaim_bar"]) == ("completed", "up", 1, 1), r
    assert r["closed_against_false_move"] is True and r["opposite_side_reached_by_deadline"] is True
    # distance to the other side 100.8 - 99.0 = 1.8, to the extreme 101.5 - 100.8 = 0.7
    assert abs(r["risk_reward"] - 1.8 / 0.7) < 1e-9
    # 2. Up judas that fails: after the reclaim price goes back above 101.5 before reaching 99.
    r = classify(*hand_day([(100.0, 101.5, 99.9, 100.8)], [(100.8, 101.6, 100.5, 101.4), (101.0, 101.2, 98.5, 98.8)]))
    assert r["outcome"] == "failed", r
    #    ... and a bar that does both counts as failed.
    r = classify(*hand_day([(100.0, 101.5, 99.9, 100.8)], [(100.8, 101.6, 98.5, 99.0)]))
    assert r["outcome"] == "failed", r
    # 3. Break that holds: closes above 101 on every bar to the end of the window.
    r = classify(*hand_day([(100.0, 101.5, 99.9, 101.2)] + [(101.2, 101.4, 101.1, 101.2)] * 19, []))
    assert (r["outcome"], r["reclaim_bar"]) == ("break_held", None), r
    #    A reclaim on the first bar AFTER the window does not count.
    r = classify(*hand_day([flat] * 19 + [(100.0, 101.5, 99.9, 101.2)], [(101.2, 101.3, 100.2, 100.5)]))
    assert r["outcome"] == "break_held", r
    # 4. No break; and both sides on one bar.
    assert classify(*hand_day([], []))["outcome"] == "no_break"
    assert classify(*hand_day([(100.0, 101.2, 98.8, 100.0)], []))["outcome"] == "both_sides"
    # 5. Down judas, reclaim two bars after the break, neither side reached afterwards.
    r = classify(*hand_day([(100.0, 100.2, 98.6, 98.8), (98.8, 99.0, 98.4, 98.9), (98.9, 99.6, 98.8, 99.5)], []))
    assert (r["outcome"], r["direction"], r["break_bar"], r["reclaim_bar"]) == ("neither", "down", 0, 2), r
    #    extreme 98.4; distance to other side 101 - 99.5 = 1.5, to extreme 99.5 - 98.4 = 1.1
    assert abs(r["risk_reward"] - 1.5 / 1.1) < 1e-9
    # 6. Power of 3, bullish: low of the period (98.6) inside the window, last close 103 with period range 98.6-103.2.
    r = classify(*hand_day([(100.0, 100.2, 98.6, 98.8), (98.8, 99.6, 98.7, 99.5)], [(99.5, 103.2, 99.4, 103.0)], last_close=103.0))
    assert r["power_of_3"] == "bullish" and r["extreme_against_close_set_in_window"] is True, r
    #    Same day closing in the middle of its range is not one.
    r = classify(*hand_day([(100.0, 100.2, 98.6, 98.8), (98.8, 99.6, 98.7, 99.5)], [(99.5, 103.2, 99.4, 103.0)], last_close=100.5))
    assert r["power_of_3"] is None, r
    #    Low set after the window is not one either.
    r = classify(*hand_day([], [(100.0, 100.2, 98.6, 98.8), (98.8, 103.2, 98.7, 103.0)], last_close=103.0))
    assert r["power_of_3"] is None, r

    t = tally([classify(*hand_day([flat, (100.0, 101.5, 99.9, 100.8)], [(100.0, 100.2, 98.9, 99.2)], last_close=99.2)),
               classify(*hand_day([(100.0, 101.5, 99.9, 100.8)], [(100.8, 101.6, 100.5, 101.4)])),
               classify(*hand_day([], [])),
               classify(*hand_day([(100.0, 101.5, 99.9, 101.2)] + [(101.2, 101.4, 101.1, 101.2)] * 19, []))])
    assert (t["days"], t["judas_swings"], t["completed"], t["failed"], t["no_break"], t["break_held"]) == (4, 2, 1, 1, 1, 1)
    assert t["completed_pct_of_judas"] == 50.0 and t["judas_pct_of_days"] == 50.0
    assert t["reclaim_pct_of_one_sided_breaks"] == round(2 / 3 * 100, 2)

    # 7. The strategy on a hand-made winter day and a summer day: one short at the reclaim bar, stop above the extreme.
    for midnight_utc, label in (("2026-01-15T05:00", "2026-01-15 00:00 EST"), ("2026-07-15T04:00", "2026-07-15 00:00 EDT")):
        o, h, l, c = hand_day([flat, (100.0, 101.5, 99.9, 100.8)], [])
        lead = 40                                                    # flat bars before the range so that ATR exists
        o, h, l, c = (np.concatenate([np.full(lead, v), x]) for v, x in ((100.0, o), (100.4, h), (99.6, l), (100.0, c)))
        a_ms = int(datetime.strptime(midnight_utc, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000)
        ts = a_ms + (np.arange(len(o)) - lead - RANGE_BARS) * STEP
        assert nytime.ny_text(int(ts[lead + RANGE_BARS])) == label
        hand = Bars(ts.astype(np.int64), o, h, l, c, np.ones(len(o)))
        s = judas_generate(hand, STRATEGY_DEFAULTS)
        where = np.flatnonzero(s.side)
        assert where.tolist() == [lead + RANGE_BARS + 1] and s.side[where[0]] == -1, (label, where)
        assert s.stop[where[0]] > 101.5 and s.target_r[where[0]] == 2.0
        # The same bars six hours later on the clock: the break now comes at 06:15, after the window, so no signal.
        shifted = Bars((ts + 6 * 3_600_000).astype(np.int64), o, h, l, c, np.ones(len(o)))
        assert nytime.ny_text(int(shifted.ts[lead + RANGE_BARS + 1]))[11:16] == "06:15"
        assert not judas_generate(shifted, STRATEGY_DEFAULTS).side.any()

    # 8. On the real data the strategy signals exactly on the reclaim bars the counting code finds.
    minute = nytime.ny_minute_of_day(bars.ts)
    day = nytime.ny_day_number(bars.ts)
    switch_days = switch_day_numbers(bars.ts)
    expected = []
    for i in np.flatnonzero(minute == 0):
        if int(day[i]) in switch_days or i - RANGE_BARS < 0 or i + WINDOW_BARS > len(bars):
            continue
        lo = i - RANGE_BARS
        pad = TEMPLATE_BARS - (min(len(bars), lo + TEMPLATE_BARS) - lo)
        cols = [np.concatenate([x[lo:lo + TEMPLATE_BARS], np.full(pad, x[min(len(bars), lo + TEMPLATE_BARS) - 1])])
                for x in (bars.open, bars.high, bars.low, bars.close)]
        row = classify(*cols)
        if row["reclaim_bar"] is not None:
            expected.append(int(i + row["reclaim_bar"]))
    got = np.flatnonzero(judas_generate(bars, STRATEGY_DEFAULTS).side).tolist()
    assert got == expected, (len(got), len(expected))
    report["strategy_signals_equal_reclaim_bars"] = len(got)
    report["hand_made_cases"] = "passed: completed, failed (2), break held (2), no break, both sides, down judas, power of 3 (3), tally, strategy winter and summer"
    return report


# --------------------------------------------------------------------------- #
# Engine runs
# --------------------------------------------------------------------------- #

METRIC_KEYS = ("trades", "insufficient_sample", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct",
               "t_stat", "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "avg_bars_held", "final_equity", "exit_reasons")


def engine_run(cost_label, data_dir, offline):
    name = f"btcusdt-15m-judas-swing.{cost_label}"
    config_path, out_path = RUNS / f"{name}.config.json", RUNS / f"{name}.json"
    if not offline:
        config = {"strategy": "judas_swing", "params": STRATEGY_DEFAULTS,
                  "execution": {**COSTS[cost_label], "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
                  "split": {"oos_start": OOS_START}}
        with open(config_path, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(config, handle, indent=2)
            handle.write("\n")
        if out_path.exists():
            out_path.unlink()
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = cli.main(["backtest", "judas_swing", "--symbol", "BTCUSDT", "--interval", "15m", "--config", str(config_path),
                             "--out", str(out_path), "--data-dir", str(data_dir)])
        if code != 0:
            raise SystemExit(f"engine exited with {code}: {stderr.getvalue().strip()}")
    with open(out_path, encoding="utf-8") as handle:
        document = json.load(handle)
    blocks = {}
    for label in ("in_sample", "out_of_sample"):
        part = document[label]
        stops = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in part["trades"]]
        blocks[label] = {"first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
                         "metrics": {key: part["metrics"][key] for key in METRIC_KEYS}, "signals": part["signals"],
                         "longs": sum(1 for t in part["trades"] if t["side"] == "long"),
                         "shorts": sum(1 for t in part["trades"] if t["side"] == "short"),
                         "entry_to_stop_pct_of_price_median": round(statistics.median(stops), 4) if stops else None}
    return {"name": name, "in_engine": False,
            "command": f"perpmath backtest judas_swing --symbol BTCUSDT --interval 15m "
                       f"--config {REL}/runs/{name}.config.json --out {REL}/runs/{name}.json",
            "engine_version": document["package_version"], "generated_at": document["generated_at"],
            "data": document["data"], "split": document["split"], "lookahead_check": document["timing"]["lookahead_check"],
            **blocks, "warnings": document["warnings"]}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    offline = "--offline" in sys.argv
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    data_dir = engine_root / "data"
    path = cache_path(str(data_dir), "BTCUSDT", "15m")
    bars = load_bars(path)
    assert bool(np.all(np.diff(bars.ts) == STEP)), "missing bars"
    RUNS.mkdir(exist_ok=True)

    checks = self_checks(bars)
    day_anchors, by_shift, comparison, detail = count_all(bars)
    again = count_all(bars)
    assert json.dumps([by_shift, comparison, detail], sort_keys=True) == json.dumps(list(again[1:]), sort_keys=True)
    baseline, reproduced, total = replay(bars, day_anchors, REPLAYS, SEED)
    baseline_again, _, _ = replay(bars, day_anchors, REPLAYS, SEED)
    assert baseline == baseline_again, "the replay is not repeatable"
    assert reproduced == total, (reproduced, total)
    checks["same_output_on_rerun"] = True
    checks["replay_with_no_flips_reproduces_real_days"] = f"{reproduced} of {total}"

    runs = [engine_run(label, data_dir, offline) for label in COSTS]

    summary = {
        "article": "en/judas-swing",
        "note": "judas_swing is defined in judas-swing_research.py and is not shipped with the engine. "
                "Both engine runs went through the engine's command line (perpmath backtest).",
        "preregistered_on": "2026-11-21 (UTC)",
        "engine_version": perpmath.__version__,
        "data": {"file": "BTCUSDT-15m.csv", "sha256": sha256(path), "bars": len(bars),
                 "first_bar": iso_utc(int(bars.ts[0])), "last_bar": iso_utc(int(bars.ts[-1]))},
        "template": {"range_bars": RANGE_BARS, "window_bars": WINDOW_BARS, "period_bars": PERIOD_BARS,
                     "range_new_york": "20:00-00:00", "window_new_york": "00:00-05:00", "deadline_new_york": "16:00"},
        "days": {"count": len(day_anchors), "first": nytime.day_number_text(day_anchors[0][0]),
                 "last": nytime.day_number_text(day_anchors[-1][0]),
                 "weekdays": sum(1 for d, _ in day_anchors if (d + 3) % 7 < 5),
                 "weekends": sum(1 for d, _ in day_anchors if (d + 3) % 7 >= 5),
                 "left_out_clock_change_days": ["2026-03-08", "2026-11-01"]},
        "self_checks": checks,
        "new_york_midnight": by_shift[0],
        "new_york_midnight_breakdown_added_after_first_run": breakdown(detail),
        "comparison_with_other_clock_times": comparison,
        "by_shift": by_shift,
        "baseline_random_directions": {"replays": REPLAYS, "seed": SEED, "all_days": baseline},
        "engine_runs": runs,
        "days_detail": detail,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")

    print("self-checks passed:", json.dumps(checks))
    print("days:", json.dumps(summary["days"]))
    for group in ("all_days", "weekdays", "weekends"):
        print(group, json.dumps(by_shift[0][group]))
    print("comparison:", json.dumps(comparison, indent=1))
    print("random directions:", json.dumps(baseline, indent=1))
    print(f"{'shift':>5}{'judas %':>9}{'reclaim %':>11}{'completed %':>13}{'failed %':>10}{'against %':>11}{'PO3 %':>8}")
    for row in by_shift:
        t = row["all_days"]
        print(f"{row['shift_hours']:>5}{t['judas_pct_of_days']:>9}{t['reclaim_pct_of_one_sided_breaks']:>11}"
              f"{t['completed_pct_of_judas']:>13}{t['failed_pct_of_judas']:>10}{t['judas_closed_against_false_move_pct']:>11}"
              f"{t['power_of_3_pct_of_days']:>8}")
    for run in runs:
        for label in ("in_sample", "out_of_sample"):
            m = run[label]["metrics"]
            print(f"{run['name']:44}{label:14} trades {m['trades']:>4} win {m['win_rate_pct']} avgR {m['avg_r']} "
                  f"t {m['t_stat']} return {m['total_return_pct']} maxDD {m['max_drawdown_pct']}")
    print(f"wrote {REL}/judas-swing_summary.json")


if __name__ == "__main__":
    main()
