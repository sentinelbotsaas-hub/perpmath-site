import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article 3 (en/fair-value-gap): how much of the published FVG loss is trading cost?

Reruns the published backtest (perpmath engine 0.1.0, strategy `fvg`, BTCUSDT
15m) with the same parameters, the same candle file and the same split, and
only the cost settings changed:

    research/fvg-zero-cost.config.json   fee_rate 0,       slippage 0
    research/fvg-fee-only.config.json    fee_rate 0.00055, slippage 0

Then compares both with the published result (fee 0.00055, slippage 0.0002).

Usage (from the perpmath site folder, engine checked out next to it):
    python research/fvg_cost_rerun.py [path-to-engine]      default ../perpmath-engine
    python research/fvg_cost_rerun.py --offline             only rebuild the summary

The engine is run with its own virtualenv if one exists, otherwise with the
Python that runs this script (which then needs `pip install -e <engine>`).

Output: research/fvg-btcusdt-zero-cost.json, research/fvg-btcusdt-fee-only.json
(full engine output, every trade) and research/fvg_cost_summary.json.
"""
import hashlib
import json
import os
import statistics
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNS = {
    "zero_cost": ("fvg-zero-cost.config.json", "fvg-btcusdt-zero-cost.json"),
    "fee_only": ("fvg-fee-only.config.json", "fvg-btcusdt-fee-only.json"),
}
OUT = HERE / "fvg_cost_summary.json"


def engine_python(engine):
    for candidate in (engine / ".venv" / "Scripts" / "python.exe", engine / ".venv" / "bin" / "python"):
        if candidate.exists():
            return str(candidate)
    return sys.executable


def run_engine(engine):
    python = engine_python(engine)
    commands = []
    for config, out in RUNS.values():
        command = [python, "-m", "perpmath", "backtest", "fvg", "--symbol", "BTCUSDT", "--interval", "15m",
                   "--config", str(HERE / config), "--out", str(HERE / out),
                   "--data-dir", str(engine / "data")]
        # The engine folder is read-only for this script: no bytecode, no writes there.
        done = subprocess.run(command, capture_output=True, text=True, cwd=str(engine),
                              env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        print(done.stdout.strip())
        if done.returncode != 0:
            print(done.stderr.strip())
            raise SystemExit(f"engine exited with {done.returncode}")
        commands.append("python -m perpmath backtest fvg --symbol BTCUSDT --interval 15m "
                        f"--config research/{config} --out research/{out} --data-dir <engine>/data")
    return commands


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def block(document, label):
    m = document[label]["metrics"]
    keys = ("trades", "wins", "losses", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
            "total_return_pct", "max_drawdown_pct", "profit_factor", "total_fees", "final_equity",
            "avg_bars_held", "exit_reasons", "insufficient_sample")
    return {key: m[key] for key in keys}


def side_split(document, label):
    """Per-side view of the published run, straight from its trade list."""
    out = {}
    for side in ("long", "short"):
        trades = [t for t in document[label]["trades"] if t["side"] == side]
        returns = [t["return_pct"] for t in trades]
        out[side] = {
            "trades": len(trades),
            "win_rate_pct": round(sum(t["pnl"] > 0 for t in trades) / len(trades) * 100, 2),
            "avg_trade_return_pct": round(statistics.fmean(returns), 4),
            "avg_r": round(statistics.fmean(t["r_multiple"] for t in trades), 4),
        }
    return out


def risk_size(document, label):
    """How far away was the stop, as a share of the entry price? This is what
    the fixed cost per trade has to be compared with."""
    trades = document[label]["trades"]
    risk = [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in trades]
    ordered = sorted(risk)
    return {
        "median_stop_distance_pct": round(statistics.median(risk), 4),
        "mean_stop_distance_pct": round(statistics.fmean(risk), 4),
        "p25_stop_distance_pct": round(ordered[len(ordered) // 4], 4),
        "p75_stop_distance_pct": round(ordered[3 * len(ordered) // 4], 4),
        "trades_with_stop_closer_than_round_trip_cost": sum(r < 0.15 for r in risk),
        # 0.15% round trip (two fees of 0.055% plus two fills of 0.02% slippage)
        # expressed in R at the median stop distance
        "round_trip_cost_in_r_at_median_stop": round(0.15 / statistics.median(risk), 2),
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent / "perpmath-engine").resolve()
    published_path = engine / "results" / "fvg-btcusdt.json"
    commands = None
    if "--offline" not in sys.argv:
        commands = run_engine(engine)

    published = load(published_path)
    reruns = {name: load(HERE / out) for name, (_, out) in RUNS.items()}

    for name, document in reruns.items():
        same_data = document["data"]["file_sha256"] == published["data"]["file_sha256"]
        same_params = document["config"]["params"] == published["config"]["params"]
        same_split = document["split"] == published["split"]
        if not (same_data and same_params and same_split):
            raise SystemExit(f"{name}: data, params or split differ from the published run")

    summary = {
        "question": "How much of the published FVG backtest loss is fees and slippage?",
        "engine": {"package": published["package"], "version": published["package_version"],
                   "repository": "https://github.com/sentinelbotsaas-hub/perpmath"},
        "data": published["data"],
        "split": published["split"],
        "params": published["config"]["params"],
        "published_result_file": "perpmath-engine/results/fvg-btcusdt.json",
        "published_result_sha256": hashlib.sha256(published_path.read_bytes()).hexdigest(),
        "published_generated_at": published["generated_at"],
        "rerun_generated_at": {name: document["generated_at"] for name, document in reruns.items()},
        "checks": "candle file sha256, strategy params and split date are identical in all three runs",
        "costs": {
            "published": published["costs"],
            "fee_only": reruns["fee_only"]["costs"],
            "zero_cost": reruns["zero_cost"]["costs"],
            "round_trip_pct_published": round((published["costs"]["fee_rate_per_side"]
                                               + published["costs"]["slippage_per_fill"]) * 2 * 100, 4),
        },
        "runs": {},
        "published_by_side": {},
        "published_stop_distance": {},
    }
    if commands:
        summary["commands"] = commands
    elif OUT.exists():
        summary["commands"] = load(OUT).get("commands")

    for label in ("in_sample", "out_of_sample"):
        summary["runs"][label] = {
            "first_bar": published[label]["first_bar"], "last_bar": published[label]["last_bar"],
            "published": block(published, label),
            "fee_only": block(reruns["fee_only"], label),
            "zero_cost": block(reruns["zero_cost"], label),
        }
        pub = summary["runs"][label]["published"]
        zero = summary["runs"][label]["zero_cost"]
        summary["runs"][label]["cost_share"] = {
            "avg_trade_return_pct_published": pub["avg_trade_return_pct"],
            "avg_trade_return_pct_zero_cost": zero["avg_trade_return_pct"],
            "difference_pct_points": round(zero["avg_trade_return_pct"] - pub["avg_trade_return_pct"], 4),
            "share_of_average_loss_explained_by_costs_pct": round(
                (zero["avg_trade_return_pct"] - pub["avg_trade_return_pct"])
                / -pub["avg_trade_return_pct"] * 100, 1),
        }
        summary["runs"][label]["gain_needed_to_recover_published_loss_pct"] = round(
            (1 / (1 + pub["total_return_pct"] / 100) - 1) * 100, 1)
        summary["runs"][label]["break_even_win_rate_at_2r_before_costs_pct"] = round(100 / 3, 2)
        summary["published_by_side"][label] = side_split(published, label)
        summary["published_stop_distance"][label] = risk_size(published, label)

    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")

    for label in ("in_sample", "out_of_sample"):
        print(label)
        for name in ("published", "fee_only", "zero_cost"):
            b = summary["runs"][label][name]
            print(f"  {name:10} trades {b['trades']:>4}  win {b['win_rate_pct']:>6.2f}%  avgR {b['avg_r']:>7.4f}  "
                  f"avg trade {b['avg_trade_return_pct']:>8.4f}%  t {b['t_stat']:>7.3f}  "
                  f"return {b['total_return_pct']:>8.2f}%  maxDD {b['max_drawdown_pct']:>6.2f}%")
        print("  cost share", summary["runs"][label]["cost_share"])
        print("  by side   ", summary["published_by_side"][label])
        print("  stop dist ", summary["published_stop_distance"][label])
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
