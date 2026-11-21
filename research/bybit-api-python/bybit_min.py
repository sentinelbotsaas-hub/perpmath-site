"""Bybit V5 REST with the Python standard library only.

This is the code printed in the article `en/bybit-api-python`. Public market
endpoints need no account and no key. The signing helpers are shown with a
made-up key; they have not been checked against a real Bybit account.

Documentation: https://bybit-exchange.github.io/docs/v5/guide
"""
import hashlib
import hmac
import json
import time
import urllib.parse
import urllib.request

MAINNET = "https://api.bybit.com"
TESTNET = "https://api-testnet.bybit.com"

# Bybit's interval codes and their length in milliseconds.
INTERVAL_MS = {"1": 60_000, "5": 300_000, "15": 900_000,
               "60": 3_600_000, "240": 14_400_000, "D": 86_400_000}


def get(path, base=MAINNET, **params):
    """One public GET. Returns the whole payload: retCode, retMsg, result, time."""
    url = base + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "my-script/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read())
    if payload["retCode"] != 0:
        raise RuntimeError(f"retCode {payload['retCode']}: {payload['retMsg']}")
    return payload


def clock_offset_ms(base=MAINNET):
    """(Bybit's clock minus yours, round trip), both in milliseconds."""
    before = time.time()
    payload = get("/v5/market/time", base)
    after = time.time()
    server_ms = int(payload["result"]["timeNano"]) // 1_000_000
    local_ms = int((before + after) / 2 * 1000)
    return server_ms - local_ms, (after - before) * 1000


def klines(symbol, interval, start_ms, end_ms, base=MAINNET):
    """Closed candles with open time in [start_ms, end_ms), oldest first."""
    step = INTERVAL_MS[interval]
    rows = {}
    cursor = (end_ms - 1) // step * step      # open time of the newest candle wanted
    while cursor >= start_ms:
        payload = get("/v5/market/kline", base, category="linear", symbol=symbol,
                      interval=interval, start=start_ms, end=cursor, limit=1000)
        page = payload["result"]["list"]      # newest first
        if not page:
            break
        for row in page:
            if int(row[0]) + step <= payload["time"]:   # skip the forming candle
                rows[int(row[0])] = row
        if len(page) < 1000:
            break
        cursor = int(page[-1][0]) - step      # one candle older than the oldest
        time.sleep(0.1)
    return [rows[ts] for ts in sorted(rows)]


def funding(symbol, start_ms, end_ms, base=MAINNET):
    """Settled funding rates with time in [start_ms, end_ms), oldest first."""
    rows = {}
    cursor = end_ms - 1
    while cursor >= start_ms:
        payload = get("/v5/market/funding/history", base, category="linear",
                      symbol=symbol, startTime=start_ms, endTime=cursor, limit=200)
        page = payload["result"]["list"]      # newest first
        if not page:
            break
        for record in page:
            rows[int(record["fundingRateTimestamp"])] = record["fundingRate"]
        if len(page) < 200:
            break
        cursor = min(int(record["fundingRateTimestamp"]) for record in page) - 1
        time.sleep(0.1)
    return sorted(rows.items())


def sign(secret, payload):
    """HMAC-SHA256 of the payload, lowercase hex."""
    digest = hmac.new(secret.encode(), payload.encode(), hashlib.sha256)
    return digest.hexdigest()


def signed_headers(api_key, secret, to_sign, timestamp_ms, recv_window_ms=5000):
    """Headers for a private request.

    to_sign is the query string for a GET (exactly as it appears after the '?')
    and the JSON body string for a POST (exactly the bytes that are sent).
    """
    payload = f"{timestamp_ms}{api_key}{recv_window_ms}{to_sign}"
    return {
        "X-BAPI-API-KEY": api_key,
        "X-BAPI-TIMESTAMP": str(timestamp_ms),
        "X-BAPI-RECV-WINDOW": str(recv_window_ms),
        "X-BAPI-SIGN": sign(secret, payload),
        "Content-Type": "application/json",
    }
