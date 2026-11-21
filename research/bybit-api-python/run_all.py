"""Run every example of the article `en/bybit-api-python` and keep what came back.

    python research/bybit-api-python/run_all.py

Writes `transcript.txt` (what the article quotes) and `raw/*.json` (responses
as received) next to this file. No API key is used anywhere.

* Sections 1 to 7 call public market endpoints on https://api.bybit.com and
  https://api-testnet.bybit.com.
* Section 8 signs with a made-up key and sends nothing.
* Section 9 sends a handful of read-only GETs to the TESTNET with that made-up
  key, to record how Bybit refuses them. Nothing there can place an order.

If the perpmath engine is importable (run with its virtualenv's python), the
signature is also compared with `perpmath.live.bybit.sign`.
"""
import io
import json
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bybit_min as bm  # noqa: E402

RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
LINES = []
REQUESTS = {"n": 0}

# Made-up credentials. They belong to no account.
FAKE_KEY = "FAKEKEY0000000000"
FAKE_SECRET = "FAKESECRET-not-a-real-secret-0000000"


def say(text=""):
    print(text)
    LINES.append(text)


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def save(name, document):
    with open(RAW / f"{name}.json", "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=1)
        handle.write("\n")


def raw_get(base, path, params=None, headers=None):
    """GET that never raises on HTTP errors: (status, headers, body text)."""
    url = base + path + ("?" + urllib.parse.urlencode(params) if params else "")
    request = urllib.request.Request(url, headers=headers or {"User-Agent": "my-script/1.0"})
    REQUESTS["n"] += 1
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, dict(response.headers.items()), response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers.items()) if exc.headers else {}, (exc.read() or b"").decode("utf-8", "replace")


# Count the requests made through bybit_min.get as well.
_original_get = bm.get


def counted_get(path, base=bm.MAINNET, **params):
    REQUESTS["n"] += 1
    return _original_get(path, base, **params)


bm.get = counted_get


def section(title):
    say()
    say("=" * 72)
    say(title)
    say("=" * 72)


def main():
    started = int(time.time() * 1000)
    say(f"run started {iso(started)} (local clock), Python {sys.version.split()[0]}")

    # ------------------------------------------------------------------ 1
    section("1. Server time and clock offset")
    payload = bm.get("/v5/market/time")
    save("01-time", payload)
    say(json.dumps(payload))
    result = {}
    for name, base in (("mainnet", bm.MAINNET), ("testnet", bm.TESTNET)):
        samples = []
        for _ in range(20):
            samples.append(bm.clock_offset_ms(base))
            time.sleep(0.2)
        offsets = [s[0] for s in samples]
        trips = [s[1] for s in samples]
        result[name] = {"offset_ms": offsets, "round_trip_ms": [round(t, 1) for t in trips]}
        say(f"{name}: 20 samples, offset min {min(offsets)} / median {statistics.median(offsets):.0f} / "
            f"max {max(offsets)} ms; round trip min {min(trips):.0f} / median {statistics.median(trips):.0f} / "
            f"max {max(trips):.0f} ms")
    save("01-clock-offset", result)
    mainnet_offset = int(statistics.median(result["mainnet"]["offset_ms"]))
    testnet_offset = int(statistics.median(result["testnet"]["offset_ms"]))

    # ------------------------------------------------------------------ 2
    section("2. Candles: one page")
    payload = bm.get("/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15", limit=3)
    save("02-kline-limit3", payload)
    say(json.dumps(payload))
    say(f"server time {payload['time']} = {iso(payload['time'])}")
    for row in payload["result"]["list"]:
        closes_at = int(row[0]) + 900_000
        state = "still forming" if closes_at > payload["time"] else "closed"
        say(f"  open time {row[0]} = {iso(int(row[0]))}  close {row[4]}  ({state})")

    no_limit = bm.get("/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15")
    big_limit = bm.get("/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15", limit=5000)
    say(f"no limit      -> {len(no_limit['result']['list'])} rows")
    say(f"limit=5000    -> {len(big_limit['result']['list'])} rows, retCode {big_limit['retCode']}")

    probes = {}
    for label, params in (
        ("interval='15m'", {"category": "linear", "symbol": "BTCUSDT", "interval": "15m", "limit": 3}),
        ("start/end in seconds", {"category": "linear", "symbol": "BTCUSDT", "interval": "15",
                                  "start": started // 1000 - 86_400, "end": started // 1000, "limit": 3}),
        ("symbol='btcusdt'", {"category": "linear", "symbol": "btcusdt", "interval": "15", "limit": 3}),
        ("symbol='BTCUSD_NOPE'", {"category": "linear", "symbol": "BTCUSD_NOPE", "interval": "15", "limit": 3}),
    ):
        status, _, body = raw_get(bm.MAINNET, "/v5/market/kline", params)
        probes[label] = {"params": params, "http_status": status, "body": body}
        say(f"{label:22} -> HTTP {status} {body}")
    status, _, body = raw_get(bm.MAINNET, "/v5/market/klines", {"category": "linear"})
    probes["wrong path /v5/market/klines"] = {"http_status": status, "body": body}
    say(f"{'path /v5/market/klines':22} -> HTTP {status}, body length {len(body)}")
    save("02-kline-mistakes", probes)

    # ------------------------------------------------------------------ 3
    section("3. Candles: 2,500 bars need three requests")
    step = 900_000
    now = started + mainnet_offset
    end_ms = now // step * step                      # open time of the candle forming now
    start_ms = end_ms - 2500 * step
    before = REQUESTS["n"]
    bars = bm.klines("BTCUSDT", "15", start_ms, end_ms)
    used = REQUESTS["n"] - before
    gaps = sum(1 for a, b in zip(bars, bars[1:]) if int(b[0]) - int(a[0]) != step)
    say(f"asked for [{iso(start_ms)}, {iso(end_ms)}): {len(bars)} candles in {used} requests, {gaps} gaps")
    say(f"first {iso(int(bars[0][0]))}, last {iso(int(bars[-1][0]))}")
    save("03-kline-2500", {"start_ms": start_ms, "end_ms": end_ms, "requests": used, "rows": bars})

    # ------------------------------------------------------------------ 4
    section("4. Funding history")
    payload = bm.get("/v5/market/funding/history", category="linear", symbol="BTCUSDT", limit=3)
    save("04-funding-limit3", payload)
    say(json.dumps(payload))
    for record in payload["result"]["list"]:
        say(f"  {iso(int(record['fundingRateTimestamp']))}  {float(record['fundingRate']) * 100:+.6f}%")
    status, headers, body = raw_get(bm.MAINNET, "/v5/market/funding/history",
                                    {"category": "linear", "symbol": "BTCUSDT", "startTime": started - 30 * 86_400_000})
    say(f"only startTime -> HTTP {status} {body}")
    big = bm.get("/v5/market/funding/history", category="linear", symbol="BTCUSDT", limit=1000)
    say(f"limit=1000     -> {len(big['result']['list'])} rows, retCode {big['retCode']}")
    year_end = now // 86_400_000 * 86_400_000
    year_start = year_end - 365 * 86_400_000
    before = REQUESTS["n"]
    rates = bm.funding("BTCUSDT", year_start, year_end)
    used = REQUESTS["n"] - before
    spacing = sorted({(b[0] - a[0]) // 3_600_000 for a, b in zip(rates, rates[1:])})
    values = [float(r[1]) for r in rates]
    say(f"365 days [{iso(year_start)}, {iso(year_end)}): {len(rates)} settlements in {used} requests, "
        f"spacing in hours {spacing}")
    say(f"sum {sum(values) * 100:+.4f}%, mean {statistics.mean(values) * 100:+.6f}% per settlement, "
        f"negative in {sum(1 for v in values if v < 0)} of {len(values)}")
    save("04-funding-365d", {"start_ms": year_start, "end_ms": year_end, "requests": used, "rows": rates,
                             "only_start_time": {"http_status": status, "body": body}})

    # ------------------------------------------------------------------ 5
    section("5. Contract rules (instruments-info)")
    payload = bm.get("/v5/market/instruments-info", category="linear", symbol="BTCUSDT")
    save("05-instrument-btcusdt", payload)
    item = payload["result"]["list"][0]
    say(json.dumps({k: item[k] for k in ("symbol", "contractType", "status", "priceFilter", "lotSizeFilter",
                                         "leverageFilter", "fundingInterval", "upperFundingRate",
                                         "lowerFundingRate")}))
    first = bm.get("/v5/market/instruments-info", category="linear")
    say(f"no symbol, no limit -> {len(first['result']['list'])} instruments, "
        f"nextPageCursor {'present' if first['result'].get('nextPageCursor') else 'empty'}")
    total, cursor, pages = 0, "", 0
    while True:
        params = {"category": "linear", "limit": 1000}
        if cursor:
            params["cursor"] = cursor
        page = bm.get("/v5/market/instruments-info", **params)
        pages += 1
        total += len(page["result"]["list"])
        cursor = page["result"].get("nextPageCursor") or ""
        if not cursor:
            break
    say(f"paged with limit=1000 -> {total} linear instruments in {pages} page(s)")
    save("05-instrument-count", {"default_page": len(first["result"]["list"]), "total": total, "pages": pages})

    # ------------------------------------------------------------------ 6
    section("6. Risk limit tiers")
    payload = bm.get("/v5/market/risk-limit", category="linear", symbol="BTCUSDT")
    save("06-risk-limit-btcusdt", payload)
    tiers = payload["result"]["list"]
    say(f"BTCUSDT: {len(tiers)} tiers")
    for tier in tiers[:3] + tiers[-1:]:
        say("  " + json.dumps(tier))
    page = bm.get("/v5/market/risk-limit", category="linear")
    symbols = sorted({t["symbol"] for t in page["result"]["list"]})
    say(f"no symbol -> {len(page['result']['list'])} rows covering {len(symbols)} symbols, "
        f"nextPageCursor {'present' if page['result'].get('nextPageCursor') else 'empty'}")

    # ------------------------------------------------------------------ 7
    section("7. Response headers of a public request")
    status, headers, body = raw_get(bm.MAINNET, "/v5/market/kline",
                                    {"category": "linear", "symbol": "BTCUSDT", "interval": "15", "limit": 1})
    names = sorted(headers)
    say(f"HTTP {status}; header names: {', '.join(names)}")
    limit_headers = [n for n in names if n.lower().startswith("x-bapi-limit")]
    say(f"X-Bapi-Limit-* headers present: {limit_headers or 'none'}")
    save("07-public-headers", {"http_status": status, "header_names": names})

    # ------------------------------------------------------------------ 8
    section("8. Signing with a made-up key (nothing is sent)")
    timestamp = 1795281600000            # fixed, so the output is the same on every run
    query = urllib.parse.urlencode({"category": "linear", "symbol": "BTCUSDT"})
    get_payload = f"{timestamp}{FAKE_KEY}5000{query}"
    say(f"GET  string to sign: {get_payload}")
    say(f"GET  X-BAPI-SIGN:    {bm.sign(FAKE_SECRET, get_payload)}")
    order = {"category": "linear", "symbol": "BTCUSDT", "side": "Buy", "orderType": "Market",
             "qty": "0.001", "positionIdx": 0, "orderLinkId": "demo-1795281600-LE1"}
    compact = json.dumps(order, separators=(",", ":"))
    spaced = json.dumps(order)
    post_payload = f"{timestamp}{FAKE_KEY}5000{compact}"
    say(f"POST body:           {compact}")
    say(f"POST string to sign: {post_payload}")
    say(f"POST X-BAPI-SIGN:    {bm.sign(FAKE_SECRET, post_payload)}")
    say(f"same dict, default json.dumps (with spaces): {bm.sign(FAKE_SECRET, f'{timestamp}{FAKE_KEY}5000{spaced}')}")
    headers = bm.signed_headers(FAKE_KEY, FAKE_SECRET, query, timestamp)
    say("headers: " + json.dumps(headers))
    signing = {"timestamp": timestamp, "api_key": FAKE_KEY, "secret": FAKE_SECRET, "get_string": get_payload,
               "get_sign": bm.sign(FAKE_SECRET, get_payload), "post_body": compact, "post_string": post_payload,
               "post_sign": bm.sign(FAKE_SECRET, post_payload)}
    try:
        from perpmath.live.bybit import sign as engine_sign, signature_payload
        same = (engine_sign(FAKE_SECRET, signature_payload(timestamp, FAKE_KEY, 5000, query)) == signing["get_sign"]
                and engine_sign(FAKE_SECRET, signature_payload(timestamp, FAKE_KEY, 5000, compact)) == signing["post_sign"])
        say(f"perpmath.live.bybit.sign gives the same two signatures: {same}")
        signing["matches_perpmath_engine"] = same
    except ImportError:
        say("perpmath engine not importable; cross-check skipped")
        signing["matches_perpmath_engine"] = None
    save("08-signing-fake-key", signing)

    # ------------------------------------------------------------------ 9
    section("9. What the TESTNET answers to a made-up key (read-only GETs)")
    answers = []

    def fake_call(label, path, query="", shift_ms=0, recv_window=5000, with_auth=True):
        # shift_ms is relative to Bybit's clock: local time + measured offset + shift.
        timestamp = int(time.time() * 1000) + testnet_offset + shift_ms
        headers = {"User-Agent": "my-script/1.0"}
        if with_auth:
            headers.update(bm.signed_headers(FAKE_KEY, FAKE_SECRET, query, timestamp, recv_window))
        url_params = dict(urllib.parse.parse_qsl(query)) or None
        status, resp_headers, body = raw_get(bm.TESTNET, path, url_params, headers)
        limit_headers = {k: v for k, v in resp_headers.items() if k.lower().startswith("x-bapi-limit")}
        answers.append({"label": label, "path": path, "shift_ms": shift_ms, "recv_window": recv_window,
                        "http_status": status, "body": body, "limit_headers": limit_headers})
        say(f"{label:34} -> HTTP {status} {body if body else '(empty body)'}")
        time.sleep(0.5)

    fake_call("no auth headers", "/v5/user/query-api", with_auth=False)
    fake_call("fake key, timestamp on time", "/v5/user/query-api")
    fake_call("timestamp 4.0 s behind", "/v5/user/query-api", shift_ms=-4000)
    fake_call("timestamp 6.0 s behind", "/v5/user/query-api", shift_ms=-6000)
    fake_call("timestamp 0.5 s ahead", "/v5/user/query-api", shift_ms=500)
    fake_call("timestamp 1.5 s ahead", "/v5/user/query-api", shift_ms=1500)
    fake_call("6.0 s behind, recv_window 10000", "/v5/user/query-api", shift_ms=-6000, recv_window=10000)
    fake_call("1.5 s ahead, recv_window 10000", "/v5/user/query-api", shift_ms=1500, recv_window=10000)
    fake_call("fake key on /v5/position/list", "/v5/position/list", query="category=linear&symbol=BTCUSDT")
    say(f"X-Bapi-Limit-* headers on any of these answers: "
        f"{sorted({k for a in answers for k in a['limit_headers']}) or 'none'}")
    save("09-fake-key-answers", {"testnet_offset_ms": testnet_offset, "answers": answers})

    say()
    say(f"run finished {iso(int(time.time() * 1000))}, {REQUESTS['n']} HTTP requests in total")
    with open(HERE / "transcript.txt", "w", encoding="utf-8") as handle:
        handle.write("\n".join(LINES) + "\n")


if __name__ == "__main__":
    main()
