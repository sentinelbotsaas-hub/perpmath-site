import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article 1 (zh-hant/what-is-liquidation): same-day liquidation counts on BTCUSDT.

Question: over 365 complete UTC days, if you opened an isolated-margin
position at the daily open, on how many days would it have been liquidated
before the day ended?

    room            = 1 / leverage - MMR          (MMR = Bybit tier-1 maintenance margin)
    long liquidated   if (open - low)  / open >= room
    short liquidated  if (high - open) / open >= room

Three variants are computed:
  A. daily candles of the last traded price          (the headline table)
  B. daily candles of the mark price                  (what Bybit actually liquidates on)
  C. hourly candles, entry at every hour, held 24 h   (does the entry time matter?)

Usage:
    python research/liquidation_btcusdt.py            fetch from Bybit, save raw CSVs, compute
    python research/liquidation_btcusdt.py --offline  recompute from the saved CSVs

Output: research/data/*.csv (raw) and research/liquidation_btcusdt.json.
"""
import statistics

from bybit_public import (DAY_MS, HERE, HOUR_MS, RAW, get, iso, klines, ms, now_iso, read_csv,
                          read_json, write_csv, write_json)

SYMBOL = "BTCUSDT"
START = "2025-11-18"          # first UTC day, inclusive
END = "2026-11-18"            # exclusive: the last complete day is 2026-11-17
LEVERAGES = [2, 5, 10, 20, 50, 100]
OUT = HERE / "liquidation_btcusdt.json"
F_DAILY = RAW / "btcusdt-daily-last-price.csv"
F_MARK = RAW / "btcusdt-daily-mark-price.csv"
F_HOURLY = RAW / "btcusdt-60m-last-price.csv"
F_RISK = RAW / "btcusdt-risk-limit.json"


def fetch():
    start_ms, end_ms = ms(START), ms(END)
    risk = get("risk-limit", category="linear", symbol=SYMBOL)
    tiers = [row for row in risk["list"] if row["symbol"] == SYMBOL]
    write_json(F_RISK, {
        "source": "https://api.bybit.com/v5/market/risk-limit?category=linear&symbol=" + SYMBOL,
        "fetched_at": now_iso(), "tiers": tiers,
    })
    daily = klines("kline", SYMBOL, "D", start_ms, end_ms)
    write_csv(F_DAILY, ["open_time_ms", "date_utc", "open", "high", "low", "close", "volume", "turnover"],
              [[r[0], iso(int(r[0]), False)] + r[1:7] for r in daily])
    mark = klines("mark-price-kline", SYMBOL, "D", start_ms, end_ms)
    write_csv(F_MARK, ["open_time_ms", "date_utc", "open", "high", "low", "close"],
              [[r[0], iso(int(r[0]), False)] + r[1:5] for r in mark])
    hourly = klines("kline", SYMBOL, "60", start_ms, end_ms)
    write_csv(F_HOURLY, ["open_time_ms", "time_utc", "open", "high", "low", "close"],
              [[r[0], iso(int(r[0]))] + r[1:5] for r in hourly])


def pct(x, digits=4):
    return round(x * 100, digits)


def daily_table(rows, mmr):
    """rows: dicts with open/high/low. Returns per-leverage counts and move stats."""
    long_moves = [(float(r["open"]) - float(r["low"])) / float(r["open"]) for r in rows]
    short_moves = [(float(r["high"]) - float(r["open"])) / float(r["open"]) for r in rows]
    n = len(rows)
    table = []
    for lev in LEVERAGES:
        room = 1 / lev - mmr
        long_hit = [m >= room for m in long_moves]
        short_hit = [m >= room for m in short_moves]
        table.append({
            "leverage": lev,
            "room_pct": pct(room),
            "long_days": sum(long_hit),
            "long_share_pct": round(sum(long_hit) / n * 100, 2),
            "short_days": sum(short_hit),
            "short_share_pct": round(sum(short_hit) / n * 100, 2),
            "both_days": sum(a and b for a, b in zip(long_hit, short_hit)),
            "either_days": sum(a or b for a, b in zip(long_hit, short_hit)),
        })

    def stats(moves):
        worst = max(range(n), key=lambda i: moves[i])
        ordered = sorted(moves)
        return {
            "median_pct": pct(statistics.median(moves)),
            "mean_pct": pct(statistics.fmean(moves)),
            "p90_pct": pct(ordered[int(0.9 * n)]),
            "p99_pct": pct(ordered[int(0.99 * n)]),
            "max_pct": pct(moves[worst]),
            "max_date": rows[worst]["date_utc"],
            "max_open": float(rows[worst]["open"]),
            "max_extreme": float(rows[worst]["low" if moves is long_moves else "high"]),
        }

    return {"days": n, "table": table, "adverse_long": stats(long_moves), "adverse_short": stats(short_moves)}


def exact_formula_table(rows, mmr):
    """Same count with Bybit's published isolated-margin formula (no extra margin,
    tier 1, MM deduction 0) instead of the simplified room:

        liq price long  = entry x (1 - 1/L) / (1 - MMR)  ->  drop = (1/L - MMR) / (1 - MMR)
        liq price short = entry x (1 + 1/L) / (1 + MMR)  ->  rise = (1/L - MMR) / (1 + MMR)

    Source of the formula: Bybit help center, "Trading Rules: Liquidation Process
    (Unified Trading Account)", USDT Perpetual section.
    """
    table = []
    for lev in LEVERAGES:
        drop = (1 / lev - mmr) / (1 - mmr)
        rise = (1 / lev - mmr) / (1 + mmr)
        table.append({
            "leverage": lev,
            "long_distance_pct": pct(drop), "short_distance_pct": pct(rise),
            "long_days": sum((float(r["open"]) - float(r["low"])) / float(r["open"]) >= drop for r in rows),
            "short_days": sum((float(r["high"]) - float(r["open"])) / float(r["open"]) >= rise for r in rows),
        })
    return table


def details(daily, mark, mmr):
    """The individual days behind the headline counts."""
    def moves(r):
        o = float(r["open"])
        return (o - float(r["low"])) / o, (float(r["high"]) - o) / o

    out = {"days_liquidating_10x": [], "days_last_and_mark_price_disagree": [], "by_month": []}
    room_10 = 1 / 10 - mmr
    for r in daily:
        down, up = moves(r)
        if down >= room_10 or up >= room_10:
            out["days_liquidating_10x"].append({
                "date": r["date_utc"], "side": "long" if down >= room_10 else "short",
                "open": float(r["open"]), "high": float(r["high"]), "low": float(r["low"]),
                "adverse_move_pct": pct(max(down, up)),
            })
    for lev in LEVERAGES:
        room = 1 / lev - mmr
        for a, b in zip(daily, mark):
            for side, k in (("long", 0), ("short", 1)):
                if (moves(a)[k] >= room) != (moves(b)[k] >= room):
                    out["days_last_and_mark_price_disagree"].append({
                        "leverage": lev, "side": side, "date": a["date_utc"],
                        "last_price_move_pct": pct(moves(a)[k]), "mark_price_move_pct": pct(moves(b)[k]),
                    })
    months = {}
    for r in daily:
        down, up = moves(r)
        m = months.setdefault(r["date_utc"][:7], {"days": 0, "long_20x": 0, "short_20x": 0,
                                                  "long_50x": 0, "short_50x": 0})
        m["days"] += 1
        m["long_20x"] += down >= 1 / 20 - mmr
        m["short_20x"] += up >= 1 / 20 - mmr
        m["long_50x"] += down >= 1 / 50 - mmr
        m["short_50x"] += up >= 1 / 50 - mmr
    out["by_month"] = [{"month": k, **v} for k, v in sorted(months.items())]
    room_100 = 1 / 100 - mmr
    out["days_neither_side_liquidated_100x"] = sum(max(moves(r)) < room_100 for r in daily)
    ranges = sorted((float(r["high"]) - float(r["low"])) / float(r["open"]) for r in daily)
    out["daily_range_median_pct"] = pct(statistics.median(ranges))
    out["daily_range_min_pct"] = pct(ranges[0])
    last_close = float(daily[-1]["close"])
    out["room_in_usdt_at_last_close"] = [{
        "leverage": lev, "room_pct": pct(1 / lev - mmr),
        "usdt_per_btc": round(last_close * (1 / lev - mmr), 2),
    } for lev in LEVERAGES]
    out["last_close"] = last_close
    return out


def rolling_24h(hourly, mmr):
    """Entry at every hourly open, held for the next 24 hourly candles."""
    opens = [float(r["open"]) for r in hourly]
    highs = [float(r["high"]) for r in hourly]
    lows = [float(r["low"]) for r in hourly]
    entries = len(hourly) - 24 + 1
    long_moves, short_moves = [], []
    for i in range(entries):
        long_moves.append((opens[i] - min(lows[i:i + 24])) / opens[i])
        short_moves.append((max(highs[i:i + 24]) - opens[i]) / opens[i])
    table = []
    for lev in LEVERAGES:
        room = 1 / lev - mmr
        long_n = sum(m >= room for m in long_moves)
        short_n = sum(m >= room for m in short_moves)
        table.append({
            "leverage": lev,
            "long_entries": long_n, "long_share_pct": round(long_n / entries * 100, 2),
            "short_entries": short_n, "short_share_pct": round(short_n / entries * 100, 2),
        })
    # Share liquidated by the UTC hour of entry, 100x only: is 00:00 special?
    room_100 = 1 / 100 - mmr
    by_hour = []
    for hour in range(24):
        idx = [i for i in range(entries) if (int(hourly[i]["open_time_ms"]) // HOUR_MS) % 24 == hour]
        by_hour.append({
            "utc_hour": hour, "entries": len(idx),
            "long_share_pct": round(sum(long_moves[i] >= room_100 for i in idx) / len(idx) * 100, 2),
            "short_share_pct": round(sum(short_moves[i] >= room_100 for i in idx) / len(idx) * 100, 2),
        })
    return {
        "entries": entries,
        "first_entry": hourly[0]["time_utc"], "last_entry": hourly[entries - 1]["time_utc"],
        "table": table,
        "median_adverse_long_pct": pct(statistics.median(long_moves)),
        "median_adverse_short_pct": pct(statistics.median(short_moves)),
        "by_entry_hour_100x": by_hour,
    }


def how_fast(daily, hourly, mmr):
    """For days on which a 100x long from the daily open was liquidated: in which
    hour of the day did the hourly low first reach the liquidation distance?"""
    room = 1 / 100 - mmr
    by_day = {}
    for r in hourly:
        by_day.setdefault(int(r["open_time_ms"]) // DAY_MS, []).append(r)
    hours_long, hours_short = [], []
    for d in daily:
        candles = by_day[int(d["open_time_ms"]) // DAY_MS]
        entry = float(d["open"])
        for side, store in (("long", hours_long), ("short", hours_short)):
            for k, c in enumerate(candles):
                move = (entry - float(c["low"])) / entry if side == "long" else (float(c["high"]) - entry) / entry
                if move >= room:
                    store.append(k)
                    break

    def summary(hours):
        return {
            "days": len(hours),
            "median_hour_index": statistics.median(hours),
            "within_first_hour": sum(h == 0 for h in hours),
            "within_first_4_hours": sum(h < 4 for h in hours),
            "within_first_8_hours": sum(h < 8 for h in hours),
        }

    return {"note": "hour index 0 = the candle 00:00-00:59 UTC", "long_100x": summary(hours_long),
            "short_100x": summary(hours_short)}


def main():
    if "--offline" not in sys.argv:
        fetch()
    risk = read_json(F_RISK)
    tier1 = min(risk["tiers"], key=lambda t: float(t["riskLimitValue"]))
    mmr = float(tier1["maintenanceMargin"])
    daily, mark, hourly = read_csv(F_DAILY), read_csv(F_MARK), read_csv(F_HOURLY)

    last_price = daily_table(daily, mmr)
    mark_price = daily_table(mark, mmr)
    document = {
        "question": "Same-day liquidation of an isolated position opened at the daily open, BTCUSDT perpetual",
        "symbol": SYMBOL,
        "range_utc": {"first_day": daily[0]["date_utc"], "last_day": daily[-1]["date_utc"], "days": len(daily)},
        "fetched_at": risk["fetched_at"],
        "sources": {
            "daily_last_price": "https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=D",
            "daily_mark_price": "https://api.bybit.com/v5/market/mark-price-kline?category=linear&symbol=BTCUSDT&interval=D",
            "hourly_last_price": "https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=60",
            "risk_limit": risk["source"],
        },
        "tier1": {
            "risk_limit_value_usdt": float(tier1["riskLimitValue"]),
            "maintenance_margin_rate": mmr,
            "initial_margin_rate": float(tier1["initialMargin"]),
            "max_leverage": float(tier1["maxLeverage"]),
        },
        "rule": "room = 1/leverage - MMR; long liquidated if (open-low)/open >= room; "
                "short liquidated if (high-open)/open >= room. Fees and funding ignored.",
        "A_daily_last_price": last_price,
        "B_daily_mark_price": mark_price,
        "C_hourly_entry_24h_hold": rolling_24h(hourly, mmr),
        "D_hour_of_liquidation_100x": how_fast(daily, hourly, mmr),
        "E_exact_bybit_formula_last_price": exact_formula_table(daily, mmr),
        "E_exact_bybit_formula_mark_price": exact_formula_table(mark, mmr),
        "F_details": details(daily, mark, mmr),
        "period_price": {
            "first_open": float(daily[0]["open"]), "last_close": float(daily[-1]["close"]),
            "change_pct": pct(float(daily[-1]["close"]) / float(daily[0]["open"]) - 1, 2),
            "highest_high": max(float(r["high"]) for r in daily),
            "lowest_low": min(float(r["low"]) for r in daily),
            "up_days": sum(float(r["close"]) > float(r["open"]) for r in daily),
            "down_days": sum(float(r["close"]) < float(r["open"]) for r in daily),
        },
    }
    write_json(OUT, document)

    print(f"{SYMBOL} {document['range_utc']['first_day']} to {document['range_utc']['last_day']} "
          f"({len(daily)} days), tier-1 MMR {mmr}")
    print(f"{'lev':>4} {'room %':>8} {'long':>5} {'short':>6} {'both':>5} | mark: {'long':>5} {'short':>6}")
    for a, b in zip(last_price["table"], mark_price["table"]):
        print(f"{a['leverage']:>4} {a['room_pct']:>8.2f} {a['long_days']:>5} {a['short_days']:>6} "
              f"{a['both_days']:>5} |       {b['long_days']:>5} {b['short_days']:>6}")
    print("adverse long ", last_price["adverse_long"])
    print("adverse short", last_price["adverse_short"])
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
