import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article 3 (en/fair-value-gap): what happened to every gap, before any trade is simulated.

Walks the same candle file as the published backtest with the same rules and
parameters as perpmath's `fvg` strategy (src/perpmath/strategies/fvg.py) and
counts, for each gap that passed the size filter, how its life ended:

    entered   price came back and the return bar closed on the right side (a signal)
    failed    price came back and the return bar closed through the far side
    expired   price did not come back within max_wait_bars
    open      still waiting when the data ended

It also checks that the bars it flags as signals are exactly the bars the
engine's own strategy function flags, so the counts describe the same thing
the backtest traded.

Must be run with a Python that has the engine installed (its virtualenv):
    <engine>/.venv/Scripts/python research/fvg_gap_stats.py [path-to-engine]

Output: research/fvg_gap_stats.json
"""
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
ENGINE = Path(args[0]).resolve() if args else (HERE.parent.parent / "perpmath-engine").resolve()
sys.path.insert(0, str(ENGINE / "src"))
sys.dont_write_bytecode = True

from perpmath.data import file_sha256, iso_utc, load_bars  # noqa: E402
from perpmath.indicators import atr  # noqa: E402
from perpmath.strategies import fvg  # noqa: E402


def main():
    config = json.loads((ENGINE / "configs" / "fvg.json").read_text(encoding="utf-8"))
    params = config["params"]
    data_file = ENGINE / "data" / "BTCUSDT-15m.csv"
    bars = load_bars(data_file)
    n = len(bars)
    high, low, close = bars.high, bars.low, bars.close
    atr_values = atr(high, low, close, params["atr_period"])
    max_wait = params["max_wait_bars"]

    raw_patterns = {"bullish": 0, "bearish": 0}      # three-candle gaps of any size
    kept = {"bullish": 0, "bearish": 0}              # gaps that passed the size filter
    outcome = {"entered": 0, "failed": 0, "expired": 0, "open": 0}
    by_side = {"bullish": dict(outcome), "bearish": dict(outcome)}
    wait_bars = []                                   # bars from formation to the return bar
    sizes_pct = []                                   # zone height as % of the zone bottom
    signal_bars = set()

    waiting = []
    for i in range(n):
        still_waiting = []
        for gap in waiting:
            direction, bottom, top, born = gap
            side = "bullish" if direction == 1 else "bearish"
            if i - born > max_wait:
                by_side[side]["expired"] += 1
                continue
            if direction == 1 and low[i] <= top:
                wait_bars.append(i - born)
                if close[i] >= bottom:
                    by_side[side]["entered"] += 1
                    signal_bars.add(i)
                else:
                    by_side[side]["failed"] += 1
                continue
            if direction == -1 and high[i] >= bottom:
                wait_bars.append(i - born)
                if close[i] <= top:
                    by_side[side]["entered"] += 1
                    signal_bars.add(i)
                else:
                    by_side[side]["failed"] += 1
                continue
            still_waiting.append(gap)
        waiting = still_waiting

        if i < 2:
            continue
        if low[i] > high[i - 2]:
            raw_patterns["bullish"] += 1
        elif high[i] < low[i - 2]:
            raw_patterns["bearish"] += 1
        if not math.isfinite(atr_values[i]):
            continue
        min_size = params["min_gap_atr"] * atr_values[i]
        if low[i] > high[i - 2] and low[i] - high[i - 2] >= min_size:
            bottom, top = float(high[i - 2]), float(low[i])
            waiting.append((1, bottom, top, i))
            kept["bullish"] += 1
            sizes_pct.append((top - bottom) / bottom * 100)
        elif high[i] < low[i - 2] and low[i - 2] - high[i] >= min_size:
            bottom, top = float(high[i]), float(low[i - 2])
            waiting.append((-1, bottom, top, i))
            kept["bearish"] += 1
            sizes_pct.append((top - bottom) / bottom * 100)
    for direction, _, _, _ in waiting:
        by_side["bullish" if direction == 1 else "bearish"]["open"] += 1

    for key in outcome:
        outcome[key] = by_side["bullish"][key] + by_side["bearish"][key]
    total = kept["bullish"] + kept["bearish"]
    returned = outcome["entered"] + outcome["failed"]

    # Cross-check against the engine's own strategy function.
    engine_signals = fvg.generate(bars, params)
    engine_bars = {int(i) for i in range(n) if engine_signals.side[i] != 0}
    if engine_bars != signal_bars:
        raise SystemExit("signal bars differ from the engine's fvg.generate: the counts would not "
                         "describe what the backtest traded")

    ordered_wait = sorted(wait_bars)
    document = {
        "question": "What happened to each fair value gap on BTCUSDT 15m, by the engine's rules?",
        "engine_repository": "https://github.com/sentinelbotsaas-hub/perpmath",
        "rules": "src/perpmath/strategies/fvg.py, parameters from configs/fvg.json",
        "params": params,
        "data": {"file": data_file.name, "file_sha256": file_sha256(data_file), "bars": n,
                 "first_bar": iso_utc(int(bars.ts[0])), "last_bar": iso_utc(int(bars.ts[-1]))},
        "three_candle_gaps_any_size": {**raw_patterns, "total": raw_patterns["bullish"] + raw_patterns["bearish"],
                                       "share_of_bars_pct": round((raw_patterns["bullish"] + raw_patterns["bearish"]) / n * 100, 2)},
        "gaps_passing_size_filter": {**kept, "total": total,
                                     "share_of_all_gaps_pct": round(total / (raw_patterns["bullish"] + raw_patterns["bearish"]) * 100, 2),
                                     "per_day": round(total / (n / 96), 2)},
        "outcome": outcome,
        "outcome_by_side": by_side,
        "outcome_share_pct": {key: round(value / total * 100, 2) for key, value in outcome.items()},
        "returned_within_max_wait": {
            "gaps": returned, "share_pct": round(returned / total * 100, 2),
            "of_those_entered_pct": round(outcome["entered"] / returned * 100, 2),
            "of_those_failed_pct": round(outcome["failed"] / returned * 100, 2),
            "median_bars_to_return": statistics.median(wait_bars),
            "returned_on_next_bar": sum(w == 1 for w in wait_bars),
            "returned_on_next_bar_pct": round(sum(w == 1 for w in wait_bars) / returned * 100, 2),
            "returned_within_4_bars_pct": round(sum(w <= 4 for w in wait_bars) / returned * 100, 2),
            "p90_bars_to_return": ordered_wait[int(0.9 * len(ordered_wait))],
        },
        "zone_height_pct_of_price": {"median": round(statistics.median(sizes_pct), 4),
                                     "mean": round(statistics.fmean(sizes_pct), 4)},
        "signal_bars": len(signal_bars),
        "cross_check": "signal bars identical to perpmath.strategies.fvg.generate on the same file",
    }
    with open(HERE / "fvg_gap_stats.json", "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2)
        handle.write("\n")
    for key in ("three_candle_gaps_any_size", "gaps_passing_size_filter", "outcome", "outcome_by_side",
                "outcome_share_pct", "returned_within_max_wait", "zone_height_pct_of_price", "signal_bars"):
        print(key, document[key])
    print("wrote", HERE / "fvg_gap_stats.json")


if __name__ == "__main__":
    main()
