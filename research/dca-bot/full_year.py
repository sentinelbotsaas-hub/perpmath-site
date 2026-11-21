import dca_sim as d  # noqa: E402  (also switches stdout to UTF-8; wrapping it a second time here would close it)
"""Article en/dca-bot: the same two rule sets over the whole year in one piece.

ADDED AFTER THE SPLIT RESULTS WERE SEEN (2026-11-21 UTC). dca_sim.py cuts the year at
2026-07-31 and sells what is open at each cut, so the cycle that was open at the end of the
in-sample period shows up as a realised loss there. This script answers the question that
loss raises: what happened to that position when nothing forced it out? The rules,
costs and data are dca_sim.py's, imported unchanged; only the window differs (one run of
35,040 bars, no split). It is a second look at the same year, not an independent test.

Usage: <engine>/.venv/Scripts/python research/dca-bot/full_year.py [candle-data-dir]
Output: research/dca-bot/full_year.json
"""
import json
import sys
from pathlib import Path

import perpmath
from perpmath.data import cache_path, file_sha256, interval_ms, load_bars
from perpmath.funding import funding_cache_path, load_funding


HERE = Path(__file__).resolve().parent


def main():
    d.selftest()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    data_dir = Path(args[0]).resolve() if args else Path(perpmath.__file__).resolve().parents[2] / "data"
    candle_path = cache_path(str(data_dir), "BTCUSDT", "15m")
    bars = load_bars(candle_path)
    step_ms = interval_ms("15m")
    rates = load_funding(funding_cache_path(str(HERE / "data"), "BTCUSDT"))
    funding = {int(t): float(r) for t, r in zip(rates.ts, rates.rate)}
    cols = (bars.ts, bars.open, bars.high, bars.low, bars.close, step_ms)
    out = {"article": "en/dca-bot", "note": "added after the split results were seen; same rules, costs and data, one window",
           "candles_sha256": file_sha256(candle_path), "bars": len(bars),
           "first_bar": d.iso(int(bars.ts[0])), "last_bar": d.iso(int(bars.ts[-1])), "rule_sets": {}}
    for rules in (d.MAIN, d.CONTROL):
        result = d.simulate(rules, *cols, funding=funding)
        assert result == d.simulate(rules, *cols, funding=funding)
        hold = d.buy_and_hold(rules, bars.ts, bars.open, bars.close, step_ms, funding)
        summary = d.summarize(rules, result, hold, step_ms, len(bars))
        ranked = sorted(result["cycles"], key=lambda c: c["bars"], reverse=True)[:5]
        summary["five_longest_cycles"] = [d.describe_cycle(c, rules.capital, step_ms) for c in ranked]
        out["rule_sets"][rules.name] = summary
        print(f"== {rules.name}: completed {summary['completed_cycles']}  net from them {summary['net_from_completed_cycles']}  "
              f"left at end {summary['net_from_position_left_at_end']}  return {summary['total_return_pct']}%  "
              f"max DD {summary['max_drawdown_pct']}%  buy&hold {summary['buy_and_hold_with_funding']['total_return_pct']}%  "
              f"lowest equity {summary['lowest_equity']} at {summary['lowest_equity_time']}")
        for c in summary["five_longest_cycles"]:
            print(f"   {c['start']} to {c['end']} {c['days']:>7} days  {c['how']:13} safety {c['safety_orders_filled']}  "
                  f"net {c['net']:>9}  worst unrealized {c['worst_unrealized']:>9} ({c['worst_unrealized_pct_of_capital']}%)  "
                  f"days full {c['days_fully_loaded']}")
        print("   leverage overlay: " + "; ".join(
            f"{k}x {v['cycles_reaching_liquidation']}/{v['of_cycles']} first {v['first_time']}"
            for k, v in summary["leverage_overlay"].items()))
    with open(HERE / "full_year.json", "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))
    print("wrote full_year.json")


if __name__ == "__main__":
    main()
