import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/dca-bot: a DCA (safety order) bot simulated on one year of BTCUSDT 15m bars.

The perpmath engine has no DCA mode: its strategy engine holds one position
with one entry, and its grid simulator has no take-profit on an average
price. So the simulation is written here. It uses the engine only to load and
check the candle and funding files and to place the in-sample / out-of-sample
split on the same UTC midnight as the engine's own results.

RULES. Written down on 2026-11-21 (UTC), before this script was first run on
real data. Both rule sets were run once. Nothing below was changed afterwards.

  Market        BTCUSDT USDT perpetual on Bybit, 15-minute bars, long only.
  Capital       10,000 USDT at the start of each sample. Order sizes are fixed
                in USDT and do not grow or shrink with the account.
  Base order    A market buy at the open of the first bar of the sample, and
                at the open of the bar after every completed cycle ("start a
                new deal as soon as the last one closes").
  Safety orders Resting limit buys below the base order's fill price:
                MAIN  ("x2"): 5 orders, 2% apart (2, 4, 6, 8, 10% below), each
                              twice the size of the one before; the first is
                              the size of the base order.
                              Sizes 312.50 / 312.50 / 625 / 1,250 / 2,500 /
                              5,000 USDT = 10,000 USDT when all have filled.
                CONTROL ("x1"): the same 5 levels, every order the same size:
                              6 x 1,666.67 USDT = 10,000 USDT.
                Only the size multiplier differs between the two (2 against
                1); the base order size follows from keeping the budget equal.
  Take profit   One limit sell for the whole position at 1% above the average
                entry price. Average = total cost / total quantity, the same
                formula as perpmath.com/tools/dca-calculator/. It is replaced
                after every safety order fill.
  Stop-loss     None, in both sets. A cycle ends at its take profit or at the
                end of the sample, where what is still open is sold at the
                last close with a market order.
  Leverage      1 in the simulation: the full ladder costs exactly the
                starting capital. Leverage is looked at separately (see
                "leverage overlay" below) with the liquidation formula of the
                site's calculators.

FILLS AND COSTS (the engine's grid conventions, see its README):
  - A limit order fills only when a bar trades strictly through its level, and
    it fills at the level, never better, also after a gap.
  - Slippage 0.02% against us on every fill, limit fills included.
  - Fees: 0.055% of notional on market orders (base order, end-of-sample
    close), 0.02% on limit fills (safety orders, take profit). Bybit VIP 0
    taker and maker rates for perpetuals, read 2026-11-19 by the engine.
  - Funding: at every settlement the position pays quantity x price x rate,
    price = close of the bar that ends at the settlement time.
  - Inside one bar the order of the high and the low is unknown. Rule: safety
    orders are filled first, and on a bar in which a safety order filled the
    take profit cannot fill; it waits for a later bar. The script counts how
    many bars this rule affected.
  - Quantities are not rounded to the exchange's 0.001 BTC step.

LEVERAGE OVERLAY. With leverage L every order is L times larger on the same
10,000 USDT, on isolated margin with nothing added. The fills and the average
price are then the same as at 1x, so the 1x path can be asked: did price reach
the liquidation price before the cycle ended? Liquidation price of a long =
average price x (1 - 1/L + MMR), recomputed after every fill, with MMR 0.33%
(Bybit BTCUSDT risk tier 1). That is liquidationPrice() of the site's
calculators with the average price as the entry, exactly what
src/lib/calc/dca.ts does. A safety order whose level is at or below the
liquidation price of the position held before it can never fill. After a
liquidation the real path would differ from the 1x path, so the overlay
reports the cycles of the 1x path that would not have survived, and the
first one; it does not simulate what happens next.

SELF-CHECKS (run on every start, before any real data is read): hand-worked
examples for the average price, the liquidation price (the same numbers as
src/lib/calc/dca.test.ts), one cycle with and without costs, a ladder that
fills completely and keeps falling, the same-bar rule, and funding. The real
run is then done twice and the two results must be identical.

Usage, from the site's root folder, with the engine's Python:
    <engine>/.venv/Scripts/python -m perpmath funding BTCUSDT --start 2025-11-18T00:00:00Z \
        --end 2026-11-18T12:00:00Z --data-dir research/dca-bot/data
    <engine>/.venv/Scripts/python research/dca-bot/dca_sim.py [candle-data-dir]
        candle-data-dir  folder holding BTCUSDT-15m.csv, default <engine>/data
    ... dca_sim.py --selftest      only the self-checks, no data needed

Output: research/dca-bot/dca_summary.json, cycles-x2.json, cycles-x1.json.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
RULES_FIXED_ON = "2026-11-21"
MMR = 0.0033                       # Bybit BTCUSDT risk tier 1, up to 300,000 USDT of position
LEVERAGES = (2, 3, 5, 10, 20)
DAY_MS = 86_400_000


@dataclass(frozen=True)
class Rules:
    name: str
    volume_scale: float
    capital: float = 10_000.0
    safety_orders: int = 5
    step: float = 0.02             # each safety order this much further below the base fill price
    take_profit: float = 0.01      # above the average entry price
    taker_fee: float = 0.00055
    maker_fee: float = 0.0002
    slippage: float = 0.0002

    def sizes(self):
        """USDT size of the base order and of each safety order; they add up to the capital."""
        weights = [1.0] + [self.volume_scale ** k for k in range(self.safety_orders)]
        unit = self.capital / sum(weights)
        return [unit * w for w in weights]

    def levels(self, base_fill_price):
        return [base_fill_price * (1.0 - self.step * (k + 1)) for k in range(self.safety_orders)]


MAIN = Rules(name="x2", volume_scale=2.0)
CONTROL = Rules(name="x1", volume_scale=1.0)


def average_price(fills):
    """fills: [(price, quantity)]. Sum of costs / sum of quantities (dca.ts averagePrice)."""
    cost = sum(p * q for p, q in fills)
    quantity = sum(q for _, q in fills)
    return cost / quantity


def liquidation_price_long(average, leverage, mmr=MMR):
    """liquidation.ts, long, no extra margin: entry x (1 - 1/leverage + MMR)."""
    return average * (1.0 - 1.0 / leverage + mmr)


@dataclass
class Cycle:
    start_ms: int
    base_price: float
    levels: list
    fills: list = field(default_factory=list)       # (price, quantity, usdt, kind, time_ms)
    quantity: float = 0.0
    cost: float = 0.0
    fees: float = 0.0
    funding: float = 0.0
    next_so: int = 0
    bars: int = 0
    worst_unrealized: float = 0.0                   # lowest quantity x low - cost, before fees
    worst_unrealized_ms: int = 0
    lowest_price: float = float("inf")
    full_since_ms: int = 0                          # time the last safety order filled, 0 = never
    bars_full: int = 0
    worst_unrealized_full: float = 0.0
    liquidated: dict = field(default_factory=dict)  # leverage -> time_ms of the bar that reached it

    @property
    def average(self):
        return self.cost / self.quantity


def simulate(rules, ts, open_, high, low, close, step_ms, funding=None):
    """One sample, bars [0, n). funding: {settlement_time_ms: rate} or None.
    Returns a dict with the cycles, the equity at every bar close and the totals."""
    n = len(ts)
    sizes = rules.sizes()
    funding = funding or {}
    realized = 0.0                                   # closed cycles, net of fees and funding
    cycles, equity = [], []
    cycle = None
    deferred_tp_bars = 0
    fees_total = funding_total = 0.0

    def close_cycle(c, price, fee_rate, when_ms, how):
        nonlocal realized, fees_total
        sell = price * (1.0 - rules.slippage)
        fee = c.quantity * sell * fee_rate
        c.fees += fee
        fees_total += fee
        gross = c.quantity * sell - c.cost
        net = gross - c.fees - c.funding
        realized += net
        cycles.append({
            "start": int(c.start_ms), "end": int(when_ms), "how": how, "bars": c.bars,
            "safety_orders_filled": c.next_so, "cost": c.cost, "quantity": c.quantity,
            "base_price": c.base_price, "average_price": c.cost / c.quantity, "exit_price": sell,
            "gross": gross, "fees": c.fees, "funding": c.funding, "net": net,
            "worst_unrealized": c.worst_unrealized, "worst_unrealized_time": int(c.worst_unrealized_ms),
            "lowest_price": c.lowest_price, "lowest_vs_base": c.lowest_price / c.base_price - 1.0,
            "bars_full": c.bars_full, "worst_unrealized_full": c.worst_unrealized_full,
            "full_since": int(c.full_since_ms),
            "liquidated_at": {str(k): int(v) for k, v in sorted(c.liquidated.items())},
            "fills": [{"time": int(t), "kind": kind, "price": p, "usdt": u} for p, q, u, kind, t in c.fills],
        })

    for i in range(n):
        o, h, l, cl, t = float(open_[i]), float(high[i]), float(low[i]), float(close[i]), int(ts[i])
        so_filled = False
        if cycle is None:                            # base order: market buy at this bar's open
            price = o * (1.0 + rules.slippage)
            cycle = Cycle(start_ms=t, base_price=price, levels=rules.levels(price))
            qty = sizes[0] / price
            cycle.fills.append((price, qty, sizes[0], "base", t))
            cycle.quantity, cycle.cost = qty, sizes[0]
            fee = sizes[0] * rules.taker_fee
            cycle.fees += fee
            fees_total += fee
        cycle.bars += 1

        # Safety orders, highest level first. Strictly through the level, filled at the level.
        while cycle.next_so < rules.safety_orders and l < cycle.levels[cycle.next_so]:
            level = cycle.levels[cycle.next_so]
            for lev in LEVERAGES:                    # was the position still there when price got here?
                if lev not in cycle.liquidated and level <= liquidation_price_long(cycle.average, lev):
                    cycle.liquidated[lev] = t
            price = level * (1.0 + rules.slippage)
            usdt = sizes[cycle.next_so + 1]
            qty = usdt / price
            cycle.fills.append((price, qty, usdt, f"safety {cycle.next_so + 1}", t))
            cycle.quantity += qty
            cycle.cost += usdt
            fee = usdt * rules.maker_fee
            cycle.fees += fee
            fees_total += fee
            cycle.next_so += 1
            so_filled = True
            if cycle.next_so == rules.safety_orders:
                cycle.full_since_ms = t

        for lev in LEVERAGES:
            if lev not in cycle.liquidated and l <= liquidation_price_long(cycle.average, lev):
                cycle.liquidated[lev] = t

        unrealized_low = cycle.quantity * l - cycle.cost
        if unrealized_low < cycle.worst_unrealized:
            cycle.worst_unrealized, cycle.worst_unrealized_ms = unrealized_low, t
        cycle.lowest_price = min(cycle.lowest_price, l)
        if cycle.next_so == rules.safety_orders:
            cycle.bars_full += 1
            cycle.worst_unrealized_full = min(cycle.worst_unrealized_full, unrealized_low)

        # Take profit: one limit sell at 1% above the average, not on a bar with a safety fill.
        tp = cycle.average * (1.0 + rules.take_profit)
        if h > tp:
            if so_filled:
                deferred_tp_bars += 1
            else:
                close_cycle(cycle, tp, rules.maker_fee, t + step_ms, "take_profit")
                cycle = None

        # Funding at the settlement that coincides with this bar's close.
        rate = funding.get(t + step_ms)
        if rate is not None and cycle is not None:
            paid = cycle.quantity * cl * rate
            cycle.funding += paid
            funding_total += paid

        if i == n - 1 and cycle is not None:         # end of sample: market sell at the last close
            close_cycle(cycle, cl, rules.taker_fee, t + step_ms, "end_of_sample")
            cycle = None

        open_value = 0.0 if cycle is None else cycle.quantity * cl - cycle.cost - cycle.fees - cycle.funding
        equity.append(rules.capital + realized + open_value)

    peak, max_dd, max_dd_i = equity[0], 0.0, 0
    for i, value in enumerate(equity):
        peak = max(peak, value)
        dd = (peak - value) / peak
        if dd > max_dd:
            max_dd, max_dd_i = dd, i
    return {
        "cycles": cycles, "equity": equity, "final_equity": equity[-1], "fees": fees_total,
        "funding": funding_total, "deferred_tp_bars": deferred_tp_bars,
        "max_drawdown": max_dd, "max_drawdown_time": int(ts[max_dd_i]) + step_ms,
        "lowest_equity": min(equity), "lowest_equity_time": int(ts[equity.index(min(equity))]) + step_ms,
    }


def buy_and_hold(rules, ts, open_, close, step_ms, funding):
    """1x long bought at the first open and sold at the last close, market orders, with funding."""
    price = float(open_[0]) * (1.0 + rules.slippage)
    qty = rules.capital / price
    fees = rules.capital * rules.taker_fee
    paid = sum(qty * float(close[i]) * funding[int(ts[i]) + step_ms]
               for i in range(len(ts)) if int(ts[i]) + step_ms in funding)
    sell = float(close[-1]) * (1.0 - rules.slippage)
    fees += qty * sell * rules.taker_fee
    return {"final_equity": qty * sell - fees - paid, "fees": fees, "funding": paid}


# --------------------------------------------------------------------------- #
# Self-checks: small cases with answers worked by hand
# --------------------------------------------------------------------------- #

def near(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))


def bars_of(rows, step_ms=900_000):
    """rows: [(open, high, low, close)] -> columns."""
    ts = [i * step_ms for i in range(len(rows))]
    cols = list(zip(*rows))
    return ts, cols[0], cols[1], cols[2], cols[3], step_ms


def selftest():
    # 1. Average price and liquidation price: the numbers of src/lib/calc/dca.test.ts.
    assert near(average_price([(100, 1), (50, 3)]), 62.5)
    assert near(average_price([(68000, 0.01), (64000, 0.01), (62000, 0.02)]), 64000.0)
    assert near(average_price([(50, 100 / 50), (40, 100 / 40), (25, 100 / 25)]), 300 / 8.5)
    assert near(liquidation_price_long(68000, 10), 61424.4)      # 68,000 x 0.9033
    assert near(liquidation_price_long(66000, 10), 59617.8)
    assert near(liquidation_price_long(64000, 10), 57811.2)
    assert near(liquidation_price_long(50000, 5), 40165.0)       # a fill at 40,000 can never happen
    assert near(liquidation_price_long(50000, 2), 25165.0)

    # 2. The ladders cost exactly the capital.
    assert [round(x, 4) for x in MAIN.sizes()] == [312.5, 312.5, 625.0, 1250.0, 2500.0, 5000.0]
    assert near(sum(MAIN.sizes()), 10_000.0) and near(sum(CONTROL.sizes()), 10_000.0)
    assert all(near(x, 10_000.0 / 6) for x in CONTROL.sizes())
    assert [round(x, 6) for x in MAIN.levels(100.0)] == [98.0, 96.0, 94.0, 92.0, 90.0]

    free = Rules(name="free", volume_scale=2.0, taker_fee=0.0, maker_fee=0.0, slippage=0.0)

    # 3. One cycle, no costs. Base 312.5 at 100 (3.125 units). Bar 2 trades to 97.9: safety 1
    #    fills at 98 for 312.5 (3.188776 units). Cost 625, average 625 / 6.313776 = 98.98990.
    #    Take profit 99.97980 is crossed on bar 3. Profit = 1% of 625 = 6.25 exactly.
    rows = [(100, 100.5, 99.5, 100), (99.5, 99.6, 97.9, 98.5), (98.5, 100.2, 98.4, 100.1), (100.1, 100.2, 100, 100.1)]
    r = simulate(free, *bars_of(rows))
    c = r["cycles"][0]
    assert c["how"] == "take_profit" and c["safety_orders_filled"] == 1 and c["bars"] == 3
    assert near(c["quantity"], 3.125 + 312.5 / 98) and near(c["cost"], 625.0)
    assert near(c["average_price"], 625.0 / (3.125 + 312.5 / 98))
    assert near(c["net"], 6.25) and near(c["gross"], 6.25)
    # Lowest point of that cycle: 6.313776 units at 97.9 against a cost of 625 = -6.8814.
    assert near(c["worst_unrealized"], (3.125 + 312.5 / 98) * 97.9 - 625.0)
    # A second cycle opened on bar 4 (the last) and was sold at its close, flat: 0.
    assert len(r["cycles"]) == 2 and r["cycles"][1]["how"] == "end_of_sample" and near(r["cycles"][1]["net"], 0.0)
    assert near(r["final_equity"], 10_006.25) and r["deferred_tp_bars"] == 0

    # 4. The same bars with costs, every term written out.
    paid = Rules(name="paid", volume_scale=2.0)
    r = simulate(paid, *bars_of(rows))
    c = r["cycles"][0]
    s, mk, tk = 0.0002, 0.0002, 0.00055
    base_price = 100 * (1 + s)
    so_price = base_price * 0.98 * (1 + s)
    qty = 312.5 / base_price + 312.5 / so_price
    sell = (625.0 / qty) * 1.01 * (1 - s)
    fees = 312.5 * tk + 312.5 * mk + qty * sell * mk
    assert near(c["net"], qty * sell - 625.0 - fees) and near(c["fees"], fees)
    assert c["net"] < 6.25

    # 5. Same-bar rule: bar 2 also trades above the new take profit (high 100.5 > 99.98),
    #    but a safety order filled on it, so the cycle stays open until bar 3.
    rows5 = [(100, 100.5, 99.5, 100), (100, 100.5, 97.9, 98.5), (98.5, 100.2, 98.4, 100.1)]
    r = simulate(free, *bars_of(rows5))
    assert r["deferred_tp_bars"] == 1 and r["cycles"][0]["end"] == 3 * 900_000

    # 6. A ladder that fills completely and keeps falling, no costs. Base at 100, bar 2 falls
    #    to 80. Units = 312.5 x (1/100 + 1/98 + 2/96 + 4/94 + 8/92 + 16/90) = 108.851516.
    #    Average 10,000 / 108.851516 = 91.8683. At 80: 108.851516 x 80 - 10,000 = -1,291.88.
    rows6 = [(100, 100.2, 99.8, 100), (100, 100, 80, 80)]
    r = simulate(free, *bars_of(rows6))
    c = r["cycles"][0]
    units = 312.5 * (1 / 100 + 1 / 98 + 2 / 96 + 4 / 94 + 8 / 92 + 16 / 90)
    assert c["safety_orders_filled"] == 5 and near(c["quantity"], units) and near(c["cost"], 10_000.0)
    assert near(c["average_price"], 10_000.0 / units) and abs(c["average_price"] - 91.8683) < 1e-4
    assert near(c["net"], units * 80 - 10_000.0) and abs(c["net"] + 1291.88) < 0.005
    assert c["how"] == "end_of_sample" and near(r["final_equity"], 10_000.0 + units * 80 - 10_000.0)
    # Leverage overlay on that fall. 20x: liquidation after the base order is 100 x 0.9533 =
    # 95.33, and safety 1 at 98 and safety 2 at 96 are above it; after safety 2 the average is
    # 97.4603 and liquidation 92.909, safety 3 at 94 is above it; ... after all five the
    # average is 91.8683 and liquidation 87.578, which the low of 80 passes. 10x: liquidation
    # of the full ladder is 91.8683 x 0.9033 = 82.98, passed as well. 5x: 91.8683 x 0.8033 =
    # 73.80, not reached at 80.
    assert set(c["liquidated_at"]) == {"10", "20"}
    assert abs(liquidation_price_long(10_000.0 / units, 20) - 87.578) < 1e-3
    assert liquidation_price_long(10_000.0 / units, 10) > 80 > liquidation_price_long(10_000.0 / units, 5)
    assert abs(liquidation_price_long(10_000.0 / units, 5) - 73.798) < 1e-3
    # No fill of the x2 ladder is out of reach at any of these leverages. On the flat ladder at
    # 20x the fourth safety order is: after three of them the average is 4 / (1/100 + 1/98 +
    # 1/96 + 1/94) = 96.9483 and liquidation 96.9483 x 0.9533 = 92.42, above the level of 92.
    assert all(v is None for v in ladder_table(MAIN)["first_fill_that_cannot_happen"].values())
    assert ladder_table(CONTROL)["first_fill_that_cannot_happen"] == {"2": None, "3": None, "5": None, "10": None, "20": 4}

    # 7. Funding: 3.125 units held over one settlement at close 100 with rate 0.0001 pay 0.03125.
    rows7 = [(100, 100.2, 99.8, 100), (100, 100.3, 99.9, 100)]
    r = simulate(free, *bars_of(rows7), funding={900_000: 0.0001})
    assert near(r["funding"], 3.125 * 100 * 0.0001) and near(r["final_equity"], 10_000.0 - 0.03125)

    # 8. The flat ladder on the fall of check 6: units = 1,666.67 x (1/100 + ... + 1/90).
    r = simulate(Rules(name="free1", volume_scale=1.0, taker_fee=0.0, maker_fee=0.0, slippage=0.0), *bars_of(rows6))
    flat_units = (10_000.0 / 6) * sum(1 / p for p in (100, 98, 96, 94, 92, 90))
    assert near(r["cycles"][0]["quantity"], flat_units) and near(r["cycles"][0]["net"], flat_units * 80 - 10_000.0)
    return 8


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #

def iso(ms):
    import datetime
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def r2(x):
    return None if x is None else round(float(x), 2)


def describe_cycle(c, capital, step_ms):
    return {
        "start": iso(c["start"]), "end": iso(c["end"]), "how": c["how"],
        "days": round(c["bars"] * step_ms / DAY_MS, 2), "bars": c["bars"],
        "safety_orders_filled": c["safety_orders_filled"], "cost": r2(c["cost"]),
        "base_price": r2(c["base_price"]), "average_price": r2(c["average_price"]), "exit_price": r2(c["exit_price"]),
        "net": r2(c["net"]), "fees": r2(c["fees"]), "funding": r2(c["funding"]),
        "worst_unrealized": r2(c["worst_unrealized"]),
        "worst_unrealized_pct_of_capital": r2(100 * c["worst_unrealized"] / capital),
        "worst_unrealized_time": iso(c["worst_unrealized_time"]),
        "lowest_price": r2(c["lowest_price"]), "lowest_vs_base_pct": r2(100 * c["lowest_vs_base"]),
        "days_fully_loaded": round(c["bars_full"] * step_ms / DAY_MS, 2),
        "worst_unrealized_fully_loaded": r2(c["worst_unrealized_full"]),
    }


def summarize(rules, result, hold, step_ms, n_bars):
    cycles = result["cycles"]
    done = [c for c in cycles if c["how"] == "take_profit"]
    left = [c for c in cycles if c["how"] == "end_of_sample"]
    nets = [c["net"] for c in done]
    days = [c["bars"] * step_ms / DAY_MS for c in done]
    by_so = {}
    for k in range(rules.safety_orders + 1):
        group = [c for c in done if c["safety_orders_filled"] == k]
        by_so[str(k)] = {
            "cycles": len(group), "net_sum": r2(sum(c["net"] for c in group)),
            "net_avg": r2(sum(c["net"] for c in group) / len(group)) if group else None,
            "median_hours": round(median(c["bars"] for c in group) * step_ms / 3_600_000, 2) if group else None,
        }
    longest = max(cycles, key=lambda c: c["bars"])
    deepest = min(cycles, key=lambda c: c["worst_unrealized"])
    full = [c for c in cycles if c["safety_orders_filled"] == rules.safety_orders]
    overlay = {}
    for lev in LEVERAGES:
        hit = [c for c in cycles if str(lev) in c["liquidated_at"]]
        first = min(hit, key=lambda c: c["liquidated_at"][str(lev)]) if hit else None
        overlay[str(lev)] = {
            "cycles_reaching_liquidation": len(hit), "of_cycles": len(cycles),
            "first_time": iso(first["liquidated_at"][str(lev)]) if first else None,
            "first_cycle_start": iso(first["start"]) if first else None,
            "first_cycle_number": cycles.index(first) + 1 if first else None,
            "take_profits_before_first": sum(1 for c in cycles[:cycles.index(first)] if c["how"] == "take_profit") if first else None,
            "net_at_1x_before_first": r2(sum(c["net"] for c in cycles[:cycles.index(first)])) if first else None,
            "safety_orders_filled_when_reached": None if first is None else sum(
                1 for f in first["fills"] if f["kind"].startswith("safety") and f["time"] <= first["liquidated_at"][str(lev)]),
        }
    bars_in_market = sum(c["bars"] for c in cycles)
    return {
        "completed_cycles": len(done),
        "net_from_completed_cycles": r2(sum(nets)),
        "net_per_completed_cycle": {"avg": r2(sum(nets) / len(nets)) if nets else None,
                                    "median": r2(median(nets)) if nets else None,
                                    "min": r2(min(nets)) if nets else None, "max": r2(max(nets)) if nets else None},
        "days_per_completed_cycle": {"median": round(median(days), 3) if days else None,
                                     "max": round(max(days), 2) if days else None},
        "completed_within_one_day": sum(1 for d in days if d <= 1.0),
        "completed_cycles_by_safety_orders_filled": by_so,
        "left_open_at_end": [describe_cycle(c, rules.capital, step_ms) for c in left],
        "net_from_position_left_at_end": r2(sum(c["net"] for c in left)),
        "fees": r2(result["fees"]), "funding_paid": r2(result["funding"]),
        "final_equity": r2(result["final_equity"]),
        "total_return_pct": r2(100 * (result["final_equity"] / rules.capital - 1)),
        "max_drawdown_pct": r2(100 * result["max_drawdown"]), "max_drawdown_time": iso(result["max_drawdown_time"]),
        "lowest_equity": r2(result["lowest_equity"]), "lowest_equity_time": iso(result["lowest_equity_time"]),
        "longest_cycle": describe_cycle(longest, rules.capital, step_ms),
        "deepest_cycle": describe_cycle(deepest, rules.capital, step_ms),
        "cycles_fully_loaded": len(full),
        "fully_loaded": [describe_cycle(c, rules.capital, step_ms) for c in full],
        "days_fully_loaded_total": round(sum(c["bars_full"] for c in cycles) * step_ms / DAY_MS, 2),
        "share_of_bars_fully_loaded_pct": r2(100 * sum(c["bars_full"] for c in cycles) / n_bars),
        "share_of_bars_in_a_cycle_pct": r2(100 * bars_in_market / n_bars),
        "bars_where_take_profit_waited_for_a_safety_fill": result["deferred_tp_bars"],
        "buy_and_hold_with_funding": {"total_return_pct": r2(100 * (hold["final_equity"] / rules.capital - 1)),
                                      "final_equity": r2(hold["final_equity"]), "funding_paid": r2(hold["funding"])},
        "leverage_overlay": overlay,
    }


def ladder_table(rules, base=100.0):
    """The ladder with no costs, as the DCA calculator shows it: average and liquidation price
    after every fill as a fraction of the base price, and which fills could never happen."""
    sizes, levels = rules.sizes(), [base] + rules.levels(base)
    rows, cost, qty = [], 0.0, 0.0
    blocked = {lev: None for lev in LEVERAGES}
    for k, (usdt, price) in enumerate(zip(sizes, levels)):
        for lev in LEVERAGES:
            if k > 0 and blocked[lev] is None and price <= liquidation_price_long(cost / qty, lev):
                blocked[lev] = k
        cost += usdt
        qty += usdt / price
        avg = cost / qty
        rows.append({
            "fill": "base" if k == 0 else f"safety {k}", "price_pct_of_base": round(100 * price / base, 2),
            "usdt": round(usdt, 2), "total_usdt": round(cost, 2), "average_pct_of_base": round(100 * avg / base, 4),
            "rise_from_this_fill_to_average_pct": round(100 * (avg / price - 1), 4),
            "rise_from_this_fill_to_take_profit_pct": round(100 * (avg * (1 + rules.take_profit) / price - 1), 4),
            "liquidation_pct_of_base": {str(lev): round(100 * liquidation_price_long(avg, lev) / base, 4) for lev in LEVERAGES},
            "fall_from_this_fill_to_liquidation_pct": {
                str(lev): round(100 * (1 - liquidation_price_long(avg, lev) / price), 4) for lev in LEVERAGES},
        })
    return {"rows": rows, "first_fill_that_cannot_happen": {str(k): v for k, v in blocked.items()}}


def main():
    checks = selftest()
    print(f"self-checks passed: {checks} groups")
    if "--selftest" in sys.argv:
        return 0

    import numpy as np
    import perpmath
    from perpmath.backtest import _split_time
    from perpmath.data import cache_path, count_missing_bars, file_sha256, interval_ms, load_bars
    from perpmath.funding import check_coverage, funding_cache_path, load_funding

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    data_dir = Path(args[0]).resolve() if args else engine_root / "data"
    candle_path = cache_path(str(data_dir), "BTCUSDT", "15m")
    funding_path = funding_cache_path(str(HERE / "data"), "BTCUSDT")
    bars = load_bars(candle_path)
    step_ms = interval_ms("15m")
    assert count_missing_bars(bars, step_ms) == 0
    rates = load_funding(funding_path)
    check_coverage(rates, int(bars.ts[0]), int(bars.ts[-1]) + step_ms)
    funding = {int(t): float(r) for t, r in zip(rates.ts, rates.rate)}
    split_ms = _split_time(bars, step_ms, {"in_sample_fraction": 0.7})
    split = int(np.searchsorted(bars.ts, split_ms))

    samples = {"in_sample": (0, split), "out_of_sample": (split, len(bars))}
    out = {
        "article": "en/dca-bot",
        "rules_fixed_on": RULES_FIXED_ON,
        "engine_version_used_for_loading": perpmath.__version__,
        "data": {
            "candles": candle_path.name, "candles_sha256": file_sha256(candle_path), "bars": len(bars),
            "first_bar": iso(int(bars.ts[0])), "last_bar": iso(int(bars.ts[-1])),
            "funding": funding_path.name, "funding_sha256": file_sha256(funding_path), "funding_settlements": len(rates),
            "out_of_sample_starts": iso(split_ms),
        },
        "costs": {"taker_fee": MAIN.taker_fee, "maker_fee": MAIN.maker_fee, "slippage": MAIN.slippage,
                  "maintenance_margin_rate": MMR},
        "rule_sets": {},
    }
    for rules in (MAIN, CONTROL):
        block = {
            "rules": {"base_order_usdt": round(rules.sizes()[0], 2), "safety_orders": rules.safety_orders,
                      "safety_order_sizes_usdt": [round(x, 2) for x in rules.sizes()[1:]],
                      "step_pct": 100 * rules.step, "volume_scale": rules.volume_scale,
                      "take_profit_pct": 100 * rules.take_profit, "stop_loss": None, "leverage": 1,
                      "capital": rules.capital},
            "ladder": ladder_table(rules),
        }
        cycles_out = {}
        for label, (a, b) in samples.items():
            cols = (bars.ts[a:b], bars.open[a:b], bars.high[a:b], bars.low[a:b], bars.close[a:b], step_ms)
            first = simulate(rules, *cols, funding=funding)
            again = simulate(rules, *cols, funding=funding)
            assert first == again, "the same data gave two different results"
            # Accounting identity: final equity = capital + the net result of every cycle.
            assert near(first["final_equity"], rules.capital + sum(c["net"] for c in first["cycles"]), 1e-9)
            assert near(first["fees"], sum(c["fees"] for c in first["cycles"]), 1e-9)
            hold = buy_and_hold(rules, bars.ts[a:b], bars.open[a:b], bars.close[a:b], step_ms, funding)
            block[label] = {"first_bar": iso(int(bars.ts[a])), "last_bar": iso(int(bars.ts[b - 1])), "bars": b - a,
                            "first_open": float(bars.open[a]), "last_close": float(bars.close[b - 1]),
                            "lowest_low": float(bars.low[a:b].min()), "highest_high": float(bars.high[a:b].max()),
                            **summarize(rules, first, hold, step_ms, b - a)}
            cycles_out[label] = [describe_cycle(c, rules.capital, step_ms) for c in first["cycles"]]
        out["rule_sets"][rules.name] = block
        with open(HERE / f"cycles-{rules.name}.json", "w", encoding="utf-8", newline="\n") as handle:
            json.dump(cycles_out, handle, indent=1)
            handle.write("\n")

    with open(HERE / "dca_summary.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")

    print(f"candles {out['data']['candles']} sha256 {out['data']['candles_sha256'][:8]}  bars {len(bars)}  "
          f"{out['data']['first_bar']} to {out['data']['last_bar']}  out-of-sample from {out['data']['out_of_sample_starts']}")
    for name, block in out["rule_sets"].items():
        print(f"\n== {name}: base {block['rules']['base_order_usdt']}, safety {block['rules']['safety_order_sizes_usdt']}")
        for label in samples:
            s = block[label]
            print(f"  {label}: completed {s['completed_cycles']}  net from them {s['net_from_completed_cycles']}  "
                  f"avg {s['net_per_completed_cycle']['avg']}  left at end {s['net_from_position_left_at_end']}  "
                  f"fees {s['fees']}  funding {s['funding_paid']}")
            print(f"    return {s['total_return_pct']}%  max DD {s['max_drawdown_pct']}%  "
                  f"buy&hold {s['buy_and_hold_with_funding']['total_return_pct']}%  "
                  f"lowest equity {s['lowest_equity']} at {s['lowest_equity_time']}")
            lc = s["longest_cycle"]
            print(f"    longest cycle: {lc['start']} to {lc['end']} ({lc['days']} days, {lc['how']}), "
                  f"{lc['safety_orders_filled']} safety orders, worst unrealized {lc['worst_unrealized']} "
                  f"({lc['worst_unrealized_pct_of_capital']}% of capital), net {lc['net']}")
            print(f"    fully loaded cycles {s['cycles_fully_loaded']}, days fully loaded {s['days_fully_loaded_total']} "
                  f"({s['share_of_bars_fully_loaded_pct']}% of bars); by safety orders filled: "
                  + ", ".join(f"{k}:{v['cycles']}" for k, v in s["completed_cycles_by_safety_orders_filled"].items()))
            print("    leverage overlay: " + "; ".join(
                f"{k}x {v['cycles_reaching_liquidation']}/{v['of_cycles']} first {v['first_time']}"
                for k, v in s["leverage_overlay"].items()))
    print("\nwrote dca_summary.json, cycles-x2.json, cycles-x1.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
