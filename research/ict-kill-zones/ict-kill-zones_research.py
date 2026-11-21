import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/ict-kill-zones: is BTCUSDT busier inside the ICT kill zones?

Reads the engine's cached candle file (BTCUSDT 15m, 2025-11-18 11:30 UTC to
2026-11-18 11:30 UTC, the file behind every published backtest) and the two
shipped result files with every trade. Nothing is downloaded and the engine
folder is only read. Needs numpy (the engine's Python has it).

------------------------------------------------------------------------------
Written down on 2026-11-21 (UTC) before the first run on the data. Run once.
------------------------------------------------------------------------------

Clock. Every bar's open time is converted to New York wall-clock time with
nytime.py (EST until 8 March 2026, EDT until 1 November 2026, EST after). A
"day" is a New York calendar day, midnight to midnight, because the sources
anchor to the midnight New York open. Only days fully inside the data are
used: 2025-11-19 to 2026-11-17, 364 days. The two days on which the clock
changes have 92 and 100 bars; they stay in the hourly averages (each bar is
labelled with its own wall-clock hour) and are left out of everything that
needs a 96-bar day (where the day's high and low fell, and its baseline).

Windows compared (New York time, start <= bar open < end), each as its source
gives it. Checked 2026-11-22; URLs in ict-kill-zones_sources.json.

    London open    02:00-05:00  LuxAlgo library, Equiti, two TradingView scripts
    London open    03:00-06:00  LiteFinance (its table is headed EDT)
    New York       07:00-10:00  LuxAlgo library, Equiti
    New York       08:00-11:00  LiteFinance
    New York       08:30-11:00  LuxAlgo's index-futures variant, mahirtrade script
    New York       08:30-11:30  TakingProphets script
    London close   10:00-12:00  LuxAlgo library
    London close   11:00-13:00  LiteFinance
    New York PM    13:30-16:00  LuxAlgo library, mahirtrade script
    New York PM    13:30-18:00  TakingProphets script
    Asian          20:00-24:00  LuxAlgo library (calculation section), both scripts
    Asian          20:00-23:00  LiteFinance
    Asian          20:00-22:00  LuxAlgo library (introduction, "roughly")
    New York lunch 12:00-13:00  TakingProphets script, named as the quiet hour

Measurements.

  1. Per New York clock hour (24 rows) and per 15-minute slot (96): mean range
     of a 15-minute bar, (high - low) / open; share of the year's turnover
     (USDT); number of days whose high, and whose low, was set in that hour
     (first bar to reach it). All days, weekdays (Monday to Friday by New
     York date) and weekends separately.
  2. Per window: its share of the clock, its share of turnover, mean bar range
     inside it divided by the mean of all bars, and the share of the days'
     highs and lows set inside it.
  3. Baseline for "where the high and low fall". Two things put extremes in a
     window without the window being special: it is long, and it is volatile.
     A third is built into the question: on a random walk the high and low of
     a period fall near its start and end more often than in the middle (the
     arcsine law). So each day is replayed 2,000 times with the direction of
     every 15-minute bar flipped at random (seed 20261122). That keeps each
     bar's size, its place in the day and the day's volatility pattern, and
     removes any tendency for a move to reverse or continue. The expected
     share of extremes per window is the average over the replays.
  4. Does the pattern follow New York's clock or UTC? The data spans two clock
     changes. If activity follows New York, the busiest 15-minute slot of the
     UTC day sits one hour earlier during daylight time.
     Prediction written before the run: the slot with the largest mean range
     is 14:30 UTC in the EST months and 13:30 UTC in the EDT months (both
     09:30 New York, the US stock market open).
  5. The engine's published fvg and liquidity_sweep trades, split by whether
     the entry (the fill, at the open of the bar after the signal) falls
     inside a window. THIS SPLIT IS MADE AFTER THE FACT, on trades from rules
     that have no clock in them. It can show whether the same rule did better
     in some hours; it is not a test of a kill-zone strategy, and with this
     many groups some will look better by chance.

Self-checks (the script stops if one fails): nytime.self_test(); a hand-made
two-day example for the hour table and the window shares; a hand-worked
two-bar example for the sign-flip replay; the replay with no flips must
reproduce the real extremes; hourly counts must add up to the number of days
and turnover shares to 100%; the t-statistic used for the trade groups must
reproduce the engine's own figure for the whole sample; the whole computation
is run twice and must give identical output.

Usage, from the site's root folder (engine checked out next to it):
    ../perpmath-engine/.venv/Scripts/python research/ict-kill-zones/ict-kill-zones_research.py [path-to-engine]

Output: research/ict-kill-zones/ict-kill-zones_summary.json
"""
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import nytime  # noqa: E402

OUT = HERE / "ict-kill-zones_summary.json"
SEED = 20261122
REPLAYS = 2000
BAR_MINUTES = 15

WINDOWS = [
    # key, label, start, end, sources
    ("london_0200_0500", "London open", "02:00", "05:00", ["LuxAlgo library", "Equiti", "mahirtrade script", "TakingProphets script"]),
    ("london_0300_0600", "London open", "03:00", "06:00", ["LiteFinance"]),
    ("ny_0700_1000", "New York", "07:00", "10:00", ["LuxAlgo library", "Equiti"]),
    ("ny_0800_1100", "New York", "08:00", "11:00", ["LiteFinance"]),
    ("ny_0830_1100", "New York", "08:30", "11:00", ["LuxAlgo library (index-futures variant)", "mahirtrade script"]),
    ("ny_0830_1130", "New York", "08:30", "11:30", ["TakingProphets script"]),
    ("london_close_1000_1200", "London close", "10:00", "12:00", ["LuxAlgo library"]),
    ("london_close_1100_1300", "London close", "11:00", "13:00", ["LiteFinance"]),
    ("ny_pm_1330_1600", "New York PM", "13:30", "16:00", ["LuxAlgo library", "mahirtrade script"]),
    ("ny_pm_1330_1800", "New York PM", "13:30", "18:00", ["TakingProphets script"]),
    ("asian_2000_2400", "Asian", "20:00", "24:00", ["LuxAlgo library (calculation section)", "mahirtrade script", "TakingProphets script"]),
    ("asian_2000_2300", "Asian", "20:00", "23:00", ["LiteFinance"]),
    ("asian_2000_2200", "Asian", "20:00", "22:00", ["LuxAlgo library (introduction)"]),
    ("ny_lunch_1200_1300", "New York lunch (named as quiet)", "12:00", "13:00", ["TakingProphets script"]),
]
LUXALGO_SET = ["london_0200_0500", "ny_0700_1000", "london_close_1000_1200", "ny_pm_1330_1600", "asian_2000_2400"]
ALL_KILL_ZONES = [w[0] for w in WINDOWS if w[0] != "ny_lunch_1200_1300"]
TRADE_GROUP_WINDOWS = ["london_0200_0500", "ny_0700_1000", "london_close_1000_1200", "ny_pm_1330_1600", "asian_2000_2400"]


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_candles(path):
    with open(path, newline="", encoding="ascii") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        assert header == ["open_time_ms", "open", "high", "low", "close", "volume", "turnover"], header
        rows = [(int(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5]), float(r[6])) for r in reader]
    cols = list(zip(*rows))
    return {"ts": np.array(cols[0], dtype=np.int64), "open": np.array(cols[1]), "high": np.array(cols[2]),
            "low": np.array(cols[3]), "close": np.array(cols[4]), "volume": np.array(cols[5]),
            "turnover": np.array(cols[6])}


def iso(ms):
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def window_mask(minute, key):
    spec = next(w for w in WINDOWS if w[0] == key)
    return nytime.in_window(minute, nytime.hhmm(spec[2]), nytime.hhmm(spec[3]))


def union_mask(minute, keys):
    out = np.zeros(len(minute), dtype=bool)
    for key in keys:
        out |= window_mask(minute, key)
    return out


# --------------------------------------------------------------------------- #
# Measurements
# --------------------------------------------------------------------------- #

def full_days(c):
    """Mask of bars that belong to a New York day lying wholly inside the data, and that day's number per bar."""
    day = nytime.ny_day_number(c["ts"])
    keep = (day > day[0]) & (day < day[-1])
    return keep, day


def extremes_by_day(c, keep, day):
    """For every full 96-bar day: slot (0..95) of the first bar that set the day's high, and the low."""
    rows = []
    for d in np.unique(day[keep]):
        index = np.flatnonzero(day == d)
        if len(index) != 96:
            continue                                      # the two clock-change days
        rows.append((int(d), int(np.argmax(c["high"][index])), int(np.argmin(c["low"][index])), index))
    return rows


def hour_table(c, keep, day, minute, weekday, which):
    """24 rows of New York clock hours. `which` is 'all', 'weekday' or 'weekend'."""
    select = keep.copy()
    if which == "weekday":
        select &= weekday < 5
    elif which == "weekend":
        select &= weekday >= 5
    bar_range = (c["high"] - c["low"]) / c["open"] * 100
    hour = minute // 60
    all_mean = float(bar_range[select].mean())
    all_turnover = float(c["turnover"][select].sum())
    days = extremes_by_day(c, select, day)
    highs = np.bincount([h // 4 for _, h, _, _ in days], minlength=24)
    lows = np.bincount([l // 4 for _, _, l, _ in days], minlength=24)
    rows = []
    for h in range(24):
        inside = select & (hour == h)
        rows.append({
            "hour_ny": h,
            "bars": int(inside.sum()),
            "mean_bar_range_pct": round(float(bar_range[inside].mean()), 4),
            "range_vs_all_hours": round(float(bar_range[inside].mean()) / all_mean, 3),
            "turnover_share_pct": round(float(c["turnover"][inside].sum()) / all_turnover * 100, 2),
            "day_highs": int(highs[h]), "day_lows": int(lows[h]),
        })
    return {"days_in_hourly_means": int(len(np.unique(day[select]))), "days_with_96_bars": len(days),
            "bars": int(select.sum()), "mean_bar_range_pct_all_hours": round(all_mean, 4), "rows": rows}


def slot_table(c, select, minute_of_day_local_or_utc):
    """Mean bar range per 15-minute slot of some clock. Returns 96 values."""
    bar_range = (c["high"] - c["low"]) / c["open"] * 100
    slot = minute_of_day_local_or_utc // BAR_MINUTES
    return [round(float(bar_range[select & (slot == s)].mean()), 4) for s in range(96)]


def sign_flip_slots(r, up, dn, signs):
    """Slot of the high and of the low of one replayed day.

    r, up, dn: per bar, log of close/open, high/open and low/open. signs: +1 keeps a bar, -1 mirrors it
    around its open (its fall becomes a rise of the same size). Bars are chained close to open.
    Works on arrays with a leading replay axis.
    """
    signed_r = signs * r
    before = np.cumsum(signed_r, axis=-1) - signed_r           # log price at each bar's open, day's open = 0
    high_path = before + np.where(signs > 0, up, -dn)
    low_path = before + np.where(signs > 0, dn, -up)
    return np.argmax(high_path, axis=-1), np.argmin(low_path, axis=-1)


def baseline(c, days, replays, seed):
    """Expected slot of the day's high and low when only bar sizes and their order are kept."""
    rng = np.random.default_rng(seed)
    high_counts = np.zeros((replays, 96), dtype=np.int32)
    low_counts = np.zeros((replays, 96), dtype=np.int32)
    reproduced = 0
    for _, real_high, real_low, index in days:
        o = c["open"][index]
        r, up, dn = np.log(c["close"][index] / o), np.log(c["high"][index] / o), np.log(c["low"][index] / o)
        h0, l0 = sign_flip_slots(r, up, dn, np.ones(96))
        reproduced += int(h0 == real_high) + int(l0 == real_low)
        signs = rng.integers(0, 2, size=(replays, 96)) * 2 - 1
        h, l = sign_flip_slots(r, up, dn, signs)
        high_counts[np.arange(replays), h] += 1
        low_counts[np.arange(replays), l] += 1
    return high_counts, low_counts, reproduced


def window_rows(c, keep, day, minute, days, high_counts, low_counts):
    bar_range = (c["high"] - c["low"]) / c["open"] * 100
    all_mean = float(bar_range[keep].mean())
    all_turnover = float(c["turnover"][keep].sum())
    slot_minutes = np.arange(96) * BAR_MINUTES
    n_extremes = 2 * len(days)
    real_high = np.bincount([h for _, h, _, _ in days], minlength=96)
    real_low = np.bincount([l for _, _, l, _ in days], minlength=96)

    def row(key, label, slots_inside, bars_inside, extra):
        hours = float(slots_inside.sum()) * BAR_MINUTES / 60
        observed = int(real_high[slots_inside].sum() + real_low[slots_inside].sum())
        simulated = (high_counts[:, slots_inside].sum(axis=1) + low_counts[:, slots_inside].sum(axis=1)) / n_extremes * 100
        return {
            "key": key, "label": label, **extra,
            "hours": hours, "clock_share_pct": round(hours / 24 * 100, 2),
            "turnover_share_pct": round(float(c["turnover"][bars_inside].sum()) / all_turnover * 100, 2),
            "range_vs_all_hours": round(float(bar_range[bars_inside].mean()) / all_mean, 3),
            "day_highs_inside": int(real_high[slots_inside].sum()), "day_lows_inside": int(real_low[slots_inside].sum()),
            "extremes_share_pct": round(observed / n_extremes * 100, 2),
            "extremes_share_expected_pct": round(float(simulated.mean()), 2),
            "extremes_share_expected_p2_5": round(float(np.percentile(simulated, 2.5)), 2),
            "extremes_share_expected_p97_5": round(float(np.percentile(simulated, 97.5)), 2),
            "observed_minus_expected_points": round(observed / n_extremes * 100 - float(simulated.mean()), 2),
        }

    rows = []
    for key, label, start, end, sources in WINDOWS:
        slots = nytime.in_window(slot_minutes, nytime.hhmm(start), nytime.hhmm(end))
        rows.append(row(key, label, slots, keep & window_mask(minute, key),
                        {"start_ny": start, "end_ny": end, "sources": sources}))
    for key, label, keys in (("union_luxalgo_five", "Any of LuxAlgo's five windows", LUXALGO_SET),
                             ("union_all_sources", "Any kill zone from any source above", ALL_KILL_ZONES)):
        slots = union_mask(slot_minutes, keys)
        rows.append(row(key, label, slots, keep & union_mask(minute, keys), {"members": keys}))
        outside = ~slots
        rows.append(row(key.replace("union", "outside"), "Outside: " + label.lower(), outside,
                        keep & ~union_mask(minute, keys), {"members_excluded": keys}))
    return rows


def dst_test(c, keep):
    """Busiest 15-minute slot of the UTC day, separately for the EST and the EDT part of the data."""
    offset = nytime.ny_offset_hours(c["ts"])
    utc_minute = (c["ts"] % nytime.DAY_MS) // 60_000
    out = {}
    for label, hours in (("est", -5), ("edt", -4)):
        select = keep & (offset == hours)
        slots = slot_table(c, select, utc_minute)
        order = np.argsort(slots)[::-1]
        top = [{"utc": f"{int(s) * 15 // 60:02d}:{int(s) * 15 % 60:02d}",
                "ny": f"{(int(s) * 15 // 60 + hours) % 24:02d}:{int(s) * 15 % 60:02d}",
                "mean_bar_range_pct": slots[int(s)]} for s in order[:5]]
        out[label] = {"bars": int(select.sum()), "first_bar": iso(c["ts"][select][0]), "last_bar": iso(c["ts"][select][-1]),
                      "top_5_utc_slots": top,
                      "mean_range_at_1330_utc": slots[54], "mean_range_at_1430_utc": slots[58],
                      "mean_range_at_1230_utc": slots[50], "mean_range_all_slots": round(float(np.mean(slots)), 4)}
    out["prediction"] = "busiest slot 14:30 UTC in the EST months and 13:30 UTC in the EDT months (both 09:30 New York)"
    out["prediction_held"] = (out["est"]["top_5_utc_slots"][0]["utc"] == "14:30"
                              and out["edt"]["top_5_utc_slots"][0]["utc"] == "13:30")
    return out


def t_stat(values):
    values = np.asarray(values, dtype=np.float64)
    if len(values) < 2 or float(np.std(values, ddof=1)) == 0.0:
        return None
    return float(np.mean(values)) / (float(np.std(values, ddof=1)) / math.sqrt(len(values)))


def group_stats(trades):
    n = len(trades)
    if n == 0:
        return {"trades": 0, "insufficient_sample": True, "win_rate_pct": None, "avg_r": None,
                "avg_trade_return_pct": None, "t_stat": None}
    returns = [t["return_pct"] for t in trades]
    t = t_stat(returns)
    return {"trades": n, "insufficient_sample": n < 100,
            "win_rate_pct": round(sum(1 for x in trades if x["pnl"] > 0) / n * 100, 2),
            "avg_r": round(float(np.mean([x["r_multiple"] for x in trades])), 4),
            "avg_trade_return_pct": round(float(np.mean(returns)), 4),
            "t_stat": round(t, 3) if t is not None else None}


def trade_groups(document):
    out = {}
    for sample in ("in_sample", "out_of_sample", "both"):
        trades = (document["in_sample"]["trades"] + document["out_of_sample"]["trades"]) if sample == "both" \
            else document[sample]["trades"]
        ts = np.array([int(datetime.strptime(t["entry_time"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)
                       for t in trades], dtype=np.int64)
        minute = nytime.ny_minute_of_day(ts)
        weekday = nytime.ny_weekday(ts)
        groups = {"all": group_stats(trades)}
        for key in TRADE_GROUP_WINDOWS:
            inside = window_mask(minute, key)
            groups[key] = group_stats([t for t, m in zip(trades, inside) if m])
        any_lux = union_mask(minute, LUXALGO_SET)
        core = union_mask(minute, ["london_0200_0500", "ny_0700_1000"])
        groups["inside_any_luxalgo_window"] = group_stats([t for t, m in zip(trades, any_lux) if m])
        groups["outside_all_luxalgo_windows"] = group_stats([t for t, m in zip(trades, any_lux) if not m])
        groups["inside_london_or_new_york"] = group_stats([t for t, m in zip(trades, core) if m])
        groups["outside_london_and_new_york"] = group_stats([t for t, m in zip(trades, core) if not m])
        groups["weekday"] = group_stats([t for t, w in zip(trades, weekday) if w < 5])
        groups["weekend"] = group_stats([t for t, w in zip(trades, weekday) if w >= 5])
        assert groups["inside_any_luxalgo_window"]["trades"] + groups["outside_all_luxalgo_windows"]["trades"] == len(trades)
        assert groups["weekday"]["trades"] + groups["weekend"]["trades"] == len(trades)
        if sample != "both":
            shipped = document[sample]["metrics"]
            assert groups["all"]["trades"] == shipped["trades"]
            assert abs(groups["all"]["t_stat"] - shipped["t_stat"]) < 2e-3, (groups["all"]["t_stat"], shipped["t_stat"])
            assert abs(groups["all"]["avg_r"] - shipped["avg_r"]) < 2e-4
            assert abs(groups["all"]["win_rate_pct"] - shipped["win_rate_pct"]) < 6e-3
        out[sample] = groups
    return out


# --------------------------------------------------------------------------- #
# Self-checks
# --------------------------------------------------------------------------- #

def self_checks():
    report = {"nytime": nytime.self_test()}

    # Sign-flip replay on a two-bar day, worked by hand in the module docstring's terms.
    r, up, dn = np.array([0.01, -0.03]), np.array([0.02, 0.001]), np.array([-0.005, -0.04])
    #   no flip:      highs at 0.02 and 0.01 + 0.001 -> bar 0;  lows at -0.005 and 0.01 - 0.04 -> bar 1
    assert [int(x) for x in sign_flip_slots(r, up, dn, np.array([1, 1]))] == [0, 1]
    #   flip bar 0:   bar 0 becomes r -0.01, up 0.005, dn -0.02; highs 0.005, -0.009 -> bar 0; lows -0.02, -0.05 -> bar 1
    assert [int(x) for x in sign_flip_slots(r, up, dn, np.array([-1, 1]))] == [0, 1]
    #   flip bar 1:   bar 1 becomes r +0.03, up 0.04, dn -0.001; highs 0.02, 0.05 -> bar 1; lows -0.005, 0.009 -> bar 0
    assert [int(x) for x in sign_flip_slots(r, up, dn, np.array([1, -1]))] == [1, 0]
    #   and with a replay axis
    both = sign_flip_slots(r, up, dn, np.array([[1, 1], [1, -1]]))
    assert both[0].tolist() == [0, 1] and both[1].tolist() == [1, 0]

    # Hour table and window shares on two hand-made New York days in January (EST, UTC-5),
    # padded with a partial day on each side so that both count as full days.
    step = 900_000
    start = int(datetime(2026, 1, 13, 5, 0, tzinfo=timezone.utc).timestamp() * 1000) - 4 * step   # 23:00 EST on the 12th
    n = 4 + 96 * 2 + 4
    ts = start + np.arange(n) * step
    c = {"ts": ts, "open": np.full(n, 100.0), "high": np.full(n, 100.5), "low": np.full(n, 99.5),
         "close": np.full(n, 100.0), "volume": np.ones(n), "turnover": np.full(n, 100.0)}
    minute = nytime.ny_minute_of_day(ts)
    day = nytime.ny_day_number(ts)
    first_day = np.flatnonzero(day == day[4])
    second_day = np.flatnonzero(day == day[4 + 96])
    assert len(first_day) == 96 and len(second_day) == 96 and minute[4] == 0
    # Day 1: high set at 09:30 (slot 38), low at 03:15 (slot 13). Day 2: high at 02:00 (slot 8), low at 14:00 (slot 56).
    c["high"][first_day[38]] = 103.0
    c["low"][first_day[13]] = 98.0
    c["high"][second_day[8]] = 102.0
    c["low"][second_day[56]] = 97.0
    # The 09:30 bar of day 1 also trades 3x the usual turnover.
    c["turnover"][first_day[38]] = 300.0
    keep, day = full_days(c)
    assert int(keep.sum()) == 192
    table = hour_table(c, keep, day, minute, nytime.ny_weekday(ts), "all")
    assert table["days_with_96_bars"] == 2
    assert [row["day_highs"] for row in table["rows"]][9] == 1 and [row["day_highs"] for row in table["rows"]][2] == 1
    assert [row["day_lows"] for row in table["rows"]][3] == 1 and [row["day_lows"] for row in table["rows"]][14] == 1
    assert sum(row["day_highs"] for row in table["rows"]) == 2 and sum(row["day_lows"] for row in table["rows"]) == 2
    # Hour 9 holds 8 bars: 7 ordinary (range 1.0) and one with high 103 (range 3.5) -> mean 1.3125 %.
    assert table["rows"][9]["mean_bar_range_pct"] == 1.3125
    # Turnover: 191 bars of 100 and one of 300 = 19,400. Hour 9: 7 x 100 + 300 = 1,000 -> 5.15 %.
    assert table["rows"][9]["turnover_share_pct"] == round(1000 / 19400 * 100, 2)
    days = extremes_by_day(c, keep, day)
    assert [(h, l) for _, h, l, _ in days] == [(38, 13), (8, 56)]
    high_counts, low_counts, reproduced = baseline(c, days, 50, SEED)
    assert reproduced == 4
    rows = {row["key"]: row for row in window_rows(c, keep, day, minute, days, high_counts, low_counts)}
    # 02:00-05:00 holds day 2's high (02:00) and day 1's low (03:15): 2 of 4 extremes; 12 of 96 slots.
    assert rows["london_0200_0500"]["extremes_share_pct"] == 50.0 and rows["london_0200_0500"]["clock_share_pct"] == 12.5
    # 07:00-10:00 holds day 1's high (09:30) only.
    assert rows["ny_0700_1000"]["day_highs_inside"] == 1 and rows["ny_0700_1000"]["day_lows_inside"] == 0
    # 13:30-16:00 holds day 2's low (14:00).
    assert rows["ny_pm_1330_1600"]["day_lows_inside"] == 1
    assert rows["union_luxalgo_five"]["hours"] == 14.5 and rows["outside_luxalgo_five"]["hours"] == 9.5
    assert rows["union_luxalgo_five"]["extremes_share_pct"] == 100.0
    assert abs(rows["union_luxalgo_five"]["turnover_share_pct"] + rows["outside_luxalgo_five"]["turnover_share_pct"] - 100) < 0.02

    assert abs(t_stat([1.0, 2.0, 3.0]) - 2.0 / (1.0 / math.sqrt(3))) < 1e-12        # mean 2, sd 1, n 3
    assert t_stat([1.0]) is None and t_stat([2.0, 2.0]) is None
    report["hand_made_cases"] = "passed: sign-flip replay (3 cases), two-day hour table, window shares, t-statistic"
    return report


# --------------------------------------------------------------------------- #

def compute(engine):
    data_path = engine / "data" / "BTCUSDT-15m.csv"
    c = load_candles(data_path)
    documents = {name: json.load(open(engine / "results" / f"{name}-btcusdt.json", encoding="utf-8"))
                 for name in ("fvg", "liquidity-sweep")}
    data_sha = sha256(data_path)
    for document in documents.values():
        assert document["data"]["file_sha256"] == data_sha, "candle file is not the one behind the shipped results"
    assert bool(np.all(np.diff(c["ts"]) == 900_000)), "missing bars"

    keep, day = full_days(c)
    minute = nytime.ny_minute_of_day(c["ts"])
    weekday = nytime.ny_weekday(c["ts"])
    tables = {which: hour_table(c, keep, day, minute, weekday, which) for which in ("all", "weekday", "weekend")}
    for table in tables.values():
        assert sum(r["day_highs"] for r in table["rows"]) == table["days_with_96_bars"]
        assert sum(r["day_lows"] for r in table["rows"]) == table["days_with_96_bars"]
        assert abs(sum(r["turnover_share_pct"] for r in table["rows"]) - 100) < 0.2

    days = extremes_by_day(c, keep, day)
    high_counts, low_counts, reproduced = baseline(c, days, REPLAYS, SEED)
    rows = window_rows(c, keep, day, minute, days, high_counts, low_counts)

    # Hour-level baseline, for the hour table.
    hour_expected = []
    for h in range(24):
        slots = slice(h * 4, h * 4 + 4)
        hour_expected.append({
            "hour_ny": h,
            "day_highs_expected": round(float(high_counts[:, slots].sum(axis=1).mean()), 1),
            "day_lows_expected": round(float(low_counts[:, slots].sum(axis=1).mean()), 1),
            "extremes_observed": tables["all"]["rows"][h]["day_highs"] + tables["all"]["rows"][h]["day_lows"],
            "extremes_expected": round(float((high_counts[:, slots].sum(axis=1) + low_counts[:, slots].sum(axis=1)).mean()), 1),
            "extremes_expected_p2_5": float(np.percentile(high_counts[:, slots].sum(axis=1) + low_counts[:, slots].sum(axis=1), 2.5)),
            "extremes_expected_p97_5": float(np.percentile(high_counts[:, slots].sum(axis=1) + low_counts[:, slots].sum(axis=1), 97.5)),
        })

    # Added after the first run, descriptive only: every three-hour block that starts on the hour,
    # so the article can say where the busiest and quietest three hours of the clock are.
    bar_range = (c["high"] - c["low"]) / c["open"] * 100
    blocks = {}
    for which, select in (("all", keep), ("weekday", keep & (weekday < 5)), ("weekend", keep & (weekday >= 5))):
        block_rows = []
        for h in range(24):
            inside = select & np.isin(minute // 60, [(h + k) % 24 for k in range(3)])
            block_rows.append({"start_hour_ny": h,
                               "range_vs_all_hours": round(float(bar_range[inside].mean()) / float(bar_range[select].mean()), 3),
                               "turnover_share_pct": round(float(c["turnover"][inside].sum()) / float(c["turnover"][select].sum()) * 100, 2)})
        blocks[which] = {"busiest_by_range": max(block_rows, key=lambda r: r["range_vs_all_hours"]),
                         "quietest_by_range": min(block_rows, key=lambda r: r["range_vs_all_hours"]),
                         "rows": block_rows}

    switch_days = [nytime.day_number_text(d) for d in np.unique(day[keep]) if int(np.count_nonzero(day == d)) != 96]
    london_minus_ny = nytime.london_offset_hours(c["ts"]) - nytime.ny_offset_hours(c["ts"])
    mismatch_days = sorted({nytime.day_number_text(d) for d in np.unique(day[keep & (london_minus_ny != 5)])})

    return {
        "article": "en/ict-kill-zones",
        "preregistered_on": "2026-11-21 (UTC)",
        "data": {"file": "BTCUSDT-15m.csv", "sha256": data_sha, "bars": int(len(c["ts"])),
                 "first_bar": iso(c["ts"][0]), "last_bar": iso(c["ts"][-1]),
                 "full_new_york_days": int(len(np.unique(day[keep]))),
                 "first_full_day": nytime.day_number_text(day[keep][0]), "last_full_day": nytime.day_number_text(day[keep][-1]),
                 "clock_change_days_left_out_of_day_extremes": switch_days,
                 "days_with_96_bars": len(days),
                 "weekday_days": tables["weekday"]["days_in_hourly_means"], "weekend_days": tables["weekend"]["days_in_hourly_means"],
                 "days_london_is_not_5h_ahead_of_new_york": {"count": len(mismatch_days),
                                                              "first": mismatch_days[0] if mismatch_days else None,
                                                              "last": mismatch_days[-1] if mismatch_days else None,
                                                              "list": mismatch_days}},
        "hour_table_new_york_time": tables,
        "hour_table_extremes_baseline": hour_expected,
        "three_hour_blocks_added_after_first_run": blocks,
        "slot_mean_bar_range_pct_new_york_time": slot_table(c, keep, minute),
        "baseline": {"method": "each 96-bar day replayed with every 15-minute bar's direction flipped at random",
                     "replays": REPLAYS, "seed": SEED,
                     "real_extremes_reproduced_with_no_flips": reproduced, "of": 2 * len(days)},
        "windows": rows,
        "dst_test": dst_test(c, keep),
        "trades_by_entry_time": {
            "warning": "Grouping made after the fact on trades from rules with no clock in them. Not a kill-zone strategy test.",
            "fvg": trade_groups(documents["fvg"]),
            "liquidity_sweep": trade_groups(documents["liquidity-sweep"]),
            "result_files": {name: {"generated_at": d["generated_at"], "package_version": d["package_version"]}
                             for name, d in documents.items()},
        },
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else HERE.parents[2] / "perpmath-engine"
    checks = self_checks()
    first = compute(engine)
    second = compute(engine)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True), "two runs on the same data differ"
    checks["same_output_on_rerun"] = True
    checks["hour_counts_add_up"] = True
    checks["t_stat_reproduces_engine"] = True
    reproduced, total = first["baseline"]["real_extremes_reproduced_with_no_flips"], first["baseline"]["of"]
    assert reproduced / total >= 0.99, (reproduced, total)
    first["self_checks"] = checks
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(first, handle, indent=1)
        handle.write("\n")

    print("self-checks passed:", json.dumps(checks))
    print(f"full New York days: {first['data']['full_new_york_days']}, with 96 bars: {first['data']['days_with_96_bars']}")
    print(f"{'hour NY':>8}{'range %':>9}{'vs all':>8}{'turnover %':>12}{'highs':>7}{'lows':>6}{'exp. extremes':>15}")
    for row, exp in zip(first["hour_table_new_york_time"]["all"]["rows"], first["hour_table_extremes_baseline"]):
        print(f"{row['hour_ny']:>8}{row['mean_bar_range_pct']:>9.4f}{row['range_vs_all_hours']:>8.3f}"
              f"{row['turnover_share_pct']:>12.2f}{row['day_highs']:>7}{row['day_lows']:>6}{exp['extremes_expected']:>15.1f}")
    print(f"{'window':34}{'clock %':>9}{'turnover %':>12}{'range x':>9}{'extremes %':>12}{'expected %':>12}{'[2.5, 97.5]':>16}")
    for row in first["windows"]:
        name = f"{row['label'][:20]} {row.get('start_ny', '')}-{row.get('end_ny', '')}" if "start_ny" in row else row["key"]
        print(f"{name:34}{row['clock_share_pct']:>9.2f}{row['turnover_share_pct']:>12.2f}{row['range_vs_all_hours']:>9.3f}"
              f"{row['extremes_share_pct']:>12.2f}{row['extremes_share_expected_pct']:>12.2f}"
              f"{'[' + str(row['extremes_share_expected_p2_5']) + ', ' + str(row['extremes_share_expected_p97_5']) + ']':>16}")
    print("DST test:", json.dumps(first["dst_test"], indent=1))
    for strategy in ("fvg", "liquidity_sweep"):
        for sample in ("in_sample", "out_of_sample", "both"):
            for key, g in first["trades_by_entry_time"][strategy][sample].items():
                print(f"{strategy:16}{sample:14}{key:30}{g['trades']:>6}  win {g['win_rate_pct']}  avgR {g['avg_r']}  t {g['t_stat']}")
    print("wrote research/ict-kill-zones/ict-kill-zones_summary.json")


if __name__ == "__main__":
    main()
