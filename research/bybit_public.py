"""Shared helpers for the research scripts: Bybit public market data only.

Every request goes to https://api.bybit.com/v5/market/ (no API key). Nothing
here places orders or reads account data. This module prints nothing; the
scripts that import it set up UTF-8 output themselves.
"""
import csv
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://api.bybit.com/v5/market/"
HERE = Path(__file__).resolve().parent
RAW = HERE / "data"
DAY_MS = 86_400_000
HOUR_MS = 3_600_000


def ms(date_text):
    """'2025-11-18' or '2025-11-18T08:00' (UTC) -> epoch milliseconds."""
    fmt = "%Y-%m-%dT%H:%M" if "T" in date_text else "%Y-%m-%d"
    return int(datetime.strptime(date_text, fmt).replace(tzinfo=timezone.utc).timestamp() * 1000)


def iso(ts_ms, with_time=True):
    d = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
    return d.strftime("%Y-%m-%dT%H:%MZ") if with_time else d.strftime("%Y-%m-%d")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(endpoint, **params):
    """One GET to /v5/market/<endpoint>. Returns the 'result' object."""
    url = API + endpoint + "?" + urllib.parse.urlencode(params)
    last_error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "research-script/1.0"})
            with urllib.request.urlopen(request, timeout=30) as response:
                body = json.loads(response.read().decode("utf-8"))
            if body.get("retCode") != 0:
                raise RuntimeError(f"retCode {body.get('retCode')} ({body.get('retMsg')}) for {url}")
            return body["result"]
        except Exception as exc:  # network hiccup: wait and retry
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"giving up on {url}: {last_error}")


def klines(endpoint, symbol, interval, start_ms, end_ms):
    """All candles with open time in [start_ms, end_ms), oldest first.

    endpoint is 'kline' (last traded price) or 'mark-price-kline'.
    Rows are lists of strings exactly as Bybit returns them.
    """
    step = {"D": DAY_MS, "60": HOUR_MS, "240": 4 * HOUR_MS}[interval]
    rows = {}
    cursor_end = end_ms - 1
    while cursor_end >= start_ms:
        result = get(endpoint, category="linear", symbol=symbol, interval=interval,
                     start=start_ms, end=cursor_end, limit=1000)
        batch = result.get("list") or []
        if not batch:
            break
        for row in batch:
            ts = int(row[0])
            if start_ms <= ts < end_ms:
                rows[ts] = row
        oldest = min(int(row[0]) for row in batch)
        if oldest <= start_ms or len(batch) < 1000:
            break
        cursor_end = oldest - 1
        time.sleep(0.25)
    ordered = [rows[ts] for ts in sorted(rows)]
    expected = (end_ms - start_ms) // step
    if len(ordered) != expected:
        raise RuntimeError(f"{endpoint} {interval}: expected {expected} candles, got {len(ordered)}")
    for a, b in zip(ordered, ordered[1:]):
        if int(b[0]) - int(a[0]) != step:
            raise RuntimeError(f"{endpoint} {interval}: gap after {iso(int(a[0]))}")
    return ordered


def write_csv(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_json(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def read_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)
