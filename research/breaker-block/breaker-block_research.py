import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/breaker-block: the fate of every order block, the strict reading, two more coins.

Uses the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.1). The engine folder is only read.

Three parts.

1. Engine runs. The list below was written down before the first run and
   nothing was added or removed after seeing results. Every row is reported;
   no row is offered as "the market to trade".

       BTCUSDT 15m   breaker_block and order_block, published settings      2 runs
       ETHUSDT 15m   breaker_block and order_block, published settings      2 runs
       SOLUSDT 15m   breaker_block and order_block, published settings      2 runs

   `order_block` is run next to `breaker_block` because both trade the same
   zones in opposite directions (the breaker module imports the order block
   detection). Each run is made twice: with the published costs (fee 0.055%
   per side, slippage 0.02% per fill) and with both set to zero. Out-of-sample
   starts on 2026-07-31 in every run. The two BTCUSDT published-cost runs
   must reproduce the shipped result files' metric blocks exactly, or the
   script stops.

   BTCUSDT 15m is the engine's own cached file (its SHA-256 is checked
   against the published result). The other two are downloaded from Bybit's
   public kline endpoint, no account or key:

       perpmath download ETHUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/breaker-block/data
       perpmath download SOLUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/breaker-block/data

2. The fate of every order block on BTCUSDT 15m: did price come back to it
   (the order block trade), was it closed through within the waiting time
   (which makes it a breaker), was the breaker retested, and how many zones
   gave a signal in both directions.

3. The published breaker trades: long and short separately, and split by a
   stricter reading that some sources require: before the block failed, did
   the move away from it trade beyond the extreme of the 20 bars before the
   block candle? That is known before entry, so the split is not look-ahead,
   but it was chosen after the published run and is a subgroup of it.

Usage (from the site's root folder, engine checked out next to it). The
script imports the engine, so run it with the engine's Python:

    ../perpmath-engine/.venv/Scripts/python research/breaker-block/breaker-block_research.py [path-to-engine]
    ... --download     fetch the two files above first (overwrites them)
    ... --offline      do not run the engine, rebuild the summary from runs/

Output: research/breaker-block/breaker-block_summary.json. The candle files
(data/) and the full engine outputs with every trade (runs/) are large and
are not committed; the summary records each file's SHA-256, each config and
each command.
"""
import hashlib
import json
import os
import statistics
import subprocess
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RUNS = HERE / "runs"
OUT = HERE / "breaker-block_summary.json"
SLUG = "breaker-block"

OOS_START = "2026-07-31"
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
ZERO_COSTS = {"fee_rate": 0.0, "slippage": 0.0}
BASE = {"atr_period": 14, "swing_left": 5, "swing_right": 5, "impulse_bars": 3, "min_impulse_atr": 2.0,
        "max_wait_bars": 96, "stop_buffer_atr": 0.1, "r_multiple": 2.0}
SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
STRATEGIES = ("breaker_block", "order_block")
DOWNLOADS = [
    ("ETHUSDT", "15m", "2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z"),
    ("SOLUSDT", "15m", "2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z"),
]
SWEEP_LOOKBACK = 20


def engine_python(engine):
    for candidate in (engine / ".venv" / "Scripts" / "python.exe", engine / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def price_change(path):
    with open(path, encoding="utf-8") as handle:
        lines = [line for line in handle.read().splitlines() if line]
    first, last = lines[1].split(","), lines[-1].split(",")
    first_open, last_close = float(first[1]), float(last[4])
    return {"first_open": first_open, "last_close": last_close,
            "change_pct": round((last_close / first_open - 1) * 100, 2)}


def call(command, engine):
    done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                          env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if done.returncode != 0:
        print(done.stdout.strip())
        print(done.stderr.strip())
        raise SystemExit(f"engine exited with {done.returncode}: {' '.join(command)}")
    return done.stdout


def download(engine):
    DATA.mkdir(exist_ok=True)
    python = engine_python(engine)
    for symbol, interval, start, end in DOWNLOADS:
        print(call([python, "-m", "perpmath", "download", symbol, interval,
                    "--start", start, "--end", end, "--data-dir", str(DATA)], engine).strip())


def data_dir_for(engine, symbol):
    if symbol == "BTCUSDT":
        return engine / "data", "<engine>/data"
    return DATA, f"research/{SLUG}/data"


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


METRIC_KEYS = ("trades", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
               "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "final_equity", "avg_bars_held", "exit_reasons", "insufficient_sample")


def block(document, label):
    part = document[label]
    return {
        "first_bar": part["first_bar"], "last_bar": part["last_bar"], "bars": part["bars"],
        "metrics": {key: part["metrics"][key] for key in METRIC_KEYS},
        "signals": part["signals"],
    }


def run_all(engine, offline, shipped):
    RUNS.mkdir(exist_ok=True)
    python = engine_python(engine)
    out = []
    for symbol in SYMBOLS:
        data_dir, data_label = data_dir_for(engine, symbol)
        data_file = data_dir / f"{symbol}-15m.csv"
        data_sha = sha256(data_file)
        if symbol == "BTCUSDT" and data_sha != shipped["breaker_block"]["data"]["file_sha256"]:
            raise SystemExit("the engine's candle file is not the one behind the published result")
        for strategy in STRATEGIES:
            name = f"{symbol.lower()}-15m-{strategy.replace('_', '-')}"
            entry = {"name": name, "strategy": strategy, "symbol": symbol, "interval": "15m", "params": dict(BASE),
                     "data_file": f"{symbol}-15m.csv", "data_sha256": data_sha, "price": price_change(data_file)}
            for label, costs in (("published_costs", PUBLISHED_COSTS), ("zero_cost", ZERO_COSTS)):
                config = {
                    "strategy": strategy,
                    "params": dict(BASE),
                    "execution": {**costs, "initial_capital": 10000, "notional_fraction": 1.0, "max_hold_bars": None},
                    "split": {"oos_start": OOS_START},
                }
                config_path = RUNS / f"{name}.{label}.config.json"
                result_path = RUNS / f"{name}.{label}.json"
                if not offline:
                    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
                    call([python, "-m", "perpmath", "backtest", strategy, "--symbol", symbol,
                          "--interval", "15m", "--config", str(config_path), "--out", str(result_path),
                          "--data-dir", str(data_dir)], engine)
                document = load(result_path)
                if document["data"]["file_sha256"] != data_sha:
                    raise SystemExit(f"{name}: result was computed on a different candle file")
                if document["config"]["params"] != BASE or document["split"]["oos_start"] != OOS_START + "T00:00:00Z":
                    raise SystemExit(f"{name}: result does not match the planned settings")
                if not document["timing"]["lookahead_check"]["passed"]:
                    raise SystemExit(f"{name}: look-ahead check did not pass")
                entry.setdefault("data", {k: document["data"][k] for k in ("first_bar", "last_bar", "bars", "missing_bars")})
                entry.setdefault("engine_version", document["package_version"])
                entry[label] = {
                    "config": config,
                    "command": (f"python -m perpmath backtest {strategy} --symbol {symbol} --interval 15m "
                                f"--config research/{SLUG}/runs/{name}.{label}.config.json "
                                f"--out research/{SLUG}/runs/{name}.{label}.json --data-dir {data_label}"),
                    "generated_at": document["generated_at"],
                    "in_sample": block(document, "in_sample"),
                    "out_of_sample": block(document, "out_of_sample"),
                }
                if symbol == "BTCUSDT" and label == "published_costs":
                    for part in ("in_sample", "out_of_sample"):
                        if document[part]["metrics"] != shipped[strategy][part]["metrics"]:
                            raise SystemExit(f"{name}: rerun differs from the shipped result ({part})")
                    entry["reproduces_shipped_result"] = True
            out.append(entry)
            for label in ("published_costs", "zero_cost"):
                m_in, m_out = entry[label]["in_sample"]["metrics"], entry[label]["out_of_sample"]["metrics"]
                print(f"{name:30} {label:15} in {m_in['trades']:>4} trades {m_in['total_return_pct']:>8.2f}% "
                      f"t {m_in['t_stat']:>6.2f}   out {m_out['trades']:>4} trades "
                      f"{m_out['total_return_pct']:>8.2f}% t {m_out['t_stat']:>6.2f}")
    return out


# --------------------------------------------------------------------------- #
# The fate of every order block on BTCUSDT 15m
# --------------------------------------------------------------------------- #

def pct(part, whole):
    return round(part / whole * 100, 2) if whole else None


def median(values, digits=1):
    return round(statistics.median(values), digits) if values else None


def to_ms(text):
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)


def block_stats(engine, shipped):
    sys.path.insert(0, str(engine / "src"))
    import numpy as np
    from perpmath.data import load_bars
    from perpmath.indicators import atr
    from perpmath.strategies import breaker_block, order_block

    bars = load_bars(engine / "data" / "BTCUSDT-15m.csv")
    n = len(bars)
    high, low, close, ts = bars.high, bars.low, bars.close, bars.ts
    params = dict(BASE)
    max_wait = params["max_wait_bars"]
    atr_values = atr(high, low, close, params["atr_period"])
    blocks = [b for b in order_block.find_order_blocks(bars, params) if b is not None]
    ob_signals = order_block.generate(bars, params)
    br_signals = breaker_block.generate(bars, params)

    rows = []
    for b in blocks:
        row = {"block": b, "return_fate": "data_ended_first", "return_bar": None,
               "broken_bar": None, "retest_fate": None, "retest_bar": None, "stop": None, "ran_prior_extreme": None}
        # The order block trade: first return to the zone (order_block rules 4 to 6).
        for i in range(b.formed + 1, n):
            if i - b.formed > max_wait:
                row["return_fate"] = "expired_untouched"
                break
            touched = low[i] <= b.top if b.direction == 1 else high[i] >= b.bottom
            if touched:
                held = close[i] >= b.bottom if b.direction == 1 else close[i] <= b.top
                row["return_fate"], row["return_bar"] = ("entry_signal" if held else "failed_on_return_bar"), i
                break
        # The failure that makes it a breaker (breaker_block rule 2): a close beyond the far edge.
        for i in range(b.formed + 1, min(n, b.formed + max_wait + 1)):
            if (b.direction == 1 and close[i] < b.bottom) or (b.direction == -1 and close[i] > b.top):
                row["broken_bar"] = i
                break
        if row["broken_bar"] is not None:
            k = row["broken_bar"]
            buffer = params["stop_buffer_atr"] * atr_values[k]
            trade_direction = -b.direction
            row["stop"] = b.top + buffer if trade_direction == -1 else b.bottom - buffer
            # The retest (breaker_block rules 3 to 5).
            row["retest_fate"] = "data_ended_first"
            for i in range(k + 1, n):
                if i - k > max_wait:
                    row["retest_fate"] = "expired_untouched"
                    break
                touched = high[i] >= b.bottom if trade_direction == -1 else low[i] <= b.top
                if touched:
                    held = close[i] <= b.top if trade_direction == -1 else close[i] >= b.bottom
                    row["retest_fate"], row["retest_bar"] = ("entry_signal" if held else "dropped_on_retest_bar"), i
                    break
            # The stricter reading: between the block candle and the failure, did price trade
            # beyond the extreme of the SWEEP_LOOKBACK bars before the block candle?
            start = max(0, b.candle - SWEEP_LOOKBACK)
            if b.candle - start == SWEEP_LOOKBACK:
                if b.direction == 1:
                    row["ran_prior_extreme"] = bool(high[b.candle + 1:k + 1].max() > high[start:b.candle].max())
                else:
                    row["ran_prior_extreme"] = bool(low[b.candle + 1:k + 1].min() < low[start:b.candle].min())
        rows.append(row)

    ob_bars = {r["return_bar"] for r in rows if r["return_fate"] == "entry_signal"}
    br_bars = {r["retest_bar"] for r in rows if r["retest_fate"] == "entry_signal"}
    if ob_bars != set(np.flatnonzero(ob_signals.side != 0).tolist()):
        raise SystemExit("the replayed order block entries differ from the engine's signal bars")
    if br_bars != set(np.flatnonzero(br_signals.side != 0).tolist()):
        raise SystemExit("the replayed breaker entries differ from the engine's signal bars")

    def count(key, value):
        return sum(r[key] == value for r in rows)

    total = len(rows)
    broken = [r for r in rows if r["broken_bar"] is not None]
    held_first = [r for r in rows if r["return_fate"] == "entry_signal"]
    both = [r for r in held_first if r["retest_fate"] == "entry_signal"]
    broken_after_signal = [r for r in held_first if r["broken_bar"] is not None]
    retested = [r for r in broken if r["retest_bar"] is not None]
    strict_known = [r for r in broken if r["ran_prior_extreme"] is not None]
    fate = {
        "order_blocks": total,
        "bullish": sum(r["block"].direction == 1 for r in rows),
        "bearish": sum(r["block"].direction == -1 for r in rows),
        "order_block_trade": {
            "entry_signal": count("return_fate", "entry_signal"),
            "failed_on_return_bar": count("return_fate", "failed_on_return_bar"),
            "expired_untouched": count("return_fate", "expired_untouched"),
            "data_ended_first": count("return_fate", "data_ended_first"),
        },
        "closed_through_within_wait": len(broken),
        "closed_through_pct_of_blocks": pct(len(broken), total),
        "never_closed_through_within_wait": total - len(broken),
        "bars_from_block_to_close_through_median": median([r["broken_bar"] - r["block"].formed for r in broken]),
        "closed_through_on_its_return_bar": sum(r["broken_bar"] == r["return_bar"] for r in broken),
        "breaker_retest": {
            "entry_signal": sum(r["retest_fate"] == "entry_signal" for r in broken),
            "dropped_on_retest_bar": sum(r["retest_fate"] == "dropped_on_retest_bar" for r in broken),
            "expired_untouched": sum(r["retest_fate"] == "expired_untouched" for r in broken),
            "data_ended_first": sum(r["retest_fate"] == "data_ended_first" for r in broken),
            "retested_pct_of_breakers": pct(len(retested), len(broken)),
            "entry_signal_pct_of_breakers": pct(sum(r["retest_fate"] == "entry_signal" for r in broken), len(broken)),
            "bars_from_close_through_to_retest_median": median([r["retest_bar"] - r["broken_bar"] for r in retested]),
            "retested_on_the_next_bar": sum(r["retest_bar"] - r["broken_bar"] == 1 for r in retested),
            "retested_on_the_next_bar_pct_of_retests": pct(
                sum(r["retest_bar"] - r["broken_bar"] == 1 for r in retested), len(retested)),
        },
        "same_zone_both_labels": {
            "blocks_with_an_order_block_entry_signal": len(held_first),
            "of_those_later_closed_through": len(broken_after_signal),
            "of_those_later_closed_through_pct": pct(len(broken_after_signal), len(held_first)),
            "of_those_with_a_breaker_entry_signal_too": len(both),
            "of_those_with_a_breaker_entry_signal_too_pct": pct(len(both), len(held_first)),
        },
        "strict_reading": {
            "lookback_bars": SWEEP_LOOKBACK,
            "breakers_with_a_full_lookback": len(strict_known),
            "move_ran_the_prior_extreme": sum(r["ran_prior_extreme"] for r in strict_known),
            "move_ran_the_prior_extreme_pct": pct(sum(r["ran_prior_extreme"] for r in strict_known), len(strict_known)),
        },
        "signal_bars": {"order_block": len(ob_bars), "breaker_block": len(br_bars)},
    }
    seen = (shipped["breaker_block"]["in_sample"]["signals"]["seen"]
            + shipped["breaker_block"]["out_of_sample"]["signals"]["seen"])
    if len(br_bars) != seen:
        raise SystemExit("breaker signal bars differ from the shipped result's count")

    # ---- The published breaker trades.
    index_of = {int(t): i for i, t in enumerate(ts)}
    breaker_at = {}
    for r in sorted((r for r in rows if r["retest_fate"] == "entry_signal"), key=lambda r: r["broken_bar"]):
        breaker_at[r["retest_bar"]] = r      # the most recently broken one wins, as in the engine

    def side_stats(trades):
        if not trades:
            return {"trades": 0}
        wins = sum(t["pnl"] > 0 for t in trades)
        return {
            "trades": len(trades), "wins": wins, "win_rate_pct": pct(wins, len(trades)),
            "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
            "avg_trade_return_pct": round(statistics.fmean(t["return_pct"] for t in trades), 4),
            "sum_of_trade_returns_pct": round(sum(t["return_pct"] for t in trades), 4),
            "exit_reasons": {r: sum(t["exit_reason"] == r for t in trades)
                             for r in sorted({t["exit_reason"] for t in trades})},
        }

    round_trip = (PUBLISHED_COSTS["fee_rate"] + PUBLISHED_COSTS["slippage"]) * 2 * 100
    trades = {}
    for label in ("in_sample", "out_of_sample"):
        listed = shipped["breaker_block"][label]["trades"]
        strict, loose_only, unknown = [], [], []
        for trade in listed:
            r = breaker_at[index_of[to_ms(trade["entry_time"])] - 1]
            if abs(r["stop"] - trade["stop_price"]) > 1e-3:
                raise SystemExit("a published trade's stop does not match its breaker")
            (unknown if r["ran_prior_extreme"] is None else strict if r["ran_prior_extreme"] else loose_only).append(trade)
        distances = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in listed]
        trades[label] = {
            "long": side_stats([t for t in listed if t["side"] == "long"]),
            "short": side_stats([t for t in listed if t["side"] == "short"]),
            "strict_reading_move_ran_prior_20_bar_extreme": side_stats(strict),
            "loose_reading_only": side_stats(loose_only),
            "no_full_lookback": len(unknown),
            "entry_to_stop_pct_of_price_median": round(statistics.median(distances), 4),
            "round_trip_cost_in_r_at_median_stop": round(round_trip / statistics.median(distances), 4),
            "trades_with_stop_closer_than_round_trip_cost": sum(d < round_trip for d in distances),
            "stopped_on_the_entry_bar": sum(t["exit_reason"] == "stop" and t["bars_held"] == 0 for t in listed),
        }
    return {"symbol": "BTCUSDT", "interval": "15m", "params": params, "bars": n,
            "round_trip_cost_pct": round(round_trip, 4),
            "fate_of_every_order_block": fate, "published_breaker_trades": trades}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    offline = "--offline" in sys.argv
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    if "--download" in sys.argv:
        download(engine)
    shipped = {"breaker_block": load(engine / "results" / "breaker-block-btcusdt.json"),
               "order_block": load(engine / "results" / "order-block-btcusdt.json")}
    runs = run_all(engine, offline, shipped)
    stats = block_stats(engine, shipped)
    doc = shipped["breaker_block"]
    summary = {
        "article": "en/breaker-block",
        "engine": {"package": "perpmath", "version": doc["package_version"],
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "shipped_result": {"file": "results/breaker-block-btcusdt.json", "generated_at": doc["generated_at"],
                           "data": doc["data"], "split": doc["split"], "costs": doc["costs"],
                           "in_sample": doc["in_sample"]["metrics"], "out_of_sample": doc["out_of_sample"]["metrics"],
                           "signals": {"in_sample": doc["in_sample"]["signals"],
                                       "out_of_sample": doc["out_of_sample"]["signals"]}},
        "downloads": [{"symbol": s, "interval": i, "start": a, "end": b,
                       "command": f"python -m perpmath download {s} {i} --start {a} --end {b} --data-dir research/{SLUG}/data"}
                      for s, i, a, b in DOWNLOADS],
        "plan_note": ("The six runs were fixed before the first run. Every row is reported and none is a "
                      "recommendation. All three coins come from the same twelve months."),
        "runs": runs,
        "btcusdt_15m": stats,
    }
    OUT.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(json.dumps(stats["fate_of_every_order_block"], indent=1))
    print(json.dumps(stats["published_breaker_trades"], indent=1))
    for run in runs:
        print(run["name"], run["data"], run["price"])


if __name__ == "__main__":
    main()
