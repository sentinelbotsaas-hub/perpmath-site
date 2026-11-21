"""What the testnet runner would send for the breakout strategy, without a key.

Usage (from the site's root folder; CLONE is a checkout of the engine at
v0.2.0 with ``breakout.py`` added and registered, see README):

    CLONE/.venv/bin/python research/build-a-trading-bot-python/order_demo.py CLONE

It only calls public endpoints of the Bybit testnet (server time,
instruments-info, kline). Nothing is signed and no order is sent.

Steps:

1. Read the testnet clock and BTCUSDT's order-size rules.
2. Download the last 1,000 closed 15-minute testnet bars (one request) and
   save them, as returned, to ``testnet_bars_15m.csv``.
3. Run ``breakout.generate`` on them and count the entry signals.
4. For the most recent signal bar, build the order with the runner's own
   planner (``SignalPlanner.plan``) and print the request body.
5. Build the order ID for that bar twice, and once more with one parameter
   changed, to show what is and is not deterministic.

Output: ``order_demo.json`` and a log on stdout.
"""

from __future__ import annotations

import csv
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

if len(sys.argv) != 2:
    print(__doc__)
    sys.exit(2)
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / "src"))

import numpy as np  # noqa: E402

import perpmath  # noqa: E402
from perpmath.data import Bars, count_missing_bars, interval_ms, iso_utc  # noqa: E402
from perpmath.live.bybit import TESTNET_REST, BybitClient  # noqa: E402
from perpmath.live.config import load_live_config  # noqa: E402
from perpmath.live.executor import (Decision, Instrument, SignalPlanner, order_link_id,  # noqa: E402
                                    run_hash)
from perpmath.strategies import STRATEGIES  # noqa: E402

HERE = Path(__file__).parent
STRATEGY, SYMBOL, INTERVAL = "breakout", "BTCUSDT", "15m"
STEP = interval_ms(INTERVAL)


def main() -> int:
    params, config = load_live_config(str(HERE / "breakout.live.config.json"), STRATEGY)
    client = BybitClient()                       # no key: signed requests are impossible
    offset = client.sync_time()
    item = client.public_get("/v5/market/instruments-info", {"category": "linear", "symbol": SYMBOL})["list"][0]
    instrument = Instrument.from_api(item)

    now = client.now_ms()
    last_closed = now // STEP * STEP - STEP
    result = client.public_get("/v5/market/kline", {
        "category": "linear", "symbol": SYMBOL, "interval": "15", "end": str(last_closed), "limit": "1000"})
    rows = sorted((r for r in result["list"] if int(r[0]) + STEP <= now), key=lambda r: int(r[0]))
    with open(HERE / "testnet_bars_15m.csv", "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["open_time_ms", "open", "high", "low", "close", "volume", "turnover"])
        writer.writerows(rows)
    ts = np.asarray([int(r[0]) for r in rows], dtype=np.int64)
    arr = np.asarray([[float(x) for x in r[1:6]] for r in rows])
    bars = Bars(ts, arr[:, 0], arr[:, 1], arr[:, 2], arr[:, 3], arr[:, 4])

    signals = STRATEGIES[STRATEGY].generate(bars, params)
    warmup = max(params["lookback"], params["atr_period"])
    usable = len(bars) - warmup
    longs = int(np.sum(signals.side == 1))
    shorts = int(np.sum(signals.side == -1))
    signal_bars = np.flatnonzero(signals.side != 0)

    print(f"perpmath {perpmath.__version__}, endpoint {TESTNET_REST} (public requests only)")
    print(f"clock offset to Bybit: {offset} ms")
    print(f"{SYMBOL} testnet rules: qty step {instrument.qty_step}, min qty {instrument.min_qty}, "
          f"tick {instrument.tick_size}, min notional {instrument.min_notional}")
    print(f"bars: {len(bars)} closed {INTERVAL} bars, {iso_utc(int(ts[0]))} to {iso_utc(int(ts[-1]))}, "
          f"missing inside the range: {count_missing_bars(bars, STEP)}")
    print(f"entry signals on the {usable} bars after warm-up: {longs} long, {shorts} short "
          f"({(longs + shorts) / usable * 100:.2f}% of bars)")

    out = {
        "perpmath_version": perpmath.__version__,
        "endpoint": TESTNET_REST,
        "fetched_at": iso_utc(now),
        "clock_offset_ms": offset,
        "instrument": {"qty_step": str(instrument.qty_step), "min_qty": str(instrument.min_qty),
                       "tick_size": str(instrument.tick_size), "min_notional": str(instrument.min_notional)},
        "bars": {"count": len(bars), "first": iso_utc(int(ts[0])), "last": iso_utc(int(ts[-1])),
                 "missing": count_missing_bars(bars, STEP)},
        "signals": {"usable_bars": usable, "long": longs, "short": shorts,
                    "share_of_bars_pct": round((longs + shorts) / usable * 100, 2)},
    }

    if len(signal_bars):
        i = int(signal_bars[-1])
        window = bars.head(i + 1)
        decision = Decision.last(window, STRATEGIES[STRATEGY].generate(window, params))
        rhash = run_hash(STRATEGY, SYMBOL, INTERVAL, params)
        planner = SignalPlanner(STRATEGY, rhash, config)
        notes = []
        intents = planner.plan(decision, None, instrument, notes.append)
        print(f"most recent signal bar: {iso_utc(decision.bar_ms)} close {decision.close} "
              f"({'long' if decision.side > 0 else 'short'}), stop {decision.stop:.2f}")
        for note in notes:
            print(f"planner: {note}")
        bodies = [intent.body(SYMBOL) for intent in intents]
        for body in bodies:
            print("order body the runner would POST to /v5/order/create:")
            print(json.dumps(body, indent=2))

        first = order_link_id(STRATEGY, rhash, decision.bar_ms, decision.side, "entry")
        again = order_link_id(STRATEGY, run_hash(STRATEGY, SYMBOL, INTERVAL, dict(params)),
                              decision.bar_ms, decision.side, "entry")
        changed_params = dict(params, lookback=params["lookback"] + 1)
        changed = order_link_id(STRATEGY, run_hash(STRATEGY, SYMBOL, INTERVAL, changed_params),
                                decision.bar_ms, decision.side, "entry")
        next_bar = order_link_id(STRATEGY, rhash, decision.bar_ms + STEP, decision.side, "entry")
        print(f"order ID, first call:            {first}")
        print(f"order ID, second call:           {again}   same: {first == again}")
        print(f"order ID, lookback {changed_params['lookback']} not {params['lookback']}:   {changed}")
        print(f"order ID, one bar later:         {next_bar}")
        out["latest_signal"] = {
            "bar": iso_utc(decision.bar_ms), "close": decision.close, "side": decision.side,
            "stop_raw": decision.stop, "planner_notes": notes, "order_bodies": bodies,
            "order_link_id": first, "order_link_id_second_call": again, "same": first == again,
            "order_link_id_other_params": changed, "order_link_id_next_bar": next_bar,
        }
    else:
        print("no entry signal in these bars")

    (HERE / "order_demo.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {HERE / 'order_demo.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
