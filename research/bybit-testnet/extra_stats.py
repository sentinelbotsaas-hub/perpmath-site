"""Further numbers from the files `compare.py` saved. Offline: no network.

    python research/bybit-testnet/extra_stats.py

Reads `raw/*.json`, writes `extra_stats.json` next to this file.
"""
import io
import json
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
ENVS = ("mainnet", "testnet")
STEP = 900_000


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load(name):
    with open(RAW / f"{name}.json", encoding="utf-8") as handle:
        return json.load(handle)


def walk(levels, qty):
    """Average fill price for qty BTC against the levels given (best first), or None."""
    left, cost = qty, 0.0
    for price, size in levels:
        take = min(left, float(size))
        cost += take * float(price)
        left -= take
        if left <= 1e-12:
            return cost / qty
    return None


def main():
    out = {}

    # ---- order book of snapshot 1 -------------------------------------- #
    snap = load("snapshot-1")
    books = {}
    for env in ENVS:
        book = snap["orderbook"][env]["result"]
        bids, asks = book["b"], book["a"]
        best_bid, best_ask = float(bids[0][0]), float(asks[0][0])
        entry = {
            "at": iso(snap["orderbook"][env]["time"]),
            "bid_levels": len(bids), "ask_levels": len(asks),
            "lowest_bid": float(bids[-1][0]), "highest_ask": float(asks[-1][0]),
            "total_bid_btc_returned": round(sum(float(q) for _, q in bids), 3),
            "total_ask_btc_returned": round(sum(float(q) for _, q in asks), 3),
            "market_sell": {}, "market_buy": {},
        }
        for qty in (0.001, 0.01, 0.1, 1, 10):
            sell, buy = walk(bids, qty), walk(asks, qty)
            entry["market_sell"][str(qty)] = None if sell is None else {
                "avg_price": round(sell, 2), "pct_vs_best_bid": round((sell / best_bid - 1) * 100, 4)}
            entry["market_buy"][str(qty)] = None if buy is None else {
                "avg_price": round(buy, 2), "pct_vs_best_ask": round((buy / best_ask - 1) * 100, 4)}
        books[env] = entry
    out["orderbook_snapshot_1"] = books

    # ---- public trades, all five snapshots ------------------------------ #
    trades = {}
    for env in ENVS:
        rows = []
        for index in range(1, 6):
            rows.append(load(f"snapshot-{index}")["recent_trade"][env]["result"]["list"])
        first = rows[0]
        times = sorted(int(t["time"]) for t in first)
        gaps = [(b - a) / 1000 for a, b in zip(times, times[1:])]
        prices = [float(t["price"]) for t in first]
        trades[env] = {
            "snapshot_1_trades": len(first),
            "snapshot_1_span_seconds": round((times[-1] - times[0]) / 1000, 1),
            "snapshot_1_from": iso(times[0]), "snapshot_1_to": iso(times[-1]),
            "distinct_prices": len(set(prices)), "min_price": min(prices), "max_price": max(prices),
            "median_gap_seconds": round(statistics.median(gaps), 3), "max_gap_seconds": round(max(gaps), 1),
            "buy_side_trades": sum(1 for t in first if t["side"] == "Buy"),
            "btc": round(sum(float(t["size"]) for t in first), 3),
            "span_seconds_each_snapshot": [
                round((max(int(t["time"]) for t in r) - min(int(t["time"]) for t in r)) / 1000, 1) for r in rows],
        }
    out["recent_trades"] = trades

    # ---- last price across the five snapshots --------------------------- #
    last = {env: [] for env in ENVS}
    oi = {}
    for index in range(1, 6):
        tick = load(f"snapshot-{index}")["tickers"]
        for env in ENVS:
            last[env].append(float(tick[env]["result"]["list"][0]["lastPrice"]))
            if index == 1:
                t = tick[env]["result"]["list"][0]
                oi[env] = {"open_interest_btc": float(t["openInterest"]), "volume24h_btc": float(t["volume24h"]),
                           "open_interest_over_24h_volume": round(float(t["openInterest"]) / float(t["volume24h"]), 2)}
    out["last_price_five_snapshots"] = last
    out["open_interest_snapshot_1"] = oi
    out["open_interest_ratio_testnet_to_mainnet"] = round(
        oi["testnet"]["open_interest_btc"] / oi["mainnet"]["open_interest_btc"], 2)
    out["volume24h_ratio_testnet_to_mainnet"] = round(
        oi["testnet"]["volume24h_btc"] / oi["mainnet"]["volume24h_btc"], 5)

    # ---- 200 candles ----------------------------------------------------- #
    candles = load("kline-15m-200")
    bars = {env: {int(r[0]): [float(x) for x in r[1:7]] for r in candles[env]["result"]["list"]} for env in ENVS}
    times = sorted(set(bars["mainnet"]) & set(bars["testnet"]))
    k = {}
    for env in ENVS:
        closes = [bars[env][t][3] for t in times]
        rets = [(b / a - 1) * 100 for a, b in zip(closes, closes[1:])]
        biggest = max(range(len(rets)), key=lambda i: abs(rets[i]))
        k[env] = {
            "unchanged_closes": sum(1 for r in rets if r == 0),
            "abs_return_over_1pct": sum(1 for r in rets if abs(r) > 1),
            "median_abs_return_pct": round(statistics.median(abs(r) for r in rets), 4),
            "biggest_move_pct": round(rets[biggest], 4), "biggest_move_bar": iso(times[biggest + 1]),
            "bars_under_2_btc": sum(1 for t in times if bars[env][t][4] < 2),
        }
    pairs = [((bars["mainnet"][b][3] / bars["mainnet"][a][3] - 1), (bars["testnet"][b][3] / bars["testnet"][a][3] - 1))
             for a, b in zip(times, times[1:]) if b - a == STEP]
    both_moved = [(x, y) for x, y in pairs if x != 0 and y != 0]
    k["return_pairs"] = len(pairs)
    k["pairs_both_moved"] = len(both_moved)
    k["same_direction_of_both_moved"] = sum(1 for x, y in both_moved if (x > 0) == (y > 0))
    out["kline_15m_200"] = k

    # ---- funding --------------------------------------------------------- #
    fund = load("funding-90")
    f = {}
    for env in ENVS:
        rates = [float(r["fundingRate"]) for r in fund[env]["result"]["list"]]
        f[env] = {"at_plus_0.333pct": sum(1 for r in rates if abs(r - 0.00333) < 1e-12),
                  "at_minus_0.333pct": sum(1 for r in rates if abs(r + 0.00333) < 1e-12),
                  "median_pct": round(statistics.median(rates) * 100, 5),
                  "abs_over_0.05pct": sum(1 for r in rates if abs(r) > 0.0005)}
    out["funding_last_90"] = f

    with open(HERE / "extra_stats.json", "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=2)
        handle.write("\n")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
