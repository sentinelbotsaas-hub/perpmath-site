import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/ict-trading: which ICT / SMC concepts this site has backtested.

Collects, in one small file, every number the article quotes. Nothing is
computed here that is not already in one of these files:

    <engine>/results/fvg-btcusdt.json                    published FVG backtest
    <engine>/results/liquidity-sweep-btcusdt.json        published liquidity sweep backtest
    research/fvg_cost_summary.json                       FVG reruns with costs changed
    research/fvg_gap_stats.json                          what happened to each gap
    research/liquidity-sweep/liquidity-sweep_summary.json   19-setting sensitivity table and bar counts

Only two of the twelve concepts in the article have a backtest. The other ten
are listed with status "not backtested" and no result, on purpose: the article
makes no claim about them either way.

Usage (from the site's root folder, engine checked out next to it; standard
library only):

    python research/ict-trading/ict-trading_status.py [path-to-engine]

Output: research/ict-trading/ict-trading_status.json
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
OUT = HERE / "ict-trading_status.json"

CONCEPTS = [
    # (concept, status, article, backtest page)
    ("fair value gap", "backtested", "/learn/fair-value-gap/", "/backtests/fvg-btcusdt/"),
    ("liquidity sweep", "backtested", "/learn/liquidity-sweep/", "/backtests/liquidity-sweep-btcusdt/"),
    ("order block", "not backtested", None, None),
    ("breaker block", "not backtested", None, None),
    ("break of structure", "not backtested", None, None),
    ("market structure shift", "not backtested", None, None),
    ("change of character", "not backtested", None, None),
    ("inverse fair value gap", "not backtested", None, None),
    ("kill zones", "not backtested", None, None),
    ("judas swing", "not backtested", None, None),
    ("power of 3", "not backtested", None, None),
    ("silver bullet", "not backtested", None, None),
]

KEYS = ("trades", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat", "total_return_pct",
        "max_drawdown_pct", "final_equity", "insufficient_sample")


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def published(document):
    return {
        "file": f"results/{document['strategy'].replace('_', '-')}-{document['symbol'].lower()}.json",
        "engine_version": document["package_version"],
        "generated_at": document["generated_at"],
        "symbol": document["symbol"], "interval": document["interval"],
        "first_bar": document["data"]["first_bar"], "last_bar": document["data"]["last_bar"],
        "bars": document["data"]["bars"], "oos_start": document["split"]["oos_start"],
        "params": document["config"]["params"],
        "costs": document["costs"],
        "in_sample": {key: document["in_sample"]["metrics"][key] for key in KEYS},
        "out_of_sample": {key: document["out_of_sample"]["metrics"][key] for key in KEYS},
    }


def pivot_counts(csv_path, sizes=(2, 5, 10, 20)):
    """How many swing points a chart has depends on one number: how many bars
    on each side make a pivot. A pivot high is a bar whose high is strictly
    above the highs of the k bars before it and the k bars after it (pivot low:
    the mirror image). This is a count of bars, not a test of any strategy."""
    with open(csv_path, encoding="utf-8") as handle:
        rows = [line.split(",") for line in handle.read().splitlines()[1:] if line]
    high = [float(r[2]) for r in rows]
    low = [float(r[3]) for r in rows]
    n = len(rows)
    days = (int(rows[-1][0]) - int(rows[0][0]) + (int(rows[1][0]) - int(rows[0][0]))) / 86_400_000
    out = {"bars": n, "days": round(days, 2), "by_k": {}}
    for k in sizes:
        highs = sum(1 for i in range(k, n - k)
                    if high[i] > max(high[i - k:i]) and high[i] > max(high[i + 1:i + 1 + k]))
        lows = sum(1 for i in range(k, n - k)
                   if low[i] < min(low[i - k:i]) and low[i] < min(low[i + 1:i + 1 + k]))
        out["by_k"][str(k)] = {"pivot_highs": highs, "pivot_lows": lows, "total": highs + lows,
                               "per_day": round((highs + lows) / days, 2),
                               "per_week": round((highs + lows) / days * 7, 1)}
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()

    fvg = load(engine / "results" / "fvg-btcusdt.json")
    sweep = load(engine / "results" / "liquidity-sweep-btcusdt.json")
    fvg_costs = load(RESEARCH / "fvg_cost_summary.json")
    fvg_gaps = load(RESEARCH / "fvg_gap_stats.json")
    sweep_summary = load(RESEARCH / "liquidity-sweep" / "liquidity-sweep_summary.json")

    if fvg["data"]["file_sha256"] != sweep["data"]["file_sha256"]:
        raise SystemExit("the two published results were not computed on the same candle file")

    base = next(run for run in sweep_summary["runs"] if run["name"] == "btcusdt-15m-lb20-sb0.1-r2")
    stats = sweep_summary["published_setting_pattern_stats"]
    tested = sum(1 for concept in CONCEPTS if concept[1] == "backtested")

    summary = {
        "article": "en/ict-trading",
        "concepts": [{"concept": c, "status": s, "article": a, "backtest_page": b} for c, s, a, b in CONCEPTS],
        "counts": {"concepts": len(CONCEPTS), "backtested": tested, "not_backtested": len(CONCEPTS) - tested},
        "candle_file_sha256": fvg["data"]["file_sha256"],
        "swing_points_btcusdt_15m": pivot_counts(engine / "data" / "BTCUSDT-15m.csv"),
        "stop_distance": {
            "fair_value_gap_in_sample": {
                key: fvg_costs["published_stop_distance"]["in_sample"][key]
                for key in ("median_stop_distance_pct", "round_trip_cost_in_r_at_median_stop")},
            "liquidity_sweep_in_sample": {
                key: sweep_summary["published_setting_trade_shape"]["in_sample"][key]
                for key in ("median_stop_distance_pct", "round_trip_cost_in_r_at_median_stop")},
        },
        "fair_value_gap": {
            "published": published(fvg),
            "zero_cost_rerun": {
                label: {key: fvg_costs["runs"][label]["zero_cost"][key]
                        for key in ("trades", "win_rate_pct", "t_stat", "total_return_pct")}
                for label in ("in_sample", "out_of_sample")},
            "gaps_any_size": fvg_gaps["three_candle_gaps_any_size"],
            "gaps_passing_size_filter": fvg_gaps["gaps_passing_size_filter"],
            "returned_within_max_wait": {key: fvg_gaps["returned_within_max_wait"][key] for key in ("gaps", "share_pct")},
        },
        "liquidity_sweep": {
            "published": published(sweep),
            "zero_cost_rerun": {
                label: {key: base["zero_cost"][label]["metrics"][key]
                        for key in ("trades", "win_rate_pct", "t_stat", "total_return_pct")}
                for label in ("in_sample", "out_of_sample")},
            "sensitivity_tally": {key: sweep_summary["tally"][key]
                                  for key in ("settings", "sample_blocks", "t_stat_range", "published_costs", "zero_cost")},
            "signal_bars_btcusdt_15m_by_lookback": sweep_summary["tally"]["signal_bars_btcusdt_15m_by_lookback"],
            "bars_that_took_either_side": stats["bars_that_took_either_side"],
            "sweeps": stats["sweeps"],
            "sweep_extreme_held_next_96_bars": stats["what_happened_to_the_bar_extreme_afterwards"]
            ["sweep_closed_back_inside"]["next_96_bars"]["both_sides"],
            "published_trades_split_by_hindsight": stats["published_trades_split_by_hindsight"],
        },
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    for name in ("fair_value_gap", "liquidity_sweep"):
        for label in ("in_sample", "out_of_sample"):
            m = summary[name]["published"][label]
            z = summary[name]["zero_cost_rerun"][label]
            print(f"{name:16} {label:14} trades {m['trades']:>5}  win {m['win_rate_pct']:.2f}%  avg R {m['avg_r']:.2f}  "
                  f"t {m['t_stat']:.2f}  return {m['total_return_pct']:.2f}%  max DD {m['max_drawdown_pct']:.2f}%  "
                  f"| zero cost: return {z['total_return_pct']:.2f}%  t {z['t_stat']:.2f}")


if __name__ == "__main__":
    main()
