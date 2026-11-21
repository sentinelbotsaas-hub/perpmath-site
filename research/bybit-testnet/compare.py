"""Bybit testnet versus mainnet, public BTCUSDT perpetual data fetched at the same moment.

    python research/bybit-testnet/compare.py

Every request goes to a public market endpoint of https://api.bybit.com or
https://api-testnet.bybit.com. No account, no API key, no order.

Writes next to this file:

* `raw/*.json`    the responses exactly as received, both environments
* `summary.json`  the numbers the article `en/bybit-testnet` quotes
* `summary.txt`   the same as a readable table

Each pair of requests (testnet, mainnet) is sent from two threads at once, so
the two answers are at most a network round trip apart; the server time of
each answer is saved with it.
"""
import io
import json
import statistics
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)

BASES = {"mainnet": "https://api.bybit.com", "testnet": "https://api-testnet.bybit.com"}
SYMBOL = "BTCUSDT"
STEP = 900_000            # 15 minutes
BARS = 200
SNAPSHOTS = 5             # ticker + order book + recent trades, repeated
SNAPSHOT_PAUSE = 45       # seconds between snapshots
LINES = []


def say(text=""):
    print(text)
    LINES.append(text)


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(base, path, **params):
    url = base + path + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "research-script/1.0"})
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read())
            if payload.get("retCode") != 0:
                raise RuntimeError(f"retCode {payload.get('retCode')} ({payload.get('retMsg')}) for {url}")
            return payload
        except Exception as exc:  # network hiccup: wait and retry
            last = exc
            time.sleep(1.0 + attempt)
    raise RuntimeError(f"giving up on {url}: {last}")


def both(path, **params):
    """The same request to both environments at the same time."""
    out = {}

    def work(name):
        out[name] = get(BASES[name], path, **params)

    threads = [threading.Thread(target=work, args=(name,)) for name in BASES]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    if set(out) != set(BASES):
        raise RuntimeError(f"{path}: one environment did not answer")
    return out


def save(name, document):
    with open(RAW / f"{name}.json", "w", encoding="utf-8") as handle:
        json.dump(document, handle, separators=(",", ":"))   # compact: the snapshots are large
        handle.write("\n")


def book_stats(book):
    asks = [(float(p), float(q)) for p, q in book["a"]]
    bids = [(float(p), float(q)) for p, q in book["b"]]
    best_ask, best_bid = asks[0][0], bids[0][0]
    mid = (best_ask + best_bid) / 2
    stats = {
        "best_bid": best_bid, "best_ask": best_ask,
        "spread_usdt": round(best_ask - best_bid, 2),
        "spread_bps": round((best_ask - best_bid) / mid * 10_000, 3),
        "ask_levels": len(asks), "bid_levels": len(bids),
        "lowest_bid_pct_from_mid": round((bids[-1][0] / mid - 1) * 100, 3),
        "highest_ask_pct_from_mid": round((asks[-1][0] / mid - 1) * 100, 3),
    }
    for pct in (0.1, 0.5, 1.0):
        stats[f"bid_btc_within_{pct}pct"] = round(sum(q for p, q in bids if p >= mid * (1 - pct / 100)), 3)
        stats[f"ask_btc_within_{pct}pct"] = round(sum(q for p, q in asks if p <= mid * (1 + pct / 100)), 3)
    return stats


def market_sell_slippage(book, qty):
    """Average fill of a market sell of qty BTC against the returned bids, as % below the best bid.
    None if the returned levels do not hold that much."""
    left, cost = qty, 0.0
    best = float(book["b"][0][0])
    for price, size in book["b"]:
        take = min(left, float(size))
        cost += take * float(price)
        left -= take
        if left <= 1e-12:
            return round((cost / qty / best - 1) * 100, 4)
    return None


def trade_stats(trades, server_ms):
    times = [int(t["time"]) for t in trades]
    sizes = [float(t["size"]) for t in trades]
    span_s = (max(times) - min(times)) / 1000
    return {
        "trades": len(trades), "span_seconds": round(span_s, 1),
        "trades_per_minute": round(len(trades) / span_s * 60, 1) if span_s > 0 else None,
        "btc_traded": round(sum(sizes), 3), "median_size_btc": statistics.median(sizes),
        "newest_trade_age_seconds": round((server_ms - max(times)) / 1000, 1),
    }


def main():
    summary = {"symbol": SYMBOL, "bases": BASES, "note": "public endpoints only, no key"}

    # ---- clocks -------------------------------------------------------- #
    clocks = both("/v5/market/time")
    summary["server_time"] = {name: iso(p["time"]) for name, p in clocks.items()}
    summary["server_clock_difference_ms"] = clocks["testnet"]["time"] - clocks["mainnet"]["time"]
    say(f"server time: mainnet {iso(clocks['mainnet']['time'])}, testnet {iso(clocks['testnet']['time'])}")

    # ---- repeated snapshots: ticker, book, trades ----------------------- #
    snapshots = []
    for index in range(SNAPSHOTS):
        tick = both("/v5/market/tickers", category="linear", symbol=SYMBOL)
        book = both("/v5/market/orderbook", category="linear", symbol=SYMBOL, limit=500)
        trades = both("/v5/market/recent-trade", category="linear", symbol=SYMBOL, limit=1000)
        save(f"snapshot-{index + 1}", {"tickers": tick, "orderbook": book, "recent_trade": trades})
        row = {"at": iso(tick["mainnet"]["time"])}
        for name in BASES:
            t = tick[name]["result"]["list"][0]
            row[name] = {
                "last": float(t["lastPrice"]), "mark": float(t["markPrice"]), "index": float(t["indexPrice"]),
                "funding_rate": float(t["fundingRate"]), "volume24h_btc": float(t["volume24h"]),
                "turnover24h_usdt": float(t["turnover24h"]), "open_interest_btc": float(t["openInterest"]),
                "high24h": float(t["highPrice24h"]), "low24h": float(t["lowPrice24h"]),
                "book": book_stats(book[name]["result"]),
                "market_sell_slippage_pct": {str(q): market_sell_slippage(book[name]["result"], q)
                                             for q in (0.01, 0.1, 1, 10)},
                "trades": trade_stats(trades[name]["result"]["list"], trades[name]["time"]),
            }
        m, t = row["mainnet"], row["testnet"]
        row["last_diff_usdt"] = round(t["last"] - m["last"], 2)
        row["last_diff_pct"] = round((t["last"] / m["last"] - 1) * 100, 4)
        row["mark_diff_pct"] = round((t["mark"] / m["mark"] - 1) * 100, 4)
        row["index_identical"] = t["index"] == m["index"]
        row["mark_vs_index_pct"] = {name: round((row[name]["mark"] / row[name]["index"] - 1) * 100, 4) for name in BASES}
        snapshots.append(row)
        say(f"snapshot {index + 1} {row['at']}: last mainnet {m['last']} testnet {t['last']} "
            f"({row['last_diff_pct']:+.3f}%), index {m['index']} / {t['index']}, "
            f"funding {m['funding_rate']} / {t['funding_rate']}")
        if index + 1 < SNAPSHOTS:
            time.sleep(SNAPSHOT_PAUSE)
    summary["snapshots"] = snapshots

    # ---- 200 closed 15-minute candles ---------------------------------- #
    last_closed = clocks["mainnet"]["time"] // STEP * STEP - STEP
    first = last_closed - (BARS - 1) * STEP
    candles = both("/v5/market/kline", category="linear", symbol=SYMBOL, interval="15",
                   start=first, end=last_closed, limit=BARS)
    save("kline-15m-200", candles)
    bars = {name: {int(r[0]): [float(x) for x in r[1:7]] for r in candles[name]["result"]["list"]} for name in BASES}
    expected = [first + i * STEP for i in range(BARS)]
    k = {"range": [iso(first), iso(last_closed + STEP)], "expected_bars": BARS}
    for name in BASES:
        have = bars[name]
        rows = [have[t] for t in expected if t in have]
        k[name] = {
            "bars": len(rows), "missing": BARS - len(rows),
            "volume_btc": round(sum(r[4] for r in rows), 3),
            "turnover_usdt": round(sum(r[5] for r in rows), 2),
            "zero_volume_bars": sum(1 for r in rows if r[4] == 0),
            "flat_bars_high_equals_low": sum(1 for r in rows if r[1] == r[2]),
            "median_bar_range_pct": round(statistics.median((r[1] - r[2]) / r[3] * 100 for r in rows), 4),
            "max_bar_range_pct": round(max((r[1] - r[2]) / r[3] * 100 for r in rows), 4),
            "median_bar_volume_btc": round(statistics.median(r[4] for r in rows), 3),
            "min_bar_volume_btc": min(r[4] for r in rows),
            "low": min(r[2] for r in rows), "high": max(r[1] for r in rows),
            "first_close": rows[0][3], "last_close": rows[-1][3],
        }
    common = [t for t in expected if t in bars["mainnet"] and t in bars["testnet"]]
    diffs = [(bars["testnet"][t][3] / bars["mainnet"][t][3] - 1) * 100 for t in common]
    absd = [abs(d) for d in diffs]
    worst = max(common, key=lambda t: abs(bars["testnet"][t][3] / bars["mainnet"][t][3] - 1))
    k["close_diff_pct"] = {
        "bars_compared": len(common), "mean": round(statistics.mean(diffs), 4),
        "median_abs": round(statistics.median(absd), 4), "max_abs": round(max(absd), 4),
        "min": round(min(diffs), 4), "max": round(max(diffs), 4),
        "bars_testnet_below_mainnet": sum(1 for d in diffs if d < 0),
        "bars_abs_diff_over_0.5pct": sum(1 for d in absd if d > 0.5),
        "bars_abs_diff_over_1pct": sum(1 for d in absd if d > 1.0),
        "worst_bar": iso(worst), "worst_bar_closes": {n: bars[n][worst][3] for n in BASES},
    }
    k["volume_ratio_testnet_to_mainnet"] = round(k["testnet"]["volume_btc"] / k["mainnet"]["volume_btc"], 5)
    # correlation of 15-minute close-to-close returns
    rm, rt = [], []
    for a, b in zip(common, common[1:]):
        if b - a == STEP:
            rm.append(bars["mainnet"][b][3] / bars["mainnet"][a][3] - 1)
            rt.append(bars["testnet"][b][3] / bars["testnet"][a][3] - 1)
    mm, mt = statistics.mean(rm), statistics.mean(rt)
    cov = sum((x - mm) * (y - mt) for x, y in zip(rm, rt))
    k["return_correlation"] = round(cov / (sum((x - mm) ** 2 for x in rm) * sum((y - mt) ** 2 for y in rt)) ** 0.5, 4)
    k["same_direction_bars"] = sum(1 for x, y in zip(rm, rt) if (x > 0) == (y > 0) and x != 0 and y != 0)
    k["return_pairs"] = len(rm)
    summary["kline_15m"] = k

    # ---- funding: last 90 settlements ---------------------------------- #
    fund = both("/v5/market/funding/history", category="linear", symbol=SYMBOL, limit=90)
    save("funding-90", fund)
    instruments = both("/v5/market/instruments-info", category="linear", symbol=SYMBOL)
    save("instrument-btcusdt", instruments)
    f = {}
    for name in BASES:
        rows = fund[name]["result"]["list"]
        rates = [float(r["fundingRate"]) for r in rows]
        item = instruments[name]["result"]["list"][0]
        cap = float(item["upperFundingRate"])
        f[name] = {
            "settlements": len(rates),
            "from": iso(min(int(r["fundingRateTimestamp"]) for r in rows)),
            "to": iso(max(int(r["fundingRateTimestamp"]) for r in rows)),
            "mean_pct": round(statistics.mean(rates) * 100, 5),
            "min_pct": round(min(rates) * 100, 5), "max_pct": round(max(rates) * 100, 5),
            "sum_pct": round(sum(rates) * 100, 4),
            "cap_pct": round(cap * 100, 4),
            "at_cap_or_floor": sum(1 for r in rates if abs(abs(r) - cap) < 1e-12),
            "negative": sum(1 for r in rates if r < 0),
            "latest_pct": round(rates[0] * 100, 5),
        }
    summary["funding_last_90"] = f

    # ---- contract rules and how many contracts exist ------------------- #
    rules = {}
    for name in BASES:
        item = instruments[name]["result"]["list"][0]
        rules[name] = {"status": item["status"], "tickSize": item["priceFilter"]["tickSize"],
                       **{key: item["lotSizeFilter"].get(key) for key in
                          ("minOrderQty", "qtyStep", "maxOrderQty", "maxMktOrderQty", "minNotionalValue")},
                       "maxLeverage": item["leverageFilter"]["maxLeverage"],
                       "fundingInterval": item["fundingInterval"],
                       "upperFundingRate": item["upperFundingRate"]}
        total, cursor = 0, ""
        while True:
            params = {"category": "linear", "limit": 1000}
            if cursor:
                params["cursor"] = cursor
            page = get(BASES[name], "/v5/market/instruments-info", **params)
            total += len(page["result"]["list"])
            cursor = page["result"].get("nextPageCursor") or ""
            if not cursor:
                break
        rules[name]["linear_instruments_listed"] = total
    risk = both("/v5/market/risk-limit", category="linear", symbol=SYMBOL)
    save("risk-limit-btcusdt", risk)
    for name in BASES:
        tiers = risk[name]["result"]["list"]
        rules[name]["risk_tiers"] = len(tiers)
        rules[name]["tier1"] = {key: tiers[0][key] for key in ("riskLimitValue", "maintenanceMargin", "maxLeverage")}
    summary["contract_rules"] = rules
    summary["finished_at"] = iso(int(time.time() * 1000))

    with open(HERE / "summary.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")

    # ---- readable table -------------------------------------------------#
    say()
    say(f"15-minute candles {k['range'][0]} to {k['range'][1]} ({BARS} expected)")
    for name in BASES:
        say(f"  {name}: {json.dumps(k[name])}")
    say(f"  close difference testnet vs mainnet: {json.dumps(k['close_diff_pct'])}")
    say(f"  volume ratio {k['volume_ratio_testnet_to_mainnet']}, return correlation {k['return_correlation']}, "
        f"same direction {k['same_direction_bars']} of {k['return_pairs']}")
    say("funding, last 90 settlements")
    for name in BASES:
        say(f"  {name}: {json.dumps(f[name])}")
    say("contract rules")
    for name in BASES:
        say(f"  {name}: {json.dumps(rules[name])}")
    say("order book and trades per snapshot")
    for row in snapshots:
        for name in BASES:
            say(f"  {row['at']} {name}: book {json.dumps(row[name]['book'])}")
            say(f"      market sell slippage % {json.dumps(row[name]['market_sell_slippage_pct'])}; "
                f"trades {json.dumps(row[name]['trades'])}")
    with open(HERE / "summary.txt", "w", encoding="utf-8") as handle:
        handle.write("\n".join(LINES) + "\n")


if __name__ == "__main__":
    main()
