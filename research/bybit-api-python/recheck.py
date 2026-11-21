"""Re-check `bybit_min.py` against what `run_all.py` saved.

    python research/bybit-api-python/recheck.py

Closed candles and settled funding rates do not change, so downloading the
same ranges again must give rows identical to `raw/03-kline-2500.json` and
`raw/04-funding-365d.json`, and the made-up-key signatures must equal the ones
in `raw/08-signing-fake-key.json`. Public endpoints only, no key. Exits 1 on
any difference. (Run after `bybit_min.py` was reformatted for the article, to
confirm the printed code behaves like the code that produced the transcript.)
"""
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bybit_min as bm  # noqa: E402


def load(name):
    with open(HERE / "raw" / f"{name}.json", encoding="utf-8") as handle:
        return json.load(handle)


def main():
    ok = True

    saved = load("03-kline-2500")
    again = bm.klines("BTCUSDT", "15", saved["start_ms"], saved["end_ms"])
    same = again == saved["rows"]
    print(f"candles: {len(again)} rows downloaded again, identical to the saved {len(saved['rows'])}: {same}")
    ok &= same

    saved = load("04-funding-365d")
    again = [list(row) for row in bm.funding("BTCUSDT", saved["start_ms"], saved["end_ms"])]
    same = again == saved["rows"]
    print(f"funding: {len(again)} rows downloaded again, identical to the saved {len(saved['rows'])}: {same}")
    ok &= same

    saved = load("08-signing-fake-key")
    same = (bm.sign(saved["secret"], saved["get_string"]) == saved["get_sign"]
            and bm.sign(saved["secret"], saved["post_string"]) == saved["post_sign"])
    print(f"signatures with the made-up key equal the saved ones: {same}")
    ok &= same
    headers = bm.signed_headers(saved["api_key"], saved["secret"], "category=linear&symbol=BTCUSDT", saved["timestamp"])
    same = headers["X-BAPI-SIGN"] == saved["get_sign"]
    print(f"signed_headers() gives the same GET signature: {same}")
    ok &= same

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
