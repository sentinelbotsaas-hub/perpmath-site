"""Max drawdown of the engine's shipped backtests, measured several ways.

Usage (from the site's root folder):

    python research/max-drawdown/drawdown_measures.py ../perpmath-engine

Reads, and never writes, these files of the open-source engine
(https://github.com/sentinelbotsaas-hub/perpmath, v0.2.1):

    results/ma-cross-btcusdt.json, results/fvg-btcusdt.json,
    results/liquidity-sweep-btcusdt.json, results/grid-btcusdt.json,
    results/order-block-btcusdt.json, results/break-of-structure-btcusdt.json,
    results/breaker-block-btcusdt.json (the last three exist from 0.2.1 on)
    data/BTCUSDT-15m.csv   (the candle file; its SHA-256 must equal the one
                            recorded in every result file)

For each strategy and each sample (in-sample, out-of-sample) the same equity
history is sampled four ways and the max drawdown is computed on each:

* ``closed_trades``  equity after each closed trade (realised profit only);
* ``daily``          the result file's ``equity_curve``: one point per UTC day,
                     open positions marked to market;
* ``bar_close``      every 15-minute bar close, open positions marked to
                     market. Rebuilt here from the trade list and the candle
                     file; it must reproduce the engine's published
                     ``max_drawdown_pct`` or the script stops;
* ``intrabar``       as ``bar_close`` for the peaks, but the trough is taken at
                     the worst price each bar reached while a position was open
                     (the low for a long, the high for a short). No fee or
                     slippage is charged on that mark.
* ``intrabar_outer`` peaks are also taken inside the bar (best price while a
                     position was open). The order of high and low inside a bar
                     is unknown, so this is an outer bound, not a measurement.

Max drawdown = largest (peak - equity) / peak, the starting capital being the
first peak: the definition in the engine's ``metrics.max_drawdown_pct``.

The grid result has no per-trade positions, so only ``realised`` (from its
fill list), ``daily`` and the published bar-close figure are available for it.

Standard library only. Output: ``drawdown_measures.json`` and a table.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

STRATEGIES = {
    "ma_cross": "ma-cross-btcusdt.json",
    "fvg": "fvg-btcusdt.json",
    "liquidity_sweep": "liquidity-sweep-btcusdt.json",
    # added in engine 0.2.1; skipped when the checkout does not have them
    "order_block": "order-block-btcusdt.json",
    "break_of_structure": "break-of-structure-btcusdt.json",
    "breaker_block": "breaker-block-btcusdt.json",
}
GRID = "grid-btcusdt.json"
SAMPLES = ("in_sample", "out_of_sample")
BAR_MS = 900_000
DAY_MS = 86_400_000
TOLERANCE_PP = 0.01   # reconstruction must match the published figure this closely


def ms(text: str) -> int:
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)


def iso(t: int) -> str:
    return datetime.fromtimestamp(t / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def drawdown(points, initial, peaks=None):
    """Max drawdown of ``points`` = [(time_ms, equity)], the starting capital being the first peak.

    ``peaks`` (same length) optionally gives a separate value used to raise the
    running peak at each step; the peak is raised before the trough is read.
    Returns depth in percent with the time of the peak and of the trough.
    """
    peak, peak_t = initial, points[0][0] if points else None
    best = {"max_drawdown_pct": 0.0, "peak": initial, "peak_time": None, "trough": initial, "trough_time": None}
    for n, (t, value) in enumerate(points):
        top = value if peaks is None else max(value, peaks[n])
        if top > peak:
            peak, peak_t = top, t
        depth = (peak - value) / peak * 100
        if depth > best["max_drawdown_pct"]:
            best = {"max_drawdown_pct": depth, "peak": peak, "peak_time": peak_t, "trough": value, "trough_time": t}
    out = dict(best)
    out["max_drawdown_pct"] = round(out["max_drawdown_pct"], 4)
    out["peak"], out["trough"] = round(out["peak"], 2), round(out["trough"], 2)
    out["peak_time"] = iso(out["peak_time"]) if out["peak_time"] is not None else None
    out["trough_time"] = iso(out["trough_time"]) if out["trough_time"] is not None else None
    return out


def underwater(points, initial):
    """Time spent below the running peak. ``points`` = [(time_ms, equity)], first point = start."""
    peak, peak_t = initial, points[0][0]
    longest, longest_from, longest_to, recovered = 0, None, None, True
    below = 0
    spell_start = None
    for t, value in points:
        if value >= peak:
            if spell_start is not None and t - spell_start > longest:
                longest, longest_from, longest_to, recovered = t - spell_start, spell_start, t, True
            peak, peak_t, spell_start = value, t, None
        else:
            below += 1
            if spell_start is None:
                spell_start = peak_t
    end_t = points[-1][0]
    if spell_start is not None and end_t - spell_start > longest:
        longest, longest_from, longest_to, recovered = end_t - spell_start, spell_start, end_t, False
    span = end_t - points[0][0]
    return {
        "longest_days": round(longest / DAY_MS, 2),
        "longest_from": iso(longest_from) if longest_from is not None else None,
        "longest_to": iso(longest_to) if longest_to is not None else None,
        "longest_ended_in_recovery": recovered,
        "points_below_peak": below,
        "points": len(points),
        "share_of_points_below_peak_pct": round(below / len(points) * 100, 2),
        "sample_days": round(span / DAY_MS, 2),
        "last_high_time": iso(peak_t),
    }


def recovery_pct(drawdown_pct: float) -> float:
    d = drawdown_pct / 100
    return round(d / (1 - d) * 100, 2)


def load_bars(path: Path):
    ts, high, low, close = [], [], [], []
    with open(path, encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        if header[:5] != ["open_time_ms", "open", "high", "low", "close"]:
            raise SystemExit(f"unexpected candle header in {path}: {header}")
        for row in reader:
            ts.append(int(row[0]))
            high.append(float(row[2]))
            low.append(float(row[3]))
            close.append(float(row[4]))
    return ts, high, low, close


def strategy_sample(block: dict, initial: float, fee_rate: float, bars) -> dict:
    ts, high, low, close = bars
    index = {t: i for i, t in enumerate(ts)}
    first, last = index[ms(block["first_bar"])], index[ms(block["last_bar"])]
    n = last - first + 1
    trades = block["trades"]
    published = block["metrics"]["max_drawdown_pct"]

    # 1. Equity after each closed trade.
    equity = initial
    closed = [(ts[first], initial)]
    for trade in trades:
        equity += trade["pnl"]
        closed.append((ms(trade["exit_time"]), equity))

    # 2. Daily points from the result file.
    daily = [(ms(p["t"]), p["equity"]) for p in block["equity_curve"]]

    # 3 and 4. Every bar close, and the worst and best marks inside each bar.
    at_close = [None] * n
    worst = [None] * n
    best = [None] * n
    equity = initial
    cursor = first
    for trade in trades:
        side = 1 if trade["side"] == "long" else -1
        qty, entry = trade["quantity"], trade["entry_price"]
        ei, xi = index[ms(trade["entry_time"])], index[ms(trade["exit_time"])]
        for i in range(cursor, ei):
            at_close[i - first] = equity
        cash = equity - qty * entry * fee_rate          # equity before the trade, less the entry fee

        def mark(price: float) -> float:
            return cash + side * qty * (price - entry)

        for i in range(ei, xi):
            at_close[i - first] = mark(close[i])
            worst[i - first] = mark(low[i] if side == 1 else high[i])
            best[i - first] = mark(high[i] if side == 1 else low[i])
        after = equity + trade["pnl"]
        # The exit bar. Exits at the open ("signal", "time") and at the stop are
        # already the realised figure. A target or an end-of-sample close leaves the
        # rest of the bar's range as a possible earlier mark.
        if trade["exit_reason"] in ("target", "end"):
            w = min(after, mark(low[xi] if side == 1 else high[xi]))
            worst[xi - first] = w if worst[xi - first] is None else min(worst[xi - first], w)
        if trade["exit_reason"] in ("stop", "end"):
            b = max(after, mark(high[xi] if side == 1 else low[xi]))
            best[xi - first] = b if best[xi - first] is None else max(best[xi - first], b)
        equity = after
        cursor = xi
    for i in range(cursor, last + 1):
        at_close[i - first] = equity
    if any(v is None for v in at_close):
        raise SystemExit("bar-close reconstruction left a gap")

    close_points = [(ts[first + k] + BAR_MS, at_close[k]) for k in range(n)]
    bar_close = drawdown(close_points, initial)
    if abs(bar_close["max_drawdown_pct"] - published) > TOLERANCE_PP:
        raise SystemExit(f"bar-close reconstruction gives {bar_close['max_drawdown_pct']}, "
                         f"the result file says {published}")
    if abs(at_close[-1] - block["metrics"]["final_equity"]) > 0.5:
        raise SystemExit("reconstructed final equity does not match the result file")

    low_points = [(ts[first + k] + BAR_MS, min(at_close[k], worst[k]) if worst[k] is not None else at_close[k])
                  for k in range(n)]
    # Peaks at bar closes only (the previous close is the latest peak a trough inside
    # this bar can be measured from), troughs inside the bar.
    intrabar_points, intrabar_peaks = [], []
    prev_close = initial
    for k in range(n):
        intrabar_points.append(low_points[k])
        intrabar_peaks.append(prev_close)
        prev_close = at_close[k]
    intrabar = drawdown(intrabar_points, initial, peaks=intrabar_peaks)
    outer_peaks = [max(prev, best[k] if best[k] is not None else prev)
                   for k, prev in enumerate(intrabar_peaks)]
    intrabar_outer = drawdown(intrabar_points, initial, peaks=outer_peaks)

    # Sample length: the same curve cut short, and cut into 30-day pieces.
    start_t = ts[first]
    growing = {}
    for days in (7, 14, 30, 60, 90, 120, 180):
        cut = [p for p in close_points if p[0] <= start_t + days * DAY_MS]
        if len(cut) < n:
            growing[f"first_{days}_days"] = drawdown(cut, initial)["max_drawdown_pct"]
    growing["full_sample"] = bar_close["max_drawdown_pct"]
    windows = []
    k0 = 0
    while k0 < n:
        k1 = min(n, k0 + 30 * 96)
        if k1 - k0 == 30 * 96:
            start_equity = initial if k0 == 0 else at_close[k0 - 1]
            windows.append(drawdown(close_points[k0:k1], start_equity)["max_drawdown_pct"])
        k0 = k1
    ordered = sorted(windows)

    measures = {
        "closed_trades": drawdown(closed, initial),
        "daily": drawdown(daily, initial),
        "bar_close": bar_close,
        "intrabar": intrabar,
        "intrabar_outer": intrabar_outer,
    }
    for m in measures.values():
        m["gain_needed_to_recover_pct"] = recovery_pct(m["max_drawdown_pct"])
    return {
        "first_bar": block["first_bar"], "last_bar": block["last_bar"], "bars": n,
        "trades": len(trades), "total_return_pct": block["metrics"]["total_return_pct"],
        "published_max_drawdown_pct": published,
        "bar_close_minus_published_pp": round(bar_close["max_drawdown_pct"] - published, 4),
        "measures": measures,
        "differences_pp": {
            "bar_close_minus_closed_trades": round(bar_close["max_drawdown_pct"] - measures["closed_trades"]["max_drawdown_pct"], 4),
            "bar_close_minus_daily": round(bar_close["max_drawdown_pct"] - measures["daily"]["max_drawdown_pct"], 4),
            "intrabar_minus_bar_close": round(intrabar["max_drawdown_pct"] - bar_close["max_drawdown_pct"], 4),
            "intrabar_outer_minus_bar_close": round(intrabar_outer["max_drawdown_pct"] - bar_close["max_drawdown_pct"], 4),
        },
        "underwater_daily": underwater(daily, initial),
        "underwater_bar_close": underwater([(ts[first], initial)] + close_points, initial),
        "max_drawdown_by_sample_length_pct": growing,
        "thirty_day_windows": {
            "count": len(windows), "each_pct": windows,
            "smallest_pct": ordered[0] if ordered else None,
            "median_pct": round(statistics.median(ordered), 4) if ordered else None,
            "largest_pct": ordered[-1] if ordered else None,
        },
    }


def grid_sample(block: dict, initial: float, comparisons: dict, label: str) -> dict:
    daily = [(ms(p["t"]), p["equity"]) for p in block["equity_curve"]]
    published = block["metrics"]["max_drawdown_pct"]
    # Realised equity from the fill list: profit of closed round trips minus fees paid so far.
    # Funding is not itemised per fill and is left out.
    realised, running = [(ms(block["first_bar"]), initial)], initial
    realised_before_end = None
    for fill in block["fills"]:
        if fill["kind"] == "end":
            realised_before_end = drawdown(realised, initial)
        running += (fill["pnl"] or 0.0) - fill["fee"]
        realised.append((ms(fill["time"]), running))
    closing = [f for f in block["fills"] if f["kind"] == "grid" and f["pnl"] is not None]
    days = (ms(block["last_bar"]) + BAR_MS - ms(block["first_bar"])) / DAY_MS
    total = block["metrics"]["total_return_pct"]
    annualised = ((1 + total / 100) ** (365 / days) - 1) * 100
    paths = {name.split("=", 1)[1]: comparisons[name][label]["max_drawdown_pct"]
             for name in comparisons if name.startswith("intrabar_path=")}
    paths["worst_of_two (published)"] = published
    daily_dd = drawdown(daily, initial)
    return {
        "first_bar": block["first_bar"], "last_bar": block["last_bar"], "sample_days": round(days, 2),
        "total_return_pct": total,
        "published_max_drawdown_pct": published,
        "measures": {
            "realised_until_final_close": realised_before_end,
            "realised_including_final_close": drawdown(realised, initial),
            "daily": daily_dd,
            "bar_close_published": {"max_drawdown_pct": published,
                                    "gain_needed_to_recover_pct": recovery_pct(published)},
            "intrabar": None,
        },
        "intrabar_note": "not computable from the result file: it lists fills, not the position held "
                         "at each bar, and funding is not itemised",
        "bar_close_by_intrabar_path_pct": paths,
        "round_trips": len(closing),
        "round_trips_with_a_loss": sum(1 for f in closing if f["pnl"] <= 0),
        "final_close_pnl": next((f["pnl"] for f in block["fills"] if f["kind"] == "end"), None),
        "differences_pp": {"bar_close_minus_daily": round(published - daily_dd["max_drawdown_pct"], 4)},
        "underwater_daily": underwater(daily, initial),
        "buy_and_hold_max_drawdown_pct": block["buy_and_hold"]["max_drawdown_pct"],
        "return_over_max_drawdown": {
            "annualised_return_pct": round(annualised, 2),
            "ratio": round(annualised / published, 2),
            "note": "annualised return of this sample divided by its max drawdown; shown to illustrate how "
                    "unstable the ratio is on short samples. Not a Calmar ratio (that needs 36 months).",
        },
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    engine = Path(sys.argv[1]).resolve()
    candle_file = engine / "data" / "BTCUSDT-15m.csv"
    sha = hashlib.sha256(candle_file.read_bytes()).hexdigest()
    bars = load_bars(candle_file)

    out = {"engine_results": "https://github.com/sentinelbotsaas-hub/perpmath/tree/v0.2.1/results",
           "candle_file_sha256": sha, "definition": "max over time of (running peak - equity) / running peak, "
           "starting capital counted as the first peak", "strategies": {}}
    for name, file in STRATEGIES.items():
        if not (engine / "results" / file).is_file():
            continue
        doc = json.loads((engine / "results" / file).read_text(encoding="utf-8"))
        if doc["data"]["file_sha256"] != sha:
            raise SystemExit(f"{file} was produced from a different candle file")
        initial = doc["config"]["execution"]["initial_capital"]
        fee = doc["config"]["execution"]["fee_rate"]
        out["strategies"][name] = {
            "result_file": file, "generated_at": doc["generated_at"], "package_version": doc["package_version"],
            **{s: strategy_sample(doc[s], initial, fee, bars) for s in SAMPLES},
        }
    grid = json.loads((engine / "results" / GRID).read_text(encoding="utf-8"))
    if grid["data"]["file_sha256"] != sha:
        raise SystemExit("grid result was produced from a different candle file")
    initial = grid["config"]["execution"]["initial_capital"]
    out["grid"] = {"result_file": GRID, "generated_at": grid["generated_at"],
                   "package_version": grid["package_version"],
                   **{s: grid_sample(grid[s], initial, grid["comparisons"], s) for s in SAMPLES}}

    here = Path(__file__).parent
    (here / "drawdown_measures.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")

    print(f"candle file sha256 {sha[:12]}... matches all {len(out['strategies']) + 1} result files")
    print(f"{'strategy':19}{'sample':15}{'trades':>7}{'closed':>9}{'daily':>9}{'bar':>9}{'publ.':>9}"
          f"{'intrabar':>10}{'outer':>9}")
    for name, s in out["strategies"].items():
        for label in SAMPLES:
            b = s[label]
            m = b["measures"]
            print(f"{name:19}{label:15}{b['trades']:>7}{m['closed_trades']['max_drawdown_pct']:>9.2f}"
                  f"{m['daily']['max_drawdown_pct']:>9.2f}{m['bar_close']['max_drawdown_pct']:>9.2f}"
                  f"{b['published_max_drawdown_pct']:>9.2f}{m['intrabar']['max_drawdown_pct']:>10.2f}"
                  f"{m['intrabar_outer']['max_drawdown_pct']:>9.2f}")
    print()
    for label in SAMPLES:
        g = out["grid"][label]
        m = g["measures"]
        print(f"grid {label:14} realised until final close {m['realised_until_final_close']['max_drawdown_pct']:.4f}%  "
              f"realised incl. final close {m['realised_including_final_close']['max_drawdown_pct']:.2f}%  "
              f"daily {m['daily']['max_drawdown_pct']:.2f}%  bar close (published) {g['published_max_drawdown_pct']:.2f}%  "
              f"paths {g['bar_close_by_intrabar_path_pct']}")
    print()
    print("underwater (daily points): longest spell in days, share of points below the peak, recovered?")
    for name, s in {**out["strategies"], "grid": out["grid"]}.items():
        for label in SAMPLES:
            u = s[label]["underwater_daily"]
            print(f"  {name:16}{label:15}{u['longest_days']:>8.2f} d of {u['sample_days']:>7.2f}  "
                  f"{u['share_of_points_below_peak_pct']:>6.2f}%  recovered={u['longest_ended_in_recovery']}  "
                  f"last high {u['last_high_time']}")
    print()
    print("max drawdown (bar close) as the sample grows, percent")
    for name, s in out["strategies"].items():
        for label in SAMPLES:
            print(f"  {name:16}{label:15}{s[label]['max_drawdown_by_sample_length_pct']}")
    print()
    print("30-day windows, each measured on its own: count, smallest, median, largest; full sample")
    for name, s in out["strategies"].items():
        for label in SAMPLES:
            w = s[label]["thirty_day_windows"]
            print(f"  {name:16}{label:15}{w['count']:>3}  {w['smallest_pct']}  {w['median_pct']}  {w['largest_pct']}"
                  f"   full {s[label]['published_max_drawdown_pct']}")
    print(f"wrote {here / 'drawdown_measures.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
