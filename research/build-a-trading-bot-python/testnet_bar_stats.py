"""Volume and price facts about the saved testnet bars (``testnet_bars_15m.csv``).

Usage (from the site's root folder):

    python research/build-a-trading-bot-python/testnet_bar_stats.py

Reads the CSV that ``order_demo.py`` saved. No network. Standard library only.
"""

from __future__ import annotations

import csv
import io
import json
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = Path(__file__).parent


def iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    with open(HERE / "testnet_bars_15m.csv", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    volume = [float(r["volume"]) for r in rows]
    turnover = [float(r["turnover"]) for r in rows]
    flat = sum(1 for r in rows if float(r["high"]) == float(r["low"]))
    by_time = {int(r["open_time_ms"]): float(r["close"]) for r in rows}
    demo = json.loads((HERE / "order_demo.json").read_text(encoding="utf-8"))
    signal_ms = int(datetime.strptime(demo["latest_signal"]["bar"], "%Y-%m-%dT%H:%M:%SZ")
                    .replace(tzinfo=timezone.utc).timestamp() * 1000)
    last_ms = max(by_time)
    move = (by_time[last_ms] / by_time[signal_ms] - 1) * 100
    out = {
        "bars": len(rows),
        "first_bar": iso(min(by_time)), "last_bar": iso(last_ms),
        "median_volume_btc": round(statistics.median(volume), 4),
        "median_turnover_usdt": round(statistics.median(turnover), 2),
        "bars_with_zero_volume": sum(1 for v in volume if v == 0),
        "bars_with_high_equal_low": flat,
        "signal_bar": iso(signal_ms), "signal_bar_close": by_time[signal_ms],
        "last_bar_close": by_time[last_ms],
        "hours_between": round((last_ms - signal_ms) / 3_600_000, 2),
        "move_pct": round(move, 2),
    }
    (HERE / "testnet_bar_stats.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
    for key, value in out.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
