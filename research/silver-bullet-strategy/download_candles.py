import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/silver-bullet-strategy: download the 5m and 1m candles the runs use.

This is the engine's own downloader (`perpmath.data.download`, the function
behind `perpmath download`): same public Bybit endpoint, same paging, same
validation of every row. The only addition is patience. One year of 1-minute
bars is 526 requests, and on 2026-11-21 (UTC) the plain command

    perpmath download BTCUSDT 1m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z

stopped with `Bybit error retCode=10006 ... Exceeded the API Rate Limit`
(the 5-minute download, 106 requests, went through). The engine does not
retry that error, so this script hands the downloader a fetch function that
waits and asks again when Bybit answers 10006, and pauses between pages.

No key is needed; the endpoint is public.

Usage, from the site's root folder, with the engine's Python:
    <engine>/.venv/Scripts/python research/silver-bullet-strategy/download_candles.py [1m] [5m]
"""
import time
from pathlib import Path

from perpmath.data import download, http_get_json, iso_utc, parse_date_ms

HERE = Path(__file__).resolve().parent
START, END = "2025-11-18T11:30:00Z", "2026-11-18T11:30:00Z"
PAUSE_SECONDS = 0.25
RATE_LIMIT_WAIT_SECONDS = (5, 10, 20, 40, 60, 60, 60, 60)
waits = []


def patient_fetch(url, params):
    for wait in RATE_LIMIT_WAIT_SECONDS:
        payload = http_get_json(url, params)
        if not (isinstance(payload, dict) and payload.get("retCode") == 10006):
            time.sleep(PAUSE_SECONDS)
            return payload
        waits.append(wait)
        time.sleep(wait)
    return http_get_json(url, params)     # last try; the downloader raises on an error code


def main():
    intervals = [a for a in sys.argv[1:] if not a.startswith("--")] or ["5m", "1m"]
    for interval in intervals:
        waits.clear()
        path, rows = download("BTCUSDT", interval, parse_date_ms(START), parse_date_ms(END),
                              data_dir=str(HERE / "data"), fetch=patient_fetch)
        print(f"saved {len(rows)} bars to research/silver-bullet-strategy/data/{path.name}")
        print(f"range {iso_utc(rows[0][0])} to {iso_utc(rows[-1][0])} (bar open times, UTC)")
        print(f"rate-limit waits: {len(waits)} ({sum(waits)} s)")


if __name__ == "__main__":
    main()
