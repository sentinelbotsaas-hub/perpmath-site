"""Does the Demo Trading host serve mainnet's public market data?

    python research/bybit-testnet/demo_host_check.py

Asks https://api.bybit.com, https://api-demo.bybit.com and
https://api-testnet.bybit.com for the same public data at the same moment:
the last 50 closed 15-minute BTCUSDT candles and the ticker. No key, no
order, public market endpoints only. Writes `demo_host_check.json`.
"""
import io
import json
import sys
import threading
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
BASES = {"mainnet": "https://api.bybit.com", "demo": "https://api-demo.bybit.com",
         "testnet": "https://api-testnet.bybit.com"}
STEP = 900_000


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(base, path, **params):
    url = base + path + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "research-script/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read())
    if payload.get("retCode") != 0:
        raise RuntimeError(f"retCode {payload.get('retCode')} ({payload.get('retMsg')}) for {url}")
    return payload


def all_three(path, **params):
    out = {}

    def work(name):
        out[name] = get(BASES[name], path, **params)

    threads = [threading.Thread(target=work, args=(name,)) for name in BASES]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return out


def main():
    server_ms = get(BASES["mainnet"], "/v5/market/time")["time"]
    last_closed = server_ms // STEP * STEP - STEP
    first = last_closed - 49 * STEP
    candles = all_three("/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15",
                        start=first, end=last_closed, limit=50)
    tickers = all_three("/v5/market/tickers", category="linear", symbol="BTCUSDT")
    rows = {name: {r[0]: r for r in candles[name]["result"]["list"]} for name in BASES}
    result = {"checked_at": iso(server_ms), "range": [iso(first), iso(last_closed + STEP)], "candles": {}, "ticker": {}}
    for name in ("demo", "testnet"):
        same = sum(1 for ts, row in rows["mainnet"].items() if rows[name].get(ts) == row)
        result["candles"][f"{name}_rows_identical_to_mainnet"] = same
    result["candles"]["rows"] = {name: len(rows[name]) for name in BASES}
    for name in BASES:
        t = tickers[name]["result"]["list"][0]
        result["ticker"][name] = {key: t[key] for key in ("lastPrice", "markPrice", "indexPrice", "fundingRate",
                                                          "volume24h", "openInterest")}
        result["ticker"][name]["server_time"] = iso(tickers[name]["time"])
    with open(HERE / "demo_host_check.json", "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
