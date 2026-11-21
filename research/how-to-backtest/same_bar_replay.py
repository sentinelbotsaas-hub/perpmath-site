import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/how-to-backtest-a-trading-strategy: stop first or target first?

When one bar touches both the stop and the target, OHLC data cannot say which
came first. The engine always assumes the stop (`timing.same_bar_stop_and_target`
is "stop first") and has no setting for the other choice. This script does not
change the engine. It replays the engine's own published trade lists for the
five shipped strategies that have a target (all except `ma_cross`) and asks
what the result would have been had the target been taken first on those bars.

Why a replay is exact here: a trade leaves on the first bar that touches its
stop or its target, whichever rule is used, so the exit bar does not move.
Only the exit price of the ambiguous trades changes. Every later trade enters
on the same bar at the same price, and because each trade uses 100% of equity,
equity after a trade is equity before x (1 + trade return). The script first
rebuilds the engine's final equity that way from the unchanged trade list and
stops if it is off by more than 0.05 USDT.

A trade is counted as ambiguous when it left at its stop, the exit bar's range
also reached its target, and the bar did not open beyond the stop (if it did,
the stop really was first).

Usage, from the site's root folder (standard library only):
    python research/how-to-backtest/same_bar_replay.py [engine] [data-dir]

Output: research/how-to-backtest/same_bar_replay.json
"""
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = {"fvg": "fvg-btcusdt.json", "liquidity_sweep": "liquidity-sweep-btcusdt.json",
           "order_block": "order-block-btcusdt.json", "break_of_structure": "break-of-structure-btcusdt.json",
           "breaker_block": "breaker-block-btcusdt.json"}


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def ms(text):
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)


def load_candles(path):
    candles = {}
    with open(path, encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        next(reader)
        for row in reader:
            candles[int(row[0])] = tuple(float(x) for x in row[1:5])   # open, high, low, close
    return candles


def trade_return(side, entry, exit_price, fee):
    """Net profit / entry notional, as the engine computes it (fee on both fills)."""
    return side * (exit_price / entry - 1) - fee * (1 + exit_price / entry)


def replay(block, candles, fee, slip, capital):
    trades = block["trades"]
    equity_stop_first = capital
    equity_target_first = capital
    ambiguous, gap_stops, wins_stop, wins_target = 0, 0, 0, 0
    entry_bar_cases = 0
    for t in trades:
        side = 1 if t["side"] == "long" else -1
        entry, stop, target = t["entry_price"], t["stop_price"], t["target_price"]
        base = trade_return(side, entry, t["exit_price"], fee)
        flipped = base
        if t["exit_reason"] == "stop" and target is not None:
            o, h, l, _ = candles[ms(t["exit_time"])]
            touched_target = h >= target if side == 1 else l <= target
            opened_beyond_stop = o <= stop if side == 1 else o >= stop
            if opened_beyond_stop:
                gap_stops += 1
            elif touched_target:
                ambiguous += 1
                entry_bar_cases += t["bars_held"] == 0
                fill = target * (1 - side * slip)          # same slippage rule as the engine
                flipped = trade_return(side, entry, fill, fee)
        equity_stop_first *= 1 + base
        equity_target_first *= 1 + flipped
        wins_stop += base > 0
        wins_target += flipped > 0
    n = len(trades)
    engine_final = block["metrics"]["final_equity"]
    if abs(equity_stop_first - engine_final) > 0.05:
        raise SystemExit(f"replay gives {equity_stop_first:.4f}, engine says {engine_final}: replay is not exact")
    return {
        "trades": n,
        "stop_exits": block["metrics"]["exit_reasons"].get("stop", 0),
        "ambiguous_trades": ambiguous,
        "ambiguous_pct_of_trades": round(ambiguous / n * 100, 2),
        "ambiguous_on_entry_bar": int(entry_bar_cases),
        "stops_hit_by_gap_at_open": gap_stops,
        "engine_final_equity": engine_final,
        "replayed_final_equity_stop_first": round(equity_stop_first, 2),
        "stop_first": {
            "total_return_pct": round((equity_stop_first / capital - 1) * 100, 2),
            "win_rate_pct": round(wins_stop / n * 100, 2),
        },
        "target_first": {
            "total_return_pct": round((equity_target_first / capital - 1) * 100, 2),
            "win_rate_pct": round(wins_target / n * 100, 2),
            "final_equity": round(equity_target_first, 2),
        },
        "difference_pct_points": round((equity_target_first - equity_stop_first) / capital * 100, 2),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    data_dir = Path(args[1]).resolve() if len(args) > 1 else engine / "data"
    candles = load_candles(data_dir / "BTCUSDT-15m.csv")
    out = {
        "question": "How much do the published results depend on assuming the stop is hit before the "
                    "target when one bar touches both?",
        "method": "replay of the engine's published trade lists; see the docstring of same_bar_replay.py",
        "note": "ma_cross has no profit target, so the question does not arise for it",
        "strategies": {},
    }
    for strategy, name in RESULTS.items():
        document = load(engine / "results" / name)
        fee = document["costs"]["fee_rate_per_side"]
        slip = document["costs"]["slippage_per_fill"]
        capital = document["config"]["execution"]["initial_capital"]
        out["strategies"][strategy] = {
            "result_file": f"perpmath-engine/results/{name}",
            "candle_file_sha256": document["data"]["file_sha256"],
            "engine_rule": document["timing"]["same_bar_stop_and_target"],
            "in_sample": replay(document["in_sample"], candles, fee, slip, capital),
            "out_of_sample": replay(document["out_of_sample"], candles, fee, slip, capital),
        }
    with open(HERE / "same_bar_replay.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")
    for strategy, blocks in out["strategies"].items():
        for label in ("in_sample", "out_of_sample"):
            b = blocks[label]
            print(f"{strategy:16} {label:14} trades {b['trades']:>5} ambiguous {b['ambiguous_trades']:>4} "
                  f"({b['ambiguous_pct_of_trades']}%, {b['ambiguous_on_entry_bar']} on the entry bar) "
                  f"gap stops {b['stops_hit_by_gap_at_open']:>3}  stop-first {b['stop_first']}  "
                  f"target-first {b['target_first']}  replay check {b['replayed_final_equity_stop_first']} "
                  f"vs {b['engine_final_equity']}")
    print(f"wrote {HERE / 'same_bar_replay.json'}")


if __name__ == "__main__":
    main()
