import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/how-to-backtest-a-trading-strategy: the engine runs behind the tables.

Runs the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.1) through its command line only. Nothing in the engine folder is
changed; every difference between runs is a value in a config file.

1. Cost runs on BTCUSDT 15m:
     *.config.json            published config, copied from the engine's configs/
     *-fee-only.config.json   fee 0.055% per side, slippage 0
     *-zero-cost.config.json  fee 0, slippage 0
   `ma_cross` gets all three and the full engine output (every trade) is kept
   next to the configs. The other five shipped strategies get the published
   and the zero-cost run. Their configs are kept; their outputs are not (the
   published rerun is checked against the engine's own results/ file, and the
   metric blocks of both runs are in summary.json).

2. Parameter sweep for `ma_cross`: 13 fast/slow pairs, each run once with the
   published costs. This is NOT a search for a strategy to trade. It is here to
   show what picking the best in-sample row does out-of-sample. The pairs were
   written down before the first run: fast 5/10/20/50, slow 20/50/100/200,
   fast < slow. Sweep configs are written to sweep/; the full result files are
   large, so only their metric blocks are kept (in summary.json).

Usage, from the site's root folder:
    python research/how-to-backtest/run_backtests.py [engine] [data-dir]
        engine    default ../perpmath-engine
        data-dir  folder holding BTCUSDT-15m.csv, default <engine>/data

Output: research/how-to-backtest/summary.json plus the result files named above.
"""
import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SWEEP_DIR = HERE / "sweep"
FAST = (5, 10, 20, 50)
SLOW = (20, 50, 100, 200)
PUBLISHED_COSTS = {"fee_rate": 0.00055, "slippage": 0.0002}
COST_VARIANTS = {
    "published": PUBLISHED_COSTS,
    "fee_only": {"fee_rate": 0.00055, "slippage": 0.0},
    "zero_cost": {"fee_rate": 0.0, "slippage": 0.0},
}
STRATEGIES = {"ma_cross": "ma-cross", "fvg": "fvg", "liquidity_sweep": "liquidity-sweep",
              "order_block": "order-block", "break_of_structure": "break-of-structure",
              "breaker_block": "breaker-block"}
VARIANTS = {name: ("published", "zero_cost") for name in STRATEGIES}
VARIANTS["ma_cross"] = ("published", "fee_only", "zero_cost")
KEEP_OUTPUT = {("ma_cross", "published"), ("ma_cross", "fee_only"), ("ma_cross", "zero_cost")}
METRIC_KEYS = ("trades", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
               "t_stat_n", "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees",
               "avg_bars_held", "final_equity", "exit_reasons", "insufficient_sample")


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


def run(engine, data_dir, strategy, config, out):
    """One `perpmath backtest` call. Returns (shown command, stdout)."""
    command = [engine_python(engine), "-m", "perpmath", "backtest", strategy, "--symbol", "BTCUSDT",
               "--interval", "15m", "--config", str(config), "--out", str(out), "--data-dir", str(data_dir)]
    done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                          env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if done.returncode != 0:
        print(done.stdout.strip())
        print(done.stderr.strip())
        raise SystemExit(f"engine exited with {done.returncode}")
    shown = (f"perpmath backtest {strategy} --symbol BTCUSDT --interval 15m "
             f"--config {rel(config)} --out {rel(out)}")
    return shown, done.stdout.strip()


def rel(path):
    try:
        return "research/how-to-backtest/" + Path(path).resolve().relative_to(HERE).as_posix()
    except ValueError:
        return "<temp>/" + Path(path).name


def block(document, label):
    return {key: document[label]["metrics"][key] for key in METRIC_KEYS}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    data_dir = Path(args[1]).resolve() if len(args) > 1 else engine / "data"
    commands, outputs = [], {}

    # ---- 1. cost runs --------------------------------------------------------
    cost_runs = {}
    scratch = tempfile.TemporaryDirectory()
    for strategy, stem in STRATEGIES.items():
        base = load(engine / "configs" / f"{strategy}.json")
        published = load(engine / "results" / f"{stem}-btcusdt.json")
        cost_runs[strategy] = {}
        for variant in VARIANTS[strategy]:
            costs = COST_VARIANTS[variant]
            suffix = "" if variant == "published" else "-" + variant.replace("_", "-")
            config_path = HERE / f"{stem}{suffix}.config.json"
            keep = (strategy, variant) in KEEP_OUTPUT
            out_path = (HERE if keep else Path(scratch.name)) / f"{stem}-btcusdt{suffix}.json"
            config = json.loads(json.dumps(base))
            config["execution"].update(costs)
            dump(config_path, config)
            shown, stdout = run(engine, data_dir, strategy, config_path, out_path)
            commands.append(shown)
            outputs[shown] = stdout
            document = load(out_path)
            if document["data"]["file_sha256"] != published["data"]["file_sha256"]:
                raise SystemExit(f"{strategy} {variant}: candle file differs from the published run")
            if document["config"]["params"] != published["config"]["params"] or document["split"] != published["split"]:
                raise SystemExit(f"{strategy} {variant}: params or split differ from the published run")
            if variant == "published":
                for label in ("in_sample", "out_of_sample"):
                    if document[label]["metrics"] != published[label]["metrics"]:
                        raise SystemExit(f"{strategy}: rerun does not reproduce the published {label} metrics")
            cost_runs[strategy][variant] = {
                "costs": document["costs"],
                "lookahead_check": document["timing"]["lookahead_check"],
                "in_sample": block(document, "in_sample"),
                "out_of_sample": block(document, "out_of_sample"),
            }
        for label in ("in_sample", "out_of_sample"):
            pub = cost_runs[strategy]["published"][label]
            zero = cost_runs[strategy]["zero_cost"][label]
            cost_runs[strategy].setdefault("cost_share", {})[label] = {
                "avg_trade_return_pct_published": pub["avg_trade_return_pct"],
                "avg_trade_return_pct_zero_cost": zero["avg_trade_return_pct"],
                "difference_pct_points": round(zero["avg_trade_return_pct"] - pub["avg_trade_return_pct"], 4),
            }

    scratch.cleanup()

    # ---- 2. ma_cross parameter sweep ----------------------------------------
    SWEEP_DIR.mkdir(exist_ok=True)
    base = load(engine / "configs" / "ma_cross.json")
    sweep = []
    with tempfile.TemporaryDirectory() as tmp:
        for fast in FAST:
            for slow in SLOW:
                if fast >= slow:
                    continue
                config = json.loads(json.dumps(base))
                config["params"].update({"fast_period": fast, "slow_period": slow})
                config_path = SWEEP_DIR / f"ma-cross-{fast}-{slow}.config.json"
                dump(config_path, config)
                out_path = Path(tmp) / f"ma-cross-{fast}-{slow}.json"
                shown, _ = run(engine, data_dir, "ma_cross", config_path, out_path)
                commands.append(shown)
                document = load(out_path)
                sweep.append({
                    "fast_period": fast, "slow_period": slow,
                    "result_sha256": hashlib.sha256(
                        "\n".join(l for l in out_path.read_text(encoding="utf-8").splitlines()
                                  if '"generated_at"' not in l).encode("utf-8")).hexdigest(),
                    "in_sample": block(document, "in_sample"),
                    "out_of_sample": block(document, "out_of_sample"),
                })
    by_is = sorted(sweep, key=lambda r: r["in_sample"]["total_return_pct"], reverse=True)
    by_oos = sorted(sweep, key=lambda r: r["out_of_sample"]["total_return_pct"], reverse=True)
    for row in sweep:
        row["rank_in_sample"] = by_is.index(row) + 1
        row["rank_out_of_sample"] = by_oos.index(row) + 1
    n = len(sweep)
    d2 = sum((r["rank_in_sample"] - r["rank_out_of_sample"]) ** 2 for r in sweep)
    sweep_summary = {
        "note": "13 pairs fixed before the first run; shown to illustrate selection, not to pick a strategy",
        "pairs": n,
        "costs": PUBLISHED_COSTS,
        "best_in_sample": {k: by_is[0][k] for k in ("fast_period", "slow_period", "rank_out_of_sample")},
        "best_out_of_sample": {k: by_oos[0][k] for k in ("fast_period", "slow_period", "rank_in_sample")},
        "pairs_with_positive_in_sample_return": sum(r["in_sample"]["total_return_pct"] > 0 for r in sweep),
        "pairs_with_positive_out_of_sample_return": sum(r["out_of_sample"]["total_return_pct"] > 0 for r in sweep),
        "pairs_with_abs_t_at_least_2_out_of_sample": sum(abs(r["out_of_sample"]["t_stat"]) >= 2 for r in sweep),
        "spearman_rank_correlation_is_vs_oos_return": round(1 - 6 * d2 / (n * (n * n - 1)), 4),
        "rows": sweep,
    }

    reference = load(HERE / "ma-cross-btcusdt.json")
    summary = {
        "article": "en/how-to-backtest-a-trading-strategy",
        "engine": {"package": reference["package"], "version": reference["package_version"],
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "data": reference["data"],
        "split": reference["split"],
        "in_sample_window": [reference["in_sample"]["first_bar"], reference["in_sample"]["last_bar"]],
        "out_of_sample_window": [reference["out_of_sample"]["first_bar"], reference["out_of_sample"]["last_bar"]],
        "checks": "every run used the candle file with the sha256 above; the published-cost reruns "
                  "reproduce the metric blocks of the engine's shipped result files exactly",
        "cost_runs": cost_runs,
        "ma_cross_sweep": sweep_summary,
        "commands": commands,
        "stdout_of_published_ma_cross_run": outputs[commands[0]],
    }
    dump(HERE / "summary.json", summary)

    for strategy, runs in cost_runs.items():
        print(strategy)
        for variant in VARIANTS[strategy]:
            for label in ("in_sample", "out_of_sample"):
                b = runs[variant][label]
                print(f"  {variant:10} {label:14} trades {b['trades']:>5}  win {b['win_rate_pct']:>6.2f}%  "
                      f"avgR {b['avg_r']:>7.4f}  avg trade {b['avg_trade_return_pct']:>8.4f}%  "
                      f"t {b['t_stat']:>7.3f}  return {b['total_return_pct']:>8.2f}%  "
                      f"maxDD {b['max_drawdown_pct']:>6.2f}%  fees {b['total_fees']:>9.2f}")
        print("  cost share", runs["cost_share"])
    print("sweep (published costs)")
    for row in by_is:
        i, o = row["in_sample"], row["out_of_sample"]
        print(f"  {row['fast_period']:>3}/{row['slow_period']:<4} IS {i['total_return_pct']:>8.2f}% "
              f"t {i['t_stat']:>6.2f} n {i['trades']:>5} (rank {row['rank_in_sample']:>2})   "
              f"OOS {o['total_return_pct']:>8.2f}% t {o['t_stat']:>6.2f} n {o['trades']:>4} "
              f"(rank {row['rank_out_of_sample']:>2})")
    print({k: v for k, v in sweep_summary.items() if k != "rows"})
    print(f"wrote {HERE / 'summary.json'}")


if __name__ == "__main__":
    main()
