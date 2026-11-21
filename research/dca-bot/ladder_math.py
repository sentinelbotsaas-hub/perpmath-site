import dca_sim as d  # noqa: E402  (also switches stdout to UTF-8)
"""Article en/dca-bot: the ladder after the last safety order, by arithmetic alone.

No market data. For each rule set, with every order filled at its level and no costs:
the paper loss of the full ladder when price is at a given percentage of the base
price, next to a single 10,000 USDT buy at the base price, and the rise needed from
there to reach the take profit. Paper loss = cost x (price / average - 1).

Usage: <engine>/.venv/Scripts/python research/dca-bot/ladder_math.py
Output: printed, and research/dca-bot/ladder_math.json
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRICES = (90, 85, 80, 75, 70, 60, 50)


def main():
    out = {"article": "en/dca-bot", "base_price": 100.0, "capital": 10_000.0, "rule_sets": {}}
    for rules in (d.MAIN, d.CONTROL):
        sizes, levels = rules.sizes(), [100.0] + rules.levels(100.0)
        units = sum(usdt / price for usdt, price in zip(sizes, levels))
        average = rules.capital / units
        rows = []
        for p in PRICES:
            loss = units * p - rules.capital
            assert d.near(loss, rules.capital * (p / average - 1.0))
            rows.append({
                "price_pct_of_base": p,
                "full_ladder_paper_loss": round(loss, 2),
                "single_buy_at_base_paper_loss": round(rules.capital * (p / 100.0 - 1.0), 2),
                "ladder_loss_as_share_of_single_buy_pct": round(100 * loss / (rules.capital * (p / 100.0 - 1.0)), 2),
                "rise_needed_to_take_profit_pct": round(100 * (average * (1 + rules.take_profit) / p - 1.0), 2),
            })
        out["rule_sets"][rules.name] = {"units_per_100_base": round(units, 6), "average_pct_of_base": round(average, 4),
                                        "paper_loss_per_1pct_of_base": round(units, 2), "rows": rows}
        print(f"== {rules.name}: average {average:.4f}% of base, {units:.2f} USDT of paper loss per 1% of the base price")
        for r in rows:
            print(f"   price {r['price_pct_of_base']:>3}% of base: ladder {r['full_ladder_paper_loss']:>9}  "
                  f"single buy {r['single_buy_at_base_paper_loss']:>9}  ({r['ladder_loss_as_share_of_single_buy_pct']}%)  "
                  f"needs +{r['rise_needed_to_take_profit_pct']}% to take profit")
    with open(HERE / "ladder_math.json", "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))


if __name__ == "__main__":
    main()
