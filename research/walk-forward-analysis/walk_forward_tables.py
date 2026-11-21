import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/walk-forward-analysis: figures derived from walk_forward.json.

No engine run and no new data: this only counts and averages what
walk_forward.py already wrote. Standard library only.

Usage, from the site's root folder:
    python research/walk-forward-analysis/walk_forward_tables.py

Output: research/walk-forward-analysis/walk_forward_tables.json and a printout.
"""
import json
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    with open(HERE / "walk_forward.json", encoding="utf-8") as handle:
        data = json.load(handle)
    folds, grid = data["folds"], data["design"]["grid"]
    out = {"per_fold": []}

    train_positive = test_positive = 0
    for row in folds:
        train = row["train_by_pair_rolling"]
        test = row["test_by_pair"]
        chosen = row["chosen_rolling_total_return_pct"]
        train_returns = sorted(((train[p]["total_return_pct"], p) for p in grid), reverse=True)
        fold_train_positive = sum(1 for p in grid if train[p]["total_return_pct"] > 0)
        fold_test_positive = sum(1 for p in grid if test[p]["total_return_pct"] > 0)
        train_positive += fold_train_positive
        test_positive += fold_test_positive
        out["per_fold"].append({
            "fold": row["fold"], "test": row["test"], "chosen": chosen["pair"],
            "chosen_train_return_pct": chosen["train"]["total_return_pct"],
            "chosen_train_trades": chosen["train"]["trades"],
            "chosen_train_t_stat": chosen["train"]["t_stat"],
            "runner_up_in_training": train_returns[1][1],
            "runner_up_train_return_pct": train_returns[1][0],
            "pairs_with_a_profit_in_training": fold_train_positive,
            "chosen_test_return_pct": chosen["test"]["total_return_pct"],
            "chosen_test_trades": chosen["test"]["trades"],
            "chosen_test_rank": chosen["test_rank_of_13"],
            "pairs_with_a_profit_in_test": fold_test_positive,
            "test_best_pair": row["test_best_pair"],
            "test_best_return_pct": test[row["test_best_pair"]]["total_return_pct"],
            "test_median_return_pct": row["test_median_return_pct"],
            "test_worst_return_pct": min(test[p]["total_return_pct"] for p in grid),
            "chosen_minus_median_pp": round(chosen["test"]["total_return_pct"] - row["test_median_return_pct"], 4),
            "rank_correlation": row["rank_correlation_train_vs_test_rolling"],
            "chosen_anchored": row["chosen_anchored_total_return_pct"]["pair"],
            "chosen_by_t_stat": row["chosen_rolling_t_stat"]["pair"],
            "trades_in_training_by_pair": {p: train[p]["trades"] for p in grid},
        })

    rows = out["per_fold"]
    chosen_train = [r["chosen_train_return_pct"] for r in rows]
    chosen_test = [r["chosen_test_return_pct"] for r in rows]
    out["totals"] = {
        "pair_windows": len(folds) * len(grid),
        "training_windows_with_a_profit": train_positive,
        "test_windows_with_a_profit": test_positive,
        "folds_where_chosen_pair_made_money_in_training": sum(1 for v in chosen_train if v > 0),
        "folds_where_chosen_pair_made_money_in_test": sum(1 for v in chosen_test if v > 0),
        "mean_chosen_train_return_pct": round(statistics.mean(chosen_train), 4),
        "mean_chosen_test_return_pct": round(statistics.mean(chosen_test), 4),
        "median_chosen_test_return_pct": round(statistics.median(chosen_test), 4),
        "folds_chosen_ranked_first_in_test": sum(1 for r in rows if r["chosen_test_rank"] == 1),
        "folds_chosen_in_top_three_in_test": sum(1 for r in rows if r["chosen_test_rank"] <= 3),
        "folds_chosen_beat_the_median_pair": sum(1 for r in rows if r["chosen_minus_median_pp"] > 0),
        "mean_rank_correlation": round(statistics.mean(r["rank_correlation"] for r in rows), 4),
        "min_rank_correlation": min(r["rank_correlation"] for r in rows),
        "max_rank_correlation": max(r["rank_correlation"] for r in rows),
        "chosen_training_windows_under_100_trades": sum(1 for r in rows if r["chosen_train_trades"] < 100),
        "chosen_test_trades_min": min(r["chosen_test_trades"] for r in rows),
        "chosen_test_trades_max": max(r["chosen_test_trades"] for r in rows),
        "distinct_pairs_chosen": sorted({r["chosen"] for r in rows}),
        "folds_where_chosen_was_the_fewest_trades_pair_in_training": sum(
            1 for r in rows
            if r["trades_in_training_by_pair"][r["chosen"]] == min(r["trades_in_training_by_pair"].values())),
        "folds_where_chosen_was_among_the_four_fewest_trades_pairs": sum(
            1 for r in rows
            if r["trades_in_training_by_pair"][r["chosen"]] <= sorted(r["trades_in_training_by_pair"].values())[3]),
        "fixed_pairs_with_a_profit_over_the_test_span": sum(
            1 for p in grid if data["fixed_pair_stitched"][p]["total_return_pct"] > 0),
    }
    # Rank correlation between trades per pair (fewer = better rank) and the pair's stitched return.
    fixed = data["fixed_pair_stitched"]
    by_trades = sorted(grid, key=lambda p: fixed[p]["trades"])
    by_return = sorted(grid, key=lambda p: -fixed[p]["total_return_pct"])
    d2 = sum((by_trades.index(p) - by_return.index(p)) ** 2 for p in grid)
    n = len(grid)
    out["totals"]["rank_correlation_fewer_trades_vs_higher_return_fixed_pairs"] = round(1 - 6 * d2 / (n * (n * n - 1)), 4)

    with open(HERE / "walk_forward_tables.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=1)
        handle.write("\n")

    print(f"{'fold':<5}{'chosen':>8}{'train %':>9}{'train t':>9}{'train n':>8}{'runner-up':>11}{'ru %':>8}{'prof/13':>9}"
          f"{'test %':>9}{'test n':>7}{'rank':>6}{'test prof/13':>14}{'worst %':>9}{'vs median':>11}{'anchored':>10}{'by t':>8}")
    for r in rows:
        print(f"{r['fold']:<5}{r['chosen']:>8}{r['chosen_train_return_pct']:>9.2f}{r['chosen_train_t_stat']:>9.2f}"
              f"{r['chosen_train_trades']:>8}{r['runner_up_in_training']:>11}{r['runner_up_train_return_pct']:>8.2f}"
              f"{r['pairs_with_a_profit_in_training']:>9}{r['chosen_test_return_pct']:>9.2f}{r['chosen_test_trades']:>7}"
              f"{r['chosen_test_rank']:>6}{r['pairs_with_a_profit_in_test']:>14}{r['test_worst_return_pct']:>9.2f}"
              f"{r['chosen_minus_median_pp']:>11.2f}{r['chosen_anchored']:>10}{r['chosen_by_t_stat']:>8}")
    print()
    for key, value in out["totals"].items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
