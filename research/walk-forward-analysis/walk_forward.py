import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/walk-forward-analysis: a walk-forward run of the engine's `ma_cross`.

Every backtest below is the open-source engine's own `run_backtest`
(https://github.com/sentinelbotsaas-hub/perpmath, version 0.2.2), look-ahead
check included. Nothing in the engine folder is changed.

EVERYTHING IN THIS BLOCK WAS FIXED BEFORE THE FIRST RUN ON REAL DATA
--------------------------------------------------------------------
Data       BTCUSDT 15m, the engine's candle file (SHA-256 must equal the one in
           its published result). Bars with open time in
           [2025-11-19T00:00Z, 2026-11-14T00:00Z): 360 days, cut at UTC midnights.
Windows    training 90 days, test 30 days, step 30 days -> 9 folds.
           Fold k (0..8): training [D0 + 30k, D0 + 30k + 90 days),
                          test     [D0 + 30k + 90, D0 + 30k + 120 days).
           The nine test windows are back to back: 2026-02-17 to 2026-11-14.
Grid       The 13 fast/slow pairs of research/how-to-backtest/sweep/:
           fast 5/10/20/50, slow 20/50/100/200, fast < slow.
           ATR period 14 and stop 2 x ATR are not searched.
Costs      Published: fee 0.055% per side, slippage 0.02% per fill, full
           position, no leverage, funding not modelled.
Objective  The pair with the highest net total return in the training window
           is traded in the next test window. Ties go to the pair that comes
           first in GRID order.
Recorded   Also written down in advance, for comparison only:
           - "anchored": training always starts at D0 and grows by 30 days;
           - objective "t_stat": highest training t-statistic instead;
           - every pair held fixed through all nine test windows;
           - the pair chosen once on the first training window and held;
           - the pair that is best over all nine test windows (hindsight).
One engine call per (fold, pair): the bars of training + test are loaded and
the engine's split is put at the start of the test window, so its `in_sample`
block is the training window and its `out_of_sample` block the test window.
Each block starts flat with 10,000 USDT; a position open at a block's last
bar is closed at that close, costs charged.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/walk-forward-analysis/walk_forward.py [engine]
        engine  default ../perpmath-engine

Output: research/walk-forward-analysis/walk_forward.json and the table printed
below (saved as walk_forward_output.txt by redirecting stdout).
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import perpmath
from perpmath.backtest import normalize_config, run_backtest
from perpmath.data import file_sha256, iso_utc, load_bars, parse_date_ms
from perpmath.engine import ExecutionConfig, simulate
from perpmath.metrics import max_drawdown_pct, t_statistic
from perpmath.strategies import ma_cross

HERE = Path(__file__).resolve().parent
DAY_MS = 86_400_000

D0 = "2025-11-19"
TRAIN_DAYS, TEST_DAYS, STEP_DAYS, FOLDS = 90, 30, 30, 9
FAST = (5, 10, 20, 50)
SLOW = (20, 50, 100, 200)
GRID = [(f, s) for f in FAST for s in SLOW if f < s]
FIXED_PARAMS = {"atr_period": 14, "stop_atr_mult": 2.0}
EXECUTION = {"fee_rate": 0.00055, "slippage": 0.0002, "initial_capital": 10000,
             "notional_fraction": 1.0, "max_hold_bars": None}
CAPITAL = 10000.0
SHIPPED = (20, 50)
KEEP = ("trades", "insufficient_sample", "win_rate_pct", "avg_r", "avg_trade_return_pct", "t_stat",
        "total_return_pct", "max_drawdown_pct", "total_fees", "avg_bars_held", "final_equity")


def day(ms):
    return iso_utc(ms)[:10]


def name(pair):
    return f"{pair[0]}/{pair[1]}"


def config_for(pair, oos_start_ms):
    return normalize_config({
        "strategy": "ma_cross",
        "params": {"fast_period": pair[0], "slow_period": pair[1], **FIXED_PARAMS},
        "execution": dict(EXECUTION),
        "split": {"oos_start": day(oos_start_ms)},
    }, "ma_cross")


def engine_run(path, pair, start_ms, split_ms, end_ms):
    """One engine backtest: bars [start, end), split at `split`. Returns (document, bars)."""
    bars = load_bars(path, start_ms, end_ms)
    document = run_backtest("ma_cross", bars, config_for(pair, split_ms), "BTCUSDT", "15m")
    assert document["timing"]["lookahead_check"]["passed"] is True
    assert document["split"]["oos_start"] == iso_utc(split_ms)
    return document, bars


def block(document, label):
    m = document[label]["metrics"]
    out = {key: m[key] for key in KEEP}
    out["first_bar"] = document[label]["first_bar"]
    out["last_bar"] = document[label]["last_bar"]
    out["bars"] = document[label]["bars"]
    return out


def choose(train_blocks, objective):
    """GRID order breaks ties: max() keeps the first of equal keys."""
    def key(pair):
        value = train_blocks[name(pair)][objective]
        return -math.inf if value is None else value
    return max(GRID, key=key)


def spearman(a, b):
    """Rank correlation without ties handling beyond average ranks."""
    def ranks(values):
        order = np.argsort(values, kind="stable")
        r = np.empty(len(values))
        r[order] = np.arange(1, len(values) + 1)
        values = np.asarray(values)
        for v in np.unique(values):
            same = values == v
            r[same] = r[same].mean()
        return r
    ra, rb = ranks(a), ranks(b)
    return float(np.corrcoef(ra, rb)[0, 1])


def stitch(windows):
    """Chain test windows: each starts with the equity the one before ended on.

    `windows` is a list of dicts with `equity` (bar-close equity of a window
    started at CAPITAL) and `returns` (per-trade return_pct). Position size is
    100% of equity and every cost is proportional, so scaling a window's
    equity path by the equity carried in is exact.
    """
    carried, path, returns = CAPITAL, [], []
    for window in windows:
        path.extend((np.asarray(window["equity"]) * (carried / CAPITAL)).tolist())
        carried = path[-1]
        returns.extend(window["returns"])
    wins = sum(1 for r in returns if r > 0)
    return {
        "trades": len(returns),
        "insufficient_sample": len(returns) < 100,
        "win_rate_pct": round(wins / len(returns) * 100, 4) if returns else None,
        "avg_trade_return_pct": round(float(np.mean(returns)), 4) if returns else None,
        "t_stat": None if t_statistic(returns) is None else round(t_statistic(returns), 4),
        "total_return_pct": round((carried / CAPITAL - 1) * 100, 4),
        "max_drawdown_pct_bar_close": round(max_drawdown_pct(path, CAPITAL), 4),
        "final_equity": round(carried, 2),
    }


def bar_level(path, pair, start_ms, split_ms, end_ms, document):
    """Bar-close equity and trade returns of the test window, from the engine's simulator.

    The result document only holds daily equity points. This calls the same
    two engine functions `run_backtest` calls and stops unless they reproduce
    the document's test-window metrics.
    """
    bars = load_bars(path, start_ms, end_ms)
    params = document["config"]["params"]
    signals = ma_cross.generate(bars, params)
    split_index = int(np.searchsorted(bars.ts, split_ms))
    result = simulate(bars, signals, ExecutionConfig(**document["config"]["execution"]), split_index, len(bars))
    m = document["out_of_sample"]["metrics"]
    assert len(result.trades) == m["trades"], "simulator and document disagree on the trade count"
    assert round(float(result.equity[-1]), 2) == m["final_equity"], "simulator and document disagree on equity"
    assert round(max_drawdown_pct(result.equity, CAPITAL), 4) == m["max_drawdown_pct"]
    return {"equity": result.equity.tolist(), "returns": [t.return_pct for t in result.trades]}


def self_check():
    """Small cases with answers worked out by hand."""
    # Two windows: +10% then -50%, started at 10,000 each. Chained: 10,000 -> 11,000 -> 5,500.
    a = {"equity": [10000.0, 11000.0], "returns": [10.0]}
    b = {"equity": [10000.0, 12000.0, 5000.0], "returns": [20.0, -58.3333]}
    s = stitch([a, b])
    assert s["final_equity"] == 5500.0 and s["total_return_pct"] == -45.0
    # Peak is 11,000 x 1.2 = 13,200, trough 5,500: drawdown 58.3333%.
    assert s["max_drawdown_pct_bar_close"] == 58.3333
    assert s["trades"] == 3 and s["insufficient_sample"] is True
    # Selection: highest value wins, the first in GRID order wins a tie, None never wins.
    blocks = {name(p): {"total_return_pct": -5.0, "t_stat": None} for p in GRID}
    assert choose(blocks, "total_return_pct") == GRID[0]
    blocks[name(GRID[7])]["total_return_pct"] = 1.0
    blocks[name(GRID[9])]["total_return_pct"] = 1.0
    assert choose(blocks, "total_return_pct") == GRID[7]
    blocks[name(GRID[3])]["t_stat"] = -0.5
    assert choose(blocks, "t_stat") == GRID[3]
    # Rank correlation: identical order 1, reversed order -1.
    assert abs(spearman([1, 2, 3, 4], [10, 20, 30, 40]) - 1) < 1e-12
    assert abs(spearman([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-12
    assert len(GRID) == 13


def main():
    self_check()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    data_path = engine / "data" / "BTCUSDT-15m.csv"
    with open(engine / "results" / "ma-cross-btcusdt.json", encoding="utf-8") as handle:
        published = json.load(handle)
    sha = file_sha256(data_path)
    if sha != published["data"]["file_sha256"]:
        raise SystemExit("candle file differs from the one behind the engine's published result")

    d0 = parse_date_ms(D0)
    folds = []
    for k in range(FOLDS):
        train_start = d0 + k * STEP_DAYS * DAY_MS
        test_start = train_start + TRAIN_DAYS * DAY_MS
        folds.append({"fold": k + 1, "train_start": train_start, "test_start": test_start,
                      "test_end": test_start + TEST_DAYS * DAY_MS})
    span_start, span_end = folds[0]["test_start"], folds[-1]["test_end"]
    assert all(folds[i]["test_end"] == folds[i + 1]["test_start"] for i in range(FOLDS - 1))

    runs = 0
    documents = {}   # (mode, fold, pair) -> engine document
    for fold in folds:
        for mode, start in (("rolling", fold["train_start"]), ("anchored", d0)):
            for pair in GRID:
                if mode == "anchored" and fold["fold"] == 1:
                    documents[(mode, 1, pair)] = documents[("rolling", 1, pair)]
                    continue
                documents[(mode, fold["fold"], pair)], _ = engine_run(
                    data_path, pair, start, fold["test_start"], fold["test_end"])
                runs += 1
        print(f"fold {fold['fold']} done ({runs} engine runs so far)", file=sys.stderr)

    # The test window of a fold must not depend on where the training window started.
    for fold in folds:
        for pair in GRID:
            rolling = documents[("rolling", fold["fold"], pair)]["out_of_sample"]["metrics"]
            anchored = documents[("anchored", fold["fold"], pair)]["out_of_sample"]["metrics"]
            assert rolling == anchored, f"fold {fold['fold']} {name(pair)}: test window differs between modes"

    # One continuous run per pair over the whole test span (no restart every 30 days).
    continuous = {}
    for pair in GRID:
        document, _ = engine_run(data_path, pair, d0, span_start, span_end)
        runs += 1
        first_training = documents[("rolling", 1, pair)]["in_sample"]["metrics"]
        assert document["in_sample"]["metrics"] == first_training
        continuous[name(pair)] = block(document, "out_of_sample")

    # Same run twice gives the same document, apart from the timestamp.
    again, _ = engine_run(data_path, SHIPPED, folds[0]["train_start"], folds[0]["test_start"], folds[0]["test_end"])
    first = documents[("rolling", 1, SHIPPED)]
    assert {k: v for k, v in again.items() if k != "generated_at"} == \
           {k: v for k, v in first.items() if k != "generated_at"}

    fold_rows = []
    for fold in folds:
        row = {"fold": fold["fold"],
               "train_rolling": [day(fold["train_start"]), day(fold["test_start"])],
               "train_anchored": [day(d0), day(fold["test_start"])],
               "test": [day(fold["test_start"]), day(fold["test_end"])]}
        test = {name(p): block(documents[("rolling", fold["fold"], p)], "out_of_sample") for p in GRID}
        row["test_by_pair"] = test
        test_returns = [test[name(p)]["total_return_pct"] for p in GRID]
        order = sorted(GRID, key=lambda p: -test[name(p)]["total_return_pct"])
        row["test_best_pair"] = name(order[0])
        row["test_median_return_pct"] = round(float(np.median(test_returns)), 4)
        row["test_mean_return_pct"] = round(float(np.mean(test_returns)), 4)
        for mode in ("rolling", "anchored"):
            train = {name(p): block(documents[(mode, fold["fold"], p)], "in_sample") for p in GRID}
            row[f"train_by_pair_{mode}"] = train
            train_returns = [train[name(p)]["total_return_pct"] for p in GRID]
            row[f"rank_correlation_train_vs_test_{mode}"] = round(spearman(train_returns, test_returns), 4)
            for objective in ("total_return_pct", "t_stat"):
                pick = choose(train, objective)
                row[f"chosen_{mode}_{objective}"] = {
                    "pair": name(pick),
                    "train": train[name(pick)],
                    "test": test[name(pick)],
                    "test_rank_of_13": order.index(pick) + 1,
                }
        fold_rows.append(row)

    def walk(mode, objective):
        windows, picks = [], []
        for fold, row in zip(folds, fold_rows):
            pick = tuple(int(x) for x in row[f"chosen_{mode}_{objective}"]["pair"].split("/"))
            start = fold["train_start"] if mode == "rolling" else d0
            windows.append(bar_level(data_path, pick, start, fold["test_start"], fold["test_end"],
                                     documents[(mode, fold["fold"], pick)]))
            picks.append(name(pick))
        out = stitch(windows)
        out["pairs_by_fold"] = picks
        out["folds_with_a_profit"] = sum(1 for w in windows if w["equity"][-1] > CAPITAL)
        ranks = [row[f"chosen_{mode}_{objective}"]["test_rank_of_13"] for row in fold_rows]
        out["test_rank_by_fold"] = ranks
        out["mean_test_rank"] = round(float(np.mean(ranks)), 4)
        train_returns = [row[f"chosen_{mode}_{objective}"]["train"]["total_return_pct"] for row in fold_rows]
        out["train_return_pct_by_fold"] = train_returns
        out["mean_train_return_pct"] = round(float(np.mean(train_returns)), 4)
        out["test_return_pct_by_fold"] = [row[f"chosen_{mode}_{objective}"]["test"]["total_return_pct"]
                                          for row in fold_rows]
        return out

    walk_forward = {f"{mode}_{objective}": walk(mode, objective)
                    for mode in ("rolling", "anchored") for objective in ("total_return_pct", "t_stat")}

    fixed = {}
    for pair in GRID:
        windows = [bar_level(data_path, pair, fold["train_start"], fold["test_start"], fold["test_end"],
                             documents[("rolling", fold["fold"], pair)]) for fold in folds]
        fixed[name(pair)] = stitch(windows)
        fixed[name(pair)]["folds_with_a_profit"] = sum(1 for w in windows if w["equity"][-1] > CAPITAL)
    hindsight = max(GRID, key=lambda p: fixed[name(p)]["total_return_pct"])
    once = fold_rows[0]["chosen_rolling_total_return_pct"]["pair"]

    # A pair drawn at random for every fold, independently: the expected final
    # equity is the product of the per-fold means of (1 + return).
    growth = 1.0
    for row in fold_rows:
        growth *= 1 + row["test_mean_return_pct"] / 100
    random_pick = round((growth - 1) * 100, 4)

    # Walk-forward efficiency as usually quoted: annualised test return over
    # annualised training return. Reported with the inputs, because the ratio
    # stops meaning anything when the training return is negative.
    main_walk = walk_forward["rolling_total_return_pct"]
    span_days = (span_end - span_start) / DAY_MS
    annual_test = ((1 + main_walk["total_return_pct"] / 100) ** (365 / span_days) - 1) * 100
    annual_train = float(np.mean([((1 + r / 100) ** (365 / TRAIN_DAYS) - 1) * 100
                                  for r in main_walk["train_return_pct_by_fold"]]))
    efficiency = {
        "annualised_test_return_pct": round(annual_test, 4),
        "mean_annualised_train_return_pct": round(annual_train, 4),
        "ratio": round(annual_test / annual_train, 4) if annual_train else None,
        "note": "a positive ratio from two negative returns is not a pass",
    }

    summary = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "engine": {"package_version": perpmath.__version__, "numpy": np.__version__,
                   "python": sys.version.split()[0], "runs": runs,
                   "lookahead_check": "passed on every run (engine default mode)"},
        "data": {"file": data_path.name, "file_sha256": sha, "symbol": "BTCUSDT", "interval": "15m",
                 "first_bar": iso_utc(d0), "end_exclusive": iso_utc(span_end)},
        "design": {"d0": D0, "train_days": TRAIN_DAYS, "test_days": TEST_DAYS, "step_days": STEP_DAYS,
                   "folds": FOLDS, "grid": [name(p) for p in GRID], "fixed_params": FIXED_PARAMS,
                   "execution": EXECUTION, "objective": "total_return_pct of the training window",
                   "tie_break": "first in grid order",
                   "test_span": [day(span_start), day(span_end)], "test_span_days": span_days},
        "walk_forward": walk_forward,
        "fixed_pair_stitched": fixed,
        "fixed_pair_continuous": continuous,
        "pick_once_on_first_training_window": {"pair": once, "stitched": fixed[once],
                                               "continuous": continuous[once]},
        "hindsight_best_over_test_span": {"pair": name(hindsight), "stitched": fixed[name(hindsight)],
                                          "continuous": continuous[name(hindsight)]},
        "shipped_pair": {"pair": name(SHIPPED), "stitched": fixed[name(SHIPPED)],
                         "continuous": continuous[name(SHIPPED)]},
        "random_pair_each_fold_expected_return_pct": random_pick,
        "walk_forward_efficiency": efficiency,
        "folds": fold_rows,
    }
    with open(HERE / "walk_forward.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")

    print(f"perpmath {perpmath.__version__}, {runs} engine runs, look-ahead check passed on each")
    print(f"BTCUSDT 15m, test span {day(span_start)} to {day(span_end)} ({span_days:.0f} days), "
          f"training {TRAIN_DAYS} days, test {TEST_DAYS} days")
    print()
    print(f"{'fold':<5}{'test window':<25}{'chosen':>8}{'train %':>9}{'train n':>8}{'test %':>9}"
          f"{'test n':>7}{'rank':>6}{'best':>8}{'best %':>8}{'median %':>10}{'rho':>7}")
    for row in fold_rows:
        c = row["chosen_rolling_total_return_pct"]
        best = row["test_by_pair"][row["test_best_pair"]]
        print(f"{row['fold']:<5}{row['test'][0] + ' ' + row['test'][1]:<25}{c['pair']:>8}"
              f"{c['train']['total_return_pct']:>9.2f}{c['train']['trades']:>8}"
              f"{c['test']['total_return_pct']:>9.2f}{c['test']['trades']:>7}{c['test_rank_of_13']:>6}"
              f"{row['test_best_pair']:>8}{best['total_return_pct']:>8.2f}"
              f"{row['test_median_return_pct']:>10.2f}{row['rank_correlation_train_vs_test_rolling']:>7.2f}")
    print()
    print(f"{'over the nine test windows':<40}{'trades':>7}{'win %':>8}{'t-stat':>8}{'return %':>10}{'max DD %':>10}")

    def line(label, s):
        print(f"{label:<40}{s['trades']:>7}{s['win_rate_pct']:>8.2f}{s['t_stat']:>8.2f}"
              f"{s['total_return_pct']:>10.2f}{s['max_drawdown_pct_bar_close']:>10.2f}")
    line("walk-forward, rolling, by return", walk_forward["rolling_total_return_pct"])
    line("walk-forward, anchored, by return", walk_forward["anchored_total_return_pct"])
    line("walk-forward, rolling, by t-stat", walk_forward["rolling_t_stat"])
    line("walk-forward, anchored, by t-stat", walk_forward["anchored_t_stat"])
    line(f"picked once on fold 1 training ({once})", fixed[once])
    line(f"shipped pair ({name(SHIPPED)})", fixed[name(SHIPPED)])
    line(f"best in hindsight ({name(hindsight)})", fixed[name(hindsight)])
    print(f"{'random pair each fold, expected':<40}{'':>7}{'':>8}{'':>8}{random_pick:>10.2f}")
    print()
    print("every pair held fixed (stitched = restart flat every 30 days, continuous = one run)")
    print(f"{'pair':<10}{'trades':>7}{'t-stat':>8}{'stitched %':>12}{'max DD %':>10}{'continuous %':>14}{'cont. trades':>14}")
    for pair in sorted(GRID, key=lambda p: -fixed[name(p)]["total_return_pct"]):
        s, c = fixed[name(pair)], continuous[name(pair)]
        print(f"{name(pair):<10}{s['trades']:>7}{s['t_stat']:>8.2f}{s['total_return_pct']:>12.2f}"
              f"{s['max_drawdown_pct_bar_close']:>10.2f}{c['total_return_pct']:>14.2f}{c['trades']:>14}")
    print()
    print(f"walk-forward efficiency inputs: test {efficiency['annualised_test_return_pct']:.2f}% a year, "
          f"training {efficiency['mean_annualised_train_return_pct']:.2f}% a year, ratio {efficiency['ratio']}")
    print("wrote research/walk-forward-analysis/walk_forward.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
