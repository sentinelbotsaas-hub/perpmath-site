import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/paper-trading-crypto: a keyless dry run against the same strategy backtested
on the same candles.

Input: the logs of `perpmath live <strategy> --symbol BTCUSDT --interval <i> --dry-run`
runs kept in this folder as dryrun-<strategy>-<interval>.stdout.txt. They were started
with the two *.live.config.json files here, from this folder, with no API key set.

What the script does, for every log:

  1. Reads what the runner printed: one decision per closed bar, the order bodies it
     would have sent, and the paper position's stop/target closes.
  2. Downloads the same bars again from the testnet's public kline endpoint (the runner
     reads testnet candles), 500 bars of history before the first handled bar included,
     and the same window from mainnet. Saved as CSV in the engine's format under
     data-testnet/ and data-mainnet/.
  3. REPLAY. For every bar the runner handled, gives the strategy the 500 bars ending at
     that bar, as the runner did, and compares the decision with the logged one.
  4. BACKTEST, TESTNET CANDLES. Calls the engine's real command line (`perpmath backtest`)
     on the downloaded testnet file. The split is placed on the first bar the runner
     handled, so the "out_of_sample" block of the result is exactly the dry-run window,
     starting flat, and the 500 bars before it only warm the indicators up. Costs are the
     engine's defaults (0.055% fee per side, 0.02% slippage per fill); capital 100 USDT to
     stand next to the runner's 100 USDT order. Entries, stops and exits of that block are
     compared with the paper position in the log.
  5. BACKTEST, MAINNET CANDLES. The same command on the mainnet file: what a backtest of
     "the same strategy over the same minutes" says when it is fed the real market.

Nothing here needs a key; every request is to a public market-data endpoint. The engine
checkout is only imported, never written to.

Usage, from the site's root folder, with the engine's Python:
    <engine>/.venv/Scripts/python research/paper-trading-crypto/compare.py
Output: compare_summary.json, backtest-<net>-<strategy>-<interval>.json and the
generated *.backtest.config.json files, all in this folder.
"""
import contextlib
import json
import re
from pathlib import Path

import numpy as np

import perpmath
from perpmath import cli
from perpmath.data import (cache_path, count_missing_bars, download, fetch_klines, file_sha256, http_get_json,
                           interval_ms, iso_utc, load_bars, parse_date_ms, write_csv)
from perpmath.live.executor import Decision
from perpmath.strategies import STRATEGIES, resolve_params

HERE = Path(__file__).resolve().parent
REL = "research/paper-trading-crypto"            # this folder, as written into commands and outputs
TESTNET_KLINE = "https://api-testnet.bybit.com/v5/market/kline"
HISTORY_BARS = 500                               # the runner's default history_bars
RUNS = [("ma_cross", "1m"), ("liquidity_sweep", "1m"), ("ma_cross", "15m"), ("liquidity_sweep", "15m")]
EXECUTION = {"fee_rate": 0.00055, "slippage": 0.0002, "initial_capital": 100, "notional_fraction": 1.0,
             "max_hold_bars": None}

LINE = re.compile(r"^(\S+Z) (.*)$")
BAR = re.compile(r"^bar (\S+Z) close ([0-9.]+): (long|short|no entry)(.*)$")
ORDER = re.compile(r"^\[dry run\] would send POST /v5/order/create (\{.*\})$")
CLOSED = re.compile(r"^\[dry run\] paper position would have closed by its (stop|target) at ([0-9.]+) in bar (\S+Z)$")


def parse_log(path):
    out = {"started": None, "clock_offset_ms": None, "bars": [], "orders": [], "paper_closes": [], "other": []}
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            m = LINE.match(raw.rstrip("\n"))
            if not m:
                continue
            stamp, text = m.groups()
            if out["started"] is None:
                out["started"] = stamp
            if (b := BAR.match(text)):
                out["bars"].append({"logged_at": stamp, "bar": b.group(1), "bar_ms": parse_date_ms(b.group(1)),
                                    "close": float(b.group(2)), "what": b.group(3), "flags": b.group(4).strip()})
            elif (o := ORDER.match(text)):
                body = json.loads(o.group(1))
                out["orders"].append({"logged_at": stamp, "decided_on_bar": out["bars"][-1]["bar"], "body": body})
            elif (c := CLOSED.match(text)):
                out["paper_closes"].append({"logged_at": stamp, "by": c.group(1), "price": float(c.group(2)),
                                            "in_bar": c.group(3)})
            elif text.startswith("clock offset to Bybit:"):
                out["clock_offset_ms"] = int(text.split(":")[1].split()[0])
            elif not text.startswith(("perpmath live", "limits:")):
                out["other"].append({"logged_at": stamp, "text": text})
    return out


def describe(decision):
    what = "long" if decision.side > 0 else "short" if decision.side < 0 else "no entry"
    flags = " ".join(f for f, on in (("exit-long", decision.exit_long), ("exit-short", decision.exit_short)) if on)
    return what, flags


def replay(strategy, params, bars, log):
    """The runner's own view: for each handled bar, the 500 bars ending at it."""
    generate = STRATEGIES[strategy].generate
    index = {int(t): i for i, t in enumerate(bars.ts)}
    same = 0
    different, close_differs, missing = [], [], []
    for row in log["bars"]:
        i = index.get(row["bar_ms"])
        if i is None or i + 1 < HISTORY_BARS:
            missing.append(row["bar"])
            continue
        window = type(bars)(*(a[i + 1 - HISTORY_BARS:i + 1] for a in (bars.ts, bars.open, bars.high, bars.low, bars.close, bars.volume)))
        decision = Decision.last(window, generate(window, params))
        what, flags = describe(decision)
        if float(bars.close[i]) != row["close"]:
            close_differs.append({"bar": row["bar"], "logged_close": row["close"], "downloaded_close": float(bars.close[i])})
        if (what, flags) == (row["what"], row["flags"]):
            same += 1
        else:
            different.append({"bar": row["bar"], "logged": (row["what"] + " " + row["flags"]).strip(),
                              "replayed": (what + " " + flags).strip()})
    return {"bars_compared": same + len(different), "identical": same, "different": different,
            "bars_not_in_download": missing, "bars_whose_close_differs": close_differs}


def run_backtest(net, strategy, interval, params, data_dir, start_ms, split_ms, end_ms):
    name = f"{strategy.replace('_', '-')}-{interval}"
    config_path = HERE / f"{name}.backtest.config.json"
    with open(config_path, "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump({"strategy": strategy, "params": params, "execution": EXECUTION,
                   "split": {"oos_start": iso_utc(split_ms)}}, handle, indent=2)
        handle.write(chr(10))
    out_rel = f"{REL}/backtest-{net}-{name}.json"
    argv = ["backtest", strategy, "--symbol", "BTCUSDT", "--interval", interval,
            "--config", f"{REL}/{config_path.name}", "--out", out_rel, "--data-dir", f"{REL}/{data_dir}",
            "--start", iso_utc(start_ms), "--end", iso_utc(end_ms)]
    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = cli.main(argv)
    block = None
    if code == 0:
        with open(out_rel, encoding="utf-8") as handle:
            block = json.load(handle)["out_of_sample"]
    return {"command": "perpmath " + " ".join(argv), "exit_code": code, "stdout": stdout.getvalue().strip(),
            "stderr": stderr.getvalue().strip(), "result_file": out_rel if code == 0 else None}, block


def entry_signals(strategy, params, bars, first_ms, last_ms):
    """Entry signals (bar open time -> side) of one full-history run, inside the window."""
    signals = STRATEGIES[strategy].generate(bars, params)
    return {int(t): int(s) for t, s in zip(bars.ts, signals.side) if s != 0 and first_ms <= int(t) <= last_ms}


def main():
    root = Path.cwd()
    if not (root / REL).is_dir():
        print(f"run this from the site's root folder (the one that contains {REL})")
        return 1
    logs = {}
    for strategy, interval in RUNS:
        path = HERE / f"dryrun-{strategy}-{interval}.stdout.txt"
        if path.exists():
            parsed = parse_log(path)
            if parsed["bars"]:
                logs[(strategy, interval)] = parsed

    # One download window per interval, covering every run on it.
    windows = {}
    for (strategy, interval), log in logs.items():
        step = interval_ms(interval)
        first, last = log["bars"][0]["bar_ms"], log["bars"][-1]["bar_ms"]
        lo, hi = windows.get(interval, (first, last))
        windows[interval] = (min(lo, first), max(hi, last))
    data = {}
    for interval, (first, last) in windows.items():
        step = interval_ms(interval)
        start_ms, end_ms = first - HISTORY_BARS * step, last + step
        rows = fetch_klines("BTCUSDT", interval, start_ms, end_ms,
                            fetch=lambda url, params: http_get_json(TESTNET_KLINE, params))
        testnet_path = cache_path(f"{REL}/data-testnet", "BTCUSDT", interval)
        write_csv(testnet_path, rows)
        mainnet_path, _ = download("BTCUSDT", interval, start_ms, end_ms, data_dir=f"{REL}/data-mainnet")
        data[interval] = {"start_ms": start_ms, "end_ms": end_ms,
                          "testnet": load_bars(testnet_path), "mainnet": load_bars(mainnet_path),
                          "testnet_file": f"data-testnet/{testnet_path.name}", "mainnet_file": f"data-mainnet/{Path(mainnet_path).name}",
                          "testnet_sha256": file_sha256(testnet_path), "mainnet_sha256": file_sha256(mainnet_path)}

    out = {"article": "en/paper-trading-crypto", "engine_version": perpmath.__version__,
           "execution_assumed_in_backtests": EXECUTION, "history_bars": HISTORY_BARS, "runs": []}
    for (strategy, interval), log in logs.items():
        step = interval_ms(interval)
        d = data[interval]
        with open(HERE / f"{strategy}.live.config.json", encoding="utf-8") as handle:
            params = resolve_params(strategy, json.load(handle)["params"])
        first, last = log["bars"][0]["bar_ms"], log["bars"][-1]["bar_ms"]
        end_ms = last + step
        testnet, mainnet = d["testnet"], d["mainnet"]

        rep = replay(strategy, params, testnet, log)
        bt_run, bt = run_backtest("testnet", strategy, interval, params, "data-testnet", d["start_ms"], first, end_ms)
        mn_run, mn = run_backtest("mainnet", strategy, interval, params, "data-mainnet", d["start_ms"], first, end_ms)

        # Paper position against the backtest's trades on the same candles.
        pairs = []
        trades = bt["trades"] if bt else []
        for order in log["orders"]:
            body = order["body"]
            if body.get("reduceOnly"):
                continue
            decided_ms = parse_date_ms(order["decided_on_bar"])
            fill_time = iso_utc(decided_ms + step)
            trade = next((t for t in trades if t["entry_time"] == fill_time), None)
            i = int(np.searchsorted(testnet.ts, decided_ms))
            signal_close = float(testnet.close[i])
            closes = [c for c in log["paper_closes"] if parse_date_ms(c["in_bar"]) >= decided_ms + step]
            pairs.append({
                "decided_on_bar": order["decided_on_bar"], "dry_run_side": body["side"], "dry_run_qty": body["qty"],
                "dry_run_reference_price": signal_close, "dry_run_stop": float(body["stopLoss"]),
                "dry_run_take_profit": float(body["takeProfit"]) if body.get("takeProfit") else None,
                "dry_run_close": closes[0] if closes else None,
                "backtest_trade": None if trade is None else {
                    "side": trade["side"], "entry_time": trade["entry_time"], "entry_price": trade["entry_price"],
                    "stop_price": trade["stop_price"], "target_price": trade["target_price"],
                    "exit_time": trade["exit_time"], "exit_price": trade["exit_price"], "exit_reason": trade["exit_reason"],
                    "bars_held": trade["bars_held"], "fees": trade["fees"], "pnl": trade["pnl"],
                    "return_pct": trade["return_pct"], "r_multiple": trade["r_multiple"]},
                "entry_fill_minus_reference_pct": None if trade is None else round(
                    100 * (trade["entry_price"] / signal_close - 1), 4),
            })
        entry_orders = [o for o in log["orders"] if not o["body"].get("reduceOnly")]
        unmatched_trades = [t["entry_time"] for t in trades
                            if t["entry_time"] not in {iso_utc(parse_date_ms(o["decided_on_bar"]) + step) for o in entry_orders}]

        test_signals = entry_signals(strategy, params, testnet, first, last)
        main_signals = entry_signals(strategy, params, mainnet, first, last)
        both = [t for t, s in test_signals.items() if main_signals.get(t) == s]
        counts = {k: sum(1 for b in log["bars"] if b["what"] == k) for k in ("long", "short", "no entry")}
        out["runs"].append({
            "strategy": strategy, "interval": interval, "params": params,
            "log": f"dryrun-{strategy}-{interval}.stdout.txt",
            "started": log["started"], "clock_offset_ms": log["clock_offset_ms"],
            "first_bar": log["bars"][0]["bar"], "last_bar": log["bars"][-1]["bar"],
            "bars_handled": len(log["bars"]),
            "last_log_line": log["bars"][-1]["logged_at"],
            "wall_clock_minutes": round((parse_date_ms(log["bars"][-1]["logged_at"]) - parse_date_ms(log["started"])) / 60000, 1),
            "minutes_covered": round(len(log["bars"]) * step / 60000, 1),
            "bars_expected_without_gaps": (last - first) // step + 1,
            "seconds_from_bar_close_to_log_line": {
                "min": min((parse_date_ms(b["logged_at"]) - b["bar_ms"] - step) // 1000 for b in log["bars"][1:]) if len(log["bars"]) > 1 else None,
                "max": max((parse_date_ms(b["logged_at"]) - b["bar_ms"] - step) // 1000 for b in log["bars"][1:]) if len(log["bars"]) > 1 else None},
            "decisions": counts,
            "bars_with_an_exit_flag": sum(1 for b in log["bars"] if b["flags"]),
            "orders_printed": len(log["orders"]), "entry_orders_printed": len(entry_orders),
            "paper_closes": log["paper_closes"], "other_lines": log["other"],
            "candles": {"testnet_file": d["testnet_file"], "testnet_sha256": d["testnet_sha256"],
                        "mainnet_file": d["mainnet_file"], "mainnet_sha256": d["mainnet_sha256"],
                        "first_bar": iso_utc(d["start_ms"]), "bars": len(testnet),
                        "testnet_missing": count_missing_bars(testnet, step), "mainnet_missing": count_missing_bars(mainnet, step),
                        "testnet_bars_with_high_equal_low_in_window": int(np.sum(
                            (testnet.high == testnet.low) & (testnet.ts >= first) & (testnet.ts <= last))),
                        "testnet_volume_in_window": round(float(np.sum(testnet.volume[(testnet.ts >= first) & (testnet.ts <= last)])), 3),
                        "mainnet_volume_in_window": round(float(np.sum(mainnet.volume[(mainnet.ts >= first) & (mainnet.ts <= last)])), 3)},
            "replay": rep,
            "backtest_testnet": {**bt_run, "window": None if bt is None else {
                "first_bar": bt["first_bar"], "last_bar": bt["last_bar"], "bars": bt["bars"],
                "signals": bt["signals"], "metrics": bt["metrics"], "trades": len(bt["trades"])}},
            "dry_run_entries_against_backtest_trades": pairs,
            "backtest_trades_with_no_dry_run_order": unmatched_trades,
            "backtest_mainnet": {**mn_run, "window": None if mn is None else {
                "signals": mn["signals"], "metrics": mn["metrics"], "trades": len(mn["trades"])}},
            "entry_signals_in_window": {"testnet_candles": len(test_signals), "mainnet_candles": len(main_signals),
                                        "same_bar_same_side": len(both)},
        })

    with open(HERE / "compare_summary.json", "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))

    for run in out["runs"]:
        print(f"== {run['strategy']} {run['interval']}: {run['bars_handled']} bars handled, {run['first_bar']} to {run['last_bar']} "
              f"(running {run['wall_clock_minutes']} min), decisions {run['decisions']}, entry orders printed {run['entry_orders_printed']}, "
              f"paper closes {len(run['paper_closes'])}")
        r = run["replay"]
        print(f"   replay on downloaded testnet candles: {r['identical']} of {r['bars_compared']} decisions identical, "
              f"{len(r['different'])} different, {len(r['bars_whose_close_differs'])} closes differ, "
              f"{len(r['bars_not_in_download'])} bars missing from the download")
        for label in ("backtest_testnet", "backtest_mainnet"):
            b = run[label]
            if b["window"] is None:
                print(f"   {label}: exit {b['exit_code']} {b['stderr'][-200:]}")
                continue
            m = b["window"]["metrics"]
            print(f"   {label}: signals {b['window']['signals']['seen']}, trades {m['trades']}, return {m['total_return_pct']}%, "
                  f"fees {m.get('total_fees')}")
        for p in run["dry_run_entries_against_backtest_trades"]:
            t = p["backtest_trade"]
            print(f"   dry run {p['dry_run_side']} decided on {p['decided_on_bar']} ref {p['dry_run_reference_price']} stop {p['dry_run_stop']} "
                  f"tp {p['dry_run_take_profit']} close {p['dry_run_close']}")
            print(f"      backtest: " + ("no trade at that bar" if t is None else
                  f"{t['side']} entry {t['entry_price']} at {t['entry_time']} stop {t['stop_price']} target {t['target_price']} "
                  f"exit {t['exit_price']} at {t['exit_time']} ({t['exit_reason']}) pnl {t['pnl']} fees {t['fees']} R {t['r_multiple']}"))
        if run["backtest_trades_with_no_dry_run_order"]:
            print(f"   backtest trades with no dry-run order: {run['backtest_trades_with_no_dry_run_order']}")
        s = run["entry_signals_in_window"]
        print(f"   entry signals in the window: testnet candles {s['testnet_candles']}, mainnet candles {s['mainnet_candles']}, "
              f"same bar and side {s['same_bar_same_side']}")
    print("wrote compare_summary.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
