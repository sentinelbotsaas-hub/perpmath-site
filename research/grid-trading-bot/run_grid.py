import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/grid-trading-bot: every number in the article comes from here.

Runs the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.1) through `perpmath grid` only. Nothing in the engine folder is
changed; every difference between runs is a value in a config file or a
command-line date.

Runs
----
shipped            the engine's configs/grid.json, unchanged. Must reproduce
                   the engine's results/grid-btcusdt.json exactly.
shipped-1m         the same config on 1-minute candles (only with --with-1m;
                   needs BTCUSDT-1m.csv, about 34 MB, in the data folder).

Range-exit runs. These exist to show what happens when price leaves the
range. They are not a search for better settings: the list below was written
before the first of them was run, all of them are reported in the article,
and everything not named here is the shipped config.

half-*             bounds = lowest low and highest high of the first half of
                   the shipped in-sample period (2025-11-18 to 2026-03-24);
                   tested on the second half (2026-03-25 to 2026-07-30).
                   Command: --end 2026-07-31, split in_sample_fraction 0.5.
month-*            bounds = range of the first 29.5 days (2025-11-18 11:30 to
                   2025-12-17); tested on the remaining eleven months.
                   Split oos_start 2025-12-18.
  *-continue / *-stop / *-close    the three out_of_range settings, leverage 1
  *-continue-3x                     leverage 3, out_of_range continue
shipped-3x         the shipped config with leverage 3

Follow-up (added after the runs above, because no 3x run was liquidated):
shipped-5x, shipped-10x, month-continue-5x, month-continue-10x. Leverage 5 and
10 only; no other values were tried.

Usage, from the site's root folder:
    python research/grid-trading-bot/run_grid.py [engine] [data-dir] [--with-1m]
        engine    default ../perpmath-engine
        data-dir  folder with BTCUSDT-15m.csv and BTCUSDT-funding.csv
                  (and BTCUSDT-1m.csv for --with-1m); default <engine>/data

Download commands for the data folder (public endpoints, no key):
    perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir DIR
    perpmath funding BTCUSDT --start 2025-11-18T00:00:00Z --end 2026-11-18T12:00:00Z --data-dir DIR
    perpmath download BTCUSDT 1m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir DIR

Output: summary.json in this folder, plus the full engine output (every fill)
of the leverage-1 range-exit runs and of the 1-minute run. The shipped rerun is
not kept because it is checked to be identical to the engine's
results/grid-btcusdt.json. The leveraged runs are not kept either: their fill
lists are the leverage-1 lists with larger quantities, and their metric blocks
are in summary.json. Every config file is kept, so any run can be repeated.
"""
import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent

HALF = {"cli": ["--end", "2026-07-31"], "split": {"in_sample_fraction": 0.5}}
MONTH = {"cli": [], "split": {"oos_start": "2025-12-18"}}
RUNS = {
    "shipped": {"cli": [], "split": None, "params": {}},
    "half-continue": {**HALF, "params": {"out_of_range": "continue"}},
    "half-stop": {**HALF, "params": {"out_of_range": "stop"}},
    "half-close": {**HALF, "params": {"out_of_range": "close"}},
    "half-continue-3x": {**HALF, "params": {"out_of_range": "continue", "leverage": 3}},
    "month-continue": {**MONTH, "params": {"out_of_range": "continue"}},
    "month-stop": {**MONTH, "params": {"out_of_range": "stop"}},
    "month-close": {**MONTH, "params": {"out_of_range": "close"}},
    "month-continue-3x": {**MONTH, "params": {"out_of_range": "continue", "leverage": 3}},
    "shipped-3x": {"cli": [], "split": None, "params": {"leverage": 3}},
    # Follow-up, added after the list above had been run: none of the 3x runs
    # was liquidated, so leverage was raised in two fixed steps to see where
    # the liquidation rule fires. Nothing else was tried.
    "shipped-5x": {"cli": [], "split": None, "params": {"leverage": 5}},
    "shipped-10x": {"cli": [], "split": None, "params": {"leverage": 10}},
    "month-continue-5x": {**MONTH, "params": {"out_of_range": "continue", "leverage": 5}},
    "month-continue-10x": {**MONTH, "params": {"out_of_range": "continue", "leverage": 10}},
}
KEEP_OUTPUT = {"half-continue", "half-stop", "half-close", "month-continue", "month-stop", "month-close"}
METRIC_KEYS = ("total_return_pct", "max_drawdown_pct", "final_equity", "fills", "grid_fills", "market_fills",
               "round_trips", "trading_pnl", "total_fees", "grid_fees", "market_fees", "funding_paid",
               "funding_events", "liquidated", "liquidation_time", "liquidation_loss", "range_exit_time",
               "bars_outside_range_pct", "max_position_notional", "avg_position_notional")


def engine_python(engine):
    for candidate in (engine / ".venv" / "Scripts" / "python.exe", engine / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def dump(path, value):
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")


def run(engine, data_dir, interval, config, out, extra):
    command = [engine_python(engine), "-m", "perpmath", "grid", "--symbol", "BTCUSDT", "--interval", interval,
               "--config", str(config), "--out", str(out), "--data-dir", str(data_dir)] + extra
    done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                          env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if done.returncode != 0:
        print(done.stdout.strip())
        print(done.stderr.strip())
        raise SystemExit(f"engine exited with {done.returncode}")
    shown = (f"perpmath grid --symbol BTCUSDT --interval {interval} --config research/grid-trading-bot/{config.name} "
             f"--out research/grid-trading-bot/{out.name}" + "".join(" " + part for part in extra))
    return shown, done.stdout.strip()


def seconds(text):
    return int(datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp())


def time_by_side(block, bar_seconds):
    """Share of the sample spent net long, net short and flat, from the fill times
    (bar resolution: a fill counts from the open of the bar it happened in)."""
    start = seconds(block["first_bar"])
    end = seconds(block["last_bar"]) + bar_seconds
    net, last, spent = 0.0, start, {"long": 0, "short": 0, "flat": 0}
    for f in block["fills"]:
        t = seconds(f["time"])
        spent["long" if net > 1e-9 else "short" if net < -1e-9 else "flat"] += t - last
        last = t
        net += f["quantity"] if f["side"] == "buy" else -f["quantity"]
    spent["long" if net > 1e-9 else "short" if net < -1e-9 else "flat"] += end - last
    return {f"time_net_{k}_pct": round(v / (end - start) * 100, 1) for k, v in spent.items()}


def breakdown(block):
    """Where the money came from, straight from the fill list of one sample."""
    fills = block["fills"]
    pairs = [f for f in fills if f["kind"] == "grid" and f["pnl"] is not None]
    by_kind = {}
    for f in fills:
        if f["pnl"] is not None and f["kind"] != "grid":
            entry = by_kind.setdefault(f["kind"], {"fills": 0, "pnl": 0.0, "quantity": 0.0, "net_quantity": 0.0})
            entry["fills"] += 1
            entry["pnl"] += f["pnl"]
            entry["quantity"] += f["quantity"]
            # a closing sell means the position was long
            entry["net_quantity"] += f["quantity"] if f["side"] == "sell" else -f["quantity"]
    for entry in by_kind.values():
        entry["pnl"] = round(entry["pnl"], 2)
        entry["quantity"] = round(entry["quantity"], 6)
        entry["net_quantity"] = round(entry["net_quantity"], 6)

    # net position after every fill, to find the largest one
    net, peak = 0.0, {"abs_quantity": 0.0}
    open_cost = 0.0
    for f in fills:
        signed = f["quantity"] if f["side"] == "buy" else -f["quantity"]
        net += signed
        if abs(net) > peak["abs_quantity"]:
            peak = {"abs_quantity": abs(net), "net_quantity": round(net, 6), "time": f["time"], "price": f["price"],
                    "fill_n": f["n"]}
    peak["abs_quantity"] = round(peak["abs_quantity"], 6)
    m = block["metrics"]
    # equity_curve has one point per UTC day (last bar close of the day), so this
    # is the lowest daily close, not the lowest bar close behind max_drawdown_pct
    curve = block["equity_curve"]
    low_point = min(curve, key=lambda p: p["equity"])
    high_point = max(curve, key=lambda p: p["equity"])
    pair_pnl = sum(f["pnl"] for f in pairs)
    other_pnl = sum(e["pnl"] for e in by_kind.values())
    return {
        "round_trips_counted": len(pairs),
        "round_trip_gross_pnl": round(pair_pnl, 2),
        "avg_gross_pnl_per_round_trip": round(pair_pnl / len(pairs), 4) if pairs else None,
        "non_grid_closes": by_kind,
        "leftover_position_pnl": round(other_pnl, 2),
        "fees": m["total_fees"],
        "funding_paid": m["funding_paid"],
        "liquidation_loss": m["liquidation_loss"],
        "net_change_in_equity": round(m["final_equity"] - 10000, 2),
        "check_sum": round(pair_pnl + other_pnl - m["total_fees"] - (m["funding_paid"] or 0.0)
                           - m["liquidation_loss"], 2),
        "largest_net_position": peak,
        **time_by_side(block, 900 if block["bars"] < 100000 else 60),
        "lowest_daily_close_equity": low_point,
        "highest_daily_close_equity": high_point,
    }


def sample(document, label):
    block = document[label]
    return {
        "first_bar": block["first_bar"], "last_bar": block["last_bar"], "bars": block["bars"],
        "start_price": block["start_price"],
        "end_price_from_last_fill_or_none": next(
            (f["price"] for f in reversed(block["fills"]) if f["kind"] == "end"), None),
        "metrics": {key: block["metrics"][key] for key in METRIC_KEYS},
        "buy_and_hold": block["buy_and_hold"],
        "breakdown": breakdown(block),
    }


def describe(document):
    return {
        "grid": {k: v for k, v in document["grid"].items() if k != "levels"},
        "split": document["split"],
        "data": {k: document["data"][k] for k in ("first_bar", "last_bar", "bars", "missing_bars", "file_sha256")},
        "costs": {k: document["costs"][k] for k in ("grid_fee_rate", "taker_fee_rate", "slippage_per_fill",
                                                     "round_trip_cost_pct", "funding_modelled",
                                                     "maintenance_margin_rate")},
        "lookahead_check": document["timing"]["lookahead_check"],
        "in_sample": sample(document, "in_sample"),
        "out_of_sample": sample(document, "out_of_sample"),
        "comparisons": document["comparisons"],
        "warnings": document["warnings"],
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    data_dir = Path(args[1]).resolve() if len(args) > 1 else engine / "data"
    base = load(engine / "configs" / "grid.json")
    published_path = engine / "results" / "grid-btcusdt.json"
    published = load(published_path)

    commands, runs, stdout = [], {}, {}
    scratch = tempfile.TemporaryDirectory()
    for name, spec in RUNS.items():
        config = json.loads(json.dumps(base))
        config["params"].update(spec["params"])
        if spec["split"]:
            config["split"] = spec["split"]
        stem = "grid" if name == "shipped" else f"grid-{name}"
        config_path = HERE / f"{stem}.config.json"
        folder = HERE if name in KEEP_OUTPUT else Path(scratch.name)
        out_path = folder / (f"{stem}-btcusdt.json" if name != "shipped" else "grid-btcusdt.json")
        dump(config_path, config)
        shown, text = run(engine, data_dir, "15m", config_path, out_path, spec["cli"])
        commands.append(shown)
        stdout[name] = text
        document = load(out_path)
        if document["data"]["file_sha256"] != published["data"]["file_sha256"]:
            raise SystemExit(f"{name}: candle file differs from the published run")
        if document["data"]["funding"]["file_sha256"] != published["data"]["funding"]["file_sha256"]:
            raise SystemExit(f"{name}: funding file differs from the published run")
        if name == "shipped":
            # the shipped file was written by 0.2.0; 0.2.1 changed no grid code
            strip = lambda d: {k: v for k, v in d.items() if k not in ("generated_at", "package_version")}  # noqa: E731
            if strip(document) != strip(published):
                raise SystemExit("the rerun of the shipped config does not reproduce results/grid-btcusdt.json")
        runs[name] = describe(document)
        runs[name]["result_file_kept"] = name in KEEP_OUTPUT
        version_used = document["package_version"]
    scratch.cleanup()

    one_minute = None
    one_minute_path = HERE / "grid-btcusdt-1m.json"
    if "--with-1m" in sys.argv:
        shown, text = run(engine, data_dir, "1m", HERE / "grid.config.json", one_minute_path, [])
        commands.append(shown)
        stdout["shipped-1m"] = text
    if one_minute_path.exists():
        one_minute = describe(load(one_minute_path))

    # intrabar-path table, 15m against 1m
    def path_table(run_summary):
        table = {}
        for label in ("in_sample", "out_of_sample"):
            table[label] = {"worst_of_two": {
                k: run_summary[label]["metrics"][k] for k in ("total_return_pct", "round_trips")}}
            for key, value in run_summary["comparisons"].items():
                if key.startswith("intrabar_path="):
                    table[label][key.split("=")[1]] = {
                        k: value[label][k] for k in ("total_return_pct", "round_trips")}
        return table

    summary = {
        "article": "en/grid-trading-bot",
        "engine": {"package": published["package"], "version": version_used,
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "published_result_file": "perpmath-engine/results/grid-btcusdt.json",
        "published_result_written_by_version": published["package_version"],
        "published_generated_at": published["generated_at"],
        "checks": "all 15m runs used the candle and funding files whose sha256 is in the published result; "
                  "the rerun of the shipped config is identical to the published file except generated_at and package_version",
        "funding_file_sha256": published["data"]["funding"]["file_sha256"],
        "runs": runs,
        "shipped_1m": one_minute,
        "intrabar_paths": {"15m": path_table(runs["shipped"]),
                           "1m": path_table(one_minute) if one_minute else None},
        "commands": commands,
        "stdout": stdout,
    }
    dump(HERE / "summary.json", summary)

    for name, r in runs.items():
        g = r["grid"]
        print(f"{name}: {g['lower']} to {g['upper']} ({g['bounds_source']}), leverage {g['leverage']}, "
              f"{g['out_of_range']}, cell {g['cell_notional']} USDT, width {g['cell_width_pct_min']}%"
              f"-{g['cell_width_pct_max']}%, oos_start {r['split']['oos_start']}")
        for label in ("in_sample", "out_of_sample"):
            s, m, b = r[label], r[label]["metrics"], r[label]["breakdown"]
            print(f"  {label:14} {s['first_bar']}..{s['last_bar']} start {s['start_price']} "
                  f"ret {m['total_return_pct']:>8.2f}% dd {m['max_drawdown_pct']:>6.2f}% pairs {m['round_trips']:>4} "
                  f"outside {m['bars_outside_range_pct']:>6.2f}% exit {m['range_exit_time']} "
                  f"liq {m['liquidation_time']} hold {s['buy_and_hold']['return_with_funding_pct']:>7.2f}%")
            print(f"  {'':14} pairs +{b['round_trip_gross_pnl']} leftover {b['leftover_position_pnl']} "
                  f"{b['non_grid_closes']} fees {b['fees']} funding {b['funding_paid']} "
                  f"liq loss {b['liquidation_loss']} net {b['net_change_in_equity']} (check {b['check_sum']}) "
                  f"peak {b['largest_net_position']} maxpos {m['max_position_notional']} avgpos {m['avg_position_notional']}")
        for w in r["warnings"]:
            print("  warning:", w)
    print(json.dumps(summary["intrabar_paths"], indent=1))
    print(json.dumps(runs["shipped"]["comparisons"], indent=1))
    print(f"wrote {HERE / 'summary.json'}")


if __name__ == "__main__":
    main()
