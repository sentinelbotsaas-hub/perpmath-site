import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/how-to-backtest-a-trading-strategy: two strategies that peek, on purpose.

Both are the engine's `ma_cross` (20/50 SMA cross, 2 x ATR stop) with one
change that lets a decision see bars that have not happened yet:

  ma_cross_centered  the fast average is centred on the bar: half of its 20
                     closes (10 bars) come from the future. This is what
                     `rolling(center=True)` or a zero-phase filter does.
  ma_cross_shift1    every decision is moved one bar earlier, so the order
                     fills at the open of the very bar whose close produced
                     the cross. This is the classic "signal and fill on the
                     same bar" mistake.

The engine checkout is not modified. The two strategies are registered in the
running Python process only (the README's "Writing a strategy" route, done at
run time), then the real command-line entry point is called, so the output
and exit codes below are the engine's own.

For each strategy the script records:
  1. what `perpmath backtest` prints and returns;
  2. what the numbers would have been had nobody checked (the simulator is
     called directly, skipping the look-ahead check; published costs and
     zero costs);
  3. how many shortened copies of the data the check needs before it notices
     (the command line uses 8 evenly spaced cuts plus one, 9 in total);
  4. the result of a stricter check written here: cut the data right after
     every bar that carries an entry signal and compare that bar's decision.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/how-to-backtest/lookahead_demo.py [data-dir]
        data-dir  folder holding BTCUSDT-15m.csv, default <engine>/data

Output: research/how-to-backtest/lookahead_demo.json, and
research/how-to-backtest/ma-cross-shift1-btcusdt.json when the engine lets
that run through.
"""
import contextlib
import json
import types
from pathlib import Path

import numpy as np

import perpmath
from perpmath import cli
from perpmath.backtest import LookaheadError, _split_time, check_no_lookahead
from perpmath.data import cache_path, file_sha256, interval_ms, load_bars
from perpmath.engine import ExecutionConfig, Signals, simulate
from perpmath.indicators import atr, sma
from perpmath.metrics import compute_metrics
from perpmath.strategies import STRATEGIES, ma_cross

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "ma-cross.config.json"
CUTS_TRIED = (8, 16, 32, 64, 128, 256, 512)


def centered_generate(bars, params):
    """ma_cross, but the fast average is centred: it reads fast_period // 2 future closes."""
    n = len(bars)
    signals = Signals.empty(n)
    half = params["fast_period"] // 2
    trailing = sma(bars.close, params["fast_period"])
    fast = np.full(n, np.nan)
    fast[: n - half] = trailing[half:]            # <- the peek: value at i is the average ending at i + half
    slow = sma(bars.close, params["slow_period"])
    stop_distance = params["stop_atr_mult"] * atr(bars.high, bars.low, bars.close, params["atr_period"])

    up = np.zeros(n, dtype=bool)
    down = np.zeros(n, dtype=bool)
    up[1:] = (fast[1:] > slow[1:]) & (fast[:-1] <= slow[:-1])
    down[1:] = (fast[1:] < slow[1:]) & (fast[:-1] >= slow[:-1])
    signals.exit_short[:] = up
    signals.exit_long[:] = down
    has_stop = np.isfinite(stop_distance)
    go_long, go_short = up & has_stop, down & has_stop
    signals.side[go_long] = 1
    signals.side[go_short] = -1
    signals.stop[go_long] = bars.close[go_long] - stop_distance[go_long]
    signals.stop[go_short] = bars.close[go_short] + stop_distance[go_short]
    return signals


def shift1_generate(bars, params):
    """ma_cross, but each decision is the honest decision of the NEXT bar."""
    honest = ma_cross.generate(bars, params)
    signals = Signals.empty(len(bars))
    for name, values in honest.fields().items():
        getattr(signals, name)[:-1] = values[1:]  # <- the peek: bar i acts on what bar i + 1 will show
    return signals


PEEKERS = {
    "ma_cross_centered": centered_generate,
    "ma_cross_shift1": shift1_generate,
}


def metrics_block(result):
    m = compute_metrics(result.trades, result.equity, result.initial_capital)
    keep = ("trades", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat", "total_return_pct",
            "max_drawdown_pct", "final_equity")
    return {k: (round(m[k], 4) if isinstance(m[k], float) else m[k]) for k in keep}


def unchecked(generate, bars, params, split_index, base_execution):
    """Simulate without the look-ahead check. These are the numbers a careless backtest would report."""
    signals = generate(bars, params)
    out = {}
    for label, costs in (("published_costs", {}), ("zero_costs", {"fee_rate": 0.0, "slippage": 0.0})):
        execution = ExecutionConfig(**{**base_execution, **costs})
        out[label] = {
            "in_sample": metrics_block(simulate(bars, signals, execution, 0, split_index)),
            "out_of_sample": metrics_block(simulate(bars, signals, execution, split_index, len(bars))),
        }
    return out


def cuts_needed(generate, bars, params):
    rows = []
    for cuts in CUTS_TRIED:
        try:
            runs = check_no_lookahead(generate, bars, params, cuts=cuts)
            rows.append({"cuts": cuts, "shortened_runs": runs, "caught": False, "message": None})
        except LookaheadError as exc:
            rows.append({"cuts": cuts, "shortened_runs": None, "caught": True, "message": str(exc)})
    return rows


def check_at_signal_bars(generate, bars, params):
    """A stricter check than the engine's: cut the data right after every bar that
    carries an entry signal in the full run, and see whether that bar still
    decides the same thing when it is the last bar the strategy can see."""
    full = generate(bars, params).fields()
    signal_bars = np.flatnonzero(full["side"])
    for count, i in enumerate(signal_bars, start=1):
        part = generate(bars.head(int(i) + 1), params).fields()
        for name, values in part.items():
            a, b = values[i], full[name][i]
            if not (a == b or (isinstance(a, float) and np.isnan(a) and np.isnan(b))):
                return {"signal_bars": int(len(signal_bars)), "caught": True, "cuts_run_before_catch": count,
                        "first_bar_that_changed": int(i), "field": name}
    return {"signal_bars": int(len(signal_bars)), "caught": False, "cuts_run_before_catch": None,
            "first_bar_that_changed": None, "field": None}


def run_cli(name, data_dir, out_path, raw):
    # Same params, costs and split as ma_cross; only the strategy name differs.
    config_path = HERE / (name.replace("_", "-") + ".config.json")
    with open(config_path, "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump({**raw, "strategy": name}, handle, indent=2)
        handle.write(chr(10))
    stdout, stderr = io.StringIO(), io.StringIO()
    argv = ["backtest", name, "--symbol", "BTCUSDT", "--interval", "15m", "--config", str(config_path),
            "--out", str(out_path), "--data-dir", str(data_dir)]
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = cli.main(argv)
    return {
        "command": f"perpmath backtest {name} --symbol BTCUSDT --interval 15m "
                   f"--config research/how-to-backtest/{config_path.name} "
                   f"--out research/how-to-backtest/{out_path.name}",
        "exit_code": code,
        "stdout": stdout.getvalue().strip().replace(str(out_path), f"research/how-to-backtest/{out_path.name}"),
        "stderr": stderr.getvalue().strip(),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    data_dir = Path(args[0]).resolve() if args else engine_root / "data"
    path = cache_path(str(data_dir), "BTCUSDT", "15m")
    bars = load_bars(path)

    with open(CONFIG, encoding="utf-8") as handle:
        raw = json.load(handle)
    params = dict(ma_cross.DEFAULTS, **raw["params"])
    step = interval_ms("15m")
    split_index = int(np.searchsorted(bars.ts, _split_time(bars, step, raw["split"])))

    for name, generate in PEEKERS.items():
        STRATEGIES[name] = types.SimpleNamespace(DEFAULTS=dict(ma_cross.DEFAULTS), generate=generate)

    out = {
        "article": "en/how-to-backtest-a-trading-strategy",
        "engine_version": perpmath.__version__,
        "candle_file_sha256": file_sha256(path),
        "bars": len(bars),
        "split_index": split_index,
        "honest_ma_cross": {
            "check": cuts_needed(ma_cross.generate, bars, params),
            "check_at_every_signal_bar": check_at_signal_bars(ma_cross.generate, bars, params),
            "unchecked": unchecked(ma_cross.generate, bars, params, split_index, raw["execution"]),
        },
        "peekers": {},
    }
    for name, generate in PEEKERS.items():
        result_path = HERE / (name.replace("_", "-") + "-btcusdt.json")
        if result_path.exists():
            result_path.unlink()
        cli_run = run_cli(name, data_dir, result_path, raw)
        if result_path.exists():
            # Engine output carries the config with an unregistered strategy name; keep it as written.
            with open(result_path, encoding="utf-8") as handle:
                document = json.load(handle)
            cli_run["result_file_written"] = f"research/how-to-backtest/{result_path.name}"
            cli_run["lookahead_check_in_result"] = document["timing"]["lookahead_check"]
        else:
            cli_run["result_file_written"] = None
        signals = generate(bars, params)
        honest = ma_cross.generate(bars, params)
        out["peekers"][name] = {
            "what_it_does": generate.__doc__,
            "cli": cli_run,
            "unchecked": unchecked(generate, bars, params, split_index, raw["execution"]),
            "check_by_number_of_cuts": cuts_needed(generate, bars, params),
            "check_at_every_signal_bar": check_at_signal_bars(generate, bars, params),
            "entry_signals": int(np.count_nonzero(signals.side)),
            "entry_signals_honest": int(np.count_nonzero(honest.side)),
        }

    with open(HERE / "lookahead_demo.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")

    def show(tag, block):
        for costs, samples in block.items():
            for label, m in samples.items():
                print(f"  {tag:18} {costs:15} {label:14} trades {m['trades']:>4}  win {m['win_rate_pct']:>6.2f}%  "
                      f"t {m['t_stat']:>6.2f}  return {m['total_return_pct']:>10.2f}%  maxDD {m['max_drawdown_pct']:>6.2f}%")

    show("ma_cross (honest)", out["honest_ma_cross"]["unchecked"])
    for name, block in out["peekers"].items():
        print(name)
        print("  $", block["cli"]["command"])
        for line in (block["cli"]["stdout"] + "\n" + block["cli"]["stderr"]).strip().splitlines():
            print("  |", line)
        print("  exit code", block["cli"]["exit_code"])
        show(name, block["unchecked"])
        for row in block["check_by_number_of_cuts"]:
            print(f"  cuts {row['cuts']:>4}: {'CAUGHT  ' + row['message'] if row['caught'] else 'passed'}"
                  f" (shortened runs: {row['shortened_runs']})")
        print("  every signal bar:", block["check_at_every_signal_bar"])
    print("honest, every signal bar:", out["honest_ma_cross"]["check_at_every_signal_bar"])
    for row in out["honest_ma_cross"]["check"]:
        print(f"honest cuts {row['cuts']:>4}: caught={row['caught']} shortened runs {row['shortened_runs']}")
    print(f"wrote {HERE / 'lookahead_demo.json'}")


if __name__ == "__main__":
    main()
