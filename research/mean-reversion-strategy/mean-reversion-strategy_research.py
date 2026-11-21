import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/mean-reversion-strategy: a band-fade rule, written down before it was run.

The strategy below is NOT one of the engine's shipped examples. It lives in
this file only. The script registers it in the running Python process (the
README's "Writing a strategy" route, done at run time) and then calls the
engine's real command-line entry point, so the look-ahead check, the fills,
the costs and the in-sample / out-of-sample split are the engine's own. The
engine checkout is only read.

RULES (fixed on 2026-11-21 UTC, before the first run on real data; run once, not
changed afterwards). Everything is evaluated on a bar's close; orders fill at
the next bar's open.

1. mean  = simple average of the last `period` closes, this bar included.
   sd    = standard deviation of the same closes (population form, divide
           by `period`), the convention of Bollinger Bands.
   upper = mean + entry_sd x sd,  lower = mean - entry_sd x sd.
2. Long:  this bar closes below `lower` and the previous bar did not close
          below its own `lower`.
   Short: this bar closes above `upper` and the previous bar did not close
          above its own `upper`.
   Only the first close outside a band gives a signal. A run of closes
   outside it gives one signal, not one per bar.
3. Exit:  a long is closed at the next open after a bar closes at or above
          `mean`; a short after a bar closes at or below `mean`. The mean is
          the one of that later bar, so it has moved since the entry.
4. Stop:  for a long, the signal bar's close minus stop_atr_mult x ATR; for a
          short, the close plus the same distance. ATR is the simple average
          of the last `atr_period` true ranges.
5. No profit target other than rule 3 and no time limit. One position at a
   time; signals that arrive while a position is open are ignored.

PARAMETERS: period 20, entry_sd 2.0 (the default Bollinger Band settings),
atr_period 14 and stop_atr_mult 2.0 (the values the engine's `ma_cross`
example already uses). Costs: fee 0.055% per side, slippage 0.02% per fill.
Out-of-sample starts 2026-07-31, the same date as the engine's shipped
results (first 70% of the period in-sample).

PLAN OF RUNS (also fixed before the first run; every row is reported, none is
offered as "the setting to use"). Each setting is run with the published
costs and with fee and slippage at zero.

    published                 period 20, entry_sd 2.0, stop 2.0 x ATR
    band width                entry_sd 1.5, 2.5, 3.0          (period 20, stop 2.0)
    lookback                  period 50, 96                   (entry_sd 2.0, stop 2.0)
    stop                      stop_atr_mult 1.0, 4.0          (period 20, entry_sd 2.0)

One thing was added after the first run, and it concerns the check, not the
trades. Rule 3 puts an exit flag on nearly every bar, so the engine counts
35,020 of the 35,040 bars as signal bars and its default look-ahead check
cuts after a sample of them (7,543 on the first run). The published setting
is therefore run with `--lookahead every-bar`, which cuts after every bar and
samples nothing. The trades and metrics are identical to the first run's; the
script was run a second time, on the same day, to record that complete check
and the engine's own transcript (runs/*.cli.txt). The "after a big bar" count
in part B was also added with the second run; it is a count on the candles
and has nothing to do with the strategy's rules or parameters. The summary
was last rebuilt with --offline, which reads the saved runs and changes no
number.

Besides the engine runs the script measures three things on the same candles:

A. Every first close outside a band, traded or not: did a later bar close
   back at the mean within 96 bars, how long did it take, was the stop of
   rule 4 touched first, and was the price at that point better or worse
   than the entry. Costs are ignored here.
B. Whether 15-minute returns show reversal at all: autocorrelation of log
   returns at lags 1 to 4 and variance ratios for 2, 4, 16 and 96 bars, with
   the range the same statistics take when the returns are shuffled (500
   shuffles, fixed seed).
C. The published trades: exits by reason, time held, longs and shorts.

Self-checks (the script stops if one fails): the variance ratio of a
four-number example worked out by hand, the same statistics on two series
with a known answer, the rolling standard deviation against a direct
computation, and a second pass over B that must give identical numbers.

Usage, from the site's root folder, with the engine's own Python:

    ../perpmath-engine/.venv/Scripts/python research/mean-reversion-strategy/mean-reversion-strategy_research.py [path-to-engine]
        --offline   do not run the engine, rebuild the summary from runs/

Output: research/mean-reversion-strategy/mean-reversion-strategy_summary.json and
mean-reversion-strategy_run_output.txt. The full engine outputs with every
trade (runs/*.json) are not committed; the summary records the candle file's
SHA-256, each config and each command.
"""
import contextlib
import json
import os
import statistics
import types
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

sys.dont_write_bytecode = True

import perpmath  # noqa: E402
from perpmath import cli  # noqa: E402
from perpmath.data import Bars, file_sha256, load_bars  # noqa: E402
from perpmath.engine import Signals  # noqa: E402
from perpmath.indicators import atr, sma  # noqa: E402
from perpmath.strategies import STRATEGIES  # noqa: E402

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
RUNS = HERE / "runs"
SLUG = "mean-reversion-strategy"
OUT = HERE / f"{SLUG}_summary.json"
LOG = HERE / f"{SLUG}_run_output.txt"
STRATEGY = "mean_reversion_band"

DEFAULTS = {"period": 20, "entry_sd": 2.0, "atr_period": 14, "stop_atr_mult": 2.0}
OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
ROUND_TRIP_PCT = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
PLAN = [
    ("published", {}),
    ("band width", {"entry_sd": 1.5}),
    ("band width", {"entry_sd": 2.5}),
    ("band width", {"entry_sd": 3.0}),
    ("lookback", {"period": 50}),
    ("lookback", {"period": 96}),
    ("stop", {"stop_atr_mult": 1.0}),
    ("stop", {"stop_atr_mult": 4.0}),
]
WINDOW = 96                 # bars an event is followed for in part A
VR_HORIZONS = (2, 4, 16, 96)
SHUFFLES = 500
SEED = 20261122

_lines = []


def say(text=""):
    print(text)
    _lines.append(text)


# --------------------------------------------------------------------------- #
# The strategy
# --------------------------------------------------------------------------- #

def rolling_sd(values, period):
    """Population standard deviation of the last `period` values, current bar included; NaN before that."""
    values = np.asarray(values, dtype=np.float64)
    out = np.full(len(values), np.nan)
    if len(values) >= period:
        out[period - 1:] = sliding_window_view(values, period).std(axis=1)
    return out


def bands(close, params):
    mean = sma(close, params["period"])
    sd = rolling_sd(close, params["period"])
    return mean, mean - params["entry_sd"] * sd, mean + params["entry_sd"] * sd


def generate(bars, params):
    """Rules 1 to 5 of this file's docstring."""
    n = len(bars)
    signals = Signals.empty(n)
    close = bars.close
    mean, lower, upper = bands(close, params)
    stop_distance = params["stop_atr_mult"] * atr(bars.high, bars.low, close, params["atr_period"])

    below = close < lower                       # False while the band is NaN
    above = close > upper
    first_below = below.copy()
    first_above = above.copy()
    first_below[1:] &= ~below[:-1]
    first_above[1:] &= ~above[:-1]

    has_stop = np.isfinite(stop_distance)
    go_long, go_short = first_below & has_stop, first_above & has_stop
    signals.side[go_long] = 1
    signals.side[go_short] = -1
    signals.stop[go_long] = close[go_long] - stop_distance[go_long]
    signals.stop[go_short] = close[go_short] + stop_distance[go_short]
    signals.exit_long[:] = close >= mean        # False while the mean is NaN
    signals.exit_short[:] = close <= mean
    return signals


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
    return (f"btcusdt-15m-p{params['period']}-sd{params['entry_sd']}-stop{params['stop_atr_mult']}"
            .replace(".", "_"))


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
    """Call the engine's command line in this process. Returns (exit code, stdout, stderr)."""
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
            if group == "published" and label == "published_costs":
                argv += ["--lookahead", "every-bar"]     # see "One thing was added" in the docstring
                command += " --lookahead every-bar"
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
            say(f"{name:34} {label:15} in {m_in['trades']:>4} trades win {m_in['win_rate_pct']:>6.2f}% "
                f"{m_in['total_return_pct']:>8.2f}% t {m_in['t_stat']:>6.2f} R {m_in['avg_r']:>6.2f}   "
                f"out {m_out['trades']:>4} trades win {m_out['win_rate_pct']:>6.2f}% "
                f"{m_out['total_return_pct']:>8.2f}% t {m_out['t_stat']:>6.2f} R {m_out['avg_r']:>6.2f}")
    return out


# --------------------------------------------------------------------------- #
# A. Every first close outside a band
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def band_events(bars, params):
    n = len(bars)
    open_, high, low, close = bars.open, bars.high, bars.low, bars.close
    mean, lower, upper = bands(close, params)
    atr_values = atr(high, low, close, params["atr_period"])
    signals = generate(bars, params)
    valid = np.isfinite(mean)
    sd = rolling_sd(close, params["period"])
    z = (close - mean) / np.where(sd > 0, sd, np.nan)

    rows = []
    for i in np.flatnonzero(signals.side != 0).tolist():
        if i + 1 >= n:
            continue
        d = int(signals.side[i])
        entry = float(open_[i + 1])
        stop = float(signals.stop[i])
        back = None                      # first bar from i + 1 on that closes back at the mean
        stop_bar = None                  # first bar from i + 1 on whose range reaches the stop
        worst = 0.0                      # largest move against the position before `back`, % of entry
        for j in range(i + 1, min(i + 1 + WINDOW, n)):
            against = d * (entry - (low[j] if d == 1 else high[j])) / entry * 100
            worst = max(worst, float(against))
            if stop_bar is None and (low[j] <= stop if d == 1 else high[j] >= stop):
                stop_bar = j
            if d * (close[j] - mean[j]) >= 0:
                back = j
                break
        row = {"bar": i, "direction": d, "back": back, "stop_bar": stop_bar, "worst_pct": worst,
               "followed_full_window": i + WINDOW < n}
        if back is not None and back + 1 < n:
            exit_price = float(open_[back + 1])          # rule 3: the next open after the close at the mean
            row["bars_to_back"] = back - i
            row["move_pct"] = d * (exit_price - entry) / entry * 100
            row["mean_moved_pct"] = d * (float(mean[back]) - float(mean[i])) / entry * 100
            row["gap_to_mean_at_signal_pct"] = d * (float(mean[i]) - float(close[i])) / float(close[i]) * 100
        rows.append(row)

    usable = [r for r in rows if r["followed_full_window"] or r["back"] is not None]
    returned = [r for r in usable if r["back"] is not None and "move_pct" in r]
    stop_first = [r for r in usable if r["stop_bar"] is not None and (r["back"] is None or r["stop_bar"] <= r["back"])]
    stopped = {r["bar"] for r in stop_first}
    clean = [r for r in returned if r["bar"] not in stopped]
    moves = [r["move_pct"] for r in returned]

    def side(direction):
        ev = [r for r in usable if r["direction"] == direction]
        ret = [r for r in ev if r["back"] is not None and "move_pct" in r]
        return {"events": len(ev), "closed_back_at_mean": len(ret),
                "closed_back_at_mean_pct": pct(len(ret), len(ev)),
                "better_than_entry_pct": pct(sum(r["move_pct"] > 0 for r in ret), len(ret)),
                "mean_move_pct": round(statistics.fmean(r["move_pct"] for r in ret), 4) if ret else None}

    return {
        "params": params, "window_bars": WINDOW,
        "closes_with_a_band": int(valid.sum()),
        "closes_below_lower": int((close < lower).sum()), "closes_above_upper": int((close > upper).sum()),
        "closes_outside_pct": pct(int((close < lower).sum() + (close > upper).sum()), int(valid.sum())),
        "normal_distribution_share_beyond_2sd_pct": 4.55,
        "largest_abs_z": round(float(np.nanmax(np.abs(z))), 4),
        "largest_abs_z_note": ("With the population standard deviation of n values, a single value can sit at most "
                               "sqrt(n - 1) standard deviations from their mean: 4.3589 for n = 20."),
        "events": {
            "first_closes_outside": len(rows),
            "long_side_below_lower": sum(r["direction"] == 1 for r in rows),
            "short_side_above_upper": sum(r["direction"] == -1 for r in rows),
            "events_followed": len(usable),
            "per_day": round(len(rows) / (n / 96), 2),
        },
        "closed_back_at_mean_within_window": {
            "events": len(returned), "pct": pct(len(returned), len(usable)),
            "bars_median": statistics.median(r["bars_to_back"] for r in returned),
            "bars_mean": round(statistics.fmean(r["bars_to_back"] for r in returned), 2),
            "bars_p90": sorted(r["bars_to_back"] for r in returned)[int(0.9 * (len(returned) - 1))],
            "within_4_bars_pct": pct(sum(r["bars_to_back"] <= 4 for r in returned), len(usable)),
            "within_20_bars_pct": pct(sum(r["bars_to_back"] <= 20 for r in returned), len(usable)),
        },
        "price_when_back_at_mean_vs_entry": {
            "note": ("Entry is the open after the signal bar; the exit is the open after the bar that closed "
                     "back at the mean. Before costs. The stop is ignored in this block."),
            "better_than_entry": sum(m > 0 for m in moves), "better_than_entry_pct": pct(sum(m > 0 for m in moves), len(moves)),
            "worse_or_equal": sum(m <= 0 for m in moves), "worse_or_equal_pct": pct(sum(m <= 0 for m in moves), len(moves)),
            "mean_move_pct": round(statistics.fmean(moves), 4),
            "median_move_pct": round(statistics.median(moves), 4),
            "mean_gain_when_better_pct": round(statistics.fmean(m for m in moves if m > 0), 4),
            "mean_loss_when_worse_pct": round(statistics.fmean(m for m in moves if m <= 0), 4),
            "gap_to_mean_at_signal_pct_median": round(statistics.median(r["gap_to_mean_at_signal_pct"] for r in returned), 4),
            "mean_moved_toward_price_pct_median": round(statistics.median(-r["mean_moved_pct"] for r in returned), 4),
            "round_trip_cost_pct": round(ROUND_TRIP_PCT, 4),
        },
        "stop_of_rule_4": {
            "touched_before_or_on_the_bar_back_at_mean": len(stop_first),
            "pct_of_events": pct(len(stop_first), len(usable)),
            "back_at_mean_without_touching_stop": len(clean),
            "back_at_mean_without_touching_stop_pct": pct(len(clean), len(usable)),
            "of_those_better_than_entry_pct": pct(sum(r["move_pct"] > 0 for r in clean), len(clean)),
            "of_those_mean_move_pct": round(statistics.fmean(r["move_pct"] for r in clean), 4) if clean else None,
        },
        "worst_move_against_before_back_pct": {
            "median": round(statistics.median(r["worst_pct"] for r in returned), 4),
            "p90": round(sorted(r["worst_pct"] for r in returned)[int(0.9 * (len(returned) - 1))], 4),
            "max": round(max(r["worst_pct"] for r in returned), 4),
        },
        "by_side": {"long_below_lower": side(1), "short_above_upper": side(-1)},
        "note": ("Counts on the bars. Every event is followed, including the ones the one-position rule "
                 "skipped, so the windows overlap and these are not independent trades."),
    }


# --------------------------------------------------------------------------- #
# B. Do 15-minute returns reverse?
# --------------------------------------------------------------------------- #

def autocorrelation(returns, lag):
    x = returns - returns.mean()
    return float((x[lag:] * x[:-lag]).sum() / (x * x).sum())


def variance_ratio(returns, q):
    """Variance of overlapping q-bar returns over q times the variance of 1-bar returns.

    Both variances are plain means of squared deviations (no small-sample
    correction). 1 = the returns add up like independent draws; below 1 =
    moves tend to be partly undone inside q bars; above 1 = they tend to carry on.
    """
    mu = returns.mean()
    var1 = ((returns - mu) ** 2).mean()
    csum = np.concatenate(([0.0], np.cumsum(returns)))
    sums = csum[q:] - csum[:-q]
    return float(((sums - q * mu) ** 2).mean() / (q * var1))


def reversal_stats(close):
    returns = np.diff(np.log(np.asarray(close, dtype=np.float64)))
    n = len(returns)
    rng = np.random.default_rng(SEED)
    shuffled = {q: [] for q in VR_HORIZONS}
    shuffled_ac1 = []
    for _ in range(SHUFFLES):
        perm = rng.permutation(returns)
        shuffled_ac1.append(autocorrelation(perm, 1))
        for q in VR_HORIZONS:
            shuffled[q].append(variance_ratio(perm, q))

    def band(values):
        return [round(float(np.percentile(values, 2.5)), 4), round(float(np.percentile(values, 97.5)), 4)]

    # The same question asked directly: after a big bar, how much does the next bar give back?
    size = np.abs(returns[:-1])
    give_back = -np.sign(returns[:-1]) * returns[1:] * 100        # positive = the next bar went the other way
    after_big = {}
    for name, share in (("largest_10_pct_of_bars", 0.10), ("largest_5_pct_of_bars", 0.05), ("largest_1_pct_of_bars", 0.01)):
        cut = float(np.quantile(size, 1 - share))
        picked = size >= cut
        after_big[name] = {
            "bars": int(picked.sum()), "bar_move_at_least_pct": round(cut * 100, 4),
            "mean_bar_move_pct": round(float(size[picked].mean() * 100), 4),
            "next_bar_mean_give_back_pct": round(float(give_back[picked].mean()), 4),
            "next_bar_went_the_other_way_pct": pct(int((give_back[picked] > 0).sum()), int(picked.sum())),
        }

    return {
        "series": "log returns of 15-minute closes", "returns": n,
        "mean_abs_return_pct": round(float(np.abs(returns).mean() * 100), 4),
        "median_abs_return_pct": round(float(np.median(np.abs(returns)) * 100), 4),
        "after_a_big_bar": after_big,
        "round_trip_cost_pct": round(ROUND_TRIP_PCT, 4),
        "autocorrelation": {f"lag_{lag}": round(autocorrelation(returns, lag), 4) for lag in (1, 2, 3, 4)},
        "autocorrelation_band_if_independent": round(1.96 / n ** 0.5, 4),
        "lag_1_range_in_shuffles_2_5_to_97_5": band(shuffled_ac1),
        "variance_ratio": {f"{q}_bars": round(variance_ratio(returns, q), 4) for q in VR_HORIZONS},
        "variance_ratio_range_in_shuffles_2_5_to_97_5": {f"{q}_bars": band(shuffled[q]) for q in VR_HORIZONS},
        "shuffles": SHUFFLES, "seed": SEED,
        "note": ("Shuffling keeps every return and destroys their order, so the range is what the statistic "
                 "does when there is no dependence at all. It also destroys volatility clustering, which real "
                 "returns have, so the range is narrower than a test that allowed for it would give. Read a "
                 "value just outside it with that in mind."),
    }


def self_checks():
    # Variance ratio by hand: returns 1, 2, 3, 4. Mean 2.5, variance (2.25 + 0.25 + 0.25 + 2.25) / 4 = 1.25.
    # Two-bar sums 3, 5, 7 against 2 x 2.5 = 5: squared deviations 4, 0, 4, mean 8 / 3.
    # Ratio (8 / 3) / (2 x 1.25) = 1.0667.
    assert abs(variance_ratio(np.array([1.0, 2.0, 3.0, 4.0]), 2) - (8 / 3) / 2.5) < 1e-12
    # A series that undoes every move: +1, -1, +1, -1 ... Every two-bar sum is 0.
    flip = np.tile([1.0, -1.0], 500)
    assert variance_ratio(flip, 2) < 1e-12 and abs(autocorrelation(flip, 1) + 1) < 2e-3
    # Independent draws with a fixed seed: ratio near 1, autocorrelation near 0.
    noise = np.random.default_rng(7).standard_normal(50_000)
    assert abs(variance_ratio(noise, 2) - 1) < 0.02 and abs(variance_ratio(noise, 16) - 1) < 0.05
    assert abs(autocorrelation(noise, 1)) < 0.01
    # Rolling standard deviation against a direct computation, and the bands on a hand-made series.
    values = np.array([1.0, 2.0, 4.0, 7.0, 11.0, 16.0])
    sd = rolling_sd(values, 3)
    assert np.isnan(sd[:2]).all() and abs(sd[2] - np.std([1.0, 2.0, 4.0])) < 1e-12 and abs(sd[5] - np.std([7.0, 11.0, 16.0])) < 1e-12
    # Rule 2 on hand-made closes, period 4 and 1 sd: 10, 10, 10, 10 then 7 (below), 6 (still below), 12 (above).
    # Bar 4: mean 9.25, sd 1.299, lower 7.951 -> 7 is below: first close below -> long.
    # Bar 5: mean 8.25, sd 1.785, lower 6.465 -> 6 is below, but so was the bar before: no signal.
    # Bar 6: mean 8.75, sd 2.385, upper 11.135 -> 12 is above: first close above -> short.
    close = np.array([10.0, 10.0, 10.0, 10.0, 7.0, 6.0, 12.0])
    bars = Bars(np.arange(7), close, close + 0.5, close - 0.5, close, np.ones(7))
    got = generate(bars, {"period": 4, "entry_sd": 1.0, "atr_period": 2, "stop_atr_mult": 1.0})
    assert got.side.tolist() == [0, 0, 0, 0, 1, 0, -1], got.side.tolist()
    # ATR(2) on bar 4: true ranges 1.0 (bar 3) and 3.5 (bar 4: high 7.5 against the previous close 10) -> 2.25.
    assert abs(got.stop[4] - (7.0 - 2.25)) < 1e-12
    assert got.exit_long.tolist() == [False, False, False, True, False, False, True]
    return "passed"


# --------------------------------------------------------------------------- #
# C. The published trades
# --------------------------------------------------------------------------- #

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
                    "sum_of_trade_returns_pct": round(sum(t["return_pct"] for t in trades), 4),
                    "avg_bars_held": round(statistics.fmean(t["bars_held"] for t in trades), 2)}

        distances = sorted(abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in rows)
        middle = statistics.median(distances)
        out[label] = {
            "long": stats([t for t in rows if t["side"] == "long"]),
            "short": stats([t for t in rows if t["side"] == "short"]),
            "by_exit_reason": {reason: stats([t for t in rows if t["exit_reason"] == reason])
                               for reason in sorted({t["exit_reason"] for t in rows})},
            "entry_to_stop_pct_of_price_median": round(middle, 4),
            "round_trip_cost_in_r_at_median_stop": round(ROUND_TRIP_PCT / middle, 4),
            "avg_win_return_pct": round(statistics.fmean(t["return_pct"] for t in rows if t["pnl"] > 0), 4),
            "avg_loss_return_pct": round(statistics.fmean(t["return_pct"] for t in rows if t["pnl"] <= 0), 4),
            "breakeven_win_rate_pct_at_those_averages": None,
        }
        win, loss = out[label]["avg_win_return_pct"], -out[label]["avg_loss_return_pct"]
        out[label]["breakeven_win_rate_pct_at_those_averages"] = round(loss / (win + loss) * 100, 2)
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

    say(f"self-checks: {self_checks()}")
    STRATEGIES[STRATEGY] = types.SimpleNamespace(DEFAULTS=dict(DEFAULTS), generate=generate)
    say(f"engine perpmath {perpmath.__version__}; strategy '{STRATEGY}' registered at run time from this script")
    say(f"candles: BTCUSDT-15m.csv, {len(bars)} bars, sha256 {data_sha}")
    say()

    runs = run_all(data_dir, data_sha, offline)
    published = load(RUNS / f"{run_name(DEFAULTS)}.published_costs.json")
    events = band_events(bars, dict(DEFAULTS))
    reversal = reversal_stats(bars.close)
    if reversal != reversal_stats(bars.close):
        raise SystemExit("the shuffle statistics changed between two passes with the same seed")
    trades = trade_stats(published)

    summary = {
        "article": "en/mean-reversion-strategy",
        "engine": {"package": "perpmath", "version": perpmath.__version__,
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "strategy": {"name": STRATEGY, "defined_in": f"research/{SLUG}/{SLUG}_research.py",
                     "shipped_with_engine": False, "defaults": DEFAULTS,
                     "rules": generate.__doc__ + " See the docstring at the top of the script.",
                     "parameters_fixed_on": "2026-11-21 (UTC), before the first run on real data"},
        "data": {"file": "BTCUSDT-15m.csv", "file_sha256": data_sha, "bars": len(bars),
                 "first_bar": published["data"]["first_bar"], "last_bar": published["data"]["last_bar"],
                 "missing_bars": published["data"]["missing_bars"]},
        "split": published["split"],
        "costs": {"published": PUBLISHED_COSTS, "round_trip_pct": round(ROUND_TRIP_PCT, 4),
                  "funding_modelled": False},
        "plan_note": ("The eight settings were fixed before the first run. This is a sensitivity table, not a "
                      "search: every row is reported and none is a recommendation."),
        "self_checks": "passed",
        "runs": runs,
        "every_first_close_outside_a_band": events,
        "do_15m_returns_reverse": reversal,
        "published_trades": trades,
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    say()
    say(f"wrote research/{SLUG}/{OUT.name}")
    say(json.dumps(events, indent=1))
    say(json.dumps(reversal, indent=1))
    say(json.dumps(trades, indent=1))
    header = (f"# Output of the run behind research/{SLUG}/{OUT.name} (engine perpmath {perpmath.__version__}).\n"
              f"# Command, from the site's root folder: ../perpmath-engine/.venv/Scripts/python "
              f"research/{SLUG}/{SLUG}_research.py" + (" --offline" if offline else "") + "\n"
              f"# The published setting was run by the engine at {published['generated_at']} (UTC).\n\n")
    LOG.write_text(header + "\n".join(_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
