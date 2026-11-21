"""Same strategy code, same parameters, two sets of candles: testnet versus mainnet.

    <engine>/.venv/Scripts/python research/bybit-testnet/signal_overlap.py [path-to-engine]

Downloads the same 1,000 closed 15-minute BTCUSDT candles from both public
kline endpoints at the same moment, then runs the three example strategies of
the open-source engine (https://github.com/sentinelbotsaas-hub/perpmath) on
each set with the parameters shipped in its `configs/*.json`, and counts how
many entry signals fall on the same bar in the same direction.

No key, no order. The engine folder is only read. Needs the engine installed
(run with the engine's virtualenv python). Writes `raw/kline-15m-1000.json`
and `signal_overlap.json` next to this file.
"""
import io
import json
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
ENGINE = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[2] / "perpmath-engine"

from perpmath import __version__ as engine_version  # noqa: E402
from perpmath.data import Bars  # noqa: E402
from perpmath.strategies import STRATEGIES, resolve_params  # noqa: E402

BASES = {"mainnet": "https://api.bybit.com", "testnet": "https://api-testnet.bybit.com"}
STEP = 900_000
BARS = 1000


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


def main():
    server_ms = get(BASES["mainnet"], "/v5/market/time")["time"]
    last_closed = server_ms // STEP * STEP - STEP
    first = last_closed - (BARS - 1) * STEP
    out = {}

    def work(name):
        out[name] = get(BASES[name], "/v5/market/kline", category="linear", symbol="BTCUSDT", interval="15",
                        start=first, end=last_closed, limit=BARS)

    threads = [threading.Thread(target=work, args=(name,)) for name in BASES]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    (HERE / "raw").mkdir(exist_ok=True)
    with open(HERE / "raw" / "kline-15m-1000.json", "w", encoding="utf-8") as handle:
        json.dump(out, handle)
        handle.write("\n")

    bars = {}
    for name in BASES:
        rows = sorted(out[name]["result"]["list"], key=lambda r: int(r[0]))
        ts = np.asarray([int(r[0]) for r in rows], dtype=np.int64)
        if len(ts) != BARS or not np.all(np.diff(ts) == STEP) or ts[0] != first:
            raise RuntimeError(f"{name}: expected {BARS} gapless candles from {iso(first)}, got {len(ts)}")
        arr = np.asarray([[float(x) for x in r[1:6]] for r in rows])
        bars[name] = Bars(ts, arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3], arr[:, 4])

    result = {
        "engine_version": engine_version, "symbol": "BTCUSDT", "interval": "15m", "bars": BARS,
        "range": [iso(first), iso(last_closed + STEP)], "fetched_at": iso(int(time.time() * 1000)),
        "strategies": {},
    }
    for name in sorted(STRATEGIES):
        config = json.loads((ENGINE / "configs" / f"{name}.json").read_text(encoding="utf-8"))
        params = resolve_params(name, config["params"])
        sides = {env: np.asarray(STRATEGIES[name].generate(bars[env], params).side) for env in BASES}
        m, t = sides["mainnet"], sides["testnet"]
        either = int(np.sum((m != 0) | (t != 0)))
        same = int(np.sum((m != 0) & (m == t)))
        result["strategies"][name] = {
            "params": params,
            "mainnet_entry_signals": int(np.sum(m != 0)),
            "testnet_entry_signals": int(np.sum(t != 0)),
            "same_bar_same_direction": same,
            "same_bar_opposite_direction": int(np.sum((m != 0) & (t != 0) & (m != t))),
            "bars_with_a_signal_on_either": either,
            "agreement_pct_of_either": round(same / either * 100, 2) if either else None,
        }
        print(name, json.dumps(result["strategies"][name]))
    with open(HERE / "signal_overlap.json", "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
        handle.write("\n")
    print("range", result["range"])


if __name__ == "__main__":
    main()
