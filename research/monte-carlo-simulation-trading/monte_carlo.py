import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/monte-carlo-simulation-trading: resampling the engine's real trade lists.

Reads, and never writes, two result files of the open-source engine
(https://github.com/sentinelbotsaas-hub/perpmath, version 0.2.2):

    results/ma-cross-btcusdt.json    results/fvg-btcusdt.json

Each file has an in-sample and an out-of-sample block, so there are four
trade lists. For each one the trades are put in a new order many times and
the equity curve is rebuilt.

EVERYTHING IN THIS BLOCK WAS FIXED BEFORE THE FIRST RUN
-------------------------------------------------------
PATHS      10,000 per method and trade list.
SEED       20261202. Every (trade list, sizing, method) gets its own stream:
           numpy.random.default_rng([SEED, list number, sizing number, method number]).
Sizing     "as_run"   every trade moves equity by the share it moved it in the
                      backtest: pnl / entry notional (the engine puts 100% of
                      equity into each trade, so that share is the trade's
                      return on the account).
           "risk_1pct" every trade risks 1% of the equity at that moment, so
                      it moves equity by 0.01 x its R multiple.
Methods    "shuffle"   the same trades in a random order (no replacement).
           "bootstrap" as many trades as the list has, drawn with replacement.
           "blocks"    moving-block bootstrap: blocks of BLOCK = 20 consecutive
                      trades (wrapping around the end), drawn with replacement
                      and cut to the list's length. Keeps what happens inside
                      20 trades in a row.
Measured   max drawdown on the equity after each closed trade (the starting
           capital is the first peak) and the final equity, both per path;
           percentiles 1, 5, 25, 50, 75, 95, 99; the longest run of losing
           trades; whether the path ever touches 20% or 50% below the START
           (the definition the site's risk-of-ruin calculator uses).
Calculator inputs written to the summary for ruin_calculator.mjs: win rate p,
           payoff b = mean winning move / mean losing move, risk r = mean
           losing move, thresholds 0.2 and 0.5, horizon = number of trades.

ADDED AFTER THE FIRST RUN OF THE BLOCK ABOVE (nothing above was changed, and
the first run's numbers are reproduced unchanged; the settings below were
written down before these two parts were run)
---------------------------------------------------------------------------
Forecast   For each strategy: 10,000 bootstrap paths drawn from the IN-SAMPLE
           trade list, each as long as the OUT-OF-SAMPLE list, sizing "as_run",
           stream [SEED, 100 + strategy number]. Where does the out-of-sample
           result that actually followed fall in that distribution?
Grid       results/grid-btcusdt.json. Its fill list holds the profit of every
           closed cell position (before fees). The grid uses a fixed USDT size
           per cell, so equity is rebuilt by adding, not compounding:
           10,000 + running sum of the shuffled profits. 10,000 shuffles with
           and without the final market close of the leftover inventory,
           stream [SEED, 200 + sample number, variant]. Compared with the
           engine's published max drawdown, which is marked to market at
           every bar close.

The drawdown here is measured on closed trades, not at every bar close, so
the "original" figure is the closed-trade one, not the engine's published
`max_drawdown_pct` (see research/max-drawdown/).

Usage, from the site's root folder (NumPy needed; the engine's Python has it):
    <engine>/.venv/Scripts/python research/monte-carlo-simulation-trading/monte_carlo.py [engine]
        engine  default ../perpmath-engine

Output: research/monte-carlo-simulation-trading/monte_carlo.json and a table.
"""
import itertools
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PATHS = 10_000
SEED = 20261202
BLOCK = 20
RISK = 0.01
THRESHOLDS = (0.2, 0.5)
PERCENTILES = (1, 5, 25, 50, 75, 95, 99)
FILES = (("ma_cross", "ma-cross-btcusdt.json"), ("fvg", "fvg-btcusdt.json"))
SAMPLES = ("in_sample", "out_of_sample")
SIZINGS = ("as_run", "risk_1pct")
METHODS = ("shuffle", "bootstrap", "blocks")


def paths_stats(moves):
    """`moves`: array (paths, trades) of per-trade equity changes as fractions.

    Returns per path: max drawdown (fraction of the peak, the start being the
    first peak), final equity as a multiple of the start, the lowest equity as
    a multiple of the start, and the longest run of losing trades.
    """
    equity = np.cumprod(1.0 + moves, axis=1)
    peaks = np.maximum.accumulate(np.concatenate((np.ones((len(equity), 1)), equity), axis=1), axis=1)[:, 1:]
    drawdown = np.max((peaks - equity) / peaks, axis=1)
    losing = moves < 0
    run = np.zeros(len(moves), dtype=np.int64)
    longest = np.zeros(len(moves), dtype=np.int64)
    for column in range(moves.shape[1]):
        run = np.where(losing[:, column], run + 1, 0)
        longest = np.maximum(longest, run)
    return drawdown, equity[:, -1], np.min(equity, axis=1), longest


def draw(moves, method, rng, paths=PATHS, block=BLOCK):
    """`paths` reorderings of the 1-D array `moves`."""
    n = len(moves)
    if method == "shuffle":
        return rng.permuted(np.tile(moves, (paths, 1)), axis=1)
    if method == "bootstrap":
        return moves[rng.integers(0, n, size=(paths, n))]
    if method == "blocks":
        count = math.ceil(n / block)
        starts = rng.integers(0, n, size=(paths, count))
        index = (starts[:, :, None] + np.arange(block)[None, None, :]) % n
        return moves[index.reshape(paths, count * block)[:, :n]]
    raise ValueError(method)


def percentiles(values):
    return {f"p{p}": round(float(np.percentile(values, p)), 4) for p in PERCENTILES}


def summarise(moves, original):
    drawdown, final, lowest, longest = paths_stats(moves)
    out = {
        "max_drawdown_pct": percentiles(drawdown * 100),
        "final_return_pct": percentiles((final - 1) * 100),
        "longest_losing_run": percentiles(longest),
        "paths_ending_above_start_pct": round(float(np.mean(final > 1) * 100), 2),
        "paths_with_deeper_drawdown_than_original_pct":
            round(float(np.mean(drawdown > original["max_drawdown"] + 1e-12) * 100), 2),
        "paths_with_longer_losing_run_than_original_pct":
            round(float(np.mean(longest > original["longest_losing_run"]) * 100), 2),
    }
    for threshold in THRESHOLDS:
        out[f"paths_touching_{int(threshold * 100)}pct_below_start_pct"] = \
            round(float(np.mean(lowest <= 1 - threshold + 1e-12) * 100), 2)
    return out


def runs_test(wins):
    """Wald-Wolfowitz runs test on a win/loss sequence. z < 0: fewer runs than chance (clustering)."""
    wins = np.asarray(wins, dtype=bool)
    n1, n2 = int(wins.sum()), int((~wins).sum())
    runs = 1 + int(np.count_nonzero(wins[1:] != wins[:-1]))
    n = n1 + n2
    expected = 2 * n1 * n2 / n + 1
    variance = 2 * n1 * n2 * (2 * n1 * n2 - n) / (n * n * (n - 1))
    return {"runs": runs, "expected_runs": round(expected, 2), "z": round((runs - expected) / math.sqrt(variance), 4)}


def lag1(values):
    values = np.asarray(values, dtype=np.float64)
    return round(float(np.corrcoef(values[:-1], values[1:])[0, 1]), 4)


def additive_drawdown(profits, capital):
    """Max drawdown (fraction of the peak) of capital + running sum, per row; the start is the first peak."""
    equity = capital + np.cumsum(profits, axis=1)
    peaks = np.maximum.accumulate(np.concatenate((np.full((len(equity), 1), capital), equity), axis=1), axis=1)[:, 1:]
    return np.max((peaks - equity) / peaks, axis=1)


def self_check():
    """Small cases with answers worked out by hand, and a rerun with the same seed."""
    # 10,000 -> 11,000 -> 5,500 -> 6,600: drawdown 50% (11,000 to 5,500), final -34%.
    dd, final, lowest, longest = paths_stats(np.array([[0.10, -0.50, 0.20]]))
    assert abs(dd[0] - 0.5) < 1e-12 and abs(final[0] - 0.66) < 1e-12 and abs(lowest[0] - 0.55) < 1e-12
    assert longest[0] == 1
    # Never above the start: the start is the first peak. 0.9 x 0.8 = 0.72, drawdown 28%.
    dd, final, lowest, longest = paths_stats(np.array([[-0.10, -0.20, 0.50]]))
    assert abs(dd[0] - 0.28) < 1e-12 and abs(final[0] - 1.08) < 1e-12 and longest[0] == 2
    # All six orders of (-10%, -20%, +50%). By hand: the drawdown is 28% when the
    # two losses are adjacent (four orders) and 20% when the gain sits between
    # them (two orders). The final equity is 1.08 in every order.
    orders = np.array(list(itertools.permutations([-0.10, -0.20, 0.50])))
    dd, final, _, _ = paths_stats(orders)
    assert sorted(np.round(dd, 10).tolist()) == [0.2, 0.2, 0.28, 0.28, 0.28, 0.28]
    assert np.allclose(final, 1.08, rtol=0, atol=1e-12)
    # A shuffle keeps every trade exactly once; a bootstrap keeps the length.
    moves = np.array([0.01, -0.02, 0.03, -0.04, 0.05, -0.06, 0.07])
    shuffled = draw(moves, "shuffle", np.random.default_rng([SEED, 99, 0, 0]), paths=50)
    assert np.array_equal(np.sort(shuffled, axis=1), np.tile(np.sort(moves), (50, 1)))
    assert draw(moves, "bootstrap", np.random.default_rng([SEED, 99, 0, 1]), paths=50).shape == (50, 7)
    # Blocks of 3 on 7 trades: inside a block the next trade is the next one of the original list.
    blocks = draw(np.arange(7.0), "blocks", np.random.default_rng([SEED, 99, 0, 2]), paths=50, block=3)
    assert blocks.shape == (50, 7)
    for start in (0, 3):
        assert np.all((blocks[:, start + 1] - blocks[:, start]) % 7 == 1)
        assert np.all((blocks[:, start + 2] - blocks[:, start + 1]) % 7 == 1)
    # Same seed, same numbers.
    for method in METHODS:
        a = draw(moves, method, np.random.default_rng([SEED, 99, 1, 0]), paths=200)
        b = draw(moves, method, np.random.default_rng([SEED, 99, 1, 0]), paths=200)
        assert np.array_equal(a, b)
    # Runs test, by hand: W W L L has 2 runs, expected 2*2*2/4 + 1 = 3, variance 2*4*(8-4)/(16*3) = 2/3.
    r = runs_test([True, True, False, False])
    assert r["runs"] == 2 and r["expected_runs"] == 3.0 and abs(r["z"] - (-1 / math.sqrt(2 / 3))) < 1e-4
    # Additive equity: 100 +10 -44 +20 -> 110, 66, 86. Peak 110, trough 66: drawdown 40%.
    assert abs(additive_drawdown(np.array([[10.0, -44.0, 20.0]]), 100.0)[0] - 0.4) < 1e-12
    # Only winners: no drawdown at all, in any order.
    assert additive_drawdown(np.array([[2.0, 2.0, 2.0]]), 100.0)[0] == 0.0
    # Touching a threshold below the start: 0.9 x 0.8 = 0.72 touches 20% down, not 50%.
    _, _, lowest, _ = paths_stats(np.array([[-0.10, -0.20, 0.50]]))
    assert lowest[0] <= 1 - 0.2 and not lowest[0] <= 1 - 0.5


def main():
    self_check()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine = Path(args[0]).resolve() if args else (HERE.parent.parent.parent / "perpmath-engine").resolve()
    summary = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "numpy": np.__version__, "python": sys.version.split()[0],
        "paths": PATHS, "seed": SEED, "block_length": BLOCK, "risk_per_trade": RISK,
        "thresholds_below_start": list(THRESHOLDS), "drawdown_sampling": "after each closed trade",
        "engine_results": {}, "lists": {},
    }
    rows = []
    kept = {}
    for list_number, ((strategy, file_name), sample) in enumerate(itertools.product(FILES, SAMPLES)):
        with open(engine / "results" / file_name, encoding="utf-8") as handle:
            document = json.load(handle)
        summary["engine_results"][file_name] = {
            "package_version": document["package_version"], "generated_at": document["generated_at"],
            "data_file_sha256": document["data"]["file_sha256"]}
        block = document[sample]
        trades, metrics = block["trades"], block["metrics"]
        capital = document["config"]["execution"]["initial_capital"]
        pnl = np.array([t["pnl"] for t in trades])
        notional = np.array([t["quantity"] * t["entry_price"] for t in trades])
        r_multiple = np.array([t["r_multiple"] for t in trades])

        # The trade list must rebuild the engine's own final equity before anything is resampled.
        rebuilt = capital + float(pnl.sum())
        assert abs(rebuilt - metrics["final_equity"]) < 0.05, (strategy, sample, rebuilt)
        assert len(trades) == metrics["trades"] >= 100
        as_run = pnl / notional
        kept[(strategy, sample)] = as_run
        equity_before = capital + np.concatenate(([0.0], np.cumsum(pnl)[:-1]))
        assert np.allclose(notional, equity_before, rtol=1e-6), "position size is not 100% of equity"
        assert abs(float(np.prod(1 + as_run)) * capital - metrics["final_equity"]) < 0.05

        entry = {"strategy": strategy, "sample": sample, "trades": len(trades),
                 "engine_total_return_pct": metrics["total_return_pct"],
                 "engine_max_drawdown_pct_bar_close": metrics["max_drawdown_pct"],
                 "engine_avg_r": metrics["avg_r"], "engine_win_rate_pct": metrics["win_rate_pct"],
                 "stop_distance_pct_median": round(float(np.median(
                     [abs(t["entry_price"] - t["stop_price"]) / t["entry_price"] * 100 for t in trades])), 4),
                 "order_dependence": {
                     "lag1_autocorrelation_of_trade_returns": lag1(as_run),
                     "lag1_autocorrelation_of_r_multiples": lag1(r_multiple),
                     "runs_test_on_wins_and_losses": runs_test(pnl > 0)},
                 "sizing": {}}
        for sizing_number, sizing in enumerate(SIZINGS):
            moves = as_run if sizing == "as_run" else RISK * r_multiple
            dd, final, lowest, longest = paths_stats(moves[None, :])
            original = {"max_drawdown": float(dd[0]), "longest_losing_run": int(longest[0])}
            wins, losses = moves[moves > 0], -moves[moves < 0]
            sized = {
                "original_path": {
                    "max_drawdown_pct": round(float(dd[0]) * 100, 4),
                    "final_return_pct": round((float(final[0]) - 1) * 100, 4),
                    "lowest_equity_vs_start_pct": round((float(lowest[0]) - 1) * 100, 4),
                    "longest_losing_run": int(longest[0])},
                "calculator_inputs": {
                    "win_rate": round(len(wins) / len(moves), 6),
                    "payoff": round(float(wins.mean() / losses.mean()), 6),
                    "risk_per_trade": round(float(losses.mean()), 8),
                    "trades": len(moves),
                    "mean_move_pct": round(float(moves.mean()) * 100, 6),
                    "zero_moves": int(np.count_nonzero(moves == 0))},
                # Descriptive only (added with the forecast and grid parts): how far the
                # real trades are from a coin with one win size and one loss size.
                "shape_pct": {
                    "wins": len(wins), "losses": len(losses),
                    "win_mean": round(float(wins.mean()) * 100, 4), "win_median": round(float(np.median(wins)) * 100, 4),
                    "win_largest": round(float(wins.max()) * 100, 4),
                    "loss_mean": round(float(losses.mean()) * 100, 4), "loss_median": round(float(np.median(losses)) * 100, 4),
                    "loss_largest": round(float(losses.max()) * 100, 4),
                    "standard_deviation": round(float(moves.std(ddof=1)) * 100, 4),
                    "standard_deviation_of_the_two_outcome_coin": round(float(math.sqrt(
                        len(wins) / len(moves) * (1 - len(wins) / len(moves))) * (wins.mean() + losses.mean())) * 100, 4)},
                "methods": {}}
            for method_number, method in enumerate(METHODS):
                seed = [SEED, list_number, sizing_number, method_number]
                drawn = draw(moves, method, np.random.default_rng(seed))
                again = draw(moves, method, np.random.default_rng(seed))
                assert np.array_equal(drawn, again), "same seed gave different paths"
                stats = summarise(drawn, original)
                if method == "shuffle":
                    finals = np.prod(1 + drawn, axis=1)
                    assert np.allclose(finals, final[0], rtol=1e-9), "a shuffle changed the final equity"
                    stats["final_return_is_the_same_on_every_path"] = True
                if method == "bootstrap":
                    means = drawn.mean(axis=1)
                    standard_error = moves.std(ddof=1) / math.sqrt(len(moves))
                    assert abs(means.mean() - moves.mean()) < 5 * standard_error / math.sqrt(PATHS)
                sized["methods"][method] = stats
            entry["sizing"][sizing] = sized
        summary["lists"][f"{strategy}/{sample}"] = entry
        rows.append(entry)

    # Cross-check against the closed-trade drawdowns measured for the max-drawdown article.
    earlier = HERE.parent / "max-drawdown" / "drawdown_measures.json"
    if earlier.exists():
        with open(earlier, encoding="utf-8") as handle:
            measured = json.load(handle)["strategies"]
        for entry in rows:
            theirs = measured[entry["strategy"]][entry["sample"]]["measures"]["closed_trades"]["max_drawdown_pct"]
            ours = entry["sizing"]["as_run"]["original_path"]["max_drawdown_pct"]
            assert abs(theirs - ours) < 0.01, (entry["strategy"], entry["sample"], theirs, ours)
        summary["cross_check"] = "closed-trade max drawdown equals research/max-drawdown/drawdown_measures.json"

    # ---- added after the first run: does the in-sample list bracket what came next? ----
    summary["forecast_from_in_sample"] = {}
    for strategy_number, (strategy, _) in enumerate(FILES):
        source, target = kept[(strategy, "in_sample")], kept[(strategy, "out_of_sample")]
        seed = [SEED, 100 + strategy_number]
        drawn = source[np.random.default_rng(seed).integers(0, len(source), size=(PATHS, len(target)))]
        again = source[np.random.default_rng(seed).integers(0, len(source), size=(PATHS, len(target)))]
        assert np.array_equal(drawn, again)
        dd, final, _, _ = paths_stats(drawn)
        actual_dd, actual_final, _, _ = paths_stats(target[None, :])
        summary["forecast_from_in_sample"][strategy] = {
            "drawn_from": f"{strategy}/in_sample ({len(source)} trades)", "path_length": len(target),
            "final_return_pct": percentiles((final - 1) * 100),
            "max_drawdown_pct": percentiles(dd * 100),
            "actual_out_of_sample_final_return_pct": round((float(actual_final[0]) - 1) * 100, 4),
            "actual_out_of_sample_max_drawdown_pct": round(float(actual_dd[0]) * 100, 4),
            "paths_with_a_worse_final_return_than_actual_pct": round(float(np.mean(final < actual_final[0]) * 100), 2),
            "paths_with_a_deeper_drawdown_than_actual_pct": round(float(np.mean(dd > actual_dd[0]) * 100), 2),
        }

    # ---- added after the first run: a trade list that leaves the risk out (the grid) ----
    with open(engine / "results" / "grid-btcusdt.json", encoding="utf-8") as handle:
        grid = json.load(handle)
    summary["engine_results"]["grid-btcusdt.json"] = {
        "package_version": grid["package_version"], "generated_at": grid["generated_at"],
        "data_file_sha256": grid["data"]["file_sha256"]}
    summary["grid"] = {}
    for sample_number, sample in enumerate(SAMPLES):
        capital = grid["config"]["execution"]["initial_capital"]
        closed = [f for f in grid[sample]["fills"] if f["pnl"] is not None]
        round_trips = np.array([f["pnl"] for f in closed if f["kind"] == "grid"])
        end_close = np.array([f["pnl"] for f in closed if f["kind"] != "grid"])
        metrics = grid[sample]["metrics"]
        assert len(round_trips) == metrics["round_trips"]
        assert abs(float(round_trips.sum() + end_close.sum()) - metrics["trading_pnl"]) < 0.05
        entry = {"round_trips": len(round_trips), "round_trips_closed_at_a_loss": int(np.sum(round_trips < 0)),
                 "final_close_fills": len(end_close), "final_close_profit": round(float(end_close.sum()), 4),
                 "engine_max_drawdown_pct_marked_to_market": metrics["max_drawdown_pct"],
                 "engine_total_return_pct": metrics["total_return_pct"], "equity": "additive, profits before fees"}
        for variant, profits in enumerate((round_trips, np.concatenate((round_trips, end_close)))):
            rng = np.random.default_rng([SEED, 200 + sample_number, variant])
            shuffled = rng.permuted(np.tile(profits, (PATHS, 1)), axis=1)
            dd = additive_drawdown(shuffled, capital) * 100
            original = additive_drawdown(profits[None, :], capital)[0] * 100
            entry["round_trips_only" if variant == 0 else "with_final_close"] = {
                "original_order_max_drawdown_pct": round(float(original), 4),
                "shuffled_max_drawdown_pct": percentiles(dd),
                "shuffled_max_drawdown_pct_largest": round(float(dd.max()), 4)}
        summary["grid"][sample] = entry

    with open(HERE / "monte_carlo.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")

    print(f"{PATHS:,} paths per method, seed {SEED}, block length {BLOCK}, NumPy {np.__version__}")
    for sizing in SIZINGS:
        print()
        print(f"sizing: {sizing}   max drawdown % on closed trades (p5 / p50 / p95), final return % (p5 / p50 / p95)")
        print(f"{'list':<26}{'n':>5}{'orig DD':>9}{'orig ret':>10}  {'method':<10}"
              f"{'DD p5':>8}{'DD p50':>8}{'DD p95':>8}{'ret p5':>9}{'ret p50':>9}{'ret p95':>9}{'deeper %':>10}{'up %':>7}")
        for entry in rows:
            s = entry["sizing"][sizing]
            for method in METHODS:
                m = s["methods"][method]
                d, f = m["max_drawdown_pct"], m["final_return_pct"]
                label = f"{entry['strategy']}/{entry['sample']}" if method == METHODS[0] else ""
                print(f"{label:<26}{entry['trades'] if label else '':>5}"
                      f"{s['original_path']['max_drawdown_pct'] if label else '':>9}"
                      f"{s['original_path']['final_return_pct'] if label else '':>10}  {method:<10}"
                      f"{d['p5']:>8.2f}{d['p50']:>8.2f}{d['p95']:>8.2f}{f['p5']:>9.2f}{f['p50']:>9.2f}{f['p95']:>9.2f}"
                      f"{m['paths_with_deeper_drawdown_than_original_pct']:>10.2f}"
                      f"{m['paths_ending_above_start_pct']:>7.2f}")
    print()
    print(f"{'list':<26}{'lag-1 r':>9}{'runs z':>8}{'orig streak':>13}{'shuffle streak p5/p50/p95':>28}{'longer %':>10}")
    for entry in rows:
        s = entry["sizing"]["as_run"]
        m = s["methods"]["shuffle"]
        streak = m["longest_losing_run"]
        print(f"{entry['strategy'] + '/' + entry['sample']:<26}"
              f"{entry['order_dependence']['lag1_autocorrelation_of_trade_returns']:>9.4f}"
              f"{entry['order_dependence']['runs_test_on_wins_and_losses']['z']:>8.2f}"
              f"{s['original_path']['longest_losing_run']:>13}"
              f"{str(int(streak['p5'])) + ' / ' + str(int(streak['p50'])) + ' / ' + str(int(streak['p95'])):>28}"
              f"{m['paths_with_longer_losing_run_than_original_pct']:>10.2f}")
    print()
    print("in-sample list resampled to the length of the out-of-sample list (sizing as_run)")
    print(f"{'strategy':<12}{'ret p5':>9}{'ret p50':>9}{'ret p95':>9}{'actual':>9}{'worse %':>9}"
          f"{'DD p5':>8}{'DD p50':>8}{'DD p95':>8}{'actual':>9}{'deeper %':>10}")
    for strategy, f in summary["forecast_from_in_sample"].items():
        r, d = f["final_return_pct"], f["max_drawdown_pct"]
        print(f"{strategy:<12}{r['p5']:>9.2f}{r['p50']:>9.2f}{r['p95']:>9.2f}"
              f"{f['actual_out_of_sample_final_return_pct']:>9.2f}{f['paths_with_a_worse_final_return_than_actual_pct']:>9.2f}"
              f"{d['p5']:>8.2f}{d['p50']:>8.2f}{d['p95']:>8.2f}"
              f"{f['actual_out_of_sample_max_drawdown_pct']:>9.2f}{f['paths_with_a_deeper_drawdown_than_actual_pct']:>10.2f}")
    print()
    print("grid: max drawdown % of shuffled closed-position profits against the engine's marked-to-market figure")
    print(f"{'sample':<16}{'round trips':>12}{'losers':>8}{'final close':>13}{'RT only p95':>13}{'RT only max':>13}"
          f"{'with close p95':>16}{'with close max':>16}{'engine':>9}")
    for sample, g in summary["grid"].items():
        print(f"{sample:<16}{g['round_trips']:>12}{g['round_trips_closed_at_a_loss']:>8}{g['final_close_profit']:>13.2f}"
              f"{g['round_trips_only']['shuffled_max_drawdown_pct']['p95']:>13.4f}"
              f"{g['round_trips_only']['shuffled_max_drawdown_pct_largest']:>13.4f}"
              f"{g['with_final_close']['shuffled_max_drawdown_pct']['p95']:>16.4f}"
              f"{g['with_final_close']['shuffled_max_drawdown_pct_largest']:>16.4f}"
              f"{g['engine_max_drawdown_pct_marked_to_market']:>9.4f}")
    print()
    print("thresholds below the start (sizing as_run, bootstrap): share of paths touching 20% / 50% down")
    for entry in rows:
        m = entry["sizing"]["as_run"]["methods"]["bootstrap"]
        print(f"{entry['strategy'] + '/' + entry['sample']:<26}"
              f"{m['paths_touching_20pct_below_start_pct']:>8.2f}{m['paths_touching_50pct_below_start_pct']:>8.2f}")
    print()
    print("wrote research/monte-carlo-simulation-trading/monte_carlo.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
